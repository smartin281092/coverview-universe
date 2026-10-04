import {
  leadCategorySchema,
  referentProfileSchema,
  referentContinuitySchema,
  referentSelectionSchema,
  type ReferentUpdate,
} from "@coverview/contracts/partner";
import { fail, type Executor, type PartnerActor } from "./partner.policy.js";
import { newId, event } from "./partner.audit.js";
import { readCompetenceSummary } from "./partner.competence.js";

type Subject = {
  id: string;
  ownerId: string;
  profileId: string | null;
  revision: number;
  name: string;
};
type SelectionRow = {
  revision: number;
  advisor_id: string | null;
  confirmed_by: string;
  subject_revision: number;
  created_at: Date;
  name: string | null;
  organization: string | null;
  eligible: boolean;
};
const eligibility = `m.state='approved' and o.state='approved' and m.roles ? 'advisor'
  and (m.review_due_at is null or m.review_due_at>now()) and m.application->'categories' ? $2`;
const selectionSql = `select s.*,m.application->>'name' name,m.application->>'organization' organization,
  coalesce(${eligibility},false) eligible from partner_referent_selections s
  left join partner_members m on m.user_id=s.advisor_id left join partner_organizations o on o.id=m.organization_id`;
const advisor = (row: SelectionRow) =>
  row.advisor_id
    ? { id: row.advisor_id, name: row.name ?? "", organization: row.organization ?? "" }
    : null;

