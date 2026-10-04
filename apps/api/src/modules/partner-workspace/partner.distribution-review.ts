import { createHash } from "node:crypto";
import {
  distributionReviewDossierSchema,
  distributionReviewSchema,
  type DistributionReviewInput,
  type PartnerApplication,
} from "@coverview/contracts/partner";
import { readSolutionClauses } from "./partner.solution-clauses.js";
import { personalNeedSubject, type PersonalNeedTarget } from "./partner.need-context.js";
import { fail, type Executor, type PartnerActor } from "./partner.policy.js";
import { event, newId } from "./partner.audit.js";

type Row = {
  revision: number;
  subject_key: string;
  scope_fingerprint: string;
  action: "record" | "withdraw";
  review: unknown;
  reason: string;
  valid_until: Date | null;
  created_at: Date;
  scope: unknown;
  clauses_revision: number;
  binding_revision: number;
  convention_reference: unknown;
};

export async function readDistributionReview(
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
  // The owner locks profile -> offer -> convention, then rereads time, sources and authority.
  const clauses = await readSolutionClauses(
    db,
    actor,
    lead,
    member,
    offerId,
    companyId,
    assessedAt,
    documentsAvailable,
    undefined,
    lockSources,
  );
  const canRecord = clauses.status === "recorded" && clauses.canRecord;
  const maxValidUntil =
    [clauses.maxValidUntil, clauses.current?.validUntil]
      .filter((value): value is string => !!value)
      .sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null;
  const scopeFingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        clauses: [clauses.scopeFingerprint, clauses.revision, clauses.status],
        canRecord,
      }),
    )
    .digest("hex");
  const previous = (
    await db.query<Row>(
      `select * from partner_distribution_reviews where user_id=$1 and offer_id=$2 and company_id=$3 order by revision desc limit 1`,
      [actor.userId, offerId, companyId],
    )
  ).rows[0];
  const current = previous?.subject_key === personalNeedSubject(lead) ? previous : null;
  const history = (
    await db.query<Row>(
      `select * from partner_distribution_reviews where user_id=$1 and offer_id=$2 and company_id=$3
     and subject_key=$4 and ($5::int is null or revision<$5) order by revision desc limit 21`,
      [actor.userId, offerId, companyId, personalNeedSubject(lead), beforeRevision ?? null],
    )
  ).rows;
  const record = (entry: Row) => ({
    revision: entry.revision,
    action: entry.action,
    review: entry.review,
    reason: entry.reason,
    validUntil: entry.valid_until?.toISOString() ?? null,
    recordedAt: entry.created_at.toISOString(),
    scope: entry.scope,
    clausesRevision: entry.clauses_revision,
    bindingRevision: entry.binding_revision,
    conventionReference: entry.convention_reference,
    sourcesCurrent:
      canRecord && entry.scope_fingerprint === scopeFingerprint && entry.action === "record",
  });
  const status = !current
    ? "missing"
    : current.action === "withdraw"
      ? "withdrawn"
      : current.scope_fingerprint !== scopeFingerprint || !canRecord
        ? "review_required"
        : current.valid_until! <= new Date(clauses.assessedAt)
          ? "expired"
          : "recorded";
  return distributionReviewDossierSchema.parse({
    source: clauses,
    scopeFingerprint,
    revision: previous?.revision ?? 0,
    status,
    position:
      status === "recorded" ? distributionReviewSchema.parse(current!.review).position : null,
    canRecord,
    canWithdraw: current?.action === "record",
    maxValidUntil,
    current: current ? record(current) : null,
    history: history.slice(0, 20).map(record),
    nextBeforeRevision: history.length > 20 ? history[19]!.revision : null,
  });
}

export async function recordDistributionReview(
  db: Executor,
  actor: PartnerActor,
  lead: PersonalNeedTarget,
  member: PartnerApplication | null,
  offerId: string,
  companyId: string,
  input: DistributionReviewInput,
  documentsAvailable: boolean,
) {
  const current = await readDistributionReview(
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
  // Presence is a technical check only. Relevance and fidelity remain the author's attestation.
  if (
    input.review?.position === "cannot_proceed" &&
    input.review.aspects.some((aspect) => !current.source.current?.clauses?.[aspect])
  )
    fail("PARTNER_ACTION_REQUIRED");
  const id = newId("pdist");
  const inserted = await db.query(
    `insert into partner_distribution_reviews
     (id,lead_id,offer_id,user_id,organization_id,company_id,subject_key,revision,scope_fingerprint,scope,
      clauses_revision,binding_revision,convention_reference,action,review,reason,valid_until,created_at)
     select $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,clock_timestamp()
     where $14='withdraw' or $17::timestamptz>clock_timestamp() returning id`,
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
      JSON.stringify(current.source.scope),
      current.source.revision,
      current.source.binding.revision,
      current.source.conventionReference
        ? JSON.stringify(current.source.conventionReference)
        : null,
      input.action,
      input.review ? JSON.stringify(input.review) : null,
      input.reason,
      input.validUntil,
    ],
  );
  if (!inserted.rowCount) fail("PARTNER_ACTION_REQUIRED");
  await event(
    db,
    actor,
    null,
    input.action === "record"
      ? "distribution_review.recorded.v1"
      : "distribution_review.withdrawn.v1",
    "",
    "private",
    id,
  );
  return lead.id;
}
