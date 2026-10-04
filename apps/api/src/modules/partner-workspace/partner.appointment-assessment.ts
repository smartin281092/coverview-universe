import type { PoolClient } from "pg";
import { createHash } from "node:crypto";
import {
  appointmentAssessmentSchema,
  type AppointmentAssessment,
  type PartnerContext,
  appointmentTimeRecordSchema,
} from "@coverview/contracts/partner";
import { fail, type Executor, type PartnerActor } from "./partner.policy.js";
import { readCurrentAvailability } from "./partner.availability.js";
import { readAdvicePreferences, type AdviceTarget } from "./partner.advice.js";

export function availabilityPeriod(
  periods: { kind: string; startsAt: string; endsAt: string }[],
  start: number,
  end: number,
) {
  const ordered = periods
    .map((p) => ({ kind: p.kind, start: Date.parse(p.startsAt), end: Date.parse(p.endsAt) }))
    .sort((a, b) => a.start - b.start);
  let coveredUntil = start;
  for (const p of ordered) {
    if (p.kind === "available" && p.start <= coveredUntil && p.end > coveredUntil)
      coveredUntil = p.end;
  }
  return ordered.some((p) => p.kind === "absent" && p.start < end && p.end > start)
    ? "absence"
    : coveredUntil >= end
      ? "covered"
      : "unreported";
}
export async function overlappingAppointment(
  tx: Executor,
  advisorId: string,
  appointmentId: string | null,
  start: Date,
  end: Date,
) {
  // C6b: a confirmed participation in another appointment occupies the professional too, with
  // their own buffers, while it matches that appointment's current terms.
  return !!(
    await tx.query(
      `select id from partner_appointments where advisor_id=$1 and ($2::text is null or id<>$2) and state='scheduled'
     and starts_at - occupied_before_minutes * interval '1 minute' < $4
     and starts_at + (duration_minutes + occupied_after_minutes) * interval '1 minute' > $3
     union all
     select a.id from partner_appointment_participants p join partner_appointments a on a.id=p.appointment_id
     where p.user_id=$1 and p.state='confirmed' and p.terms_revision=a.link_terms_revision and a.state='scheduled'
     and ($2::text is null or a.id<>$2)
     and a.starts_at - (p.preparation_minutes + p.travel_before_minutes) * interval '1 minute' < $4
     and a.starts_at + (a.duration_minutes + p.travel_after_minutes) * interval '1 minute' > $3 limit 1`,
      [advisorId, appointmentId, start, end],
    )
  ).rowCount;
}

export async function readAppointmentAssessment(
  tx: PoolClient,
  actor: PartnerActor,
  lead: AdviceTarget,
  appointmentId: string,
  ctx: PartnerContext,
  canSchedule: boolean,
  leadRevision: number,
) {
  // The caller has locked the actor, membership and authorized Lead. Never assess a colleague.
  const appt = (
    await tx.query<{
      starts_at: Date;
      duration_minutes: number;
      mode: string;
      timezone: string;
      occupied_before_minutes: number;
      occupied_after_minutes: number;
    }>(
      `select starts_at,duration_minutes,mode,timezone,occupied_before_minutes,occupied_after_minutes from partner_appointments
     where id=$1 and lead_id=$2 and advisor_id=$3 and state='scheduled' for share`,
      [appointmentId, lead.id, actor.userId],
    )
  ).rows[0];
  if (!appt) return fail("PARTNER_NOT_FOUND", 404);
  return appointmentAssessmentSchema.parse({
    appointmentId,
    ...(await readAppointmentPeriod(
      tx,
      actor,
      lead,
      appointmentId,
      appt,
      ctx,
      canSchedule,
      leadRevision,
    )),
  });
}

