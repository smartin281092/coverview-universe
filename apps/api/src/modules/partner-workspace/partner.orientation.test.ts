import { describe, expect, it } from "vitest";
import type { CurrentContract, LeadOffer } from "@coverview/contracts/partner";
import type { BenefitLimit } from "@coverview/contracts/partner-benefits";
import { compareOffers } from "./partner.comparison.js";
import { orientOffers } from "./partner.orientation.js";

type OfferFeature = LeadOffer["features"][number];
type ContractFeature = CurrentContract["features"][number];

const feature = (value: Partial<OfferFeature> & Pick<OfferFeature, "label">): OfferFeature => ({
  key: "other",
  value: "",
  conditions: "",
  exclusions: "",
  coverage: "unknown",
  origin: "extracted",
  verification: "verified",
  source: value.label,
  sourcePage: 1,
  ...value,
});
const offer = (
  id: string,
  premium: number | null,
  features: OfferFeature[],
  extra: Partial<LeadOffer> = {},
) =>
  ({
    id,
    version: 1,
    active: true,
    state: "ready",
    reviewedAt: "2026-10-01T10:00:00.000Z",
    publishedAt: null,
    createdAt: "2026-10-01T09:00:00.000Z",
    company: `Compagnie ${id}`,
    product: "Produit",
    documentId: `doc_${id}`,
    replacesId: null,
    reference: "",
    annualPremiumMinor: premium,
    currency: "CHF",
    validUntil: null,
    effectiveDate: null,
    features,
    summary: "",
    limitations: "",
    canCompare: true,
    ...extra,
  }) as LeadOffer;
const held = (
  value: Partial<ContractFeature> & Pick<ContractFeature, "label">,
): ContractFeature => ({
  key: "other",
  value: "",
  conditions: "",
  exclusions: "",
  coverage: "unknown",
  verification: "verified",
  page: 2,
  quote: value.label,
  ...value,
});
// Annual current premium of CHF 1'500 (750 per half-year); only the fields read are given.
const current = (features: ContractFeature[], premiumVerified = true) =>
  ({
    referenceId: "ref",
    documentId: "doc_current",
    fingerprint: "a".repeat(64),
    confirmedAt: "2026-09-01T10:00:00.000Z",
    status: "available",
    reviewVersion: 2,
    premiumVerified,
    features,
    source: {
      contract: { title: "Auto actuelle" },
      facts: {
        companyId: null,
        premium: { amountMinor: 75000, currency: "CHF", period: "half_year" },
      },
    },
  }) as unknown as CurrentContract;
const chf = (francs: number): BenefitLimit => ({
  value: francs * 100,
  unit: "chf",
  period: "event",
});
const orient = (reference: CurrentContract | null, offers: LeadOffer[]) =>
  orientOffers(compareOffers(reference, offers), offers, reference);
const parking = (francs: number, label = "Parking") =>
  feature({ label, category: "parking", value: `CHF ${francs}`, limit: chf(francs) });

describe("automatic orientation", () => {
  it("points to the cheaper offer without verified loss and lists what it improves", () => {
    const reference = current([
      held({ label: "Parcage", category: "parking", value: "CHF 2000", limit: chf(2000) }),
    ]);
    const result = orient(reference, [
      offer("cheaper", 140000, [parking(5000)]),
      offer("cheapest_but_loses", 120000, [parking(1000)]),
      offer("same_price_better", 150000, [parking(3000)]),
    ]);
    expect(result).toMatchObject({
      version: "orientation-v1",
      kind: "offer_advantage",
      reference: "current_contract",
    });
    expect(
      result.offers.map((item) => [item.offerId, item.status, item.annualDifferenceMinor]),
    ).toEqual([
      ["cheaper", "advantage", -10000],
      ["cheapest_but_loses", "tradeoff", -30000],
      ["same_price_better", "advantage", 0],
    ]);
    expect(result.suggestion).toEqual({ kind: "offer", offerId: "cheaper", offerVersion: 1 });
    expect(result.offers[0]!.improves.map((row) => row.key)).toEqual(["parking"]);
    expect(result.offers[1]!.loses.map((row) => row.key)).toEqual(["parking"]);
    expect(result.transparency).toMatchObject({
      asOf: "2026-10-01T10:00:00.000Z",
      currentReviewVersion: 2,
      annualFactor: 2,
      companies: 3,
      assumptions: [
        "chf_only",
        "verified_sources_only",
        "structured_amounts_only",
        "annualized_current_premium",
      ],
    });
    expect(result.offers.every((item) => item.availability.admission === "not_established")).toBe(
      true,
    );
  });

  it("concludes that keeping the current contract is preferable when no offer brings anything verified", () => {
    const reference = current([
      held({ label: "Parcage", category: "parking", value: "CHF 2000", limit: chf(2000) }),
    ]);
    const result = orient(reference, [
      offer("dearer", 160000, [parking(2000)]),
      offer("same", 150000, [parking(1000)]),
    ]);
    expect(result.offers.map((item) => item.status)).toEqual(["keep_current", "keep_current"]);
    expect(result).toMatchObject({ kind: "keep_current", suggestion: { kind: "keep_current" } });
  });

  it("calls an arbitration when savings come with losses or gains cost more", () => {
    const reference = current([
      held({ label: "Parcage", category: "parking", value: "CHF 2000", limit: chf(2000) }),
    ]);
    const result = orient(reference, [
      offer("cheaper_loses", 120000, [parking(1000)]),
      offer("dearer_gains", 170000, [parking(5000)]),
    ]);
    expect(result.offers.map((item) => item.status)).toEqual(["tradeoff", "tradeoff"]);
    expect(result).toMatchObject({ kind: "tradeoff", suggestion: null });
  });

  it("stays insufficient while a premium or a value is still to verify", () => {
    const reference = current(
      [held({ label: "Parcage", category: "parking", value: "CHF 2000", limit: chf(2000) })],
      false,
    );
    const unverified = orient(reference, [offer("a", 140000, [parking(5000)])]);
    expect(unverified.offers[0]).toMatchObject({ status: "incomplete", premiumVerified: false });
    expect(unverified).toMatchObject({ kind: "insufficient", suggestion: null });
    const pending = orient(current([]), [
      offer("a", 160000, []),
      offer("b", 140000, [
        feature({ label: "Parking", category: "parking", verification: "to_verify" }),
      ]),
    ]);
    expect(pending.offers.map((item) => item.status)).toEqual(["keep_current", "incomplete"]);
    expect(pending.offers[1]!.toVerify.map((row) => row.key)).toEqual(["parking"]);
    expect(pending.kind).toBe("insufficient");
  });

  it("never concludes on keeping a contract without a linked current contract", () => {
    const result = orient(null, [
      offer("a", 140000, [parking(5000)]),
      offer("b", 120000, [
        parking(3000),
        feature({ label: "Bris de glace", category: "glass", coverage: "included" }),
      ]),
    ]);
    expect(result).toMatchObject({ kind: "offers_only", reference: "none", suggestion: null });
    expect(result.offers.map((item) => item.status)).toEqual(["comparable", "comparable"]);
    expect(result.offers[0]!.missing.map((row) => row.key)).toEqual(["glass"]);
    expect(result.offers.every((item) => !item.improves.length && !item.loses.length)).toBe(true);
    expect(orient(null, [offer("a", null, [])]).kind).toBe("insufficient");
  });
});
