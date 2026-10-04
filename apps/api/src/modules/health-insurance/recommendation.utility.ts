import type {
  EvidenceBenefit,
  RecommendationInput,
  RecommendationRules,
  ResearchModel,
  RankedRecommendation,
} from "@coverview/contracts/health-recommendation";
import type { HealthOffer } from "@coverview/contracts/health-insurance";
import { answerValues, hasAnswer } from "./recommendation.compatibility.js";
import { usableEvidence } from "./recommendation.cost.js";
export function benefitCategory(benefit: EvidenceBenefit) {
  if (benefit.category === "pharmacy") return "pharmacy";
  if (benefit.category === "telemedicine" || benefit.category === "access") return "digital";
  if (benefit.category === "prevention" || /fitness|sport|active/i.test(benefit.title))
    return "fitness";
  return "family";
}
export function benefitBranchInactive(input: RecommendationInput, benefit: EvidenceBenefit) {
  if (benefitAudienceInactive(input, benefit)) return true;
  const parentIds = [
    "lifestyle",
    "benefit_types",
    ...(benefit.category === "prevention" ? ["prevention"] : []),
    ...(["pharmacy", "cost_sharing"].includes(benefit.category) ? ["medication"] : []),
  ];
  const relevant = parentIds.some((id) =>
    answerValues(input, id).some((value) =>
      id === "lifestyle"
        ? value === benefitCategory(benefit)
        : id === "benefit_types"
          ? value === benefit.equivalenceGroup
          : value !== "none",
    ),
  );
  // A removed preference deactivates its dependent answers without deleting them.
  return !relevant && parentIds.some((id) => input.answers[id] !== undefined);
}
export function benefitAudienceInactive(input: RecommendationInput, benefit: EvidenceBenefit) {
  return (
    (input.sex === "male" || input.sex === "female") &&
    (benefit.questionAudience === "male" || benefit.questionAudience === "female") &&
    input.sex !== benefit.questionAudience
  );
}
// Filters of the historical `health_benefits` table (comparator before the taxonomy).
export const legacyBenefitFilterKeys = [
  "generic_deductible_waiver",
  "breast_screening_deductible_waiver",
  "breast_screening_free",
  "telemedicine_free",
  "pharmacy_first_advice_free",
];
const preferredBenefitTypes = (input: RecommendationInput) =>
  answerValues(input, "priority")[0] === "premium"
    ? []
    : answerValues(input, "benefit_types").filter((value) => value !== "none");
