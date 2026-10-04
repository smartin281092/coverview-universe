import { createHash } from "node:crypto";
import {
  solutionClausesDossierSchema,
  type SolutionClausesInput,
  type PartnerApplication,
} from "@coverview/contracts/partner";
import { insuranceCompanyIdSchema } from "@coverview/contracts";
import { readSolutionBinding } from "./partner.solution-binding.js";
import { readSolutionConventionSource } from "./partner.convention.js";
import { personalNeedSubject, type PersonalNeedTarget } from "./partner.need-context.js";
import { context, lockActor, fail, type Executor, type PartnerActor } from "./partner.policy.js";
import { event, newId } from "./partner.audit.js";

type Row = {
  revision: number;
  subject_key: string;
  scope_fingerprint: string;
  action: "record" | "withdraw";
  clauses: unknown;
  reason: string;
  valid_until: Date | null;
  created_at: Date;
  scope: unknown;
  binding_revision: number;
  convention_reference: unknown;
};

// Actor/member/Lead guards are held by the repository. Profile precedes offer original,
// then convention original; mutations observe the time after the last possible wait.
export async function readSolutionClauses(
  db: Executor,
  actor: PartnerActor,
  lead: PersonalNeedTarget,
  member: PartnerApplication | null,
  offerId: string,
  companyId: string,
  assessedAt: string,
  documentsAvailable: boolean,
  beforeRevision?: number,
  lockSources = false,
) {
  insuranceCompanyIdSchema.parse(companyId);
  let { dossier: binding } = await readSolutionBinding(
    db,
    actor,
    lead,
    member,
    offerId,
    assessedAt,
    documentsAvailable,
    undefined,
    lockSources,
  );
  const convention = await readSolutionConventionSource(
    db,
    actor.userId,
    lead.category,
    companyId,
    member,
    assessedAt,
    documentsAvailable,
    lockSources,
  );
  assessedAt = convention.assessedAt;
  if (lockSources) {
    // The convention wait can outlast the association or offer's expiry.
    ({ dossier: binding } = await readSolutionBinding(
      db,
      actor,
      lead,
      member,
      offerId,
      assessedAt,
      documentsAvailable,
    ));
    await lockActor(db, actor);
    if (!(await context(db, actor)).canAdvise) fail("PARTNER_ACCESS_DENIED", 403);
  }
  const bound = binding.status === "recorded" ? binding.current : null;
  const canRecord =
    !!bound &&
    bound.companyId === companyId &&
    convention.evidence.sourceStatus === "available" &&
    convention.evidence.current?.professionalScope === "current" &&
    !["missing", "withdrawn", "expired", "unavailable", "rejected"].includes(
      convention.evidence.summary.status,
    ) &&
    !!member?.categories.some((category) => category === lead.category) &&
    !binding.changeRequested;
  const maxValidUntil =
    [binding.offer.validUntil, bound?.validUntil, convention.evidence.summary.validUntil]
      .filter((value): value is string => !!value)
      .sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null;
  const scopeFingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        binding: [binding.scopeFingerprint, binding.revision, binding.status],
        companyId,
        convention: convention.reference,
        status: convention.evidence.summary.status,
        sourceStatus: convention.evidence.sourceStatus,
        canRecord,
      }),
    )
    .digest("hex");
  const previous = (
    await db.query<Row>(
      `select * from partner_solution_clauses where user_id=$1 and offer_id=$2 and company_id=$3 order by revision desc limit 1`,
      [actor.userId, offerId, companyId],
    )
  ).rows[0];
  const current = previous?.subject_key === personalNeedSubject(lead) ? previous : null;
  const history = (
    await db.query<Row>(
      `select * from partner_solution_clauses where user_id=$1 and offer_id=$2 and company_id=$3
     and subject_key=$4 and ($5::int is null or revision<$5) order by revision desc limit 21`,
      [actor.userId, offerId, companyId, personalNeedSubject(lead), beforeRevision ?? null],
    )
  ).rows;
  const record = (entry: Row) => {
    const available =
      canRecord && entry.scope_fingerprint === scopeFingerprint && entry.action === "record";
    return {
      revision: entry.revision,
      action: entry.action,
      reason: entry.reason,
      validUntil: entry.valid_until?.toISOString() ?? null,
      recordedAt: entry.created_at.toISOString(),
      scope: entry.scope,
      bindingRevision: entry.binding_revision,
      conventionReference: entry.convention_reference,
      clauses: available ? entry.clauses : null,
      clausesAvailable: available,
      method: "human_transcription",
    };
  };
  const status = !current
    ? "missing"
    : current.action === "withdraw"
      ? "withdrawn"
      : current.scope_fingerprint !== scopeFingerprint || !canRecord
        ? "review_required"
        : current.valid_until! <= new Date(assessedAt)
          ? "expired"
          : "recorded";
  return solutionClausesDossierSchema.parse({
    leadId: lead.id,
    advisorId: actor.userId,
    companyId,
    assessedAt,
    scope: binding.scope,
    offer: binding.offer,
    scopeFingerprint,
    revision: previous?.revision ?? 0,
    status,
    canRecord,
    canWithdraw: current?.action === "record",
    changeRequested: binding.changeRequested,
    binding: { status: binding.status, revision: binding.revision, current: bound },
    convention: convention.evidence,
    conventionReference: convention.reference,
    maxValidUntil,
    current: current ? record(current) : null,
    history: history.slice(0, 20).map(record),
    nextBeforeRevision: history.length > 20 ? history[19]!.revision : null,
    assessment: "human_review_required",
    legalIdentity: "unverified",
    productIdentity: "unverified",
  });
}

