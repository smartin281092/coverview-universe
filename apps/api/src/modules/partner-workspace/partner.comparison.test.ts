import { describe, expect, it } from "vitest";
import type { CurrentContract, LeadOffer } from "@coverview/contracts/partner";
import { suggestBenefitCategory, type BenefitLimit } from "@coverview/contracts/partner-benefits";
import { compareOffers } from "./partner.comparison.js";

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
function offer(
  id: string,
  features: OfferFeature[],
  overrides: Partial<LeadOffer> = {},
): LeadOffer {
  return {
    id,
    version: 1,
    active: true,
    state: "ready",
    reviewedAt: "2026-10-01T10:00:00.000Z",
    publishedAt: null,
    createdAt: "2026-10-01T09:00:00.000Z",
    company: `Compagnie ${id}`,
    product: "Produit isolé",
    documentId: `doc_${id}`,
    replacesId: null,
    reference: "",
    annualPremiumMinor: 128000,
    currency: "CHF",
    validUntil: null,
    effectiveDate: null,
    features,
    summary: "",
    limitations: "",
    canCompare: true,
    ...overrides,
  };
}
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
// Only the fields read by the comparison: the document projection carries many others.
const current = (features: ContractFeature[], premiumVerified = true) =>
  ({
    referenceId: "ref_isolated",
    documentId: "doc_current",
    fingerprint: "a".repeat(64),
    confirmedAt: "2026-09-01T10:00:00.000Z",
    status: "available",
    reviewVersion: 1,
    premiumVerified,
    features,
    source: {
      contract: { title: "Auto actuelle" },
      facts: {
        companyId: null,
        premium: { amountMinor: 75500, currency: "CHF", period: "half_year" },
      },
    },
  }) as unknown as CurrentContract;
const chf = (francs: number, period: BenefitLimit["period"] = "event"): BenefitLimit => ({
  value: francs * 100,
  unit: "chf",
  period,
});

