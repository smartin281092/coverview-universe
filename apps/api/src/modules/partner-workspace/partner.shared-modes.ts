import type { Pool, PoolClient } from "pg";
import {
  sharedModesInputSchema,
  sharedModesDossierSchema,
  sharedModesSummarySchema,
  referentQuerySchema,
  type SharedModesInput,
  type PartnerApplication,
} from "@coverview/contracts/partner";
import {
  fail,
  lockActor,
  membership,
  professionalScope,
  type Executor,
  type PartnerActor,
} from "./partner.policy.js";
import { newId, event } from "./partner.audit.js";

type Mutation = <T>(
  actor: PartnerActor,
  operation: string,
  key: string,
  input: unknown,
  action: (tx: PoolClient) => Promise<string>,
  project: (tx: PoolClient, id: string) => Promise<T>,
) => Promise<T>;
type Row = {
  revision: number;
  professional_revision: number;
  organization_id: string;
  declared_name: string;
  declared_organization: string;
  categories: string[];
  action: "publish" | "withdraw";
  modes: string[];
  audience: string;
  created_at: Date;
};
async function access(
  db: Executor,
  actor: PartnerActor,
  userId: string,
  action?: SharedModesInput["action"],
) {
  if (actor.wallet || (actor.userId !== userId && (action || !actor.administrator)))
    fail("PARTNER_ACCESS_DENIED", 403);
  await db.query(
    `select user_id from partner_members where user_id=$1 ${action ? "for update" : "for share"}`,
    [userId],
  );
  const member = await membership(db, userId);
  if (!member) return fail("PARTNER_NOT_FOUND", 404);
  // A closed member can still stop sharing, but cannot publish or replay a publication.
  if (action === "publish" && member.state === "closed") fail("PARTNER_ACCESS_DENIED", 403);
  return member;
}
async function latest(db: Executor, userId: string) {
  return (
    await db.query<Row>(
      "select * from partner_shared_modes where user_id=$1 order by revision desc limit 1",
      [userId],
    )
  ).rows[0];
}
function declaration(row: Row, member: PartnerApplication) {
  return {
    revision: row.revision,
    professionalRevision: row.professional_revision,
    declaredName: row.declared_name,
    declaredOrganization: row.declared_organization,
    categories: row.categories,
    action: row.action,
    modes: row.modes,
    audience: row.audience,
    declaredAt: row.created_at.toISOString(),
    professionalScope: professionalScope(row, member),
  };
}
async function dossier(db: Executor, actor: PartnerActor, userId: string, beforeRevision?: number) {
  const member = await access(db, actor, userId);
  const current = await latest(db, userId);
  const history = (
    await db.query<Row>(
      "select * from partner_shared_modes where user_id=$1 and ($2::int is null or revision<$2) order by revision desc limit 21",
      [userId, beforeRevision ?? null],
    )
  ).rows;
  return sharedModesDossierSchema.parse({
    userId,
    name: member.name,
    organization: member.organization,
    categories: member.categories,
    professionalRevision: member.professionalRevision,
    canPublish: actor.userId === userId && member.state !== "closed",
    canWithdraw: actor.userId === userId && current?.action === "publish",
    current: current ? declaration(current, member) : null,
    history: history.slice(0, 20).map((row) => declaration(row, member)),
    nextBeforeRevision: history.length > 20 ? history[19]!.revision : null,
  });
}
// Only used after authorizing the Lead and its confirmed referent, in the assessment snapshot.
// This query never reads availability, its revisions, periods or any private source.
export async function readSharedModes(db: Executor, userId: string) {
  const row = (
    await db.query<
      Row & {
        current_revision: number;
        current_organization: string;
        current_name: string;
        current_organization_name: string;
      }
    >(
      `select d.*,m.professional_revision current_revision,m.organization_id current_organization,
    m.application->>'name' current_name,m.application->>'organization' current_organization_name
    from partner_members m join lateral (select * from partner_shared_modes where user_id=m.user_id order by revision desc limit 1) d on true
    where m.user_id=$1`,
      [userId],
    )
  ).rows[0];
  const current =
    row &&
    professionalScope(row, {
      professionalRevision: row.current_revision,
      organizationId: row.current_organization,
      name: row.current_name,
      organization: row.current_organization_name,
    }) === "current";
  const published = current && row.action === "publish";
  return sharedModesSummarySchema.parse({
    status: !row
      ? "missing"
      : row.action === "withdraw"
        ? "withdrawn"
        : current
          ? "declared"
          : "scope_changed",
    modes: published ? row.modes : [],
    declaredAt: published ? row.created_at.toISOString() : null,
  });
}
export function createSharedModesOperations(pool: Pool, transaction: Mutation) {
  return {
    async sharedModes(actor: PartnerActor, userId: string, beforeRevision?: number) {
      referentQuerySchema.parse(beforeRevision === undefined ? {} : { beforeRevision });
      const tx = await pool.connect();
      try {
        await tx.query("begin");
        await lockActor(tx, actor);
        const result = await dossier(tx, actor, userId, beforeRevision);
        await tx.query("commit");
        return result;
      } catch (cause) {
        await tx.query("rollback");
        throw cause;
      } finally {
        tx.release();
      }
    },
    declareSharedModes(actor: PartnerActor, userId: string, raw: SharedModesInput, key: string) {
      const input = sharedModesInputSchema.parse(raw);
      return transaction(
        actor,
        `shared-modes:${userId}`,
        key,
        input,
        async (tx) => {
          const member = await access(tx, actor, userId, input.action);
          const previous = await latest(tx, userId);
          if (
            input.revision !== (previous?.revision ?? 0) ||
            input.professionalRevision !== member.professionalRevision
          )
            fail("PARTNER_CONFLICT", 409);
          if (input.action === "withdraw" && previous?.action !== "publish")
            fail("PARTNER_ACTION_REQUIRED");
          const id = newId("psharedmode");
          await tx.query(
            `insert into partner_shared_modes(id,user_id,organization_id,revision,professional_revision,declared_name,declared_organization,categories,action,modes,audience)
          values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [
              id,
              userId,
              member.organizationId,
              input.revision + 1,
              input.professionalRevision,
              member.name,
              member.organization,
              [...new Set(member.categories)].sort(),
              input.action,
              [...input.modes].sort(),
              input.audience,
            ],
          );
          await event(
            tx,
            actor,
            null,
            input.action === "publish" ? "modes.shared.v1" : "modes.withdrawn.v1",
            "",
            "private",
            id,
          );
          return userId;
        },
        async (tx) => {
          await access(tx, actor, userId, input.action);
          return dossier(tx, actor, userId);
        },
      );
    },
  };
}
