import { insuranceCompanyIdSchema } from "@coverview/contracts";
import type { Pool, PoolClient } from "pg";
import {
  conventionDeclarationSchema,
  conventionDecisionSchema,
  conventionDossierSchema,
  conventionSummarySchema,
  conventionQuerySchema,
  solutionEvidenceSchema,
  leadCategorySchema,
  type ConventionDeclaration,
  type ConventionDecision,
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
  declaration_id: string;
  revision: number;
  declaration: string;
  decision: string;
  reason: string;
  scope: string;
  coverage: string | null;
  valid_until: Date | null;
  valid_from: Date | null;
  member_covered: boolean;
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
};
const select = `select d.*,s.declaration,s.organization_id,s.professional_revision,s.declared_name,s.declared_organization,s.document_id,s.checksum,
  coalesce(a.application->>'name','CoverView') actor_name,
  f.revision file_revision,f.checksum file_checksum,f.user_id file_user_id,f.managed_profile_id,f.purpose,
  f.name document_name,f.state document_state,f.scan_version,f.deleted_at
  from partner_convention_decisions d join partner_convention_declarations s on s.id=d.declaration_id
  join files f on f.id=s.document_id left join partner_members a on a.user_id=d.decided_by`;
const safe = (row: Row, userId: string) =>
  row.file_user_id === userId &&
  row.managed_profile_id === null &&
  row.purpose === "partner_convention" &&
  row.file_checksum === row.checksum &&
  !row.deleted_at &&
  !!row.scan_version &&
  ["ready", "failed"].includes(row.document_state);
