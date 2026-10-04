import type {
  EvidenceBenefit,
  RecommendationInput,
} from "@coverview/contracts/health-recommendation";
import { answerValues } from "./recommendation.compatibility.js";
export function revisedCareCurrent(input: RecommendationInput) {
  const revised = input.answers.care_revised;
  return (
    !!revised &&
    (revised.confirmedAtVersion ?? 0) >=
      Math.max(
        ...["care", "treatment", "treatment_included"].map(
          (id) => input.answers[id]?.confirmedAtVersion ?? 0,
        ),
      )
  );
}
export function careScenarios(input: RecommendationInput) {
  const planned = answerValues(input, "treatment").some((value) =>
    ["regular", "planned", "other"].includes(value),
  );
  const included = answerValues(input, "treatment_included")[0];
  if (planned && included !== "yes" && included !== "no") return [];
  const key = planned && included === "no" ? "care_revised" : "care";
  if (key === "care_revised" && !revisedCareCurrent(input)) return [];
  const answer = input.answers[key];
  if (answer?.status !== "answered") return [];
  const value = answerValues(input, key)[0];
  const low =
    value === "exact"
      ? answer.amountMinor
      : value && /^\d+$/.test(value)
        ? Number(value) * 100
        : undefined;
  if (low === undefined) return [];
  return [
    ...new Set([
      low,
      ...(answer.upperMinor != null && answer.upperMinor >= low ? [answer.upperMinor] : []),
    ]),
  ];
}
export function reserveRange(input: RecommendationInput): [number, number | null] | null {
  const value = answerValues(input, "reserve")[0];
  const ranges: Record<string, [number, number | null]> = {
    below500: [0, 49999],
    "500to999": [50000, 99999],
    "1000to1999": [100000, 199999],
    "2000to3199": [200000, 319999],
    "3200plus": [320000, null],
  };
  if (value === "exact" && input.answers.reserve?.amountMinor !== undefined)
    return [input.answers.reserve.amountMinor, input.answers.reserve.amountMinor];
  return value ? (ranges[value] ?? null) : null;
}
export function usableEvidence(benefit: EvidenceBenefit, year: number) {
  return (
    benefit.year === year &&
    benefit.yearConfirmed &&
    benefit.verification === "verified" &&
    benefit.validFrom !== null &&
    benefit.validFrom <= `${year}-01-01` &&
    (benefit.validUntil === null || benefit.validUntil >= `${year}-12-31`)
  );
}
// Amounts are cents. Medical waivers modify the cost-sharing bases; they are never rebates from premiums.
export function financialScenario(
  monthly: number,
  deductible: number,
  care: number,
  child: boolean,
  benefits: EvidenceBenefit[],
  input: RecommendationInput,
) {
  const regularCap = child ? 35000 : 70000;
  let cap = regularCap;
  const groups = new Map<string, { amount: number; deductible: boolean; copay: boolean }>();
  // OPAS 12a: vaccination/advice deductible exemption common to ALL insurers from 2026.
  // 2027 scope is anchored in RO 2026 336; this is not a model-specific saving.
  // Programme breast/colorectal screenings require separate canton/programme verification and are not inferred here.
  const vaccination = input.answers["caregroup:opas12a_vaccination"];
  if (
    input.tariff.year === 2027 &&
    vaccination?.status === "answered" &&
    vaccination.amountMinor !== undefined
  )
    groups.set("opas12a_vaccination", {
      amount: vaccination.amountMinor,
      deductible: true,
      copay: false,
    });
  for (const benefit of benefits) {
    if (
      !usableEvidence(benefit, input.tariff.year) ||
      benefit.requiresSupplementary !== false ||
      benefit.requiresSameBase !== true ||
      benefit.classification === "legal_common"
    )
      continue;
    if (!answerValues(input, `eligible:${benefit.id}`).includes("yes")) continue;
    if (
      answerValues(input, `usage:${benefit.id}`).some((value) =>
        ["none", "interest"].includes(value),
      ) ||
      answerValues(input, `existing:${benefit.id}`).includes("yes")
    )
      continue;
    if (benefit.financial.kind === "copay_cap") cap = Math.min(cap, benefit.financial.capMinor);
    if (benefit.financial.kind === "eligible_care_waiver") {
      const rule = benefit.financial;
      if (!rule.deductible && !rule.copay) continue;
      const amount = input.answers[`caregroup:${rule.careGroup}`];
      if (amount?.status !== "answered" || amount.amountMinor === undefined) continue;
      const prior = groups.get(rule.careGroup);
      groups.set(rule.careGroup, {
        amount: amount.amountMinor,
        deductible: (prior?.deductible ?? false) || rule.deductible,
        copay: (prior?.copay ?? false) || rule.copay,
      });
    }
  }
  const allocated = [...groups.values()].reduce((sum, value) => sum + value.amount, 0);
  if (allocated > care) return null;
  // Only fully exempt groups or deductible-only groups are composable without guessing chronology.
  if ([...groups.values()].some((value) => !value.deductible && value.copay)) return null;
  const ordinary = care - allocated;
  const deductibleUsed = Math.min(ordinary, deductible * 100);
  const copayBase =
    ordinary -
    deductibleUsed +
    [...groups.values()]
      .filter((value) => !value.copay)
      .reduce((sum, value) => sum + value.amount, 0);
  const costShareMinor = deductibleUsed + Math.min(Math.round(copayBase / 10), cap);
  return { careMinor: care, costShareMinor, annualMinor: monthly * 12 + costShareMinor };
}
