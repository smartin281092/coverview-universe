import { advicePreferencesSchema, type AdvicePreferencesInput } from "@coverview/contracts/partner";
import { fail, type Executor, type PartnerActor } from "./partner.policy.js";
import { event, newId } from "./partner.audit.js";
import { z } from "zod";

export type AdviceTarget = {
  id: string;
  title: string;
  category: string;
  object: string;
  details: unknown;
  clientUserId: string | null;
  clientProfileId: string | null;
  clientName: string;
  adviceScopeRevision: number;
  stage: string;
};
type Subject = { id: string; ownerId: string; revision: number; name: string };
type Row = {
  revision: number;
  scope_revision: number;
  profile_revision: number;
  subject_id: string;
  confirmed_by: string;
  language_code: string | null;
  mode: string | null;
  canton: string | null;
  scope: unknown;
  created_at: Date;
};
// A null actor is internal composition (matching): no audience, only the canonical subject.
async function subject(db: Executor, actor: PartnerActor | null, lead: AdviceTarget) {
  if (!lead.clientUserId) return null;
  // Same row as canonical profile transfer. The original Lead owner is not an authority.
  const row = lead.clientProfileId
    ? (
        await db.query<{ user_id: string; revision: number; name: string }>(
          "select user_id,revision,display_name name from managed_profiles where id=$1 for share",
          [lead.clientProfileId],
        )
      ).rows[0]
    : (
        await db.query<{ user_id: string; revision: number; name: string }>(
          "select user_id,0 revision,trim(concat_ws(' ',fields->'firstName'->>'value',fields->'lastName'->>'value')) name from identity_profiles where user_id=$1 for share",
          [lead.clientUserId],
        )
      ).rows[0];
  if (!row || (actor?.wallet && row.user_id !== actor.userId))
    return fail("PARTNER_NOT_FOUND", 404);
  return {
    id: lead.clientProfileId ? `profile:${lead.clientProfileId}` : `self:${row.user_id}`,
    ownerId: row.user_id,
    revision: row.revision,
    name: row.name,
  };
}
const scope = (lead: AdviceTarget) => ({
  title: lead.title,
  category: lead.category,
  object: lead.object,
  context: z.object({ context: z.string() }).parse(lead.details).context,
});
async function latest(db: Executor, leadId: string) {
  return (
    await db.query<Row>(
      "select * from partner_advice_preferences where lead_id=$1 order by revision desc limit 1",
      [leadId],
    )
  ).rows[0];
}
function confirmation(row: Row, target: Subject) {
  return {
    revision: row.revision,
    scopeRevision: row.scope_revision,
    profileRevision: row.profile_revision,
    languageCode: row.language_code,
    mode: row.mode,
    canton: row.canton,
    scope: row.scope,
    confirmedAt: row.created_at.toISOString(),
    currentOwnerConfirmation:
      row.confirmed_by === target.ownerId && row.profile_revision === target.revision,
  };
}
export async function readAdvicePreferences(
  db: Executor,
  actor: PartnerActor,
  lead: AdviceTarget,
  beforeRevision?: number,
) {
  const target = await subject(db, actor, lead);
  const previous = await latest(db, lead.id);
  // A relinked Lead must never project the previous person's choices or historical need.
  const current =
    target && previous?.subject_id === target.id ? confirmation(previous, target) : null;
  const rows = target
    ? (
        await db.query<Row>(
          "select * from partner_advice_preferences where lead_id=$1 and subject_id=$2 and ($3::int is null or revision<$3) order by revision desc limit 21",
          [lead.id, target.id, beforeRevision ?? null],
        )
      ).rows
    : [];
  return advicePreferencesSchema.parse({
    leadId: lead.id,
    profileName: target?.name || lead.clientName,
    profileRevision: target?.revision ?? null,
    scopeRevision: lead.adviceScopeRevision,
    scope: scope(lead),
    revision: previous?.revision ?? 0,
    canConfirm: !!target && !!actor.wallet && !actor.administrator && lead.stage !== "completed",
    status: !target
      ? "unlinked"
      : !current
        ? "unset"
        : current.currentOwnerConfirmation && current.scopeRevision === lead.adviceScopeRevision
          ? "confirmed"
          : "confirmation_required",
    current,
    history: target ? rows.slice(0, 20).map((row) => confirmation(row, target)) : [],
    nextBeforeRevision: rows.length > 20 ? rows[19]!.revision : null,
  });
}
// Matching composition: the current confirmed choices of the canonical subject, nothing else.
export async function readConfirmedAdvice(db: Executor, lead: AdviceTarget) {
  const target = await subject(db, null, lead);
  const previous = target ? await latest(db, lead.id) : undefined;
  const current =
    target && previous?.subject_id === target.id ? confirmation(previous, target) : null;
  const status = !target
    ? ("unlinked" as const)
    : !current
      ? ("unset" as const)
      : current.currentOwnerConfirmation && current.scopeRevision === lead.adviceScopeRevision
        ? ("confirmed" as const)
        : ("confirmation_required" as const);
  return { status, current };
}
export async function confirmAdvicePreferences(
  db: Executor,
  actor: PartnerActor,
  lead: AdviceTarget,
  input: AdvicePreferencesInput,
) {
  if (!actor.wallet || actor.administrator || lead.stage === "completed")
    fail("PARTNER_ACCESS_DENIED", 403);
  const target = await subject(db, actor, lead);
  if (!target) return fail("PARTNER_INVALID_CLIENT");
  const previous = await latest(db, lead.id);
  if (
    input.revision !== (previous?.revision ?? 0) ||
    input.scopeRevision !== lead.adviceScopeRevision ||
    input.profileRevision !== target.revision
  )
    fail("PARTNER_CONFLICT", 409);
  const id = newId("padvice");
  await db.query(
    `insert into partner_advice_preferences(id,lead_id,subject_id,self_user_id,profile_id,profile_revision,scope_revision,scope,revision,language_code,mode,canton,confirmed_by)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      id,
      lead.id,
      target.id,
      lead.clientProfileId ? null : target.ownerId,
      lead.clientProfileId,
      target.revision,
      lead.adviceScopeRevision,
      JSON.stringify(scope(lead)),
      input.revision + 1,
      input.languageCode,
      input.mode,
      input.canton,
      actor.userId,
    ],
  );
  await event(db, actor, lead.id, "client.advice_preferences_confirmed.v1", "", "client", id);
  // Own history/revision only: no Lead update, useful-action clock, notification or appointment.
  return lead.id;
}
