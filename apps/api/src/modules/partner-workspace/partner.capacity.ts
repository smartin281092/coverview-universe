import type { Pool, PoolClient } from "pg";
import {
  capacityInputSchema,
  capacityDossierSchema,
  capacityAdvisorAssessmentSchema,
  referentQuerySchema,
  type CapacityInput,
  type CapacityAdvisorAssessment,
  type PartnerApplication,
} from "@coverview/contracts/partner";
import {
  authorityCurrent,
  fail,
  lockActor,
  membership,
  professionalScope,
  type Executor,
  type PartnerActor,
  failOnConcurrentAbort,
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
  action: "declare" | "withdraw";
  position: "open" | "case_by_case" | "unavailable" | null;
  valid_until: Date | null;
  created_at: Date;
};
async function access(
  db: Executor,
  actor: PartnerActor,
  userId: string,
  action?: CapacityInput["action"],
) {
  if (actor.wallet || (actor.userId !== userId && (action || !actor.administrator)))
    fail("PARTNER_ACCESS_DENIED", 403);
  await db.query(
    `select user_id from partner_members where user_id=$1 ${action ? "for update" : "for share"}`,
    [userId],
  );
  const member = await membership(db, userId, true);
  if (!member) return fail("PARTNER_NOT_FOUND", 404);
  // Closing keeps personal withdrawal possible, but disallows new declarations and their replay.
  if (action === "declare" && member.state === "closed") fail("PARTNER_ACCESS_DENIED", 403);
  return member;
}
async function latest(db: Executor, userId: string) {
  return (
    await db.query<Row>(
      "select * from partner_capacity_declarations where user_id=$1 order by revision desc limit 1",
      [userId],
    )
  ).rows[0];
}
function declaration(row: Row, member: PartnerApplication, observedAt: Date) {
  return {
    revision: row.revision,
    professionalRevision: row.professional_revision,
    declaredName: row.declared_name,
    declaredOrganization: row.declared_organization,
    categories: row.categories,
    action: row.action,
    position: row.position,
    validUntil: row.valid_until?.toISOString() ?? null,
    status:
      row.action === "withdraw"
        ? "withdrawn"
        : professionalScope(row, member) !== "current"
          ? "scope_changed"
          : row.valid_until! <= observedAt
            ? "expired"
            : "declared",
    declaredAt: row.created_at.toISOString(),
    professionalScope: professionalScope(row, member),
  };
}
// Caller must authorize the personal audience and hold the member in the assessment snapshot.
export async function readCapacityAssessment(
  db: Executor,
  member: PartnerApplication | null,
  category: CapacityAdvisorAssessment["category"],
  assessedAt: string,
): Promise<CapacityAdvisorAssessment["capacity"]> {
  const row = member ? await latest(db, member.userId) : undefined;
  const current = row && member ? declaration(row, member, new Date(assessedAt)) : null;
  const status = !current
    ? "missing"
    : current.status !== "declared"
      ? current.status
      : current.categories.includes(category)
        ? "declared"
        : "category_not_covered";
  return capacityAdvisorAssessmentSchema.shape.capacity.parse({
    source: "personal_declaration",
    status,
    position: status === "declared" ? current!.position : null,
    declaration: current
      ? {
          revision: current.revision,
          professionalRevision: current.professionalRevision,
          categories: current.categories,
          professionalScope: current.professionalScope === "current" ? "current" : "changed",
          declaredAt: current.declaredAt,
          validUntil: current.validUntil,
        }
      : null,
    decision: "human_review_required",
  });
}
export async function readCapacityWorkload(db: Executor, userId: string, observedAt?: string) {
  // Count recorded open links across ALL categories, not eligibility, time or capacity.
  // EXISTS and the responsibility exclusion keep one Lead from inflating a bucket.
  const workload = (
    await db.query<{
      observed_at: Date;
      accepted: number;
      proposed: number;
      contributing: number;
    }>(
      `select coalesce($2::timestamptz,clock_timestamp()) observed_at,
    count(*) filter(where (l.responsible_id=$1 and ${authorityCurrent("l")}) and l.assignment='accepted')::int accepted,
    count(*) filter(where (l.responsible_id=$1 and ${authorityCurrent("l")}) and l.assignment='proposed')::int proposed,
    count(*) filter(where l.responsible_id is distinct from $1 and exists(
      select 1 from partner_contributors c where c.lead_id=l.id and c.user_id=$1
      and c.revoked_at is null and ${authorityCurrent("c")} and c.access_scope='advice' and c.can_edit))::int contributing
    from partner_leads l where l.stage not in ('draft','completed')
    and ((l.responsible_id=$1 and ${authorityCurrent("l")}) or exists(select 1 from partner_contributors c
      where c.lead_id=l.id and c.user_id=$1 and c.revoked_at is null and ${authorityCurrent("c")}
      and c.access_scope='advice' and c.can_edit))`,
      [userId, observedAt ?? null],
    )
  ).rows[0]!;
  return {
    observedAt: workload.observed_at.toISOString(),
    accepted: workload.accepted,
    proposed: workload.proposed,
    contributing: workload.contributing,
  };
}
async function dossier(db: Executor, actor: PartnerActor, userId: string, beforeRevision?: number) {
  const member = await access(db, actor, userId);
  const current = await latest(db, userId);
  const history = (
    await db.query<Row>(
      "select * from partner_capacity_declarations where user_id=$1 and ($2::int is null or revision<$2) order by revision desc limit 21",
      [userId, beforeRevision ?? null],
    )
  ).rows;
  const workload = await readCapacityWorkload(db, userId);
  const observedAt = new Date(workload.observedAt);
  return capacityDossierSchema.parse({
    userId,
    name: member.name,
    organization: member.organization,
    categories: member.categories,
    professionalRevision: member.professionalRevision,
    canDeclare: actor.userId === userId && member.state !== "closed",
    canWithdraw: actor.userId === userId && current?.action === "declare",
    activeAdvisor:
      member.state === "approved" &&
      member.organizationState === "approved" &&
      member.grantedRoles.includes("advisor") &&
      (!member.reviewDueAt || Date.parse(member.reviewDueAt) > observedAt.getTime()),
    workload,
    current: current ? declaration(current, member, observedAt) : null,
    history: history.slice(0, 20).map((row) => declaration(row, member, observedAt)),
    nextBeforeRevision: history.length > 20 ? history[19]!.revision : null,
  });
}
export function createCapacityOperations(pool: Pool, transaction: Mutation) {
  return {
    async capacity(actor: PartnerActor, userId: string, beforeRevision?: number) {
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
        failOnConcurrentAbort(cause);
        throw cause;
      } finally {
        tx.release();
      }
    },
    declareCapacity(actor: PartnerActor, userId: string, raw: CapacityInput, key: string) {
      const input = capacityInputSchema.parse(raw);
      return transaction(
        actor,
        `capacity:${userId}`,
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
          if (input.action === "withdraw" && previous?.action !== "declare")
            fail("PARTNER_ACTION_REQUIRED");
          if (input.action === "declare") {
            const valid = await tx.query<{ valid: boolean }>(
              "select $1::timestamptz > clock_timestamp() valid",
              [input.validUntil],
            );
            if (!valid.rows[0]?.valid) fail("PARTNER_ACTION_REQUIRED");
          }
          const id = newId("pcapacity");
          await tx.query(
            `insert into partner_capacity_declarations(id,user_id,organization_id,revision,professional_revision,declared_name,declared_organization,categories,action,position,valid_until)
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
              input.position,
              input.validUntil,
            ],
          );
          await event(
            tx,
            actor,
            null,
            input.action === "declare" ? "capacity.declared.v1" : "capacity.withdrawn.v1",
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
