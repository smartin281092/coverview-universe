import type { Pool, PoolClient } from "pg";
import {
  contestQueueSchema,
  evaluationContestDecisionSchema,
  evaluationContestInputSchema,
  evaluationSchema,
  profileDossierSchema,
  profileInputSchema,
  profileQueueSchema,
  profileReviewSchema,
  publicProfileSchema,
  referrerEvaluationSchema,
  type EvaluationContestDecision,
  type EvaluationContestInput,
  type ProfileInput,
  type ProfileReview,
} from "@coverview/contracts/partner-profiles";
import { leadCategorySchema } from "@coverview/contracts/partner";
import {
  fail,
  failOnConcurrentAbort,
  lockActor,
  membership,
  ownedClient,
  type Executor,
  type PartnerActor,
} from "./partner.policy.js";
import { readCompetenceSummary } from "./partner.competence.js";
import { readPracticeSummary } from "./partner.practice.js";
import { readCurrentAvailability } from "./partner.availability.js";
import { event, newId } from "./partner.audit.js";
import { queuePartnerProof } from "../document-intelligence/index.js";
import {
  chooseImage,
  imageMime,
  imageReady,
  imageView,
  readImage,
  requireImageMime,
} from "./partner.profile-images.js";
import { publishedLogoFile, publishedOrganization } from "./partner.organization-profiles.js";

type Mutation = <T>(
  actor: PartnerActor,
  operation: string,
  key: string,
  input: unknown,
  action: (tx: PoolClient) => Promise<string>,
  project: (tx: PoolClient, id: string) => Promise<T>,
) => Promise<T>;
type VersionRow = {
  id: string;
  revision: number;
  presentation: string;
  created_at: Date;
  decision: "published" | "rejected" | "withdrawn" | null;
  reason: string | null;
  decided_at: Date | null;
  photo_document_id: string | null;
  photo_checksum: string | null;
};

// Public client ratings need enough observations; below this, no average is shown.
const ratingMinimum = 5;
const periodMs = 365 * 86_400_000;

function period(now: Date) {
  return { from: new Date(now.getTime() - periodMs), to: now };
}

async function versions(db: Executor, userId: string, limit = 21) {
  return (
    await db.query<VersionRow>(
      `select v.id,v.revision,v.presentation,v.created_at,v.photo_document_id,v.photo_checksum,
      r.decision,r.reason,r.created_at decided_at
      from partner_profile_versions v
      left join lateral (select decision,reason,created_at from partner_profile_reviews where version_id=v.id order by created_at desc limit 1) r on true
      where v.user_id=$1 order by v.revision desc limit $2`,
      [userId, limit],
    )
  ).rows;
}
// The photo of a version is uploaded and retried by the person while the version awaits review.
async function project(db: Executor, row: VersionRow, writable = false) {
  return {
    revision: row.revision,
    presentation: row.presentation,
    status: row.decision ?? ("submitted" as const),
    submittedAt: row.created_at.toISOString(),
    decidedAt: row.decided_at?.toISOString() ?? null,
    decisionReason: row.reason,
    photo: imageView(await readImage(db, row.photo_document_id), writable && row.decision === null),
  };
}

