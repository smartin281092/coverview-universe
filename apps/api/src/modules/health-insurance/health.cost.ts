// Ordinary LAMal cost-sharing only: no hospital daily charge, maternity exemptions,
// higher drug copay, supplementary insurance, subsidies or model-specific waivers.
export function healthAgeGroup(birthYear: number, year = 2027) {
  const age = year - birthYear;
  return age <= 18 ? "child" : age <= 25 ? "young_adult" : "adult";
}
export function healthDeductibles(birthYear: number) {
  return healthAgeGroup(birthYear) === "child"
    ? [0, 100, 200, 300, 400, 500, 600]
    : [300, 500, 1000, 1500, 2000, 2500];
}
export function ordinaryAnnualCost(
  monthlyPremiumMinor: number,
  deductible: number,
  annualCareMinor: number,
  child: boolean,
) {
  const deductibleMinor = deductible * 100;
  const copayCap = child ? 35_000 : 70_000;
  const costShareMinor =
    Math.min(annualCareMinor, deductibleMinor) +
    Math.min(Math.round(Math.max(0, annualCareMinor - deductibleMinor) / 10), copayCap);
  return {
    annualPremiumMinor: monthlyPremiumMinor * 12,
    costShareMinor,
    estimatedAnnualMinor: monthlyPremiumMinor * 12 + costShareMinor,
    maxOrdinaryCostShareMinor: deductibleMinor + copayCap,
  };
}