// The model offers this advantage with the basic insurance alone: free, sourced for this year,
// not common to everyone by law. Contradictory or inaccessible evidence never qualifies, nor an
// offer whose stated validity does not reach this year.
export function offeredWithBase(fact: EvidenceBenefit, year: number) {
  return (
    fact.year === year &&
    (fact.validUntil === null || fact.validUntil >= `${year}-01-01`) &&
    (fact.validFrom === null || fact.validFrom <= `${year}-12-31`) &&
    fact.utility !== "none" &&
    !["legal_common", "unknown", "public_service"].includes(fact.classification) &&
    fact.requiresSameBase !== false &&
    fact.requiresSupplementary === false &&
    fact.extraCostMinor === 0 &&
    ["verified", "partial"].includes(fact.verification)
  );
}
// A preferred type adds service utility only for a fact offered with the base; services reachable
// without this basic insurance never count; amounts are handled separately by the cost engine.
export function typeQualification(
  fact: EvidenceBenefit,
  input: RecommendationInput,
  rules: RecommendationRules,
): "counted" | "counted_unconfirmed" | "conditional" | "already_accessible" | "irrelevant" {
  if (
    fact.utility === "none" ||
    ["legal_common", "unknown"].includes(fact.classification) ||
    benefitAudienceInactive(input, fact)
  )
    return "irrelevant";
  if (fact.classification === "public_service" || fact.requiresSameBase === false)
    return "already_accessible";
  if (!offeredWithBase(fact, input.tariff.year)) return "conditional";
  if (usableEvidence(fact, input.tariff.year)) return "counted";
  return rules.serviceEvidence === "official" ? "counted_unconfirmed" : "conditional";
}
export function assessUtility(
  offer: HealthOffer,
  model: ResearchModel | undefined,
  facts: EvidenceBenefit[],
  input: RecommendationInput,
  rules: RecommendationRules,
) {
  const objective = answerValues(input, "priority")[0];
  const interested = objective === "premium" ? [] : answerValues(input, "lifestyle");
  const wantedTypes = preferredBenefitTypes(input);
  const groups = new Set<string>();
  const savings = new Map<string, number>();
  const benefits: RankedRecommendation["benefits"] = [];
  const dimensions = { freedom: 0, practical: 0, simplicity: 0, services: 0, total: 0 };
  if (offer.category === "BASE") dimensions.freedom = rules.weights.freedom;
  if (
    model?.year === input.tariff.year &&
    model.access.verifiedYear &&
    !(model.access.ageScope === "adult" && offer.ageGroup === "child") &&
    model.access.contacts.some((value) => answerValues(input, "access_preference").includes(value))
  )
    dimensions.practical = rules.weights.practical;
  if (
    model?.year === input.tariff.year &&
    model.access.verifiedYear &&
    !(model.access.ageScope === "adult" && offer.ageGroup === "child") &&
    model.access.multipleEntry &&
    answerValues(input, "access_flex").includes("preferred")
  )
    dimensions.simplicity = rules.weights.simplicity;
  for (const benefit of facts) {
    const typed = wantedTypes.includes(benefit.equivalenceGroup);
    // A preferred type already states a planned use; an explicit per-fact answer still prevails.
    const used =
      typed && !hasAnswer(input, `usage:${benefit.id}`)
        ? ["planned"]
        : answerValues(input, `usage:${benefit.id}`);
    let status: RankedRecommendation["benefits"][number]["status"] = "conditional",
      reason = "conditions_unverified";
    let certainSavingMinor = 0,
      potentialSavingMinor: number | null = null;
    const relevant =
      interested.includes(benefitCategory(benefit)) ||
      typed ||
      (objective !== "premium" &&
        benefit.category === "prevention" &&
        answerValues(input, "prevention").some((x) => !["none", "declined"].includes(x))) ||
      (objective !== "premium" &&
        ["pharmacy", "cost_sharing"].includes(benefit.category) &&
        answerValues(input, "medication").some((x) => !["none", "declined"].includes(x)));
    if (benefit.classification === "legal_common") {
      status = "irrelevant";
      reason = "common_legal_benefit";
    } else if (
      benefit.classification === "public_service" ||
      benefit.requiresSameBase === false ||
      answerValues(input, `existing:${benefit.id}`).includes("yes")
    ) {
      status = "already_accessible";
      reason = "independent_of_base";
    } else if (
      benefit.requiresSupplementary &&
      answerValues(input, "supplementary").includes("none")
    ) {
      status = "ineligible";
      reason = "supplementary_required";
    } else if (!relevant || used.includes("none") || benefitAudienceInactive(input, benefit)) {
      status = "irrelevant";
      reason = "no_declared_use";
    } else if (typed && benefit.financial.kind === "none") {
      const level = typeQualification(benefit, input, rules);
      if (level === "counted" || level === "counted_unconfirmed") {
        status = "available";
        reason = level === "counted" ? "preferred_type" : "preferred_type_unconfirmed";
      } else reason = "preferred_type_conditions";
    } else if (
      usableEvidence(benefit, input.tariff.year) &&
      benefit.requiresSameBase === true &&
      benefit.requiresSupplementary === false &&
      benefit.extraCostMinor !== null &&
      answerValues(input, `eligible:${benefit.id}`).includes("yes")
    ) {
      status = "available";
      reason = "verified_conditions";
      if (used.some((value) => ["current", "planned"].includes(value))) {
        if (
          !groups.has(benefit.equivalenceGroup) &&
          groups.size < rules.serviceContributionCap &&
          benefit.utility !== "none"
        ) {
          groups.add(benefit.equivalenceGroup);
          dimensions.services = Math.min(
            rules.weights.services,
            dimensions.services + rules.weights.services / rules.serviceContributionCap,
          );
        }
        const spending = input.answers[`spending:${benefit.id}`];
        if (
          benefit.financial.kind === "purchase_discount" &&
          spending?.status === "answered" &&
          spending.amountMinor !== undefined
        ) {
          const rule = benefit.financial;
          const discount = Math.floor((spending.amountMinor * rule.basisPoints) / 10000);
          const eligible = Math.max(
            0,
            Math.min(discount, rule.capMinor ?? discount, benefit.capMinor ?? discount) -
              benefit.extraCostMinor,
          );
          // No evidence of cumulation: overlapping equivalent benefits use the best, never their sum.
          certainSavingMinor = eligible;
          const basket = `${benefit.beneficiary}:${rule.basket}`;
          savings.set(basket, Math.max(savings.get(basket) ?? 0, eligible));
        }
      } else reason = "usage_not_planned";
    }
    if (
      status === "conditional" &&
      benefit.financial.kind === "purchase_discount" &&
      relevant &&
      used.some((value) => ["current", "planned"].includes(value))
    )
      potentialSavingMinor = benefit.financial.capMinor ?? benefit.capMinor;
    benefits.push({ id: benefit.id, status, certainSavingMinor, potentialSavingMinor, reason });
  }
  // Type-level preferences: one contribution per canonical type, shared with the groups above so
  // that synonyms and the per-fact path never count the same advantage twice.
  const preferredBenefits: RankedRecommendation["preferredBenefits"] = wantedTypes.map((type) => {
    const matching = facts.filter((fact) => fact.equivalenceGroup === type);
    const levels = matching.map((fact) => typeQualification(fact, input, rules));
    const counted = matching.filter((_, index) => levels[index] === "counted");
    const unconfirmed = matching.filter((_, index) => levels[index] === "counted_unconfirmed");
    const retained = counted.length ? counted : unconfirmed;
    if (retained.length && !groups.has(type) && groups.size < rules.serviceContributionCap) {
      groups.add(type);
      dimensions.services = Math.min(
        rules.weights.services,
        dimensions.services + rules.weights.services / rules.serviceContributionCap,
      );
    }
    return {
      type,
      status: counted.length
        ? "counted"
        : unconfirmed.length
          ? "counted_unconfirmed"
          : levels.some((level) => level !== "irrelevant")
            ? "conditional"
            : "not_documented",
      benefitIds: (retained.length ? retained : matching).slice(0, 30).map((fact) => fact.id),
    };
  });
  dimensions.total =
    dimensions.freedom + dimensions.practical + dimensions.simplicity + dimensions.services;
  return {
    utility: dimensions,
    benefits,
    preferredBenefits,
    peripheralSavingMinor: [...savings.values()].reduce((sum, value) => sum + value, 0),
  };
}
