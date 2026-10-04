import type {
  RecommendationInput,
  ResearchModel,
  RankedRecommendation,
} from "@coverview/contracts/health-recommendation";
import type { HealthOffer } from "@coverview/contracts/health-insurance";
export const answerValues = (input: RecommendationInput, id: string): string[] =>
  input.answers[id]?.status === "answered"
    ? input.answers[id].values.filter((value) => !["unknown", "declined"].includes(value))
    : [];
export const hasAnswer = (input: RecommendationInput, id: string) =>
  input.answers[id] !== undefined;
export function compatibility(
  offer: HealthOffer,
  model: ResearchModel | undefined,
  input: RecommendationInput,
): Pick<RankedRecommendation, "compatibility" | "reasons" | "uncertainties"> {
  const reasons: string[] = [],
    uncertainties: string[] = [];
  let incompatible = false;
  const free = offer.category === "BASE";
  const verifiedAccess =
    model?.year === input.tariff.year &&
    model.access.verifiedYear &&
    !(model.access.ageScope === "adult" && offer.ageGroup === "child");
  const access = answerValues(input, "access");
  const obligations = answerValues(input, "obligations")[0];
  if (offer.eligibility === "municipality_required") uncertainties.push("municipality_required");
  if (!input.tariffKnown.birth || !input.tariffKnown.locality)
    uncertainties.push("tariff_incomplete");
  if (!access.length) uncertainties.push("acceptable_path_unknown");
  if ((access.includes("free") || obligations === "no") && !free) {
    incompatible = true;
    reasons.push("mandatory_path_refused");
  }
  if (free) reasons.push("free_access");
  else {
    if (obligations !== "yes" && obligations !== "no") uncertainties.push("obligations_unresolved");
    if (!verifiedAccess) uncertainties.push("model_conditions_unverified");
    else if (access.length && !access.includes("any") && !access.includes("free")) {
      if (!model.access.contacts.length) uncertainties.push("entry_points_unknown");
      else if (!model.access.contacts.some((value) => access.includes(value))) {
        incompatible = true;
        reasons.push("entry_points_incompatible");
      } else reasons.push("acceptable_entry_point");
    }
  }
  if (answerValues(input, "access_flex").includes("required") && !free) {
    if (!verifiedAccess || !model || model.access.multipleEntry === null)
      uncertainties.push("multiple_entry_unknown");
    else if (!model.access.multipleEntry) {
      incompatible = true;
      reasons.push("multiple_entry_required");
    }
  }
  const professionals = answerValues(input, "professionals");
  if (!professionals.length) uncertainties.push("professionals_unknown");
  if (!free && professionals.some((value) => ["gp", "specialist"].includes(value))) {
    for (const professional of professionals.filter((value) =>
      ["gp", "specialist"].includes(value),
    )) {
      const importance = answerValues(input, `importance:${professional}`);
      const essential = importance.includes("required");
      if (!importance.length) uncertainties.push("professional_importance_unknown");
      // Admission evidence must be specific to the identified professional, never a category-wide inference.
      const identifier = answerValues(input, `professional:${professional}`)[0];
      const admission =
        identifier && verifiedAccess && model
          ? model.access.professionalAdmission[identifier]
          : undefined;
      if (admission === "incompatible" && essential) {
        incompatible = true;
        reasons.push(`professional_${professional}_incompatible`);
      } else if (admission !== "compatible")
        uncertainties.push(`professional_${professional}_verify`);
    }
  }
  if (!input.tariff.accident && !answerValues(input, "accident").includes("covered"))
    uncertainties.push("accident_exclusion_unverified");
  return {
    compatibility: incompatible ? "incompatible" : uncertainties.length ? "verify" : "compatible",
    reasons,
    uncertainties,
  };
}
