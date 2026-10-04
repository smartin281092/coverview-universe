import type { Pool, PoolClient } from "pg";
import {
  professionalAvailabilityInputSchema,
  professionalAvailabilityDossierSchema,
  referentQuerySchema,
  type ProfessionalAvailabilityInput,
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
  id: string;
  modes: string[];
  timezone: string;
  periods: { kind: string; startsAt: string; endsAt: string }[];
  created_at: Date;
};
async function access(db: Executor, actor: PartnerActor, userId: string, write = false) {
  if (actor.wallet || (actor.userId !== userId && (write || !actor.administrator)))
    fail("PARTNER_ACCESS_DENIED", 403);
  await db.query(
    `select user_id from partner_members where user_id=$1 ${write ? "for update" : "for share"}`,
    [userId],
  );
  const member = await membership(db, userId);
  if (!member) return fail("PARTNER_NOT_FOUND", 404);
  if (write && member.state === "closed") fail("PARTNER_ACCESS_DENIED", 403);
  return member;
}
const projection = `select d.*,coalesce((select jsonb_agg(jsonb_build_object('kind',p.kind,'startsAt',p.starts_at,'endsAt',p.ends_at) order by p.position) from partner_availability_periods p where p.declaration_id=d.id),'[]'::jsonb) periods from partner_availability_declarations d`;
async function latest(db: Executor, userId: string) {
  return (
    await db.query<Row>(`${projection} where user_id=$1 order by revision desc limit 1`, [userId])
  ).rows[0];
}
function declaration(row: Row, member: PartnerApplication) {
  return {
    revision: row.revision,
    professionalRevision: row.professional_revision,
    declaredName: row.declared_name,
    declaredOrganization: row.declared_organization,
    modes: row.modes,
    timezone: row.timezone,
    periods: row.periods.map((period) => ({
      ...period,
      startsAt: new Date(period.startsAt).toISOString(),
      endsAt: new Date(period.endsAt).toISOString(),
    })),
    declaredAt: row.created_at.toISOString(),
    professionalScope: professionalScope(row, member),
  };
}
async function dossier(db: Executor, actor: PartnerActor, userId: string, beforeRevision?: number) {
  const member = await access(db, actor, userId);
  const current = await latest(db, userId);
  const history = (
    await db.query<Row>(
      `${projection} where user_id=$1 and ($2::int is null or revision<$2) order by revision desc limit 21`,
      [userId, beforeRevision ?? null],
    )
  ).rows;
  return professionalAvailabilityDossierSchema.parse({
    userId,
    name: member.name,
    organization: member.organization,
    professionalRevision: member.professionalRevision,
    canDeclare: actor.userId === userId && member.state !== "closed",
    current: current ? declaration(current, member) : null,
    history: history.slice(0, 20).map((row) => declaration(row, member)),
    nextBeforeRevision: history.length > 20 ? history[19]!.revision : null,
  });
}
// Internal composition only; callers must already hold the member lock and authorize self access.
export async function readCurrentAvailability(db: Executor, member: PartnerApplication | null) {
  const current = member ? await latest(db, member.userId) : null;
  return professionalAvailabilityDossierSchema.shape.current.parse(
    current && member ? declaration(current, member) : null,
  );
}
export function createAvailabilityOperations(pool: Pool, transaction: Mutation) {
  return {
    async availability(actor: PartnerActor, userId: string, beforeRevision?: number) {
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
    declareAvailability(
      actor: PartnerActor,
      userId: string,
      raw: ProfessionalAvailabilityInput,
      key: string,
    ) {
      const input = professionalAvailabilityInputSchema.parse(raw);
      return transaction(
        actor,
        `availability:${userId}`,
        key,
        input,
        async (tx) => {
          const member = await access(tx, actor, userId, true);
          const previous = await latest(tx, userId);
          if (
            input.revision !== (previous?.revision ?? 0) ||
            input.professionalRevision !== member.professionalRevision
          )
            fail("PARTNER_CONFLICT", 409);
          const id = newId("pavailability");
          await tx.query(
            `insert into partner_availability_declarations(id,user_id,organization_id,revision,professional_revision,declared_name,declared_organization,modes,timezone)
          values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [
              id,
              userId,
              member.organizationId,
              input.revision + 1,
              input.professionalRevision,
              member.name,
              member.organization,
              [...input.modes].sort(),
              input.timezone,
            ],
          );
          if (input.periods.length) {
            const periods = [...input.periods].sort(
              (a, b) =>
                Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.kind.localeCompare(b.kind),
            );
            await tx.query(
              `insert into partner_availability_periods(declaration_id,position,kind,starts_at,ends_at)
              select $1,position,kind,starts_at,ends_at from unnest($2::int[],$3::text[],$4::timestamptz[],$5::timestamptz[]) as p(position,kind,starts_at,ends_at)`,
              [
                id,
                periods.map((_, i) => i),
                periods.map((p) => p.kind),
                periods.map((p) => p.startsAt),
                periods.map((p) => p.endsAt),
              ],
            );
          }
          await event(tx, actor, null, "availability.declared.v1", "", "private", id);
          return userId;
        },
        async (tx) => {
          // Even an exact replay needs the current authority to make this declaration.
          await access(tx, actor, userId, true);
          return dossier(tx, actor, userId);
        },
      );
    },
  };
}
