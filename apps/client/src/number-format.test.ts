import { expect, it } from "vitest";
import { numberFormat } from "./number-format";

it("separates the thousands with an apostrophe and keeps the rest of the locale", () => {
  expect(numberFormat("fr").format(2500)).toBe("2'500");
  expect(numberFormat("fr", { minimumFractionDigits: 2 }).format(1234567.5)).toBe("1'234'567,50");
  expect(numberFormat("fr", { style: "currency", currency: "CHF" }).format(185000)).toMatch(
    /^185'000,00\sCHF$/u,
  );
  expect(numberFormat("fr-CH", { maximumFractionDigits: 1 }).format(1536.25)).toBe("1'536,3");
});

it("leaves numbers below a thousand and percentages as they were", () => {
  expect(numberFormat("fr").format(950)).toBe("950");
  expect(numberFormat("fr", { style: "percent" }).format(0.45)).toMatch(/^45\s%$/u);
  expect(numberFormat("fr").format(-1200)).toBe("-1'200");
});