// Personal proposal and existing commitment share exactly the same source checks.
export async function readAppointmentPeriod(
  tx: PoolClient,
  actor: PartnerActor,
  lead: AdviceTarget,
  appointmentId: string | null,
  appt: {
    starts_at: Date;
    duration_minutes: number;
    mode: string;
    timezone: string;
    occupied_before_minutes: number;
    occupied_after_minutes: number;
  },
  ctx: PartnerContext,
  canSchedule: boolean,
  leadRevision: number,
  advisorId = actor.userId,
) {
  // The caller authorizes the explicit professional; the actor remains the real authenticated user.
  await tx.query("select pg_advisory_xact_lock(hashtextextended($1,1))", [advisorId]);
  const current = await readCurrentAvailability(tx, ctx.application);
  const start = appt.starts_at.getTime(),
    end = start + appt.duration_minutes * 60000;
  const occupiedStart = start - appt.occupied_before_minutes * 60000,
    occupiedEnd = end + appt.occupied_after_minutes * 60000;
  const declaration: AppointmentAssessment["declaration"] = {
    revision: current?.revision ?? null,
    professionalRevision: current?.professionalRevision ?? null,
    scope: current?.professionalScope ?? "missing",
    mode: "unknown",
    period: "unknown",
  };
  if (current?.professionalScope === "current") {
    declaration.mode = !current.modes.length
      ? "unspecified"
      : current.modes.some((mode) => mode === appt.mode)
        ? "offered"
        : "not_offered";
    declaration.period = availabilityPeriod(current.periods, occupiedStart, occupiedEnd);
  }
  // Other commitments may be in a Lead no longer visible here: only expose the collision fact.
  const overlappingCommitment = await overlappingAppointment(
    tx,
    advisorId,
    appointmentId,
    new Date(occupiedStart),
    new Date(occupiedEnd),
  );
  const preference = await readAdvicePreferences(tx, actor, lead);
  const requestedMode =
    preference.status === "confirmed" ? (preference.current?.mode ?? null) : null;
  const client: AppointmentAssessment["client"] = {
    preferenceRevision: preference.current?.revision ?? null,
    requestedMode,
    mode:
      preference.status === "confirmation_required"
        ? "confirmation_required"
        : preference.status === "unlinked"
          ? "unlinked"
          : !requestedMode
            ? "unspecified"
            : requestedMode === appt.mode
              ? "matches"
              : "differs",
    changeRequested: !!(
      await tx.query(
        "select id from partner_notifications where lead_id=$1 and kind='interlocutor_request' and resolved_at is null limit 1",
        [lead.id],
      )
    ).rowCount,
  };
  const responsibility =
    ctx.canAdvise &&
    canSchedule &&
    (ctx.administrator ||
      ctx.application?.categories.some((category) => category === lead.category))
      ? "current"
      : "review_required";
  const attention =
    responsibility !== "current" ||
    overlappingCommitment ||
    client.changeRequested ||
    client.mode === "differs" ||
    declaration.mode === "not_offered" ||
    declaration.period === "absence";
  const incomplete =
    declaration.scope !== "current" ||
    declaration.mode !== "offered" ||
    declaration.period !== "covered" ||
    client.mode !== "matches";
  const history = (
    await tx.query<{
      revision: number;
      basis: string;
      preparation_minutes: number;
      travel_before_minutes: number;
      travel_after_minutes: number;
      starts_at: Date;
      ends_at: Date;
      recorded_at: Date;
      evidence: { rescheduling?: unknown };
    }>(
      "select * from partner_appointment_time_plans where appointment_id=$1 and advisor_id=$2 order by revision desc limit 20",
      [appointmentId, advisorId],
    )
  ).rows.map((row) =>
    appointmentTimeRecordSchema.parse({
      revision: row.revision,
      basis: row.basis,
      preparationMinutes: row.preparation_minutes,
      travelBeforeMinutes: row.travel_before_minutes,
      travelAfterMinutes: row.travel_after_minutes,
      startsAt: row.starts_at.toISOString(),
      endsAt: row.ends_at.toISOString(),
      recordedAt: row.recorded_at.toISOString(),
      rescheduling: row.evidence.rescheduling,
    }),
  );
  const basis = createHash("sha256")
    .update(
      JSON.stringify({
        leadId: lead.id,
        leadRevision,
        appointmentId,
        appt,
        declaration,
        preferenceRevision: preference.revision,
        scopeRevision: preference.scopeRevision,
        profileRevision: preference.profileRevision,
        client,
        responsibility,
        revision: history[0]?.revision ?? 0,
      }),
    )
    .digest("hex");
  return appointmentAssessmentSchema.omit({ appointmentId: true }).parse({
    leadId: lead.id,
    appointmentId,
    checkedAt: new Date().toISOString(),
    startsAt: appt.starts_at.toISOString(),
    endsAt: new Date(end).toISOString(),
    mode: appt.mode,
    timezone: appt.timezone,
    timeProtection: {
      basis,
      canConfirm: responsibility === "current" && start > Date.now(),
      current: history[0] ?? null,
      history,
      startsAt: new Date(occupiedStart).toISOString(),
      endsAt: new Date(occupiedEnd).toISOString(),
    },
    status: attention ? "attention" : incomplete ? "incomplete" : "consistent",
    responsibility,
    declaration,
    overlappingCommitment,
    client,
    unverifiedChecks: [
      "preparation",
      ...(["home", "office"].includes(appt.mode) ? ["travel"] : []),
      "external_commitments",
      "capacity",
      "client_agreement",
      "eligibility",
    ],
  });
}
