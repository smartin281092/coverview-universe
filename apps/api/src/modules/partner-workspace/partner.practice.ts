import type { Pool, PoolClient } from "pg";
import {
  professionalPracticeInputSchema,
  professionalPracticeDossierSchema,
  professionalPracticeSummarySchema,
  referentQuerySchema,
  type ProfessionalPracticeInput,
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
  language_codes: string[];
  cantons: string[];
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
async function latest(db: Executor, userId: string) {
  return (
    await db.query<Row>(
      "select * from partner_practice_declarations where user_id=$1 order by revision desc limit 1",
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
    languageCodes: row.language_codes,
    cantons: row.cantons,
    declaredAt: row.created_at.toISOString(),
    professionalScope: professionalScope(row, member),
  };
}
async function dossier(db: Executor, actor: PartnerActor, userId: string, beforeRevision?: number) {
  const member = await access(db, actor, userId);
  const current = await latest(db, userId);
  const history = (
    await db.query<Row>(
      "select * from partner_practice_declarations where user_id=$1 and ($2::int is null or revision<$2) order by revision desc limit 21",
      [userId, beforeRevision ?? null],
    )
  ).rows;
  return professionalPracticeDossierSchema.parse({
    userId,
    name: member.name,
    organization: member.organization,
    professionalRevision: member.professionalRevision,
    canDeclare: actor.userId === userId && member.state !== "closed",
    legacy: { languages: member.languages, regions: member.regions },
    current: current ? declaration(current, member) : null,
    history: history.slice(0, 20).map((row) => declaration(row, member)),
    nextBeforeRevision: history.length > 20 ? history[19]!.revision : null,
  });
}
export async function readPracticeSummary(db: Executor, userId: string | null) {
  // The declaration and current identity are read in one PostgreSQL snapshot.
  const row = userId
    ? (
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
     from partner_members m join lateral (select * from partner_practice_declarations where user_id=m.user_id order by revision desc limit 1) d on true
     where m.user_id=$1`,
          [userId],
        )
      ).rows[0]
    : undefined;
  const current =
    row &&
    professionalScope(row, {
      professionalRevision: row.current_revision,
      organizationId: row.current_organization,
      name: row.current_name,
      organization: row.current_organization_name,
    }) === "current";
  return professionalPracticeSummarySchema.parse({
    status: !row ? "unset" : current ? "declared" : "scope_changed",
    languageCodes: current ? row.language_codes : [],
    cantons: current ? row.cantons : [],
    declaredAt: row?.created_at.toISOString() ?? null,
  });
}
export function createPracticeOperations(pool: Pool, transaction: Mutation) {
  return {
    async practice(actor: PartnerActor, userId: string, beforeRevision?: number) {
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
    declarePractice(
      actor: PartnerActor,
      userId: string,
      raw: ProfessionalPracticeInput,
      key: string,
    ) {
      const input = professionalPracticeInputSchema.parse(raw);
      return transaction(
        actor,
        `practice:${userId}`,
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
          const id = newId("ppractice");
          await tx.query(
            `insert into partner_practice_declarations(id,user_id,organization_id,revision,professional_revision,declared_name,declared_organization,language_codes,cantons)
          values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [
              id,
              userId,
              member.organizationId,
              input.revision + 1,
              input.professionalRevision,
              member.name,
              member.organization,
              [...input.languageCodes].sort(),
              [...input.cantons].sort(),
            ],
          );
          await event(tx, actor, null, "practice.declared.v1", "", "private", id);
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
