import {
  referentAssessmentSchema,
  sharedReferentAssessmentSchema,
  type ReferentAssessment,
} from "@coverview/contracts/partner";
import type { Executor, PartnerActor } from "./partner.policy.js";
import { readAdvicePreferences, type AdviceTarget } from "./partner.advice.js";
import { readLeadReferentState } from "./partner.referents.js";
import { readPracticeSummary } from "./partner.practice.js";
import { readCompetenceSummary } from "./partner.competence.js";
import { compareAdvisorCriterion } from "./partner.advisor-criteria.js";
import { readSharedModes } from "./partner.shared-modes.js";

// Caller authorizes the existing Lead audience and holds actor/Lead/profile locks in one snapshot.
// Deliberately never reads the private availability dossier, including its modes.
export async function readReferentAssessment(
  db: Executor,
  actor: PartnerActor,
  lead: AdviceTarget,
  assessedAt: string,
  includeSharedModes = false,
) {
  const preferences = await readAdvicePreferences(db, actor, lead);
  const continuity = await readLeadReferentState(db, lead);
  const selection = continuity.selection;
  const status =
    lead.stage === "completed"
      ? "closed"
      : continuity.status === "client_change_requested"
        ? "client_change_requested"
        : !selection
          ? "unlinked"
          : selection.status === "chosen"
            ? "human_review"
            : selection.status;
  let assessment: ReferentAssessment["assessment"] = null;
  if (status === "human_review" && selection?.advisor) {
    const current = preferences.status === "confirmed" ? preferences.current : null;
    const practice = await readPracticeSummary(db, selection.advisor.id);
    assessment = {
      preferences: {
        status: preferences.status,
        confirmedAt: current?.confirmedAt ?? null,
        languageCode: current?.languageCode ?? null,
        canton: current?.canton ?? null,
        mode: current?.mode ?? null,
      },
      practice,
      competence: await readCompetenceSummary(db, selection.advisor.id, lead.category),
      criteria: {
        language: compareAdvisorCriterion(
          preferences.status,
          current?.languageCode ?? null,
          practice.languageCodes,
          practice.status,
        ),
        canton:
          current && (current.mode === "phone" || current.mode === "video")
            ? { status: "not_applicable", reason: "remote_mode" }
            : compareAdvisorCriterion(
                preferences.status,
                current?.canton ?? null,
                practice.cantons,
                practice.status,
              ),
        mode: { status: "unknown", reason: "shared_source_unavailable" },
      },
      remainingChecks: [
        "conventions",
        "availability",
        "capacity",
        "conflicts",
        "need_expertise",
        "quality",
      ],
    };
  }
  const result = referentAssessmentSchema.parse({
    leadId: lead.id,
    title: lead.title,
    category: lead.category,
    assessedAt,
    status,
    selection: selection
      ? { ...selection, advisor: selection.status === "chosen" ? selection.advisor : null }
      : null,
    assessment,
  });
  if (!includeSharedModes) return result;
  if (!assessment || !selection?.advisor) return sharedReferentAssessmentSchema.parse(result);
  const sharedModes = await readSharedModes(db, selection.advisor.id);
  const mode = compareAdvisorCriterion(
    assessment.preferences.status,
    assessment.preferences.mode,
    sharedModes.modes,
    sharedModes.status === "withdrawn" ? "missing" : sharedModes.status,
  );
  return sharedReferentAssessmentSchema.parse({
    ...result,
    assessment: {
      ...assessment,
      sharedModes,
      criteria: {
        ...assessment.criteria,
        mode:
          mode.reason === "declaration_missing"
            ? { status: "unknown", reason: "shared_source_unavailable" }
            : mode,
      },
    },
  });
}
