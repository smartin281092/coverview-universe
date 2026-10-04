import type { PoolClient } from "pg";
import type {
  AppointmentAssessment,
  AppointmentTimeInput,
  PartnerContext,
} from "@coverview/contracts/partner";
import { availabilityPeriod, overlappingAppointment } from "./partner.appointment-assessment.js";
import { readCurrentAvailability } from "./partner.availability.js";
import { fail, type PartnerActor } from "./partner.policy.js";
import { newId, event } from "./partner.audit.js";

// Called only after the personal assessment has locked all authorization/source holders.
export async function protectAppointmentTime(
  tx: PoolClient,
  actor: PartnerActor,
  ctx: PartnerContext,
  assessed: AppointmentAssessment,
  input: AppointmentTimeInput,
) {
  const protection = assessed.timeProtection;
  if (!protection?.canConfirm) fail("PARTNER_ACCESS_DENIED", 403);
  if (input.basis !== protection.basis) fail("PARTNER_CONFLICT", 409);
  if (
    assessed.declaration.scope !== "current" ||
    assessed.declaration.mode !== "offered" ||
    assessed.client.mode !== "matches" ||
    assessed.client.changeRequested ||
    (["phone", "video"].includes(assessed.mode) &&
      (input.travelBeforeMinutes !== 0 || input.travelAfterMinutes !== 0))
  )
    fail("PARTNER_ACTION_REQUIRED");
  const before = input.preparationMinutes + input.travelBeforeMinutes;
  const start = Date.parse(assessed.startsAt) - before * 60000,
    end = Date.parse(assessed.endsAt) + input.travelAfterMinutes * 60000;
  if (start <= Date.now()) fail("PARTNER_ACTION_REQUIRED");
  const availability = await readCurrentAvailability(tx, ctx.application);
  if (!availability || availabilityPeriod(availability.periods, start, end) !== "covered")
    fail("PARTNER_ACTION_REQUIRED");
  if (
    await overlappingAppointment(
      tx,
      actor.userId,
      assessed.appointmentId,
      new Date(start),
      new Date(end),
    )
  )
    fail("PARTNER_APPOINTMENT_CONFLICT", 409);
  await recordAppointmentTime(
    tx,
    actor,
    assessed.appointmentId,
    (protection.current?.revision ?? 0) + 1,
    input,
    new Date(start),
    new Date(end),
    {
      declaration: assessed.declaration,
      client: assessed.client,
      appointmentStartsAt: assessed.startsAt,
      appointmentEndsAt: assessed.endsAt,
      mode: assessed.mode,
    },
  );
}

// Internal writer: authorization, revision and full-period checks must already hold in this transaction.
export async function recordAppointmentTime(
  tx: PoolClient,
  actor: PartnerActor,
  appointmentId: string,
  revision: number,
  input: AppointmentTimeInput,
  start: Date,
  end: Date,
  evidence: Record<string, unknown>,
) {
  const id = newId("aptime");
  await tx.query(
    `insert into partner_appointment_time_plans(id,appointment_id,advisor_id,revision,basis,preparation_minutes,travel_before_minutes,travel_after_minutes,starts_at,ends_at,evidence)
     values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      id,
      appointmentId,
      actor.userId,
      revision,
      input.basis,
      input.preparationMinutes,
      input.travelBeforeMinutes,
      input.travelAfterMinutes,
      start,
      end,
      JSON.stringify(evidence),
    ],
  );
  await tx.query(
    "update partner_appointments set occupied_before_minutes=$2,occupied_after_minutes=$3 where id=$1",
    [appointmentId, input.preparationMinutes + input.travelBeforeMinutes, input.travelAfterMinutes],
  );
  // No Lead event or fanout: these periods are private to the advisor, including from Admin.
  await event(tx, actor, null, "appointment.time_protected.v1", "", "private", id);
}
