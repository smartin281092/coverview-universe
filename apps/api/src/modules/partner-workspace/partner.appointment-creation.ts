import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import {
  personalAppointmentPreviewSchema,
  type PersonalAppointmentProposal,
  type PartnerContext,
  type LeadDetail,
} from "@coverview/contracts/partner";
import type { AdviceTarget } from "./partner.advice.js";
import type { PartnerActor } from "./partner.policy.js";
import { readAppointmentPeriod } from "./partner.appointment-assessment.js";

// Caller has locked the current actor, professional membership and personally authorized Lead.
export async function previewPersonalAppointment(
  tx: PoolClient,
  actor: PartnerActor,
  lead: AdviceTarget & { revision: number },
  ctx: PartnerContext,
  proposal: PersonalAppointmentProposal,
  previous?: LeadDetail["appointments"][number] & {
    occupiedBeforeMinutes: number;
    occupiedAfterMinutes: number;
  },
) {
  const { appointment, time } = proposal;
  const assessment = await readAppointmentPeriod(
    tx,
    actor,
    lead,
    previous?.id ?? null,
    {
      starts_at: new Date(appointment.startsAt),
      duration_minutes: appointment.durationMinutes,
      mode: appointment.mode,
      timezone: appointment.timezone,
      occupied_before_minutes: time.preparationMinutes + time.travelBeforeMinutes,
      occupied_after_minutes: time.travelAfterMinutes,
    },
    ctx,
    true,
    lead.revision,
  );
  const period = assessment.timeProtection!;
  const basis = createHash("sha256")
    .update(
      JSON.stringify({
        actor: actor.userId,
        proposal,
        previous,
        sources: period.basis,
      }),
    )
    .digest("hex");
  return personalAppointmentPreviewSchema.parse({
    proposal,
    previous,
    assessment,
    basis,
    occupiedStartsAt: period.startsAt,
    occupiedEndsAt: period.endsAt,
    canConfirm:
      assessment.status === "consistent" &&
      (!previous ||
        (Date.parse(previous.startsAt) > Date.now() &&
          Date.parse(previous.startsAt) !== Date.parse(appointment.startsAt))) &&
      Date.parse(period.startsAt) > Date.now() &&
      (!["phone", "video"].includes(appointment.mode) ||
        (time.travelBeforeMinutes === 0 && time.travelAfterMinutes === 0)),
  });
}
