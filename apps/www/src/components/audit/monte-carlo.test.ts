import { describe, expect, it } from "vitest";
import { createRandom, seedFrom, simulate } from "./monte-carlo";
import { projectConstant } from "./projection";

const bank = { kind: "bank" as const, reduction: [] };

describe("Monte Carlo par bootstrap", () => {
  it("avec une seule observation, égale la projection déterministe", () => {
    const result = simulate({
      returns: [0.05],
      monthly: 200,
      initial: 5000,
      years: 20,
      model: bank,
      simulations: 500,
    });
    const expected = projectConstant({
      monthly: 200,
      initial: 5000,
      years: 20,
      annualReturn: 0.05,
      model: bank,
    });
    expect(result.percentiles.p50).toBeCloseTo(expected.final, 6);
    expect(result.percentiles.p10).toBeCloseTo(expected.final, 6);
    expect(result.yearly).toHaveLength(21);
    expect(result.yearly[20]?.p50).toBeCloseTo(expected.final, 6);
    expect(result.yearly[7]?.p50).toBeCloseTo(expected.path[7]!, 6);
  });
  it("est reproductible pour une même graine et ordonne ses percentiles", () => {
    const input = {
      returns: [0.2, -0.1, 0.08, 0.15, -0.25, 0.3],
      monthly: 300,
      initial: 0,
      years: 25,
      model: bank,
      simulations: 20000,
      seed: seedFrom("test"),
      target: 300000,
    };
    const first = simulate(input);
    const second = simulate(input);
    expect(first.percentiles).toEqual(second.percentiles);
    const { p5, p10, p25, p50, p75, p90, p95 } = first.percentiles;
    expect(p5).toBeLessThanOrEqual(p10);
    expect(p10).toBeLessThanOrEqual(p25);
    expect(p25).toBeLessThanOrEqual(p50);
    expect(p50).toBeLessThanOrEqual(p75);
    expect(p75).toBeLessThanOrEqual(p90);
    expect(p90).toBeLessThanOrEqual(p95);
    expect(first.probabilityAtOrAbove).toBeGreaterThan(0);
    expect(first.probabilityAtOrAbove).toBeLessThanOrEqual(1);
    expect(first.ranges.reduce((sum, range) => sum + range.probability, 0)).toBeCloseTo(1, 9);
    expect(first.invested).toBe(300 * 12 * 25);
  });
  it("ne compte pas de cible sans cible et respecte un horizon nul", () => {
    const result = simulate({
      returns: [0.1, 0.2],
      monthly: 100,
      initial: 1000,
      years: 0,
      model: bank,
      simulations: 10,
    });
    expect(result.probabilityAtOrAbove).toBeNull();
    expect(result.percentiles.p50).toBe(1000);
    expect(result.yearly).toHaveLength(1);
  });
  it("tire uniformément dans [0, 1[", () => {
    const random = createRandom(42);
    const values = Array.from({ length: 10000 }, random);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    expect(mean).toBeGreaterThan(0.47);
    expect(mean).toBeLessThan(0.53);
  });
});