export async function recordSolutionClauses(
  db: Executor,
  actor: PartnerActor,
  lead: PersonalNeedTarget,
  member: PartnerApplication | null,
  offerId: string,
  companyId: string,
  input: SolutionClausesInput,
  documentsAvailable: boolean,
) {
  const current = await readSolutionClauses(
    db,
    actor,
    lead,
    member,
    offerId,
    companyId,
    new Date().toISOString(),
    documentsAvailable,
    undefined,
    true,
  );
  if (input.revision !== current.revision || input.scopeFingerprint !== current.scopeFingerprint)
    fail("PARTNER_CONFLICT", 409);
  if (input.action === "withdraw" ? !current.canWithdraw : !current.canRecord)
    fail("PARTNER_ACTION_REQUIRED");
  if (
    input.validUntil &&
    current.maxValidUntil &&
    Date.parse(input.validUntil) > Date.parse(current.maxValidUntil)
  )
    fail("PARTNER_ACTION_REQUIRED");
  const id = newId("pclauses");
  const inserted = await db.query(
    `insert into partner_solution_clauses
     (id,lead_id,offer_id,user_id,organization_id,company_id,subject_key,revision,scope_fingerprint,scope,binding_revision,convention_reference,action,clauses,reason,valid_until,created_at)
     select $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,clock_timestamp()
     where $13='withdraw' or $16::timestamptz>clock_timestamp() returning id`,
    [
      id,
      lead.id,
      offerId,
      actor.userId,
      member?.organizationId ?? null,
      companyId,
      personalNeedSubject(lead),
      input.revision + 1,
      current.scopeFingerprint,
      JSON.stringify(current.scope),
      current.binding.revision,
      current.conventionReference ? JSON.stringify(current.conventionReference) : null,
      input.action,
      input.clauses ? JSON.stringify(input.clauses) : null,
      input.reason,
      input.validUntil,
    ],
  );
  if (!inserted.rowCount) fail("PARTNER_ACTION_REQUIRED");
  await event(
    db,
    actor,
    null,
    input.action === "record" ? "solution_clauses.recorded.v1" : "solution_clauses.withdrawn.v1",
    "",
    "private",
    id,
  );
  return lead.id;
}