// Client experience over a rolling year, from surveys attributed when they were created.
async function ratings(db: Executor, userId: string, from: Date, to: Date) {
  return (
    await db.query<{ rating: number; positives: string[]; improvements: string[] }>(
      `select (r.response->>'rating')::int rating,
        coalesce((select array_agg(p) from jsonb_array_elements_text(r.response->'positives') p),'{}') positives,
        coalesce((select array_agg(p) from jsonb_array_elements_text(r.response->'improvements') p),'{}') improvements
      from partner_survey_responses r join partner_surveys s on s.id=r.survey_id
      join partner_survey_attributions a on a.survey_id=s.id
      where a.advisor_id=$1 and s.invalidated_at is null and r.created_at>=$2 and r.created_at<$3
      and not exists(select 1 from partner_evaluation_contests c where c.subject_kind='survey' and c.subject_id=s.id and c.decision='accepted')
      limit 10000`,
      [userId, from.toISOString(), to.toISOString()],
    )
  ).rows;
}
function publicRating(rows: { rating: number }[], from: Date, to: Date) {
  const count = rows.length;
  const average = count
    ? Math.round((rows.reduce((sum, r) => sum + r.rating, 0) / count) * 10) / 10
    : null;
  return {
    status: count >= ratingMinimum ? ("available" as const) : ("insufficient" as const),
    average: count >= ratingMinimum ? average : null,
    count,
    minimum: ratingMinimum,
    periodFrom: from.toISOString(),
    periodTo: to.toISOString(),
    method: "client-surveys-12m-v1" as const,
  };
}

async function published(db: Executor, userId: string, now: Date) {
  // The latest publication decision wins; a withdrawal hides the profile entirely.
  const row = (
    await db.query<{
      presentation: string;
      created_at: Date;
      decision: string;
      photo_document_id: string | null;
      photo_checksum: string | null;
    }>(
      `select v.presentation,v.photo_document_id,v.photo_checksum,r.created_at,r.decision from partner_profile_reviews r
      join partner_profile_versions v on v.id=r.version_id
      where v.user_id=$1 and r.decision in ('published','withdrawn') order by r.created_at desc limit 1`,
      [userId],
    )
  ).rows[0];
  if (!row || row.decision !== "published") return null;
  // A photo appears only while its file stays the exact, scanned image that was published.
  const photo = await readImage(db, row.photo_document_id);
  const member = await membership(db, userId);
  if (!member) return null;
  const specialties = [];
  for (const category of member.categories) {
    const status = (await readCompetenceSummary(db, userId, category)).status;
    if (status === "reviewed" || status === "limited")
      specialties.push(leadCategorySchema.parse(category));
  }
  const practice = await readPracticeSummary(db, userId);
  const availability = await readCurrentAvailability(db, member);
  const { from, to } = period(now);
  return publicProfileSchema.parse({
    userId,
    name: member.name,
    organization: member.organization,
    presentation: row.presentation,
    specialties,
    languages: practice.status === "declared" ? practice.languageCodes : [],
    cantons: practice.status === "declared" ? practice.cantons : [],
    modes: availability?.professionalScope === "current" ? availability.modes : [],
    publishedAt: row.created_at.toISOString(),
    rating: publicRating(await ratings(db, userId, from, to), from, to),
    photo:
      imageReady(photo, "partner_profile_photo", row.photo_checksum) && imageMime(photo)
        ? { mime: imageMime(photo) }
        : null,
    organizationProfile: await publishedOrganization(db, member.organizationId),
  });
}
/** The file of the published photo, for an audience allowed to see the profile (C8c). */
async function publishedPhoto(db: Executor, userId: string) {
  const row = (
    await db.query<{
      photo_document_id: string | null;
      photo_checksum: string | null;
      decision: string;
    }>(
      `select v.photo_document_id,v.photo_checksum,r.decision from partner_profile_reviews r
      join partner_profile_versions v on v.id=r.version_id
      where v.user_id=$1 and r.decision in ('published','withdrawn') order by r.created_at desc limit 1`,
      [userId],
    )
  ).rows[0];
  if (row?.decision !== "published") return null;
  const file = await readImage(db, row.photo_document_id);
  return imageReady(file, "partner_profile_photo", row.photo_checksum) ? file : null;
}

async function self(db: Executor, actor: PartnerActor, userId: string, lock = false) {
  if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
  if (!actor.administrator && actor.userId !== userId) fail("PARTNER_ACCESS_DENIED", 403);
  const member = await membership(db, userId, lock);
  if (!member) fail("PARTNER_NOT_FOUND", 404);
  return member;
}

