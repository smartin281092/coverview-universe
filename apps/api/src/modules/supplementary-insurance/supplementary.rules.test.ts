import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import type {
  SupplementaryCatalog,
  SupplementaryProduct,
} from "@coverview/contracts/supplementary-insurance";
import { publicNote } from "./supplementary.notes.js";
import { interpretWithRules } from "./supplementary.interpret.js";
import { quotePrices, type PremiumRecord } from "./supplementary.quote.js";
import { createSupplementaryRepository } from "./supplementary.repository.js";
import { createVariantMatcher } from "./supplementary.variants.js";

const catalog = {
  tags: [
    "glasses_lenses",
    "dental_treatment",
    "orthodontics",
    "hospital_general_ch",
    "hospital_semi_private",
    "hospital_private",
    "alt_medicine_therapies",
  ].map((key) => ({
    key,
    family: key.startsWith("hospital") ? "hospital" : "ambulatory",
    label: key,
  })),
  insurers: [{ key: "assura" }, { key: "groupe-mutuel" }, { key: "kpt" }],
} as unknown as SupplementaryCatalog;

describe("rules interpretation", () => {
  it("reads needs, child, sex and age in French, accents and plural ignored", () => {
    expect(
      interpretWithRules("Lunettes et DENTAIRE pour mon fils de 12 ans", catalog),
    ).toMatchObject({
      tags: ["glasses_lenses", "dental_treatment"],
      child: true,
      sex: "male",
      birthYear: 2015,
      canton: null,
      maxMonthlyMinor: null,
    });
    expect(interpretWithRules("hôpital privé, budget 150 francs", catalog)).toMatchObject({
      tags: ["hospital_private"],
      maxMonthlyMinor: 15000,
      birthYear: null,
      child: false,
    });
  });
  it("keeps the longest phrase and drops the generic hospital behind a precise ward", () => {
    expect(interpretWithRules("une chambre demi-privée à l'hôpital", catalog).tags).toEqual([
      "hospital_semi_private",
    ]);
    expect(interpretWithRules("hospitalisation", catalog).tags).toEqual(["hospital_general_ch"]);
    expect(interpretWithRules("ostéopathe, appareil dentaire", catalog).tags).toEqual([
      "alt_medicine_therapies",
      "orthodontics",
    ]);
  });
  it("reads cantons, insurers and a yearly budget", () => {
    expect(
      interpretWithRules("Je vis à Genève, chez Groupe Mutuel, max CHF 1200 par an", catalog),
    ).toMatchObject({ canton: "GE", insurers: ["groupe-mutuel"], maxMonthlyMinor: 10000 });
    // "né en 1985" is a birth, not a maternity need.
    expect(interpretWithRules("née en 1985, VS", catalog)).toMatchObject({
      tags: [],
      birthYear: 1985,
      canton: "VS",
    });
  });
});

describe("public note", () => {
  it("turns recognized survey remarks into short French text, never raw identifiers", () => {
    expect(publicNote("online_discount_included=0.80; three_year_contract_price=11.70")).toBe(
      "Rabais en ligne inclus · Avec un contrat de 3 ans : CHF 11.70 par mois",
    );
    expect(
      publicNote(
        "internal=PRD_SV_HPS_V001; tariff_id=HPS_AG; discounts_included=firstYearDiscount; price_from_2027-06-15=31.50",
      ),
    ).toBe("1re année de vie gratuite, puis CHF 31.50 par mois dès le 15.06.2027");
    expect(publicNote("internal=H3SL04Produkt; region=VD_1")).toBeNull();
    expect(publicNote("free_per_calculator; child_free")).toBe("Gratuit jusqu’à 18 ans");
  });
});

