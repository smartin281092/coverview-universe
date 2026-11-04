import { describe, expect, it } from "vitest";
import {
  cagr,
  cumulativeIndex,
  investedMonthly,
  neededCapital,
  percentile,
  projectConstant,
  reconstructCapital,
  riskPremium,
  scenarioRanges,
  yearsNeeded,
  type ContributionModel,
} from "./projection";
import { HYPERION_ID, strategies, strategyById } from "./strategies";

const bank: ContributionModel = { kind: "bank", reduction: [] };

describe("taux annualisé", () => {
  it("compose les rendements au lieu de les moyenner", () => {
    expect(cagr([0.2, -0.2])).toBeCloseTo(-0.0202, 4);
    expect(cagr([])).toBe(0);
  });
  it("retrouve les taux publiés par Horizon 3 pour le catalogue", () => {
    const published: Record<string, number> = {
      prosperity: 18,
      "viac-global-100": 8.64,
      "finpension-global-100": 8.34,
      "helvetia-global-passive": 8.7,
      "helvetia-baloise-safe-plan-100": -1.92,
    };
    for (const [id, expected] of Object.entries(published)) {
      const strategy = strategyById(id);
      expect(strategy).toBeDefined();
      expect(cagr(strategy!.returns) * 100).toBeCloseTo(expected, 1);
    }
  });
  it("garde onze observations et une nature par année pour chaque stratégie", () => {
    for (const strategy of strategies) {
      expect(strategy.returns).toHaveLength(11);
      expect(strategy.natures).toHaveLength(11);
    }
  });
});

describe("capitalisation mensuelle", () => {
  it("égale un calcul mois par mois avec versement en début de mois", () => {
    const monthly = 300;
    const rate = Math.pow(1.06, 1 / 12) - 1;
    let expected = 1000;
    for (let month = 0; month < 12 * 10; month += 1) expected = (expected + monthly) * (1 + rate);
    const { final, path } = projectConstant({
      monthly,
      initial: 1000,
      years: 10,
      annualReturn: 0.06,
      model: bank,
    });
    expect(final).toBeCloseTo(expected, 6);
    expect(path).toHaveLength(11);
    expect(path[0]).toBe(1000);
  });
  it("à taux nul, additionne simplement les versements", () => {
    expect(
      projectConstant({ monthly: 100, initial: 0, years: 3, annualReturn: 0, model: bank }).final,
    ).toBeCloseTo(3600, 9);
  });
});

describe("modèle de versements d’une assurance", () => {
  it("prime de risque de 5 CHF pour 100 CHF, 30 CHF dès 605 CHF, linéaire entre", () => {
    expect(riskPremium(50)).toBeCloseTo(2.5);
    expect(riskPremium(100)).toBeCloseTo(5);
    expect(riskPremium(352.5)).toBeCloseTo(17.5);
    expect(riskPremium(605)).toBeCloseTo(30);
    expect(riskPremium(1000)).toBeCloseTo(30);
    expect(riskPremium(0)).toBe(0);
  });
  it("retient la part prévue des premières années, rien ensuite", () => {
    const hyperion = strategyById(HYPERION_ID)!;
    const model = { kind: hyperion.kind, reduction: hyperion.reduction };
    expect(investedMonthly(model, 300, 1)).toBeCloseTo((300 - riskPremium(300)) * 0.33, 6);
    expect(investedMonthly(model, 300, 6)).toBeCloseTo(300 - riskPremium(300), 6);
    expect(investedMonthly(bank, 300, 1)).toBe(300);
  });
});

describe("reconstitution du capital", () => {
  it("applique les rendements réels des années connues et signale les autres", () => {
    const returns = [0.1, -0.05, 0.2];
    const result = reconstructCapital({
      returns,
      monthly: 100,
      startYear: 2015,
      model: bank,
      untilYear: 2018,
    });
    expect(result.years.map((year) => year.estimated)).toEqual([true, false, false, false]);
    expect(result.years[1]?.rate).toBe(0.1);
    expect(result.invested).toBe(4800);
    expect(result.capital).toBeGreaterThan(4800);
  });
  it("ne reconstitue rien pour un contrat qui n’a pas commencé", () => {
    expect(
      reconstructCapital({ returns: [0.1], monthly: 100, startYear: 2030, model: bank }).capital,
    ).toBe(0);
  });
});