// Wallet sees a published profile only for people serving one of its own requests.
async function audience(db: Executor, actor: PartnerActor, userId: string) {
  if (actor.administrator && !actor.wallet) return true;
  if (actor.wallet) {
    return !!(
      await db.query(
        `select 1 from partner_leads l where (${ownedClient}) and l.stage<>'draft' and (l.responsible_id=$2
        or exists(select 1 from partner_contributors c where c.lead_id=l.id and c.user_id=$2 and c.revoked_at is null and c.can_contact))
        limit 1`,
        [actor.userId, userId],
      )
    ).rowCount;
  }
  const viewer = await membership(db, actor.userId);
  return (
    !!viewer &&
    viewer.state === "approved" &&
    viewer.organizationState === "approved" &&
    (!viewer.reviewDueAt || Date.parse(viewer.reviewDueAt) > Date.now())
  );
}

async function evaluationFor(db: Executor, actor: PartnerActor, userId: string, now: Date) {
  const member = await self(db, actor, userId);
  const { from, to } = period(now);
  const rows = await ratings(db, userId, from, to);
  const distribution = [1, 2, 3, 4, 5].map((n) => rows.filter((r) => r.rating === n).length);
  const tally = (values: string[]) =>
    [...values.reduce((map, v) => map.set(v, (map.get(v) ?? 0) + 1), new Map<string, number>())]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([key, count]) => ({ key, count }));
  const operational = (
    await db.query<{
      assigned: number;
      escalated: number;
      complaints: number;
      closed: number;
      active: number;
      followed: number;
    }>(
      `with assigned as (
        select distinct lead_id from partner_events where kind='lead.assigned' and subject_id=$1 and created_at>=$2 and created_at<$3
      ), escalated as (
        select distinct e.lead_id from partner_events e join assigned a on a.lead_id=e.lead_id
        where e.subject_id=$1 and e.kind in ('lead.continuity_escalated','lead.reassigned_automatically') and e.created_at>=$2
      ), complaints as (
        select q.id from partner_quality_cases q join partner_leads l on l.id=q.lead_id
        left join partner_survey_attributions a on a.survey_id=q.survey_id
        where q.kind='complaint' and q.invalidated_at is null and q.created_at>=$2 and q.created_at<$3
        and coalesce(a.advisor_id,l.responsible_id)=$1
        and not exists(select 1 from partner_evaluation_contests c where c.subject_kind='quality_case' and c.subject_id=q.id and c.decision='accepted')
      )
      select (select count(*) from assigned)::int assigned,(select count(*) from escalated)::int escalated,
        (select count(*) from complaints)::int complaints,
        (select count(*) from complaints c where (select a.input->>'action' from partner_quality_actions a where a.case_id=c.id and a.input->>'action'<>'reply' order by a.revision desc limit 1)='close')::int closed,
        (select count(*) from partner_leads where responsible_id=$1 and stage not in ('draft','completed'))::int active,
        (select count(*) from partner_leads where responsible_id=$1 and stage not in ('draft','completed') and first_useful_at is not null and due_at is not null and due_at>=$3::timestamptz-interval '1 day')::int followed`,
      [userId, from.toISOString(), to.toISOString()],
    )
  ).rows[0]!;
  const economic = (
    await db.query<{ cases: number; disputed: number; clawbacks: number }>(
      `select count(distinct c.id)::int cases,
        count(e.id) filter(where e.entry->>'kind'='dispute')::int disputed,
        count(e.id) filter(where e.entry->>'kind'='clawback')::int clawbacks
      from partner_economy_cases c join partner_market_reservations r on r.id=c.agreement_id
      left join partner_economy_entries e on e.case_id=c.id
      where (r.target_id=$1 or r.publisher_id=$1) and c.created_at>=$2 and c.created_at<$3`,
      [userId, from.toISOString(), to.toISOString()],
    )
  ).rows[0]!;
  const contests = (
    await db.query<{
      id: string;
      subject_kind: "survey" | "quality_case";
      subject_id: string;
      reason: string;
      decision: "accepted" | "rejected" | null;
      decision_reason: string | null;
      decided_at: Date | null;
      created_at: Date;
    }>(
      "select * from partner_evaluation_contests where user_id=$1 order by created_at desc,id desc limit 20",
      [userId],
    )
  ).rows;
  const contestable = (
    await db.query<{
      kind: "survey" | "quality_case";
      id: string;
      title: string;
      at: Date;
      rating: number | null;
    }>(
      `(select 'survey' kind,s.id,l.title,r.created_at at,(r.response->>'rating')::int rating
        from partner_survey_responses r join partner_surveys s on s.id=r.survey_id
        join partner_survey_attributions a on a.survey_id=s.id join partner_leads l on l.id=s.lead_id
        where a.advisor_id=$1 and s.invalidated_at is null and r.created_at>=$2)
      union all
      (select 'quality_case',q.id,l.title,q.created_at,null from partner_quality_cases q join partner_leads l on l.id=q.lead_id
        left join partner_survey_attributions a on a.survey_id=q.survey_id
        where q.kind='complaint' and q.invalidated_at is null and q.created_at>=$2 and coalesce(a.advisor_id,l.responsible_id)=$1)
      order by at desc,id desc limit 20`,
      [userId, from.toISOString()],
    )
  ).rows;
  return evaluationSchema.parse({
    userId,
    name: member.name,
    periodFrom: from.toISOString(),
    periodTo: to.toISOString(),
    clientExperience: {
      rating: publicRating(rows, from, to),
      distribution,
      positives: tally(rows.flatMap((r) => r.positives)),
      improvements: tally(rows.flatMap((r) => r.improvements)),
    },
    operational: {
      assigned: operational.assigned,
      onTime: Math.max(operational.assigned - operational.escalated, 0),
      onTimeRate: operational.assigned
        ? Math.round(
            (Math.max(operational.assigned - operational.escalated, 0) / operational.assigned) *
              100,
          )
        : null,
      complaints: operational.complaints,
      complaintsClosed: operational.closed,
      activeLeads: operational.active,
      followedUp: operational.followed,
    },
    economic,
    contests: contests.map((c) => ({
      id: c.id,
      subjectKind: c.subject_kind,
      subjectId: c.subject_id,
      reason: c.reason,
      status: c.decision ?? ("pending" as const),
      createdAt: c.created_at.toISOString(),
      decidedAt: c.decided_at?.toISOString() ?? null,
      decisionReason: c.decision_reason,
    })),
    contestable: contestable.map((c) => ({
      subjectKind: c.kind,
      subjectId: c.id,
      leadTitle: c.title,
      occurredAt: c.at.toISOString(),
      rating: c.rating,
    })),
    canContest: actor.userId === userId,
  });
}

