import { expect, it } from "vitest";
import { amountsInText, numberFormat } from "@coverview/ui/number-format";

it("separates the thousands with an apostrophe and keeps the rest of the locale", () => {
  expect(numberFormat("fr").format(2500)).toBe("2'500");
  expect(numberFormat("fr", { minimumFractionDigits: 2 }).format(1234567.5)).toBe("1'234'567,50");
  expect(numberFormat("fr", { style: "currency", currency: "CHF" }).format(185000)).toMatch(
    /^185'000,00\sCHF$/u,
  );
  expect(numberFormat("fr-CH", { maximumFractionDigits: 1 }).format(1536.25)).toBe("1'536,3");
});

it("writes the decimals with a comma in French, CHF amounts in fr-CH included", () => {
  expect(numberFormat("fr-CH", { style: "currency", currency: "CHF" }).format(2500)).toMatch(
    /^2'500,00\sCHF$/u,
  );
  expect(numberFormat("fr-CH", { maximumFractionDigits: 2 }).format(0.25)).toBe("0,25");
});

it("leaves numbers below a thousand and percentages as they were", () => {
  expect(numberFormat("fr").format(950)).toBe("950");
  expect(numberFormat("fr", { style: "percent" }).format(0.45)).toMatch(/^45\s%$/u);
  expect(numberFormat("fr").format(-1200)).toBe("-1'200");
});

it("formats the amounts written next to CHF in a partner's text, and only those", () => {
  expect(amountsInText("CHF 185000", "fr")).toBe("CHF 185'000");
  expect(amountsInText("CHF 6000 par an", "fr")).toBe("CHF 6'000 par an");
  expect(amountsInText("CHF 588.50 par mois", "fr")).toBe("CHF 588,50 par mois");
  expect(amountsInText("Dès 2500 CHF de frais, puis CHF 185 000", "fr")).toBe(
    "Dès 2'500 CHF de frais, puis CHF 185'000",
  );
  expect(amountsInText("CHF 2'500.– par cas", "fr")).toBe("CHF 2'500.– par cas");
  expect(amountsInText("Police 123456, primes 2027, 90 jours", "fr")).toBe(
    "Police 123456, primes 2027, 90 jours",
  );
  expect(amountsInText("CHF 1.500", "fr")).toBe("CHF 1.500");
});