describe("quote prices", () => {
  const row = (over: Partial<PremiumRecord>): PremiumRecord => ({
    productKey: "p",
    variant: "",
    option: "",
    birthYear: 1990,
    postalCode: "1003",
    sex: "female",
    accident: null,
    monthlyMinor: 1000,
    note: null,
    ...over,
  });
  const rows = [
    row({ accident: true, monthlyMinor: 1200 }),
    row({ accident: false, monthlyMinor: 1100 }),
    row({ sex: "male", accident: true, monthlyMinor: 1500 }),
    row({ sex: "male", accident: false, monthlyMinor: 1400 }),
    row({ productKey: "q", monthlyMinor: 900 }),
    row({ productKey: "q", sex: "male", monthlyMinor: 800 }),
    row({ productKey: "q", birthYear: 1991, monthlyMinor: 1 }),
  ];
  it("gives the female–male range without sex and keeps the accident profile only", () => {
    expect(quotePrices(rows, 1990, null)).toEqual([
      expect.objectContaining({ productKey: "p", accident: true, minMinor: 1200, maxMinor: 1500 }),
      expect.objectContaining({ productKey: "q", accident: null, minMinor: 800, maxMinor: 900 }),
    ]);
  });
  it("gives one price with a sex", () => {
    expect(quotePrices(rows, 1990, "male")).toEqual([
      expect.objectContaining({ productKey: "p", minMinor: 1500, maxMinor: 1500 }),
      expect.objectContaining({ productKey: "q", minMinor: 800, maxMinor: 800 }),
    ]);
  });
});

describe("variant matcher", () => {
  const product = (variants: Array<[string, string]>) =>
    ({
      key: "x",
      variants: variants.map(([key, name]) => ({ key, name, description: "" })),
    }) as unknown as SupplementaryProduct;
  it("attributes calculator variants to the closest catalogue variants", () => {
    const match = createVariantMatcher();
    const hospital = product([
      ["commune", "Assurance-hospitalisation COMMUNE"],
      ["mi-privee", "Assurance-hospitalisation MI-PRIVÉE"],
      ["privee", "Assurance-hospitalisation PRIVÉE"],
    ]);
    expect(match(hospital, "MI-PRIVÉE", "franchise 1'000")).toEqual(["mi-privee"]);
    expect(match(hospital, "PRIVÉE", "")).toEqual(["privee"]);
    const ortho = product([
      ["ortho2000", "Niveau CHF 2'000"],
      ["ortho10000", "Niveau CHF 10'000"],
    ]);
    expect(match(ortho, "Choix du montant de la couverture 10'000", "")).toEqual(["ortho10000"]);
    expect(
      match(
        product([
          ["a", "Alpha"],
          ["b", "Beta"],
        ]),
        "CHF 50'000",
        "",
      ),
    ).toEqual([]);
    // Equally close variants share the price.
    const world = product([
      ["privee-europe", "Division privée Europe"],
      ["privee-monde", "Division privée Monde"],
    ]);
    expect(match(world, "Division privée", "")).toEqual(["privee-europe", "privee-monde"]);
    const natura = product([
      ["plus", "plus"],
      ["plus-natura", "plus natura"],
    ]);
    expect(match(natura, "Sans natura", "")).toEqual(["plus"]);
    expect(match(natura, "Avec natura", "")).toEqual(["plus-natura"]);
    const wards = product([
      ["generale", "hospita générale"],
      ["demi", "Hospita Demi-Privée (classe 2)"],
      ["flex-demi", "Hospita Flex Demi-Privée"],
    ]);
    expect(match(wards, "Division commune", "")).toEqual(["generale"]);
    expect(match(wards, "Hospita Demi-Privée", "")).toEqual(["demi"]);
    const upgrade = product([
      ["commune", "Hospita Commune (classe 1)"],
      ["privee", "Hospita Privée (classe 4)"],
    ]);
    expect(match(upgrade, "Hospita Commune · PLUS Option privée", "")).toEqual(["commune"]);
  });
});

it("answers 503 SUPPLEMENTARY_CATALOG_UNAVAILABLE before any import", async () => {
  const pool = { query: () => Promise.resolve({ rows: [] }) } as unknown as Pool;
  await expect(createSupplementaryRepository(pool).current()).rejects.toMatchObject({
    code: "SUPPLEMENTARY_CATALOG_UNAVAILABLE",
    statusCode: 503,
  });
});
