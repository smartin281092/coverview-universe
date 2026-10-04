import type { Pool, PoolClient } from "pg";
import {
  competenceDeclarationSchema,
  competenceDecisionSchema,
  competenceDossierSchema,
  competenceSummarySchema,
  competenceQuerySchema,
  leadCategorySchema,
  partnerApplicationInputSchema,
  type CompetenceDeclaration,
  type CompetenceDecision,
} from "@coverview/contracts/partner";
import { createPartnerProof, queuePartnerProof } from "../document-intelligence/index.js";
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
  id: string;
  revision: number;
  declaration: string;
  decision: string;
  reason: string;
  scope: string;
  coverage: string | null;
  valid_until: Date | null;
  created_at: Date;
  actor_name: string;
  organization_id: string;
  professional_revision: number | null;
  declared_name: string;
  declared_organization: string;
  document_id: string;
  checksum: string;
  document_revision: number;
  file_revision: number;
  file_checksum: string;
  file_user_id: string;
  managed_profile_id: string | null;
  purpose: string;
  document_name: string;
  document_state: string;
  scan_version: string | null;
  deleted_at: Date | null;
  current_application: unknown;
  current_organization_id: string;
  current_professional_revision: number;
};
const select = `select d.*,s.declaration,s.organization_id,s.professional_revision,s.declared_name,s.declared_organization,s.document_id,s.checksum,
  coalesce(a.application->>'name','CoverView') actor_name,
  f.revision file_revision,f.checksum file_checksum,f.user_id file_user_id,f.managed_profile_id,f.purpose,
  f.name document_name,f.state document_state,f.scan_version,f.deleted_at,
  m.application current_application,m.organization_id current_organization_id,m.professional_revision current_professional_revision
  from partner_competence_decisions d join partner_competence_declarations s on s.id=d.declaration_id
  join partner_members m on m.user_id=d.user_id
  join files f on f.id=s.document_id left join partner_members a on a.user_id=d.decided_by`;
const safe = (row: Row, userId: string) =>
  row.file_user_id === userId &&
  row.managed_profile_id === null &&
  row.purpose === "partner_competence" &&
  row.file_checksum === row.checksum &&
  !row.deleted_at &&
  !!row.scan_version &&
  ["ready", "failed"].includes(row.document_state);
