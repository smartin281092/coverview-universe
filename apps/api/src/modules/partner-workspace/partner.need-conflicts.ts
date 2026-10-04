import { createHash } from "node:crypto";
import {
  needConflictDossierSchema,
  type NeedConflictInput,
  type PartnerApplication,
} from "@coverview/contracts/partner";
import { readAdvicePreferences } from "./partner.advice.js";
import {
  readPersonalNeedContext,
  personalNeedSubject,
  type PersonalNeedTarget,
} from "./partner.need-context.js";
import { event, newId } from "./partner.audit.js";
import { fail, type Executor, type PartnerActor } from "./partner.policy.js";

type Row = {
  revision: number;
  subject_key: string;
  scope_fingerprint: string;
  action: "decide" | "withdraw";
  position: NeedConflictInput["position"];
  reviewed_scope: string | null;
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
  reason: row.reason,
  validUntil: row.valid_until?.toISOString() ?? null,
  recordedAt: row.created_at.toISOString(),
  scope: row.scope,
  basis: row.basis,
});
// Caller holds the current personal audience, actor/member/Lead and canonical subject locks.
export async function readNeedConflict(
  db: Executor,
  actor: PartnerActor,
  lead: PersonalNeedTarget,
  member: PartnerApplication | null,
  assessedAt: string,
  beforeRevision?: number,
) {
  const { preferences, fingerprintBasis, changeRequested } = await readPersonalNeedContext(
    db,
    actor,
    lead,
    member,
  );
  const basis = {
    scopeRevision: lead.adviceScopeRevision,
    profileRevision: preferences.profileRevision,
    professionalRevision: member?.professionalRevision ?? null,
    preferencesRevision: preferences.revision,
    referentRevision: fingerprintBasis.referent,
  };
  // Only the current human review has a position. Context is not evidence of no conflict.
  const scopeFingerprint = createHash("sha256")
    .update(JSON.stringify({ ...fingerprintBasis, changeRequested }))
    .digest("hex");
  const previous = (
    await db.query<Row>(
      `select * from partner_need_conflict_reviews where user_id=$1 and lead_id=$2
       order by revision desc limit 1`,
      [actor.userId, lead.id],
    )
  ).rows[0];
  const current = previous?.subject_key === personalNeedSubject(lead) ? previous : null;
  const history = (
    await db.query<Row>(
      `select * from partner_need_conflict_reviews where user_id=$1 and lead_id=$2
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
        : current.valid_until! <= new Date(assessedAt)
          ? "expired"
          : "recorded";
  return needConflictDossierSchema.parse({
    leadId: lead.id,
    advisorId: actor.userId,
    assessedAt,
    scope: preferences.scope,
    scopeFingerprint,
    revision: previous?.revision ?? 0,
    canDeclareAbsence: !changeRequested,
    canWithdraw: current?.action === "decide",
    status,
    effectivePosition: status === "recorded" ? current!.position : null,
    current: current ? record(current) : null,
    history: history.slice(0, 20).map(record),
    nextBeforeRevision: history.length > 20 ? history[19]!.revision : null,
    changeRequested,
    basis,
  });
}

export async function decideNeedConflict(
  db: Executor,
  actor: PartnerActor,
  lead: PersonalNeedTarget,
  member: PartnerApplication | null,
  input: NeedConflictInput,
) {
  // Acquire the canonical profile guard before choosing the write's observation instant.
  await readAdvicePreferences(db, actor, lead);
  const now = (await db.query<{ at: Date }>("select clock_timestamp() at")).rows[0]!.at;
  const current = await readNeedConflict(db, actor, lead, member, now.toISOString());
  if (input.revision !== current.revision || input.scopeFingerprint !== current.scopeFingerprint)
    fail("PARTNER_CONFLICT", 409);
  if (
    (input.action === "withdraw" && !current.canWithdraw) ||
    (input.position === "none_declared" && !current.canDeclareAbsence)
  )
    fail("PARTNER_ACTION_REQUIRED");
  const id = newId("pneedconflict");
  const inserted = await db.query(
    `insert into partner_need_conflict_reviews
     (id,lead_id,user_id,organization_id,subject_key,revision,scope_fingerprint,scope,basis,action,position,reason,reviewed_scope,valid_until,created_at)
     select $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,clock_timestamp()
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
    ],
  );
  if (!inserted.rowCount) fail("PARTNER_ACTION_REQUIRED");
  // Audit is private and carries no need, position, review scope or reason; no Lead effects.
  await event(
    db,
    actor,
    null,
    input.action === "decide" ? "need_conflict.decided.v1" : "need_conflict.withdrawn.v1",
    "",
    "private",
    id,
  );
  return lead.id;
}