async function latest(db: Executor, userId: string, category: string, companyId: string) {
  return (
    await db.query<Row>(
      `${select} where d.user_id=$1 and d.category=$2 and d.company_id=$3 order by d.revision desc limit 1`,
      [userId, category, companyId],
    )
  ).rows[0];
}
function sameSubject(row: Row, member: NonNullable<Awaited<ReturnType<typeof membership>>>) {
  return professionalScope(row, member) === "current";
}
function summary(
  row: Row | undefined,
  userId: string,
  member: Awaited<ReturnType<typeof membership>>,
  categoryAllowed = true,
  assessedAt = Date.now(),
) {
  const reviewed = row?.decision === "reviewed";
  const status = !row
    ? "missing"
    : row.decision === "withdrawn"
      ? "withdrawn"
      : reviewed && row.valid_until && row.valid_until.getTime() <= assessedAt
        ? "expired"
        : !member || !sameSubject(row, member) || !categoryAllowed
          ? "unavailable"
          : reviewed && (!safe(row, userId) || row.document_revision !== row.file_revision)
            ? "unavailable"
            : reviewed && row.valid_from && row.valid_from.getTime() > assessedAt
              ? "scheduled"
              : reviewed && row.coverage === "limited"
                ? "limited"
                : row.decision;
  return conventionSummarySchema.parse({
    status,
    scope: row?.scope ?? "",
    validFrom: row?.valid_from?.toISOString() ?? null,
    validUntil: row?.valid_until?.toISOString() ?? null,
    reviewedAt: reviewed ? row.created_at.toISOString() : null,
  });
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
    memberCovered: row.member_covered,
    validFrom: row.valid_from?.toISOString() ?? null,
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
// Caller enforces the personal Lead mandate in one repeatable-read snapshot.
export async function readSolutionConventionEvidence(
  db: Executor,
  userId: string,
  category: string,
  companyId: string,
  member: Awaited<ReturnType<typeof membership>>,
  assessedAt: string,
  documentsAvailable: boolean,
) {
  const row = await latest(db, userId, category, companyId);
  return solutionEvidenceSchema.shape.convention.unwrap().parse({
    summary: summary(
      row,
      userId,
      member,
      !!member?.categories.includes(leadCategorySchema.parse(category)),
      Date.parse(assessedAt),
    ),
    current: row ? project(row, userId, member) : null,
    sourceStatus: !row
      ? "missing"
      : !documentsAvailable
        ? "disabled"
        : !safe(row, userId)
          ? "unavailable"
          : row.decision === "reviewed" && row.document_revision !== row.file_revision
            ? "changed"
            : "available",
    reviewedDocumentRevision: row?.decision === "reviewed" ? row.document_revision : null,
    canOpenDossier: !!member,
  });
}

// Only callers already holding the personal Lead/member/profile guards may use this reader.
// The decision refers to the immutable declaration, which owns the exact original.
export async function readSolutionConventionSource(
  db: Executor,
  userId: string,
  category: string,
  companyId: string,
  member: Awaited<ReturnType<typeof membership>>,
  assessedAt: string,
  documentsAvailable: boolean,
  lockSource = false,
) {
  let row = await latest(db, userId, category, companyId);
  if (row && lockSource) {
    await db.query("select id from files where id=$1 for share", [row.document_id]);
    row = await latest(db, userId, category, companyId);
  }
  if (lockSource)
    assessedAt = (
      await db.query<{ at: Date }>("select clock_timestamp() at")
    ).rows[0]!.at.toISOString();
  return {
    assessedAt,
    reference: row
      ? {
          declarationId: row.declaration_id,
          decisionId: row.id,
          revision: row.revision,
          documentRevision: row.file_revision,
          reviewedDocumentRevision: row.decision === "reviewed" ? row.document_revision : null,
        }
      : null,
    evidence: await readSolutionConventionEvidence(
      db,
      userId,
      category,
      companyId,
      member,
      assessedAt,
      documentsAvailable,
    ),
  };
}

async function target(
  db: Executor,
  actor: PartnerActor,
  userId: string,
  category: string,
  companyId: string,
) {
  leadCategorySchema.parse(category);
  insuranceCompanyIdSchema.parse(companyId);
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
  companyId: string,
  beforeRevision?: number,
) {
  const member = await target(db, actor, userId, category, companyId),
    row = await latest(db, userId, category, companyId);
  const history = (
    await db.query<Row>(
      `${select} where d.user_id=$1 and d.category=$2 and d.company_id=$3 and ($4::int is null or d.revision<$4) order by d.revision desc limit 21`,
      [userId, category, companyId, beforeRevision ?? null],
    )
  ).rows;
  const categoryAllowed = member.categories.includes(leadCategorySchema.parse(category));
  return conventionDossierSchema.parse({
    userId,
    name: member.name,
    organization: member.organization,
    professionalRevision: member.professionalRevision,
    category,
    companyId,
    current: row ? project(row, userId, member) : null,
    summary: summary(row, userId, member, categoryAllowed),
    canDeclare: actor.userId === userId && member.state !== "closed" && categoryAllowed,
    canResume:
      actor.userId === userId &&
      member.state !== "closed" &&
      categoryAllowed &&
      !!row &&
      row.decision === "submitted" &&
      sameSubject(row, member),
    canReview:
      actor.administrator &&
      actor.userId !== userId &&
      !!row &&
      row.decision !== "withdrawn" &&
      sameSubject(row, member) &&
      categoryAllowed,
    canWithdraw: !!row && row.decision !== "withdrawn",
    history: history.slice(0, 20).map((entry) => project(entry, userId, member)),
    nextBeforeRevision: history.length > 20 ? history[19]!.revision : null,
  });
}
export function createConventionOperations(
  pool: Pool,
  mutate: Mutation,
  documentsAvailable = true,
) {
  async function availableDossier(
    db: Executor,
    actor: PartnerActor,
    userId: string,
    category: string,
    companyId: string,
    beforeRevision?: number,
  ) {
    const result = await dossier(db, actor, userId, category, companyId, beforeRevision);
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
    companyId: string,
    id: string,
    write: boolean,
  ) {
    if (!documentsAvailable) fail("PARTNER_UNAVAILABLE", 503);
    const member = await target(tx, actor, userId, category, companyId);
    const row = (
      await tx.query<Row>(
        `${select} where d.user_id=$1 and d.category=$2 and d.company_id=$3 and d.id=$4`,
        [userId, category, companyId, id],
      )
    ).rows[0];
    if (!row) return fail("PARTNER_NOT_FOUND", 404);
    if (write) {
      const current = await latest(tx, userId, category, companyId);
      if (
        actor.userId !== userId ||
        member.state === "closed" ||
        !member.categories.includes(leadCategorySchema.parse(category)) ||
        !current ||
        current.id !== row.id ||
        current.decision !== "submitted" ||
        !sameSubject(row, member)
      )
        fail("PARTNER_ACCESS_DENIED", 403);
    } else if (!safe(row, userId)) fail("PARTNER_INVALID_DOCUMENT");
    return row;
  }
  return {
    convention(
      actor: PartnerActor,
      userId: string,
      category: string,
      companyId: string,
      beforeRevision?: number,
    ) {
      conventionQuerySchema.parse(beforeRevision === undefined ? {} : { beforeRevision });
      return read(actor, (tx) =>
        availableDossier(tx, actor, userId, category, companyId, beforeRevision),
      );
    },
    declareConvention(
      actor: PartnerActor,
      userId: string,
      category: string,
      companyId: string,
      raw: ConventionDeclaration,
      key: string,
    ) {
      const input = conventionDeclarationSchema.parse(raw);
      if (!documentsAvailable) fail("PARTNER_UNAVAILABLE", 503);
      return mutate(
        actor,
        `convention:${userId}:${category}:${companyId}:declare`,
        key,
        input,
        async (tx) => {
          const current = await dossier(tx, actor, userId, category, companyId);
          if (!current.canDeclare) fail("PARTNER_ACCESS_DENIED", 403);
          if ((current.current?.revision ?? 0) !== input.revision) fail("PARTNER_CONFLICT", 409);
          if (
            !input.professionalRevision ||
            current.professionalRevision !== input.professionalRevision ||
            current.name !== input.subjectName ||
            current.organization !== input.subjectOrganization
          )
            fail("PARTNER_CONFLICT", 409);
          const member = (await membership(tx, userId))!,
            documentId = await createPartnerProof(tx, userId, input.file, "partner_convention"),
            id = newId("pvdecl");
          await tx.query(
            `insert into partner_convention_declarations(id,user_id,organization_id,category,declaration,document_id,checksum,company_id,declared_name,declared_organization,professional_revision)
          values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [
              id,
              userId,
              member.organizationId,
              category,
              input.declaration,
              documentId,
              input.file.checksum,
              companyId,
              member.name,
              member.organization,
              member.professionalRevision,
            ],
          );
          const decisionId = newId("pvdec");
          await tx.query(
            `insert into partner_convention_decisions(id,declaration_id,user_id,category,revision,decision,document_revision,decided_by,company_id)
          values($1,$2,$3,$4,$5,'submitted',0,$3,$6)`,
            [decisionId, id, userId, category, input.revision + 1, companyId],
          );
          await event(tx, actor, null, "convention.declared.v1", "", "private", decisionId);
          return userId;
        },
        (tx) => availableDossier(tx, actor, userId, category, companyId),
      );
    },
    decideConvention(
      actor: PartnerActor,
      userId: string,
      category: string,
      companyId: string,
      raw: ConventionDecision,
      key: string,
    ) {
      const input = conventionDecisionSchema.parse(raw);
      if (!documentsAvailable && input.decision !== "withdrawn") fail("PARTNER_UNAVAILABLE", 503);
      return mutate(
        actor,
        `convention:${userId}:${category}:${companyId}:decision`,
        key,
        input,
        async (tx) => {
          const current = await dossier(tx, actor, userId, category, companyId),
            row = await latest(tx, userId, category, companyId);
          if (!(input.decision === "withdrawn" ? current.canWithdraw : current.canReview))
            fail("PARTNER_ACCESS_DENIED", 403);
          if (!row || row.revision !== input.revision) fail("PARTNER_CONFLICT", 409);
          await tx.query("select id from files where id=$1 for share", [row.document_id]);
          const fresh = (await latest(tx, userId, category, companyId))!;
          if (input.documentRevision !== fresh.file_revision) fail("PARTNER_CONFLICT", 409);
          if (
            input.decision === "reviewed" &&
            (!safe(fresh, userId) ||
              !input.validUntil ||
              new Date(input.validUntil).getTime() <= Date.now())
          )
            fail("PARTNER_INVALID_DOCUMENT");
          const id = newId("pvdec");
          await tx.query(
            `insert into partner_convention_decisions(id,declaration_id,user_id,category,revision,decision,reason,scope,coverage,valid_until,document_revision,decided_by,company_id,valid_from,member_covered)
          select $1,declaration_id,user_id,category,$2,$3,$4,$5,$6,$7,$8,$9,company_id,$11,$12 from partner_convention_decisions where id=$10`,
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
              input.validFrom,
              input.decision === "reviewed" && input.memberCovered,
            ],
          );
          await event(tx, actor, null, `convention.${input.decision}.v1`, "", "private", id);
          return userId;
        },
        (tx) => availableDossier(tx, actor, userId, category, companyId),
      );
    },
    conventionSource(
      actor: PartnerActor,
      userId: string,
      category: string,
      companyId: string,
      id: string,
      write = false,
      record = false,
    ) {
      return read(actor, async (tx) => {
        const row = await source(tx, actor, userId, category, companyId, id, write);
        if (record) await event(tx, actor, null, "convention.source_viewed.v1", "", "private", id);
        return { userId, documentId: row.document_id };
      });
    },
    completeConventionUpload(
      actor: PartnerActor,
      userId: string,
      category: string,
      companyId: string,
      id: string,
      mime: string,
    ) {
      return read(actor, async (tx) => {
        const row = await source(tx, actor, userId, category, companyId, id, true);
        await queuePartnerProof(tx, userId, row.document_id, { mime }, "partner_convention");
        return availableDossier(tx, actor, userId, category, companyId);
      });
    },
    retryConventionUpload(
      actor: PartnerActor,
      userId: string,
      category: string,
      companyId: string,
      id: string,
      revision: number,
      key: string,
    ) {
      return mutate(
        actor,
        `convention:${userId}:${category}:${companyId}:${id}:retry`,
        key,
        { revision },
        async (tx) => {
          const row = await source(tx, actor, userId, category, companyId, id, true);
          await queuePartnerProof(tx, userId, row.document_id, { revision }, "partner_convention");
          return id;
        },
        async (tx, resultId) => {
          await source(tx, actor, userId, category, companyId, resultId, true);
          return availableDossier(tx, actor, userId, category, companyId);
        },
      );
    },
  };
}
