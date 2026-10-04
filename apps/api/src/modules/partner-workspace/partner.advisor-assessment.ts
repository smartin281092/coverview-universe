import {
  advisorAssessmentSchema,
  capacityAdvisorAssessmentSchema,
  type AdvisorAssessment,
  type PartnerApplication,
} from "@coverview/contracts/partner";
import type { Executor, PartnerActor } from "./partner.policy.js";
import { readAdvicePreferences, type AdviceTarget } from "./partner.advice.js";
import { readPracticeSummary } from "./partner.practice.js";
import { readCurrentAvailability } from "./partner.availability.js";
import { readCompetenceSummary } from "./partner.competence.js";
import { readLeadReferentSelection } from "./partner.referents.js";
import { compareAdvisorCriterion } from "./partner.advisor-criteria.js";
import { readCapacityAssessment, readCapacityWorkload } from "./partner.capacity.js";

// Caller authorizes the personal mandate and holds actor/member/Lead locks in one snapshot.
export async function readAdvisorAssessment(
  db: Executor,
  actor: PartnerActor,
  lead: AdviceTarget,
  member: PartnerApplication | null,
  assessedAt: string,
  includeCapacity = false,
) {
  const preferences = await readAdvicePreferences(db, actor, lead);
  const current = preferences.status === "confirmed" ? preferences.current : null;
  const practice = await readPracticeSummary(db, actor.userId);
  const availability = await readCurrentAvailability(db, member);
  const modes: AdvisorAssessment["modes"] = {
    status: !availability
      ? "missing"
      : availability.professionalScope === "current"
        ? "declared"
        : "scope_changed",
    revision: availability?.revision ?? null,
    declaredAt: availability?.declaredAt ?? null,
    values: availability?.professionalScope === "current" ? availability.modes : [],
  };
  const compare = (
    wanted: string | null,
    values: string[],
    source: Parameters<typeof compareAdvisorCriterion>[3],
  ) => compareAdvisorCriterion(preferences.status, wanted, values, source);
  const selection = await readLeadReferentSelection(db, lead);
  const result = advisorAssessmentSchema.parse({
    leadId: lead.id,
    advisorId: actor.userId,
    category: lead.category,
    assessedAt,
    preferences: { status: preferences.status, scopeRevision: preferences.scopeRevision, current },
    practice,
    modes,
    competence: await readCompetenceSummary(db, actor.userId, lead.category),
    continuity: {
      status: !selection
        ? "unlinked"
        : selection.status === "chosen"
          ? selection.advisor?.id === actor.userId
            ? "chosen_self"
            : "chosen_other"
          : selection.status,
      confirmedAt: selection?.confirmedAt ?? null,
      changeRequested: !!(
        await db.query(
          "select id from partner_notifications where lead_id=$1 and kind='interlocutor_request' and resolved_at is null limit 1",
          [lead.id],
        )
      ).rowCount,
    },
    criteria: {
      language: compare(current?.languageCode ?? null, practice.languageCodes, practice.status),
      canton:
        current && (current.mode === "phone" || current.mode === "video")
          ? { status: "not_applicable", reason: "remote_mode" }
          : compare(current?.canton ?? null, practice.cantons, practice.status),
      mode: compare(current?.mode ?? null, modes.values, modes.status),
    },
    remainingChecks: [
      "conventions",
      "availability",
      "capacity",
      "conflicts",
      "need_expertise",
      "quality",
    ],
  });
  if (!includeCapacity) return result;
  return capacityAdvisorAssessmentSchema.parse({
    ...result,
    version: 2,
    capacity: await readCapacityAssessment(db, member, result.category, assessedAt),
    workload: await readCapacityWorkload(db, actor.userId, assessedAt),
  });
}
