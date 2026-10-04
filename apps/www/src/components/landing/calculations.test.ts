import { describe, expect, it } from "vitest";
import { futureCapital, purchasingPower } from "./calculations";

describe("simulations pédagogiques de la landing", () => {
  it("respecte le taux nul, l’horizon nul et les versements de fin de mois", () => {
    expect(futureCapital(300, 30, 0)).toBe(108000);
    expect(futureCapital(300, 0, 0.06)).toBe(0);
    expect(futureCapital(0, 30, 0.06)).toBe(0);
    expect(futureCapital(300, 1 / 12, 0.06)).toBeCloseTo(300, 8);
    expect(futureCapital(300, 30, 0.02)).toBeCloseTo(147379.0451, 2);
    expect(futureCapital(300, 30, 0.06)).toBeCloseTo(292353.8919, 2);
    expect(futureCapital(300, 30, 0.16)).toBeCloseTo(2045374.1242, 2);
  });
  it("actualise le pouvoir d’achat sans modifier le capital nominal", () => {
    expect(purchasingPower(300000, 30, 0.04)).toBeCloseTo(92495.6004, 2);
    expect(purchasingPower(300000, 30, 0)).toBe(300000);
    expect(purchasingPower(0, 30, 0.04)).toBe(0);
    expect(purchasingPower(300000, 0, 0.04)).toBe(300000);
  });
  it("reste fini sur les limites du formulaire et rejette les valeurs invalides", () => {
    expect(Number.isFinite(futureCapital(2000, 45, 0.2))).toBe(true);
    expect(futureCapital(Number.NaN, 30, 0.06)).toBe(0);
    expect(purchasingPower(300000, 30, -1)).toBe(0);
  });
});