describe("offer comparison", () => {
  it("groups differently named benefits under one normalized category, keeping each label", () => {
    const result = compareOffers(null, [
      offer("a", [
        feature({ label: "Assistance mobilité", category: "assistance", coverage: "included" }),
      ]),
      offer("b", [
        feature({ label: "Assistance Europe", category: "assistance", coverage: "included" }),
      ]),
    ]);
    expect(result).toMatchObject({ catalog: "benefit-catalog-v2", reference: "none" });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      key: "assistance",
      category: "assistance",
      label: null,
    });
    expect(result.rows[0]!.cells.map((cell) => cell?.label)).toEqual([
      "Assistance mobilité",
      "Assistance Europe",
    ]);
    expect(result.rows[0]!.cells.map((cell) => cell?.change)).toEqual([null, null]);
    expect(result.columns.map((column) => column.summary)).toEqual([null, null]);
  });

  it("compares amounts only when structured, verified and sourced with the same unit and period", () => {
    const result = compareOffers(
      current([
        held({
          label: "Dommages de parcage",
          category: "parking",
          value: "CHF 2'000",
          limit: chf(2000),
        }),
      ]),
      [
        offer("better", [
          feature({ label: "Parking", category: "parking", value: "CHF 5'000", limit: chf(5000) }),
        ]),
        offer("worse", [
          feature({ label: "Parking", category: "parking", value: "CHF 1'000", limit: chf(1000) }),
        ]),
        offer("period", [
          feature({
            label: "Parking",
            category: "parking",
            value: "CHF 5'000 par an",
            limit: chf(5000, "year"),
          }),
        ]),
        offer("unpaged", [
          feature({
            label: "Parking",
            category: "parking",
            value: "CHF 5'000",
            limit: chf(5000),
            sourcePage: null,
          }),
        ]),
        offer("calculated", [
          feature({
            label: "Parking",
            category: "parking",
            value: "CHF 5'000",
            limit: chf(5000),
            origin: "calculated",
          }),
        ]),
      ],
    );
    const [row] = result.rows;
    expect(row!.cells.map((cell) => cell?.change)).toEqual([
      null,
      "better",
      "worse",
      "changed",
      "changed",
      "to_verify",
    ]);
    // The best amount is ranked among offers sharing the same unit and period only.
    expect(row!.cells.map((cell) => cell?.best)).toEqual([false, true, false, false, false, false]);
    expect(row!.primary).toBe(true);
    expect(result.columns.map((column) => column.summary?.gains ?? null)).toEqual([
      null,
      1,
      0,
      0,
      0,
      0,
    ]);
    expect(result.columns[2]!.summary).toMatchObject({ gains: 0, losses: 1 });
  });

  it("never turns an absence or an uncertain inclusion into a gain or a loss", () => {
    const result = compareOffers(
      current([
        held({ label: "Casco collision", category: "collision", coverage: "excluded" }),
        held({ label: "Bris de glace", category: "glass", coverage: "unknown" }),
      ]),
      [
        offer("a", [
          feature({ label: "Collision", category: "collision", coverage: "included" }),
          feature({ label: "Vitrage", category: "glass", coverage: "included" }),
          feature({
            label: "Effets personnels",
            category: "personal_effects",
            coverage: "included",
          }),
        ]),
        offer("b", [feature({ label: "Collision", category: "collision", coverage: "excluded" })]),
      ],
    );
    const changes = (key: string) =>
      result.rows
        .find((item) => item.key === key)!
        .cells.map((cell) => (cell ? cell.change : "absent"));
    expect(changes("collision")).toEqual([null, "added", "identical"]);
    expect(changes("glass")).toEqual([null, "changed", "absent"]);
    expect(changes("personal_effects")).toEqual(["absent", "missing", "absent"]);
    expect(result.columns[1]!.summary).toEqual({
      gains: 1,
      losses: 0,
      exclusionsChanged: 0,
      toVerify: 0,
      missing: 1,
    });
  });

  it("asks for verification of unreviewed, expired, unverified, calculated or duplicated values", () => {
    const now = Date.parse("2026-10-04T10:00:00.000Z");
    const base = held({ label: "Assistance", category: "assistance", coverage: "included" });
    const result = compareOffers(
      current([base]),
      [
        offer(
          "unreviewed",
          [feature({ label: "Assistance", category: "assistance", coverage: "included" })],
          {
            reviewedAt: null,
          },
        ),
        offer(
          "expired",
          [feature({ label: "Assistance", category: "assistance", coverage: "included" })],
          {
            validUntil: "2026-10-03T10:00:00.000Z",
          },
        ),
        offer("unverified", [
          feature({
            label: "Assistance",
            category: "assistance",
            coverage: "included",
            verification: "to_verify",
          }),
        ]),
        offer("duplicated", [
          feature({ label: "Assistance mobilité", category: "assistance", coverage: "included" }),
          feature({ label: "Assistance Europe", category: "assistance", coverage: "included" }),
        ]),
      ],
      now,
    );
    expect(result.rows[0]!.cells.map((cell) => cell?.change)).toEqual([
      null,
      "to_verify",
      "to_verify",
      "to_verify",
      "to_verify",
    ]);
    expect(result.rows[0]!.cells[4]!.label).toBe("Assistance mobilité · Assistance Europe");
    expect(result.columns[1]).toMatchObject({
      premiumStatus: "to_verify",
      annualDifferenceMinor: null,
    });
  });

  it("reports the verified annual difference and refuses it without a verified premium", () => {
    const verified = compareOffers(current([]), [offer("a", [])]);
    expect(verified.columns.map((column) => column.annualPremiumMinor)).toEqual([151000, 128000]);
    expect(verified.columns[1]).toMatchObject({
      premiumStatus: "verified",
      annualDifferenceMinor: -23000,
    });
    const unverified = compareOffers(current([], false), [offer("a", [])]);
    expect(unverified.columns[0]!.premiumStatus).toBe("to_verify");
    expect(unverified.columns[1]!.annualDifferenceMinor).toBeNull();
  });

  it("ranks the best amount among offers without a reference, lower being better for a deductible", () => {
    const result = compareOffers(null, [
      offer("a", [
        feature({
          label: "Soins dentaires",
          category: "dental",
          value: "CHF 1'000",
          limit: chf(1000, "year"),
        }),
        feature({ label: "Franchise", category: "deductible", value: "CHF 300", limit: chf(300) }),
      ]),
      offer("b", [
        feature({
          label: "Dentaire",
          category: "dental",
          value: "CHF 2'000",
          limit: chf(2000, "year"),
        }),
        feature({ label: "Franchise", category: "deductible", value: "CHF 500", limit: chf(500) }),
      ]),
      offer("c", [
        feature({ label: "Franchise", category: "deductible", value: "CHF 300", limit: chf(300) }),
      ]),
    ]);
    const row = (key: string) => result.rows.find((item) => item.key === key)!;
    expect(row("dental").cells.map((cell) => cell?.best ?? null)).toEqual([false, true, null]);
    expect(row("deductible").cells.map((cell) => cell?.best)).toEqual([true, false, true]);
    expect(result.rows.map((item) => item.key)).toEqual(["deductible", "dental"]);
  });

  it("groups other benefits by normalized label and tells differing exclusions apart", () => {
    const result = compareOffers(
      current([
        held({
          label: "Protection  juridique Circulation",
          value: "Incluse",
          coverage: "included",
        }),
        held({
          label: "Vol",
          category: "theft",
          value: "Valeur à neuf",
          coverage: "included",
          exclusions: "Vol simple",
        }),
      ]),
      [
        offer("a", [
          feature({
            label: "protection juridique circulation",
            value: "Incluse",
            coverage: "included",
          }),
          feature({
            label: "Vol",
            category: "theft",
            value: "Valeur à neuf",
            coverage: "included",
          }),
        ]),
      ],
    );
    const other = result.rows.find((item) => item.category === "other")!;
    expect(other).toMatchObject({ key: "other:protection juridique circulation", primary: false });
    expect(other.cells.map((cell) => cell?.change)).toEqual([null, "identical"]);
    const theft = result.rows.find((item) => item.key === "theft")!;
    expect(theft.cells[1]!.change).toBe("exclusions_changed");
    expect(theft.primary).toBe(true);
  });

  it("keeps pension terms as sourced text rows, never as computed gains or losses", () => {
    const result = compareOffers(
      current([
        held({
          label: "Valeurs de rachat",
          category: "surrender_value",
          value: "Année 10 : CHF 12'000",
        }),
        held({
          label: "Capital garanti",
          category: "guaranteed_capital",
          value: "CHF 50'000",
          limit: chf(50000, "total"),
        }),
      ]),
      [
        offer("a", [
          feature({
            label: "Valeur de rachat",
            category: "surrender_value",
            value: "Année 10 : CHF 14'000",
          }),
          feature({
            label: "Capital garanti",
            category: "guaranteed_capital",
            value: "CHF 60'000",
            limit: chf(60000, "total"),
          }),
          feature({
            label: "Conséquences d'un remplacement",
            category: "replacement_consequences",
            value: "Nouveau questionnaire de santé",
          }),
        ]),
      ],
    );
    const changes = (key: string) =>
      result.rows
        .find((row) => row.key === key)!
        .cells.map((cell) => (cell ? cell.change : "absent"));
    expect(changes("surrender_value")).toEqual([null, "changed"]);
    expect(changes("guaranteed_capital")).toEqual([null, "better"]);
    expect(changes("replacement_consequences")).toEqual(["absent", "missing"]);
    expect(result.catalog).toBe("benefit-catalog-v2");
  });

  it("suggests a category from a label only when one category of the need matches", () => {
    expect(suggestBenefitCategory("Véhicule de remplacement 7 jours", "vehicle")).toBe(
      "replacement_vehicle",
    );
    expect(suggestBenefitCategory("Assistance mobilité Plus", "vehicle")).toBe("assistance");
    expect(suggestBenefitCategory("Franchise annuelle", "health")).toBe("deductible");
    expect(suggestBenefitCategory("Lunettes", "vehicle")).toBeNull();
    expect(suggestBenefitCategory("Franchise vol", "vehicle")).toBeNull();
    expect(suggestBenefitCategory("Valeurs de rachat garanties", "pension")).toBe(
      "surrender_value",
    );
    expect(suggestBenefitCategory("Stratégie de placement", "pension")).toBe("investment_strategy");
    expect(suggestBenefitCategory("Échéance du contrat", "pension")).toBe("maturity");
    expect(suggestBenefitCategory("Versements annuels", "pension")).toBe("contribution");
    expect(suggestBenefitCategory("Valeurs de rachat", "vehicle")).toBeNull();
  });
});