export function createProfileOperations(
  pool: Pool,
  transaction: Mutation,
  documentsAvailable = true,
) {
  async function read<T>(actor: PartnerActor, action: (tx: PoolClient, now: Date) => Promise<T>) {
    const tx = await pool.connect();
    try {
      await tx.query("begin isolation level repeatable read");
      await lockActor(tx, actor);
      const now = (await tx.query<{ at: Date }>("select transaction_timestamp() at")).rows[0]!.at;
      const result = await action(tx, now);
      await lockActor(tx, actor);
      await tx.query("commit");
      return result;
    } catch (cause) {
      await tx.query("rollback");
      failOnConcurrentAbort(cause);
      throw cause;
    } finally {
      tx.release();
    }
  }
  async function dossier(db: Executor, actor: PartnerActor, userId: string, now: Date) {
    const member = await self(db, actor, userId);
    const rows = await versions(db, userId);
    const history = [];
    for (const row of rows.slice(0, 20)) history.push(await project(db, row));
    return profileDossierSchema.parse({
      userId,
      name: member.name,
      organization: member.organization,
      canEdit: actor.userId === userId && member.state === "approved",
      canReview:
        actor.administrator && actor.userId !== userId && !!rows[0] && rows[0].decision === null,
      current: rows[0]
        ? await project(db, rows[0], actor.userId === userId && documentsAvailable)
        : null,
      published: await published(db, userId, now),
      history,
    });
  }
  // The photo file of the latest version: written by the person while it awaits review, read by
  // the person or CoverView (C8c).
  async function versionPhoto(
    tx: PoolClient,
    actor: PartnerActor,
    userId: string,
    revision: number | null,
    write: boolean,
  ) {
    if (!documentsAvailable) fail("PARTNER_UNAVAILABLE", 503);
    await self(tx, actor, userId, write);
    const rows = await versions(tx, userId);
    const row = revision === null ? rows[0] : rows.find((r) => r.revision === revision);
    if (!row?.photo_document_id) fail("PARTNER_NOT_FOUND", 404);
    const file = await readImage(tx, row.photo_document_id, true);
    if (!file) return fail("PARTNER_NOT_FOUND", 404);
    if (write) {
      if (actor.userId !== userId || row !== rows[0] || row.decision !== null)
        fail("PARTNER_ACCESS_DENIED", 403);
      if (file.user_id !== userId) fail("PARTNER_ACCESS_DENIED", 403);
    } else if (!file.scan_version || !["ready", "failed"].includes(file.state))
      fail("PARTNER_INVALID_DOCUMENT");
    return { userId: file.user_id, documentId: file.id, revision: file.revision };
  }
  return {
    profileDossier: (actor: PartnerActor, userId: string) =>
      read(actor, (tx, now) => dossier(tx, actor, userId, now)),
    publicProfile: (actor: PartnerActor, userId: string) =>
      read(actor, async (tx, now) => {
        // Absence and refusal look the same: a profile's existence is never revealed otherwise.
        if (!(await audience(tx, actor, userId))) fail("PARTNER_NOT_FOUND", 404);
        const profile = await published(tx, userId, now);
        if (!profile) fail("PARTNER_NOT_FOUND", 404);
        return profile;
      }),
    submitProfile(actor: PartnerActor, userId: string, raw: ProfileInput, key: string) {
      const input = profileInputSchema.parse(raw);
      return transaction(
        actor,
        `profile:${userId}:submit`,
        key,
        input,
        async (tx) => {
          if (actor.wallet || actor.userId !== userId) fail("PARTNER_ACCESS_DENIED", 403);
          const member = await self(tx, actor, userId, true);
          if (member.state !== "approved" || member.organizationState !== "approved")
            fail("PARTNER_ACCESS_DENIED", 403);
          const current = (await versions(tx, userId, 1))[0];
          if ((current?.revision ?? 0) !== input.revision) fail("PARTNER_CONFLICT", 409);
          const photo = await chooseImage(
            tx,
            userId,
            input.photo,
            current
              ? { documentId: current.photo_document_id, checksum: current.photo_checksum }
              : null,
            "partner_profile_photo",
            documentsAvailable,
          );
          const id = newId("pprof");
          await tx.query(
            `insert into partner_profile_versions(id,user_id,organization_id,revision,professional_revision,declared_name,declared_organization,presentation,photo_document_id,photo_checksum)
            values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [
              id,
              userId,
              member.organizationId,
              input.revision + 1,
              member.professionalRevision,
              member.name,
              member.organization,
              input.presentation,
              photo.documentId,
              photo.checksum,
            ],
          );
          await event(tx, actor, null, "profile.submitted.v1", "", "coverview", userId);
          return userId;
        },
        async (tx) => dossier(tx, actor, userId, new Date()),
      );
    },
    reviewProfile(actor: PartnerActor, userId: string, raw: ProfileReview, key: string) {
      const input = profileReviewSchema.parse(raw);
      return transaction(
        actor,
        `profile:${userId}:review`,
        key,
        input,
        async (tx) => {
          if (!actor.administrator || actor.wallet || actor.userId === userId)
            fail("PARTNER_ACCESS_DENIED", 403);
          await membership(tx, userId, true);
          const current = (await versions(tx, userId, 1))[0];
          if (!current || current.revision !== input.revision || current.decision !== null)
            fail("PARTNER_CONFLICT", 409);
          // A photo is published only once scanned and found clean (C8c).
          if (
            input.decision === "published" &&
            current.photo_document_id &&
            !imageReady(
              await readImage(tx, current.photo_document_id, true),
              "partner_profile_photo",
              current.photo_checksum,
            )
          )
            fail("PARTNER_ACTION_REQUIRED");
          await tx.query(
            "insert into partner_profile_reviews(id,version_id,decision,reason,decided_by) values($1,$2,$3,$4,$5)",
            [newId("pprev"), current.id, input.decision, input.reason, actor.userId],
          );
          await event(tx, actor, null, `profile.${input.decision}.v1`, "", "coverview", userId);
          return userId;
        },
        async (tx) => dossier(tx, actor, userId, new Date()),
      );
    },
    withdrawProfile(actor: PartnerActor, userId: string, reason: string, key: string) {
      const input = profileReviewSchema.shape.reason.parse(reason);
      return transaction(
        actor,
        `profile:${userId}:withdraw`,
        key,
        { reason: input },
        async (tx) => {
          if (actor.wallet || actor.userId !== userId) fail("PARTNER_ACCESS_DENIED", 403);
          await self(tx, actor, userId, true);
          const row = (
            await tx.query<{ version_id: string; decision: string }>(
              `select r.version_id,r.decision from partner_profile_reviews r join partner_profile_versions v on v.id=r.version_id
              where v.user_id=$1 and r.decision in ('published','withdrawn') order by r.created_at desc limit 1`,
              [userId],
            )
          ).rows[0];
          if (row?.decision !== "published") fail("PARTNER_INVALID_TRANSITION");
          await tx.query(
            "insert into partner_profile_reviews(id,version_id,decision,reason,decided_by) values($1,$2,'withdrawn',$3,$4)",
            [newId("pprev"), row.version_id, input, actor.userId],
          );
          await event(tx, actor, null, "profile.withdrawn.v1", "", "coverview", userId);
          return userId;
        },
        async (tx) => dossier(tx, actor, userId, new Date()),
      );
    },
    // Photo files (C8c): upload and retry by the person, reading by the person or CoverView,
    // and the published photo for the audience of the profile.
    profilePhotoSource: (
      actor: PartnerActor,
      userId: string,
      revision: number | null,
      write = false,
    ) => read(actor, (tx) => versionPhoto(tx, actor, userId, revision, write)),
    completeProfilePhotoUpload: (actor: PartnerActor, userId: string, mime: string) =>
      read(actor, async (tx, now) => {
        requireImageMime(mime);
        const photo = await versionPhoto(tx, actor, userId, null, true);
        await queuePartnerProof(tx, userId, photo.documentId, { mime }, "partner_profile_photo");
        return dossier(tx, actor, userId, now);
      }),
    retryProfilePhoto(actor: PartnerActor, userId: string, revision: number, key: string) {
      return transaction(
        actor,
        `profile:${userId}:photo_retry`,
        key,
        { revision },
        async (tx) => {
          const photo = await versionPhoto(tx, actor, userId, null, true);
          await queuePartnerProof(
            tx,
            userId,
            photo.documentId,
            { revision },
            "partner_profile_photo",
          );
          return userId;
        },
        async (tx) => dossier(tx, actor, userId, new Date()),
      );
    },
    publishedPhotoSource: (actor: PartnerActor, userId: string) =>
      read(actor, async (tx) => {
        if (!documentsAvailable) fail("PARTNER_UNAVAILABLE", 503);
        // Absence and refusal look the same, as for the profile itself.
        if (!(await audience(tx, actor, userId))) fail("PARTNER_NOT_FOUND", 404);
        const file = await publishedPhoto(tx, userId);
        if (!file) return fail("PARTNER_NOT_FOUND", 404);
        return { userId: file.user_id, documentId: file.id };
      }),
    // The logo of the organisation shown with a published profile, for the same audience.
    publishedLogoSource: (actor: PartnerActor, userId: string) =>
      read(actor, async (tx, now) => {
        if (!documentsAvailable) fail("PARTNER_UNAVAILABLE", 503);
        if (!(await audience(tx, actor, userId))) fail("PARTNER_NOT_FOUND", 404);
        const profile = await published(tx, userId, now);
        const file = profile?.organizationProfile?.logo
          ? await publishedLogoFile(tx, profile.organizationProfile.organizationId)
          : null;
        if (!file) return fail("PARTNER_NOT_FOUND", 404);
        return { userId: file.user_id, documentId: file.id };
      }),
    profileQueue: (actor: PartnerActor) =>
      read(actor, async (tx) => {
        if (!actor.administrator || actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
        const rows = (
          await tx.query<{
            user_id: string;
            name: string;
            organization: string;
            revision: number;
            created_at: Date;
          }>(
            `select v.user_id,v.declared_name name,v.declared_organization organization,v.revision,v.created_at
            from partner_profile_versions v
            where v.revision=(select max(revision) from partner_profile_versions x where x.user_id=v.user_id)
            and not exists(select 1 from partner_profile_reviews r where r.version_id=v.id)
            order by v.created_at,v.user_id limit 50`,
          )
        ).rows;
        return profileQueueSchema.parse({
          items: rows.map((r) => ({
            userId: r.user_id,
            name: r.name,
            organization: r.organization,
            revision: r.revision,
            submittedAt: r.created_at.toISOString(),
          })),
        });
      }),
    evaluation: (actor: PartnerActor, userId: string) =>
      read(actor, (tx, now) => evaluationFor(tx, actor, userId, now)),
    contestEvaluation(
      actor: PartnerActor,
      userId: string,
      raw: EvaluationContestInput,
      key: string,
    ) {
      const input = evaluationContestInputSchema.parse(raw);
      return transaction(
        actor,
        `evaluation:${userId}:contest`,
        key,
        input,
        async (tx) => {
          if (actor.wallet || actor.userId !== userId) fail("PARTNER_ACCESS_DENIED", 403);
          await self(tx, actor, userId, true);
          const attributed =
            input.subjectKind === "survey"
              ? await tx.query(
                  "select 1 from partner_survey_attributions where survey_id=$1 and advisor_id=$2",
                  [input.subjectId, userId],
                )
              : await tx.query(
                  `select 1 from partner_quality_cases q join partner_leads l on l.id=q.lead_id
                  left join partner_survey_attributions a on a.survey_id=q.survey_id
                  where q.id=$1 and q.kind='complaint' and coalesce(a.advisor_id,l.responsible_id)=$2`,
                  [input.subjectId, userId],
                );
          if (!attributed.rowCount) fail("PARTNER_NOT_FOUND", 404);
          const id = newId("pcont");
          await tx.query(
            "insert into partner_evaluation_contests(id,user_id,subject_kind,subject_id,reason) values($1,$2,$3,$4,$5)",
            [id, userId, input.subjectKind, input.subjectId, input.reason],
          );
          await event(tx, actor, null, "evaluation.contested.v1", "", "coverview", userId);
          return userId;
        },
        async (tx) => evaluationFor(tx, actor, userId, new Date()),
      );
    },
    decideContest(
      actor: PartnerActor,
      contestId: string,
      raw: EvaluationContestDecision,
      key: string,
    ) {
      const input = evaluationContestDecisionSchema.parse(raw);
      return transaction(
        actor,
        `evaluation-contest:${contestId}:decide`,
        key,
        input,
        async (tx) => {
          if (!actor.administrator || actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
          const contest = (
            await tx.query<{ user_id: string; decision: string | null }>(
              "select user_id,decision from partner_evaluation_contests where id=$1 for update",
              [contestId],
            )
          ).rows[0];
          if (!contest) fail("PARTNER_NOT_FOUND", 404);
          if (contest.decision !== null || contest.user_id === actor.userId)
            fail("PARTNER_CONFLICT", 409);
          await tx.query(
            "update partner_evaluation_contests set decision=$2,decision_reason=$3,decided_by=$4,decided_at=clock_timestamp() where id=$1",
            [contestId, input.decision, input.reason, actor.userId],
          );
          await event(
            tx,
            actor,
            null,
            `evaluation.contest_${input.decision}.v1`,
            "",
            "coverview",
            contest.user_id,
          );
          return contest.user_id;
        },
        async (tx, userId) => evaluationFor(tx, actor, userId, new Date()),
      );
    },
    contestQueue: (actor: PartnerActor) =>
      read(actor, async (tx) => {
        if (!actor.administrator || actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
        const rows = (
          await tx.query<{
            id: string;
            user_id: string;
            name: string | null;
            subject_kind: "survey" | "quality_case";
            subject_id: string;
            reason: string;
            created_at: Date;
          }>(
            `select c.*,m.application->>'name' name from partner_evaluation_contests c
            left join partner_members m on m.user_id=c.user_id
            where c.decision is null order by c.created_at,c.id limit 50`,
          )
        ).rows;
        return contestQueueSchema.parse({
          items: rows.map((c) => ({
            id: c.id,
            userId: c.user_id,
            name: c.name ?? "",
            subjectKind: c.subject_kind,
            subjectId: c.subject_id,
            reason: c.reason,
            status: "pending" as const,
            createdAt: c.created_at.toISOString(),
            decidedAt: null,
            decisionReason: null,
          })),
        });
      }),
    referrerEvaluation: (actor: PartnerActor, userId: string) =>
      read(actor, async (tx, now) => {
        // An internal score stays open to the person it describes (R5, C7a).
        if (actor.wallet || (!actor.administrator && actor.userId !== userId))
          fail("PARTNER_ACCESS_DENIED", 403);
        const member = await membership(tx, userId);
        if (!member) fail("PARTNER_NOT_FOUND", 404);
        const { from, to } = period(now);
        const row = (
          await tx.query<{
            created: number;
            authorized: number;
            duplicates: number;
            invalid: number;
            changed: number;
          }>(
            `select count(*)::int created,
              count(*) filter(where l.details->>'transmissionAuthorized'='true')::int authorized,
              count(*) filter(where l.result='duplicate' or exists(select 1 from partner_lead_relationships r where r.source_lead_id=l.id and r.kind='duplicate' and r.withdrawn_at is null and r.invalidated_at is null))::int duplicates,
              count(*) filter(where l.result='invalid')::int invalid,
              count(*) filter(where exists(select 1 from partner_events e where e.lead_id=l.id and e.kind='lead.category_changed' and e.actor_id is distinct from $1))::int changed
            from partner_leads l where l.creator_id=$1 and l.created_at>=$2 and l.created_at<$3`,
            [userId, from.toISOString(), to.toISOString()],
          )
        ).rows[0]!;
        return referrerEvaluationSchema.parse({
          userId,
          name: member.name,
          organization: member.organization,
          periodFrom: from.toISOString(),
          periodTo: to.toISOString(),
          created: row.created,
          authorized: row.authorized,
          duplicates: row.duplicates,
          invalid: row.invalid,
          categoryChanged: row.changed,
        });
      }),
  };
}