describe("capital nécessaire", () => {
  it("suit la méthode Horizon 3 : 40 % du revenu, 17 ans, inflation de 4 % jusqu’à la retraite", () => {
    const need = neededCapital({
      income: 6000,
      replacement: 0.6,
      retirementYears: 17,
      inflation: 0.04,
      yearsToRetirement: 30,
    });
    expect(need.gapMonthly).toBeCloseTo(2400);
    expect(need.today).toBeCloseTo(489600);
    expect(need.atRetirement).toBeCloseTo(489600 * Math.pow(1.04, 30), 3);
  });
});

describe("années encore nécessaires", () => {
  it("retrouve l’exemple des 123 ans à taux nul et sans inflation", () => {
    expect(
      yearsNeeded({
        capital: 0,
        monthly: 300,
        annualReturn: 0,
        targetToday: 442800,
        inflation: 0,
        model: bank,
      }),
    ).toBe(123);
  });
  it("vaut 0 quand la cible est atteinte et null quand elle ne l’est jamais", () => {
    // Versement nominal constant : à rendement égal à l’inflation, la cible indexée s’éloigne.
    expect(
      yearsNeeded({
        capital: 0,
        monthly: 300,
        annualReturn: 0.02,
        targetToday: 300000,
        inflation: 0.02,
        model: bank,
      }),
    ).toBeNull();
    expect(
      yearsNeeded({
        capital: 500000,
        monthly: 0,
        annualReturn: 0,
        targetToday: 400000,
        inflation: 0.04,
        model: bank,
      }),
    ).toBe(0);
    expect(
      yearsNeeded({
        capital: 0,
        monthly: 100,
        annualReturn: 0,
        targetToday: 1e9,
        inflation: 0.04,
        model: bank,
      }),
    ).toBeNull();
  });
  it("se raccourcit avec le rendement", () => {
    const slow = yearsNeeded({
      capital: 0,
      monthly: 300,
      annualReturn: 0.03,
      targetToday: 300000,
      inflation: 0.01,
      model: bank,
    });
    const fast = yearsNeeded({
      capital: 0,
      monthly: 300,
      annualReturn: 0.08,
      targetToday: 300000,
      inflation: 0.01,
      model: bank,
    });
    expect(slow).not.toBeNull();
    expect(fast).not.toBeNull();
    expect(fast!).toBeLessThan(slow!);
  });
});

describe("percentiles et fourchettes", () => {
  const sorted = Float64Array.from({ length: 1000 }, (_, index) => index + 1);
  it("interpole linéairement", () => {
    expect(percentile(sorted, 0.5)).toBeCloseTo(500.5);
    expect(percentile(sorted, 0)).toBe(1);
    expect(percentile(sorted, 1)).toBe(1000);
    expect(percentile([], 0.5)).toBe(0);
  });
  it("regroupe les extrêmes et somme les tranches à 100 %", () => {
    const ranges = scenarioRanges(sorted);
    expect(ranges.map((range) => range.id)).toEqual([
      "extremes",
      "central-low",
      "central-mid-low",
      "median-low",
      "median-high",
      "central-mid-high",
      "central-high",
    ]);
    expect(ranges.reduce((sum, range) => sum + range.probability, 0)).toBeCloseTo(1, 9);
    expect(ranges[0]?.probability).toBeCloseTo(0.2, 1);
    expect(ranges[0]?.extremes?.lowMax).toBeCloseTo(percentile(sorted, 0.1));
    for (const range of ranges.slice(1)) expect(range.max).toBeGreaterThanOrEqual(range.min);
  });
});

describe("indice cumulé", () => {
  it("part de 100 et compose", () => {
    expect(cumulativeIndex([0.1, -0.5])).toEqual([100, 110.00000000000001, 55.00000000000001]);
  });
});