// Profile row lock also serializes transfers and concurrent category selections. Self cannot transfer.
async function subject(
  db: Executor,
  ownerId: string,
  profileId: string | null,
  write = false,
): Promise<Subject> {
  const row = profileId
    ? (
        await db.query<{ user_id: string; revision: number; name: string }>(
          `select user_id,revision,display_name name from managed_profiles where id=$1 ${write ? "for update" : "for share"}`,
          [profileId],
        )
      ).rows[0]
    : (
        await db.query<{ user_id: string; revision: number; name: string }>(
          `select user_id,0 revision,trim(concat_ws(' ',fields->'firstName'->>'value',fields->'lastName'->>'value')) name
       from identity_profiles where user_id=$1 ${write ? "for update" : "for share"}`,
          [ownerId],
        )
      ).rows[0];
  if (!row || row.user_id !== ownerId) return fail("PARTNER_NOT_FOUND", 404);
  return {
    id: profileId ? `profile:${profileId}` : `self:${ownerId}`,
    ownerId,
    profileId,
    revision: row.revision,
    name: row.name,
  };
}
async function walletSubject(db: Executor, actor: PartnerActor, profileId: string, write = false) {
  if (!actor.wallet || actor.administrator) fail("PARTNER_ACCESS_DENIED", 403);
  if (profileId !== "self" && !/^prf_[\w-]+$/u.test(profileId)) fail("PARTNER_NOT_FOUND", 404);
  return subject(db, actor.userId, profileId === "self" ? null : profileId, write);
}
async function latest(db: Executor, target: Subject, category: string) {
  return (
    await db.query<SelectionRow>(
      `${selectionSql} where s.subject_id=$1 and s.category=$2 order by s.revision desc limit 1`,
      [target.id, category],
    )
  ).rows[0];
}
function selection(target: Subject, row?: SelectionRow) {
  return referentSelectionSchema.parse({
    revision: row?.revision ?? 0,
    advisor: row ? advisor(row) : null,
    status: !row
      ? "unset"
      : row.confirmed_by !== target.ownerId || row.subject_revision !== target.revision
        ? "confirmation_required"
        : !row.advisor_id
          ? "coverview"
          : row.eligible
            ? "chosen"
            : "unavailable",
    confirmedAt: row?.created_at.toISOString() ?? null,
  });
}
async function candidates(db: Executor, target: Subject, category: string) {
  return (
    await db.query<{ id: string; name: string; organization: string }>(
      `select m.user_id id,m.application->>'name' name,m.application->>'organization' organization
     from partner_members m join partner_organizations o on o.id=m.organization_id
     where ${eligibility} and exists(select 1 from partner_leads l
       where l.responsible_id=m.user_id and l.assignment='accepted' and l.category=$2
       and (case when $3::text is null then l.client_profile_id is null and l.client_user_id=$1 else l.client_profile_id=$3 end))
     order by m.application->>'name',m.user_id limit 101`,
      [target.ownerId, category, target.profileId],
    )
  ).rows;
}
export async function readReferentProfile(
  db: Executor,
  actor: PartnerActor,
  profileId: string,
  category: string,
  beforeRevision?: number,
) {
  leadCategorySchema.parse(category);
  const target = await walletSubject(db, actor, profileId);
  const current = selection(target, await latest(db, target, category));
  const choices = await candidates(db, target, category);
  const rows = (
    await db.query<SelectionRow>(
      `${selectionSql}
    where s.subject_id=$1 and s.category=$2 and ($3::int is null or s.revision<$3)
    order by s.revision desc limit 21`,
      [target.id, category, beforeRevision ?? null],
    )
  ).rows;
  return referentProfileSchema.parse({
    profileId,
    profileRevision: target.revision,
    profileName: target.name,
    category,
    current,
    candidates: choices.slice(0, 100),
    candidatesTruncated: choices.length > 100,
    history: rows.slice(0, 20).map((row) => ({
      revision: row.revision,
      advisor: advisor(row),
      confirmedAt: row.created_at.toISOString(),
      currentOwnerConfirmation:
        row.confirmed_by === target.ownerId && row.subject_revision === target.revision,
    })),
    nextBeforeRevision: rows.length > 20 ? rows[19]!.revision : null,
  });
}
export async function updateReferent(
  db: Executor,
  actor: PartnerActor,
  profileId: string,
  category: string,
  input: ReferentUpdate,
) {
  leadCategorySchema.parse(category);
  const target = await walletSubject(db, actor, profileId, true);
  const previous = await latest(db, target, category);
  if (input.revision !== (previous?.revision ?? 0) || input.profileRevision !== target.revision)
    fail("PARTNER_CONFLICT", 409);
  if (input.advisorId) {
    // Approval changes are locked independently of a mere relationship preference.
    await db.query(
      `select m.user_id from partner_members m join partner_organizations o on o.id=m.organization_id where m.user_id=$1 for share of m,o`,
      [input.advisorId],
    );
    if (!(await candidates(db, target, category)).some((item) => item.id === input.advisorId))
      fail("PARTNER_ACCESS_DENIED", 403);
  }
  const id = newId("pref");
  await db.query(
    `insert into partner_referent_selections(id,subject_id,self_user_id,profile_id,subject_revision,category,revision,advisor_id,confirmed_by)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id,
      target.id,
      target.profileId ? null : target.ownerId,
      target.profileId,
      target.revision,
      category,
      input.revision + 1,
      input.advisorId,
      actor.userId,
    ],
  );
  // The relation has its own immutable history; no Lead clock or audience is changed.
  await event(db, actor, null, "referent.selected.v1", "", "private", id);
  return profileId;
}
export async function readReferentContinuity(
  db: Executor,
  lead: {
    id: string;
    clientUserId: string | null;
    clientProfileId: string | null;
    category: string;
    stage: string;
  },
) {
  if (!lead.clientUserId) return null;
  const target = await subject(db, lead.clientUserId, lead.clientProfileId);
  const current = selection(target, await latest(db, target, lead.category));
  const changeRequested = (
    await db.query(
      `select id from partner_notifications
    where lead_id=$1 and kind='interlocutor_request' and resolved_at is null limit 1`,
      [lead.id],
    )
  ).rowCount;
  const status =
    lead.stage === "completed"
      ? "closed"
      : changeRequested
        ? "client_change_requested"
        : "human_review";
  const competence = await readCompetenceSummary(db, current.advisor?.id ?? null, lead.category);
  return referentContinuitySchema.parse({
    competence,
    selection: current,
    status,
    suggestion: status === "human_review" && current.status === "chosen" ? current.advisor : null,
    missingChecks: [
      ...(competence.status === "reviewed" ? [] : ["competence"]),
      "conventions",
      "language",
      "region",
      "availability",
      "conflicts",
      "preferences",
    ],
  });
}
