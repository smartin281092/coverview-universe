import { describe, expect, it } from "vitest";
import {
  HYPERION,
  annualisedReturn,
  createCapitalRanges,
  createRandom,
  cumulativeGrowth,
  effectiveContribution,
  formatFrancs,
  formatPercent,
  grossReturns,
  historicalProjection,
  insuranceMonthlyCost,
  monteCarlo,
  netReturn,
  netReturns,
  percentile,
  reducedContribution,
  totalInvested,
  yearsUntilRetirement,
} from "./hyperion-model";

describe("Hyperion : série et frais, comme le comparateur horizon3", () => {
  it("retrouve les taux annualisés publiés par horizon3", () => {
    // 19,04 % brut sur 2016–2025 (historicReturnAnnualised d’origine), 18,00 % net sur 2016–2026.
    expect(annualisedReturn(grossReturns().slice(0, 10))).toBeCloseTo(0.1904, 4);
    expect(annualisedReturn(netReturns())).toBeCloseTo(0.18, 3);
    expect(netReturn(0.1)).toBeCloseTo(1.1 * (1 - 0.0221) - 1, 12);
    expect(cumulativeGrowth(netReturns().slice(0, 10))).toBeCloseTo(4.5698, 3);
    expect(HYPERION.history.map((point) => point.year)).toEqual([
      2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026,
    ]);
    expect(() => annualisedReturn([-1])).toThrow();
  });
  it("applique la prime de risque et les retenues des cinq premières années", () => {
    expect(insuranceMonthlyCost(100)).toBe(5);
    expect(insuranceMonthlyCost(605)).toBe(30);
    expect(insuranceMonthlyCost(1000)).toBe(30);
    expect(insuranceMonthlyCost(352.5)).toBeCloseTo(17.5, 10);
    expect(insuranceMonthlyCost(50)).toBe(2.5);
    expect(effectiveContribution(300, "monthly")).toBeCloseTo(300 - insuranceMonthlyCost(300), 10);
    expect(effectiveContribution(3600, "annual")).toBeCloseTo(
      3600 - 12 * insuranceMonthlyCost(300),
      10,
    );
    expect(reducedContribution(300, 1, "monthly")).toBeCloseTo(
      effectiveContribution(300, "monthly") * 0.33,
      10,
    );
    expect(reducedContribution(300, 5, "monthly")).toBeCloseTo(
      effectiveContribution(300, "monthly") * 0.33,
      10,
    );
    expect(reducedContribution(300, 6, "monthly")).toBeCloseTo(
      effectiveContribution(300, "monthly"),
      10,
    );
  });
  it("compte les années jusqu’à 65 ans dans les bornes du modèle", () => {
    expect(yearsUntilRetirement(1992, 2026)).toBe(31);
    expect(yearsUntilRetirement(1960, 2026)).toBe(0);
    expect(yearsUntilRetirement(2010, 2026)).toBe(45);
    expect(yearsUntilRetirement(Number.NaN, 2026)).toBe(0);
  });
});

describe("Hyperion : projection historique", () => {
  it("à taux nul, le capital est la somme des versements nets des retenues", () => {
    const projection = historicalProjection(
      { investment: 300, frequency: "monthly", years: 1, initialCapital: 0 },
      0,
    );
    expect(projection.finalCapital).toBe(Math.round(12 * reducedContribution(300, 1, "monthly")));
    expect(projection.totalInvested).toBe(3600);
    expect(projection.points).toHaveLength(1);
  });
  it("suit la même récurrence mensuelle qu’une implémentation indépendante", () => {
    const input = {
      investment: 300,
      frequency: "monthly" as const,
      years: 30,
      initialCapital: 10000,
    };
    const rate = 0.18;
    let capital = 10000;
    const monthly = Math.pow(1 + rate, 1 / 12) - 1;
    for (let month = 1; month <= 360; month += 1) {
      const year = Math.ceil(month / 12);
      capital = (capital + reducedContribution(300, year, "monthly")) * (1 + monthly);
    }
    const projection = historicalProjection(input, rate);
    expect(projection.finalCapital).toBe(Math.round(capital));
    expect(projection.points).toHaveLength(30);
    expect(projection.points[29]!.invested).toBe(totalInvested(input));
    expect(
      projection.points.every(
        (point, index, all) => index === 0 || point.capital >= all[index - 1]!.capital,
      ),
    ).toBe(true);
  });
  it("gère le mode annuel", () => {
    const projection = historicalProjection(
      { investment: 7258, frequency: "annual", years: 2, initialCapital: 0 },
      0.1,
    );
    const first = reducedContribution(7258, 1, "annual") * 1.1;
    const second = (first + reducedContribution(7258, 2, "annual")) * 1.1;
    expect(projection.finalCapital).toBe(Math.round(second));
    expect(projection.totalInvested).toBe(14516);
  });
});

