import type { Pool, PoolClient } from "pg";
import {
  organizationProfileDossierSchema,
  organizationProfileInputSchema,
  organizationProfileQueueSchema,
  profileReviewSchema,
  publicOrganizationSchema,
  type OrganizationProfileInput,
  type ProfileReview,
} from "@coverview/contracts/partner-profiles";
import { queuePartnerProof } from "../document-intelligence/index.js";
import {
  context,
  fail,
  failOnConcurrentAbort,
  lockActor,
  type Executor,
  type PartnerActor,
} from "./partner.policy.js";
import { event, newId } from "./partner.audit.js";
import {
  chooseImage,
  imageMime,
  imageReady,
  imageView,
  readImage,
  requireImageMime,
} from "./partner.profile-images.js";

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
  logo_document_id: string | null;
  logo_checksum: string | null;
  submitted_by: string;
  decision: "published" | "rejected" | "withdrawn" | null;
  reason: string | null;
  decided_at: Date | null;
};

// Organisation profile (C8c, brief I.18): written by a manager of the organisation, published
// after a CoverView review by someone outside it, shown with the profiles of its members.
async function versions(db: Executor, organizationId: string, limit = 21) {
  return (
    await db.query<VersionRow>(
      `select v.id,v.revision,v.presentation,v.created_at,v.logo_document_id,v.logo_checksum,v.submitted_by,
      r.decision,r.reason,r.created_at decided_at
      from partner_organization_profile_versions v
      left join lateral (select decision,reason,created_at from partner_organization_profile_reviews where version_id=v.id order by created_at desc limit 1) r on true
      where v.organization_id=$1 order by v.revision desc limit $2`,
      [organizationId, limit],
    )
  ).rows;
}
async function latestPublication(db: Executor, organizationId: string) {
  const row = (
    await db.query<{
      presentation: string;
      logo_document_id: string | null;
      logo_checksum: string | null;
      created_at: Date;
      decision: string;
      name: string;
    }>(
      `select v.presentation,v.logo_document_id,v.logo_checksum,r.created_at,r.decision,o.name
      from partner_organization_profile_reviews r
      join partner_organization_profile_versions v on v.id=r.version_id
      join partner_organizations o on o.id=v.organization_id
      where v.organization_id=$1 and r.decision in ('published','withdrawn') order by r.created_at desc limit 1`,
      [organizationId],
    )
  ).rows[0];
  return row?.decision === "published" ? row : null;
}
/** The published profile of an organisation that is still approved, or nothing. */
export async function publishedOrganization(db: Executor, organizationId: string) {
  const state = (
    await db.query<{ state: string }>("select state from partner_organizations where id=$1", [
      organizationId,
    ])
  ).rows[0]?.state;
  if (state !== "approved") return null;
  const row = await latestPublication(db, organizationId);
  if (!row) return null;
  const logo = await readImage(db, row.logo_document_id);
  return publicOrganizationSchema.parse({
    organizationId,
    name: row.name,
    presentation: row.presentation,
    logo:
      imageReady(logo, "partner_organization_logo", row.logo_checksum) && imageMime(logo)
        ? { mime: imageMime(logo) }
        : null,
    publishedAt: row.created_at.toISOString(),
  });
}
/** The file of the published logo, for an audience the caller already checked. */
export async function publishedLogoFile(db: Executor, organizationId: string) {
  if (!(await publishedOrganization(db, organizationId))) return null;
  const row = await latestPublication(db, organizationId);
  const file = await readImage(db, row?.logo_document_id ?? null);
  return imageReady(file, "partner_organization_logo", row?.logo_checksum ?? null) ? file : null;
}

// Who acts on an organisation profile: CoverView, or an operational manager of that organisation.
async function access(db: Executor, actor: PartnerActor, organizationId: string, lock = false) {
  if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
  const organization = (
    await db.query<{ name: string; state: string }>(
      `select name,state from partner_organizations where id=$1${lock ? " for update" : ""}`,
      [organizationId],
    )
  ).rows[0];
  if (!organization) return fail("PARTNER_NOT_FOUND", 404);
  const ctx = await context(db, { ...actor, administrator: false });
  const member = ctx.application?.organizationId === organizationId;
  const manager = member && ctx.operational && !!ctx.application?.grantedRoles.includes("manager");
  if (!actor.administrator && !manager) fail("PARTNER_ACCESS_DENIED", 403);
  return { organization, member, manager };
}

