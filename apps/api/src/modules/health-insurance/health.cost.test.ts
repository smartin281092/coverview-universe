import { describe, expect, it } from "vitest";
import { healthAgeGroup, healthDeductibles, ordinaryAnnualCost } from "./health.cost.js";

// Independent examples derived from the OFSP ordinary cost-sharing rules.
// https://www.priminfo.admin.ch/fr/faq — no exemptions or hospital charges here.
describe("ordinary health-insurance cost in 2027", () => {
  it("changes age bands in the tariff year, including their boundary years", () => {
    expect([2009, 2008, 2002, 2001].map((year) => healthAgeGroup(year))).toEqual([
      "child",
      "young_adult",
      "young_adult",
      "adult",
    ]);
    expect(healthDeductibles(2009)).toEqual([0, 100, 200, 300, 400, 500, 600]);
    expect(healthDeductibles(2008)).toEqual([300, 500, 1000, 1500, 2000, 2500]);
  });
  it("adds only the premium when there is no care expenditure", () => {
    expect(ordinaryAnnualCost(40000, 2500, 0, false)).toEqual({
      annualPremiumMinor: 480000,
      costShareMinor: 0,
      estimatedAnnualMinor: 480000,
      maxOrdinaryCostShareMinor: 320000,
    });
  });
  it("charges actual care below the deductible, then ten percent above it", () => {
    expect(ordinaryAnnualCost(40000, 300, 20000, false).costShareMinor).toBe(20000);
    expect(ordinaryAnnualCost(40000, 300, 30000, false).costShareMinor).toBe(30000);
    // CHF 2,000 care: CHF 300 deductible + CHF 170 copay.
    expect(ordinaryAnnualCost(40000, 300, 200000, false).estimatedAnnualMinor).toBe(527000);
  });
  it("caps adult copay at CHF 700 and child copay at CHF 350", () => {
    expect(ordinaryAnnualCost(40000, 2500, 10000000, false).costShareMinor).toBe(320000);
    expect(ordinaryAnnualCost(10000, 0, 10000000, true).costShareMinor).toBe(35000);
    expect(ordinaryAnnualCost(10000, 600, 10000000, true).costShareMinor).toBe(95000);
  });
  it("keeps fractional copay in whole cents", () => {
    expect(ordinaryAnnualCost(40001, 300, 30015, false).costShareMinor).toBe(30002);
  });
});