describe("Hyperion : Monte Carlo", () => {
  const input = { investment: 300, frequency: "monthly" as const, years: 30, initialCapital: 0 };
  it("est reproductible et cohérent avec la projection historique", () => {
    const projection = historicalProjection(input, annualisedReturn(netReturns()));
    const first = monteCarlo({
      ...input,
      historicalProjection: projection.finalCapital,
      simulations: 20000,
    });
    const second = monteCarlo({
      ...input,
      historicalProjection: projection.finalCapital,
      simulations: 20000,
    });
    expect(first).toEqual(second);
    expect(first.simulations).toBe(20000);
    expect(first.observations).toBe(11);
    const { p5, p10, p25, p50, p75, p90, p95 } = first.percentiles;
    expect(p5 <= p10 && p10 <= p25 && p25 <= p50 && p50 <= p75 && p75 <= p90 && p90 <= p95).toBe(
      true,
    );
    expect(first.median).toBe(p50);
    expect(first.probabilityAboveHistoricalProjection).toBeGreaterThan(0);
    expect(first.probabilityAboveHistoricalProjection).toBeLessThan(1);
    const probabilityMass =
      first.ranges.extremes.low.probability +
      first.ranges.extremes.high.probability +
      first.ranges.central.reduce((sum, range) => sum + range.probability, 0);
    expect(probabilityMass).toBeCloseTo(1, 9);
    expect(first.histogram.bins).toHaveLength(36);
    expect(first.histogram.bins.reduce((sum, value) => sum + value, 0)).toBeGreaterThan(19000);
    const other = monteCarlo({
      ...input,
      historicalProjection: projection.finalCapital,
      simulations: 20000,
      seed: 7,
    });
    expect(other.median).not.toBe(first.median);
    expect(Math.abs(other.median - first.median) / first.median).toBeLessThan(0.05);
  });
  it("refuse un horizon hors du modèle", () => {
    expect(() => monteCarlo({ ...input, years: 0, historicalProjection: 0 })).toThrow();
    expect(() => monteCarlo({ ...input, years: 46, historicalProjection: 0 })).toThrow();
  });
  it("tire uniformément et calcule les quantiles par interpolation", () => {
    const random = createRandom(1);
    const counts = [0, 0, 0];
    for (let i = 0; i < 30000; i += 1) counts[Math.floor(random() * 3)]! += 1;
    for (const count of counts) expect(Math.abs(count / 30000 - 1 / 3)).toBeLessThan(0.02);
    const sorted = new Float64Array([10, 20, 30, 40]);
    expect(percentile(sorted, 0.5)).toBe(25);
    expect(percentile(sorted, 0)).toBe(10);
    expect(percentile(sorted, 1)).toBe(40);
    const ranges = createCapitalRanges(sorted);
    expect(ranges.central.map((range) => range.id)).toEqual([
      "central-low",
      "central-mid-low",
      "median-low",
      "median-high",
      "central-mid-high",
      "central-high",
    ]);
  });
});

describe("Hyperion : écriture suisse", () => {
  it("groupe les milliers avec l’apostrophe et la virgule décimale", () => {
    expect(formatFrancs(1234567)).toBe("1’234’567");
    expect(formatFrancs(1234.5, 2)).toBe("1’234,50");
    expect(formatFrancs(-300)).toBe("−300");
    expect(formatPercent(0.18)).toBe("18,0 %");
    expect(formatPercent(-0.3082, 2)).toBe("−30,82 %");
  });
});