export function createOrganizationProfileOperations(
  pool: Pool,
  transaction: Mutation,
  documentsAvailable = true,
) {
  async function read<T>(actor: PartnerActor, action: (tx: PoolClient) => Promise<T>) {
    const tx = await pool.connect();
    try {
      await tx.query("begin isolation level repeatable read");
      await lockActor(tx, actor);
      const result = await action(tx);
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
  async function project(db: Executor, row: VersionRow, writable: boolean) {
    return {
      revision: row.revision,
      presentation: row.presentation,
      logo: imageView(await readImage(db, row.logo_document_id), writable && row.decision === null),
      status: row.decision ?? ("submitted" as const),
      submittedAt: row.created_at.toISOString(),
      decidedAt: row.decided_at?.toISOString() ?? null,
      decisionReason: row.reason,
    };
  }
  async function dossier(db: Executor, actor: PartnerActor, organizationId: string) {
    const { organization, member, manager } = await access(db, actor, organizationId);
    const rows = await versions(db, organizationId);
    const history = [];
    for (const row of rows.slice(0, 20)) history.push(await project(db, row, false));
    return organizationProfileDossierSchema.parse({
      organizationId,
      name: organization.name,
      canEdit: manager && organization.state === "approved",
      canReview: actor.administrator && !member && !!rows[0] && rows[0].decision === null,
      current: rows[0]
        ? await project(
            db,
            rows[0],
            manager && documentsAvailable && rows[0].submitted_by === actor.userId,
          )
        : null,
      published: await publishedOrganization(db, organizationId),
      history,
    });
  }
  // The logo file of the latest version: sent by the manager who submitted it while it awaits
  // review; read by the managers or CoverView.
  async function versionLogo(
    tx: PoolClient,
    actor: PartnerActor,
    organizationId: string,
    revision: number | null,
    write: boolean,
  ) {
    if (!documentsAvailable) fail("PARTNER_UNAVAILABLE", 503);
    const { manager } = await access(tx, actor, organizationId, write);
    const rows = await versions(tx, organizationId);
    const row = revision === null ? rows[0] : rows.find((r) => r.revision === revision);
    if (!row?.logo_document_id) fail("PARTNER_NOT_FOUND", 404);
    const file = await readImage(tx, row.logo_document_id, true);
    if (!file) return fail("PARTNER_NOT_FOUND", 404);
    if (write) {
      if (
        !manager ||
        row !== rows[0] ||
        row.decision !== null ||
        file.user_id !== actor.userId ||
        row.submitted_by !== actor.userId
      )
        fail("PARTNER_ACCESS_DENIED", 403);
    } else if (!file.scan_version || !["ready", "failed"].includes(file.state))
      fail("PARTNER_INVALID_DOCUMENT");
    return { userId: file.user_id, documentId: file.id };
  }
  return {
    organizationProfile: (actor: PartnerActor, organizationId: string) =>
      read(actor, (tx) => dossier(tx, actor, organizationId)),
    submitOrganizationProfile(
      actor: PartnerActor,
      organizationId: string,
      raw: OrganizationProfileInput,
      key: string,
    ) {
      const input = organizationProfileInputSchema.parse(raw);
      return transaction(
        actor,
        `organization_profile:${organizationId}:submit`,
        key,
        input,
        async (tx) => {
          const { organization, manager } = await access(tx, actor, organizationId, true);
          if (!manager || organization.state !== "approved") fail("PARTNER_ACCESS_DENIED", 403);
          const current = (await versions(tx, organizationId, 1))[0];
          if ((current?.revision ?? 0) !== input.revision) fail("PARTNER_CONFLICT", 409);
          const logo = await chooseImage(
            tx,
            actor.userId,
            input.logo,
            current
              ? { documentId: current.logo_document_id, checksum: current.logo_checksum }
              : null,
            "partner_organization_logo",
            documentsAvailable,
          );
          await tx.query(
            `insert into partner_organization_profile_versions(id,organization_id,revision,declared_name,presentation,logo_document_id,logo_checksum,submitted_by)
            values($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
              newId("porgp"),
              organizationId,
              input.revision + 1,
              organization.name,
              input.presentation,
              logo.documentId,
              logo.checksum,
              actor.userId,
            ],
          );
          await event(
            tx,
            actor,
            null,
            "organization_profile.submitted.v1",
            "",
            "coverview",
            organizationId,
          );
          return organizationId;
        },
        (tx) => dossier(tx, actor, organizationId),
      );
    },
    withdrawOrganizationProfile(
      actor: PartnerActor,
      organizationId: string,
      reason: string,
      key: string,
    ) {
      const input = profileReviewSchema.shape.reason.parse(reason);
      return transaction(
        actor,
        `organization_profile:${organizationId}:withdraw`,
        key,
        { reason: input },
        async (tx) => {
          const { manager } = await access(tx, actor, organizationId, true);
          if (!manager) fail("PARTNER_ACCESS_DENIED", 403);
          const row = (
            await tx.query<{ version_id: string; decision: string }>(
              `select r.version_id,r.decision from partner_organization_profile_reviews r
              join partner_organization_profile_versions v on v.id=r.version_id
              where v.organization_id=$1 and r.decision in ('published','withdrawn') order by r.created_at desc limit 1`,
              [organizationId],
            )
          ).rows[0];
          if (row?.decision !== "published") fail("PARTNER_INVALID_TRANSITION");
          await tx.query(
            "insert into partner_organization_profile_reviews(id,version_id,decision,reason,decided_by) values($1,$2,'withdrawn',$3,$4)",
            [newId("porgr"), row.version_id, input, actor.userId],
          );
          await event(
            tx,
            actor,
            null,
            "organization_profile.withdrawn.v1",
            "",
            "coverview",
            organizationId,
          );
          return organizationId;
        },
        (tx) => dossier(tx, actor, organizationId),
      );
    },
    reviewOrganizationProfile(
      actor: PartnerActor,
      organizationId: string,
      raw: ProfileReview,
      key: string,
    ) {
      const input = profileReviewSchema.parse(raw);
      return transaction(
        actor,
        `organization_profile:${organizationId}:review`,
        key,
        input,
        async (tx) => {
          if (!actor.administrator) fail("PARTNER_ACCESS_DENIED", 403);
          const { member } = await access(tx, actor, organizationId, true);
          // Nobody reviews their own organisation.
          if (member) fail("PARTNER_ACCESS_DENIED", 403);
          const current = (await versions(tx, organizationId, 1))[0];
          if (!current || current.revision !== input.revision || current.decision !== null)
            fail("PARTNER_CONFLICT", 409);
          if (
            input.decision === "published" &&
            current.logo_document_id &&
            !imageReady(
              await readImage(tx, current.logo_document_id, true),
              "partner_organization_logo",
              current.logo_checksum,
            )
          )
            fail("PARTNER_ACTION_REQUIRED");
          await tx.query(
            "insert into partner_organization_profile_reviews(id,version_id,decision,reason,decided_by) values($1,$2,$3,$4,$5)",
            [newId("porgr"), current.id, input.decision, input.reason, actor.userId],
          );
          await event(
            tx,
            actor,
            null,
            `organization_profile.${input.decision}.v1`,
            "",
            "coverview",
            organizationId,
          );
          return organizationId;
        },
        (tx) => dossier(tx, actor, organizationId),
      );
    },
    organizationProfileQueue: (actor: PartnerActor) =>
      read(actor, async (tx) => {
        if (!actor.administrator || actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
        const rows = (
          await tx.query<{
            organization_id: string;
            name: string;
            revision: number;
            created_at: Date;
          }>(
            `select v.organization_id,o.name,v.revision,v.created_at
            from partner_organization_profile_versions v join partner_organizations o on o.id=v.organization_id
            where v.revision=(select max(revision) from partner_organization_profile_versions x where x.organization_id=v.organization_id)
            and not exists(select 1 from partner_organization_profile_reviews r where r.version_id=v.id)
            order by v.created_at,v.organization_id limit 50`,
          )
        ).rows;
        return organizationProfileQueueSchema.parse({
          items: rows.map((r) => ({
            organizationId: r.organization_id,
            name: r.name,
            revision: r.revision,
            submittedAt: r.created_at.toISOString(),
          })),
        });
      }),
    organizationLogoSource: (
      actor: PartnerActor,
      organizationId: string,
      revision: number | null,
      write = false,
    ) => read(actor, (tx) => versionLogo(tx, actor, organizationId, revision, write)),
    completeOrganizationLogoUpload: (actor: PartnerActor, organizationId: string, mime: string) =>
      read(actor, async (tx) => {
        requireImageMime(mime);
        const logo = await versionLogo(tx, actor, organizationId, null, true);
        await queuePartnerProof(
          tx,
          logo.userId,
          logo.documentId,
          { mime },
          "partner_organization_logo",
        );
        return dossier(tx, actor, organizationId);
      }),
    retryOrganizationLogo(
      actor: PartnerActor,
      organizationId: string,
      revision: number,
      key: string,
    ) {
      return transaction(
        actor,
        `organization_profile:${organizationId}:logo_retry`,
        key,
        { revision },
        async (tx) => {
          const logo = await versionLogo(tx, actor, organizationId, null, true);
          await queuePartnerProof(
            tx,
            logo.userId,
            logo.documentId,
            { revision },
            "partner_organization_logo",
          );
          return organizationId;
        },
        (tx) => dossier(tx, actor, organizationId),
      );
    },
  };
}
