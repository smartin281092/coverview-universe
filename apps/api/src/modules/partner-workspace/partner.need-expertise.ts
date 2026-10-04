import { createHash } from "node:crypto";
import {
  needExpertiseDossierSchema,
  type NeedExpertiseInput,
  type PartnerApplication,
} from "@coverview/contracts/partner";
import { readNeedExpertiseSource } from "./partner.competence.js";
import { readAdvicePreferences } from "./partner.advice.js";
import {
  readPersonalNeedContext,
  personalNeedSubject,
  type PersonalNeedTarget,
} from "./partner.need-context.js";
import { event, newId } from "./partner.audit.js";
import { context, lockActor, fail, type Executor, type PartnerActor } from "./partner.policy.js";

type Row = {
  revision: number;
  subject_key: string;
  scope_fingerprint: string;
  action: "decide" | "withdraw";
  position: NeedExpertiseInput["position"];
  reviewed_scope: string | null;
  limitations: string | null;
  next_step: string | null;
  reason: string;
  valid_until: Date | null;
  created_at: Date;
  scope: unknown;
  basis: unknown;
};
const record = (row: Row) => ({
  revision: row.revision,
  action: row.action,
  position: row.position,
  reviewedScope: row.reviewed_scope,
  limitations: row.limitations,
  nextStep: row.next_step,
  reason: row.reason,
  validUntil: row.valid_until?.toISOString() ?? null,
  recordedAt: row.created_at.toISOString(),
  scope: row.scope,
  basis: row.basis,
});
// Caller holds the current personal audience, actor/member/Lead and canonical subject locks.
export async function readNeedExpertise(
  db: Executor,
  actor: PartnerActor,
  lead: PersonalNeedTarget,
  member: PartnerApplication | null,
  assessedAt: string,
  documentsAvailable: boolean,
  beforeRevision?: number,
  lockSource = false,
) {
  const { preferences, fingerprintBasis, changeRequested } = await readPersonalNeedContext(
    db,
    actor,
    lead,
    member,
  );
  const source = await readNeedExpertiseSource(
    db,
    actor.userId,
    lead.category,
    member,
    assessedAt,
    documentsAvailable,
    lockSource,
  );
  if (lockSource) {
    // Existing row locks prevent revocation races, but time-based rights can expire while
    // waiting for the original. Reauthorize writes and replays after the last blocking lock.
    await lockActor(db, actor);
    if (!(await context(db, actor)).canAdvise) fail("PARTNER_ACCESS_DENIED", 403);
  }
  const basis = {
    scopeRevision: lead.adviceScopeRevision,
    profileRevision: preferences.profileRevision,
    professionalRevision: member?.professionalRevision ?? null,
    preferencesRevision: preferences.revision,
    referentRevision: fingerprintBasis.referent,
    source: source.reference,
  };
  // References identify the exact general evidence; the human assessment stays separate.
  const scopeFingerprint = createHash("sha256")
    .update(JSON.stringify({ ...fingerprintBasis, changeRequested, source: source.reference }))
    .digest("hex");
  const previous = (
    await db.query<Row>(
      `select * from partner_need_expertise_reviews where user_id=$1 and lead_id=$2
       order by revision desc limit 1`,
      [actor.userId, lead.id],
    )
  ).rows[0];
  const current = previous?.subject_key === personalNeedSubject(lead) ? previous : null;
  const history = (
    await db.query<Row>(
      `select * from partner_need_expertise_reviews where user_id=$1 and lead_id=$2
       and subject_key=$3 and ($4::int is null or revision<$4) order by revision desc limit 21`,
      [actor.userId, lead.id, personalNeedSubject(lead), beforeRevision ?? null],
    )
  ).rows;
  const status = !current
    ? "missing"
    : current.action === "withdraw"
      ? "withdrawn"
      : current.scope_fingerprint !== scopeFingerprint
        ? "review_required"
        : current.valid_until! <= new Date(source.assessedAt)
          ? "expired"
          : "recorded";
  return needExpertiseDossierSchema.parse({
    leadId: lead.id,
    advisorId: actor.userId,
    assessedAt: source.assessedAt,
    scope: preferences.scope,
    scopeFingerprint,
    revision: previous?.revision ?? 0,
    canConfirmExpertise:
      !changeRequested &&
      source.evidence.sourceStatus === "available" &&
      ["reviewed", "limited"].includes(source.evidence.summary.status),
    canWithdraw: current?.action === "decide",
    status,
    effectivePosition: status === "recorded" ? current!.position : null,
    current: current ? record(current) : null,
    history: history.slice(0, 20).map(record),
    nextBeforeRevision: history.length > 20 ? history[19]!.revision : null,
    changeRequested,
    basis,
    competence: source.evidence,
  });
}

export async function decideNeedExpertise(
  db: Executor,
  actor: PartnerActor,
  lead: PersonalNeedTarget,
  member: PartnerApplication | null,
  input: NeedExpertiseInput,
  documentsAvailable: boolean,
) {
  // Acquire the canonical profile guard before choosing the write's observation instant.
  await readAdvicePreferences(db, actor, lead);
  const now = (await db.query<{ at: Date }>("select clock_timestamp() at")).rows[0]!.at;
  const current = await readNeedExpertise(
    db,
    actor,
    lead,
    member,
    now.toISOString(),
    documentsAvailable,
    undefined,
    true,
  );
  if (input.revision !== current.revision || input.scopeFingerprint !== current.scopeFingerprint)
    fail("PARTNER_CONFLICT", 409);
  if (
    (input.action === "withdraw" && !current.canWithdraw) ||
    (input.position === "expertise_confirmed_within_scope" && !current.canConfirmExpertise)
  )
    fail("PARTNER_ACTION_REQUIRED");
  if (
    input.position === "expertise_confirmed_within_scope" &&
    (!current.basis.source?.validUntil ||
      !input.validUntil ||
      new Date(input.validUntil) > new Date(current.basis.source.validUntil))
  )
    fail("PARTNER_ACTION_REQUIRED");
  const id = newId("pneedexpertise");
  const inserted = await db.query(
    `insert into partner_need_expertise_reviews
     (id,lead_id,user_id,organization_id,subject_key,revision,scope_fingerprint,scope,basis,action,position,reason,reviewed_scope,valid_until,limitations,next_step,created_at)
     select $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,clock_timestamp()
     where $10='withdraw' or $14::timestamptz>clock_timestamp() returning id`,
    [
      id,
      lead.id,
      actor.userId,
      member?.organizationId ?? null,
      personalNeedSubject(lead),
      input.revision + 1,
      current.scopeFingerprint,
      JSON.stringify(current.scope),
      JSON.stringify(current.basis),
      input.action,
      input.position,
      input.reason,
      input.reviewedScope,
      input.validUntil,
      input.limitations,
      input.nextStep,
    ],
  );
  if (!inserted.rowCount) fail("PARTNER_ACTION_REQUIRED");
  // Minimal private audit: no need, position, scope, limits, next step or reason.
  await event(
    db,
    actor,
    null,
    input.action === "decide" ? "need_expertise.decided.v1" : "need_expertise.withdrawn.v1",
    "",
    "private",
    id,
  );
  return lead.id;
}