async function latest(db: Executor, userId: string, category: string) {
  return (
    await db.query<Row>(
      `${select} where d.user_id=$1 and d.category=$2 order by d.revision desc limit 1`,
      [userId, category],
    )
  ).rows[0];
}
function summary(
  row: Row | undefined,
  userId: string,
  member: Parameters<typeof professionalScope>[1],
  categoryAllowed = true,
) {
  const reviewed = row?.decision === "reviewed";
  const status = !row
    ? "missing"
    : row.decision === "withdrawn"
      ? "withdrawn"
      : reviewed && row.valid_until && row.valid_until.getTime() <= Date.now()
        ? "expired"
        : professionalScope(row, member) !== "current" || !categoryAllowed
          ? "unavailable"
          : reviewed && (!safe(row, userId) || row.document_revision !== row.file_revision)
            ? "unavailable"
            : reviewed && row.coverage === "limited"
              ? "limited"
              : row.decision;
  return competenceSummarySchema.parse({
    status,
    scope: row?.scope ?? "",
    validUntil: row?.valid_until?.toISOString() ?? null,
    reviewedAt: reviewed ? row.created_at.toISOString() : null,
  });
}
export async function readCompetenceSummary(db: Executor, userId: string | null, category: string) {
  if (!userId) return summary(undefined, "", null);
  // Read the declaration and its current subject in the same PostgreSQL snapshot.
  const row = await latest(db, userId, category);
  if (!row) return summary(undefined, userId, null);
  const application = partnerApplicationInputSchema.parse(row.current_application);
  const member = {
    ...application,
    organizationId: row.current_organization_id,
    professionalRevision: row.current_professional_revision,
  };
  return summary(
    row,
    userId,
    member,
    member.categories.includes(leadCategorySchema.parse(category)),
  );
}
function project(row: Row, userId: string, member: Awaited<ReturnType<typeof membership>>) {
  return {
    id: row.id,
    revision: row.revision,
    declaration: row.declaration,
    professionalRevision: row.professional_revision,
    professionalScope: professionalScope(row, member),
    declaredName: row.declared_name,
    declaredOrganization: row.declared_organization,
    decision: row.decision,
    reason: row.reason,
    scope: row.scope,
    coverage: row.coverage,
    validUntil: row.valid_until?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    actorName: row.actor_name,
    documentId: row.document_id,
    documentName: row.document_name,
    documentState: row.document_state,
    documentRevision: row.file_revision,
    canDownload: safe(row, userId),
  };
}
async function target(db: Executor, actor: PartnerActor, userId: string, category: string) {
  leadCategorySchema.parse(category);
  if (actor.wallet || (!actor.administrator && actor.userId !== userId))
    fail("PARTNER_ACCESS_DENIED", 403);
  // The membership lock serializes declarations, Admin decisions and organization changes.
  await db.query("select user_id from partner_members where user_id=$1 for update", [userId]);
  const member = await membership(db, userId, true);
  if (!member) return fail("PARTNER_NOT_FOUND", 404);
  return member;
}
async function dossier(
  db: Executor,
  actor: PartnerActor,
  userId: string,
  category: string,
  beforeRevision?: number,
) {
  const member = await target(db, actor, userId, category),
    row = await latest(db, userId, category);
  const history = (
    await db.query<Row>(
      `${select} where d.user_id=$1 and d.category=$2 and ($3::int is null or d.revision<$3) order by d.revision desc limit 21`,
      [userId, category, beforeRevision ?? null],
    )
  ).rows;
  const categoryAllowed = member.categories.includes(leadCategorySchema.parse(category));
  return competenceDossierSchema.parse({
    userId,
    name: member.name,
    organization: member.organization,
    professionalRevision: member.professionalRevision,
    category,
    current: row ? project(row, userId, member) : null,
    summary: summary(row, userId, member, categoryAllowed),
    canDeclare: actor.userId === userId && member.state !== "closed" && categoryAllowed,
    canResume:
      actor.userId === userId &&
      member.state !== "closed" &&
      categoryAllowed &&
      !!row &&
      row.decision === "submitted" &&
      professionalScope(row, member) === "current",
    canReview:
      actor.administrator &&
      actor.userId !== userId &&
      !!row &&
      row.decision !== "withdrawn" &&
      professionalScope(row, member) === "current" &&
      categoryAllowed,
    canWithdraw: !!row && row.decision !== "withdrawn",
    history: history.slice(0, 20).map((entry) => project(entry, userId, member)),
    nextBeforeRevision: history.length > 20 ? history[19]!.revision : null,
  });
}
export function createCompetenceOperations(
  pool: Pool,
  mutate: Mutation,
  documentsAvailable = true,
) {
  async function availableDossier(
    db: Executor,
    actor: PartnerActor,
    userId: string,
    category: string,
    beforeRevision?: number,
  ) {
    const result = await dossier(db, actor, userId, category, beforeRevision);
    if (documentsAvailable) return result;
    return {
      ...result,
      documentsAvailable: false,
      canDeclare: false,
      canResume: false,
      canReview: false,
      current: result.current ? { ...result.current, canDownload: false } : null,
      history: result.history.map((row) => ({ ...row, canDownload: false })),
    };
  }
  async function read<T>(actor: PartnerActor, action: (tx: PoolClient) => Promise<T>) {
    const tx = await pool.connect();
    try {
      await tx.query("begin");
      await lockActor(tx, actor);
      const result = await action(tx);
      await tx.query("commit");
      return result;
    } catch (cause) {
      await tx.query("rollback");
      throw cause;
    } finally {
      tx.release();
    }
  }
  async function source(
    tx: PoolClient,
    actor: PartnerActor,
    userId: string,
    category: string,
    id: string,
    write: boolean,
  ) {
    if (!documentsAvailable) fail("PARTNER_UNAVAILABLE", 503);
    const member = await target(tx, actor, userId, category);
    const row = (
      await tx.query<Row>(`${select} where d.user_id=$1 and d.category=$2 and d.id=$3`, [
        userId,
        category,
        id,
      ])
    ).rows[0];
    if (!row) return fail("PARTNER_NOT_FOUND", 404);
    if (write) {
      const current = await latest(tx, userId, category);
      if (
        actor.userId !== userId ||
        member.state === "closed" ||
        !member.categories.includes(leadCategorySchema.parse(category)) ||
        !current ||
        current.id !== row.id ||
        current.decision !== "submitted" ||
        professionalScope(row, member) !== "current"
      )
        fail("PARTNER_ACCESS_DENIED", 403);
    } else if (!safe(row, userId)) fail("PARTNER_INVALID_DOCUMENT");
    return row;
  }
  return {
    competence(actor: PartnerActor, userId: string, category: string, beforeRevision?: number) {
      competenceQuerySchema.parse(beforeRevision === undefined ? {} : { beforeRevision });
      return read(actor, (tx) => availableDossier(tx, actor, userId, category, beforeRevision));
    },
    declareCompetence(
      actor: PartnerActor,
      userId: string,
      category: string,
      raw: CompetenceDeclaration,
      key: string,
    ) {
      const input = competenceDeclarationSchema.parse(raw);
      if (!documentsAvailable) fail("PARTNER_UNAVAILABLE", 503);
      return mutate(
        actor,
        `competence:${userId}:${category}:declare`,
        key,
        input,
        async (tx) => {
          const current = await dossier(tx, actor, userId, category);
          if (!current.canDeclare) fail("PARTNER_ACCESS_DENIED", 403);
          if ((current.current?.revision ?? 0) !== input.revision) fail("PARTNER_CONFLICT", 409);
          if (
            !input.professionalRevision ||
            current.professionalRevision !== input.professionalRevision
          )
            fail("PARTNER_CONFLICT", 409);
          const member = (await membership(tx, userId))!,
            documentId = await createPartnerProof(tx, userId, input.file),
            id = newId("pcdecl");
          await tx.query(
            `insert into partner_competence_declarations(id,user_id,organization_id,category,declaration,document_id,checksum,professional_revision,declared_name,declared_organization)
          values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [
              id,
              userId,
              member.organizationId,
              category,
              input.declaration,
              documentId,
              input.file.checksum,
              member.professionalRevision,
              member.name,
              member.organization,
            ],
          );
          const decisionId = newId("pcdec");
          await tx.query(
            `insert into partner_competence_decisions(id,declaration_id,user_id,category,revision,decision,document_revision,decided_by)
          values($1,$2,$3,$4,$5,'submitted',0,$3)`,
            [decisionId, id, userId, category, input.revision + 1],
          );
          await event(tx, actor, null, "competence.declared.v1", "", "private", decisionId);
          return userId;
        },
        (tx) => availableDossier(tx, actor, userId, category),
      );
    },
    decideCompetence(
      actor: PartnerActor,
      userId: string,
      category: string,
      raw: CompetenceDecision,
      key: string,
    ) {
      const input = competenceDecisionSchema.parse(raw);
      if (!documentsAvailable && input.decision !== "withdrawn") fail("PARTNER_UNAVAILABLE", 503);
      return mutate(
        actor,
        `competence:${userId}:${category}:decision`,
        key,
        input,
        async (tx) => {
          const current = await dossier(tx, actor, userId, category),
            row = await latest(tx, userId, category);
          if (!(input.decision === "withdrawn" ? current.canWithdraw : current.canReview))
            fail("PARTNER_ACCESS_DENIED", 403);
          if (!row || row.revision !== input.revision) fail("PARTNER_CONFLICT", 409);
          await tx.query("select id from files where id=$1 for share", [row.document_id]);
          const fresh = (await latest(tx, userId, category))!;
          if (input.documentRevision !== fresh.file_revision) fail("PARTNER_CONFLICT", 409);
          if (
            input.decision === "reviewed" &&
            (!safe(fresh, userId) ||
              !input.validUntil ||
              new Date(input.validUntil).getTime() <= Date.now())
          )
            fail("PARTNER_INVALID_DOCUMENT");
          const id = newId("pcdec");
          await tx.query(
            `insert into partner_competence_decisions(id,declaration_id,user_id,category,revision,decision,reason,scope,coverage,valid_until,document_revision,decided_by)
          select $1,declaration_id,user_id,category,$2,$3,$4,$5,$6,$7,$8,$9 from partner_competence_decisions where id=$10`,
            [
              id,
              input.revision + 1,
              input.decision,
              input.reason,
              input.scope,
              input.coverage,
              input.validUntil,
              input.documentRevision,
              actor.userId,
              row.id,
            ],
          );
          await event(tx, actor, null, `competence.${input.decision}.v1`, "", "private", id);
          return userId;
        },
        (tx) => availableDossier(tx, actor, userId, category),
      );
    },
    competenceSource(
      actor: PartnerActor,
      userId: string,
      category: string,
      id: string,
      write = false,
      record = false,
    ) {
      return read(actor, async (tx) => {
        const row = await source(tx, actor, userId, category, id, write);
        if (record) await event(tx, actor, null, "competence.source_viewed.v1", "", "private", id);
        return { userId, documentId: row.document_id };
      });
    },
    completeCompetenceUpload(
      actor: PartnerActor,
      userId: string,
      category: string,
      id: string,
      mime: string,
    ) {
      return read(actor, async (tx) => {
        const row = await source(tx, actor, userId, category, id, true);
        await queuePartnerProof(tx, userId, row.document_id, { mime });
        return availableDossier(tx, actor, userId, category);
      });
    },
    retryCompetenceUpload(
      actor: PartnerActor,
      userId: string,
      category: string,
      id: string,
      revision: number,
      key: string,
    ) {
      return mutate(
        actor,
        `competence:${userId}:${category}:${id}:retry`,
        key,
        { revision },
        async (tx) => {
          const row = await source(tx, actor, userId, category, id, true);
          await queuePartnerProof(tx, userId, row.document_id, { revision });
          return id;
        },
        async (tx, resultId) => {
          await source(tx, actor, userId, category, resultId, true);
          return availableDossier(tx, actor, userId, category);
        },
      );
    },
  };
}
