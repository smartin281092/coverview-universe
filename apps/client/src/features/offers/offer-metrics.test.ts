import { expect, it } from "vitest";
import type { LeadOffer } from "@coverview/api-client/partner";
import { amountText, offerMetrics } from "./offer-metrics";

const feature = (category: string, value: string, chf?: number) => ({
  key: `${category}-1`,
  label: category,
  value,
  conditions: "",
  origin: "extracted" as const,
  verification: "verified" as const,
  source: value,
  category,
  ...(chf === undefined ? {} : { limit: { value: chf * 100, unit: "chf", period: "event" } }),
});
const offer = (annualPremiumMinor: number | null, features: unknown[] = []) =>
  ({
    annualPremiumMinor,
    validUntil: "2026-12-31T00:00:00.000Z",
    features,
  }) as unknown as LeadOffer;

it("reads an amount only when the text states nothing else", () => {
  expect(amountText("CHF 588 par mois")).toEqual({ kind: "amount", minor: 58800, per: "month" });
  expect(amountText("CHF 185'000")).toEqual({ kind: "amount", minor: 18500000 });
  expect(amountText("CHF 6000 par an")).toEqual({ kind: "amount", minor: 600000, per: "year" });
  expect(amountText("CHF 185000 à 65 ans")).toEqual({ kind: "text", text: "CHF 185000 à 65 ans" });
});

it("shows the projected capital and the premium as paid for a 3rd pillar", () => {
  const [capital, premium] = offerMetrics(
    offer(705600, [feature("maturity", "CHF 185000"), feature("contribution", "CHF 588 par mois")]),
    "pension",
  );
  expect(capital).toEqual({ label: "capital", value: { kind: "amount", minor: 18500000 } });
  expect(premium.value).toEqual({ kind: "amount", minor: 58800, per: "month" });
  // Without a stated contribution, the yearly premium; without a capital, nothing invented.
  expect(offerMetrics(offer(600000), "pension")).toEqual([
    { label: "capital", value: { kind: "missing" } },
    { label: "premium", value: { kind: "amount", minor: 600000, per: "year" } },
  ]);
});

it("shows the monthly premium and the deductible for basic health insurance", () => {
  expect(offerMetrics(offer(487800, [feature("deductible", "CHF 2500", 2500)]), "health")).toEqual([
    { label: "monthly", value: { kind: "amount", minor: 40650, per: "month" } },
    { label: "deductible", value: { kind: "amount", minor: 250000 } },
  ]);
});

it("shows the yearly premium and the validity otherwise", () => {
  expect(offerMetrics(offer(null), "vehicle")).toEqual([
    { label: "annual", value: { kind: "missing" } },
    { label: "validUntil", value: { kind: "date", at: "2026-12-31T00:00:00.000Z" } },
  ]);
});
