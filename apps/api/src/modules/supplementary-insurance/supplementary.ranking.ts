import type {
  SupplementaryBenefit,
  SupplementaryCatalog,
  SupplementaryPrice,
  SupplementaryProduct,
} from "@coverview/contracts/supplementary-insurance";
import type { Interpretation } from "./supplementary.interpret.js";
import { createVariantMatcher, type VariantMatcher } from "./supplementary.variants.js";

// Deterministic ranking of the assistant (19 November 2026).
// - Score 0–100 = mean, over the requested tags, of the best benefit of the variant: 1 for the main
//   tag, 0.6 for a secondary tag, halved for a benefit limited to accidents, times
//   0.85 + 0.15 × strength (rate and amount compared with the largest amount for that tag in the
//   catalogue, log scale; unlimited = 1).
// - Variant = the cheapest priced one among those covering the most tags as main tag, then the
//   most tags at all.
// - Filters: insurers (strict); categories (only without tags; with tags, a tie-breaker).
// - Budget: products above it come after all products within it. Without a price, a product comes
//   after the priced ones at equal score. A priced product without a price for the profile (age,
//   sex) is not offered to that person and is left out; an unpriced product is kept unless its
//   audience is children and the person is an adult, or the reverse.

type Coverage = { weight: number; strength: number; benefit: SupplementaryBenefit };
type Level = { key: string | null; coverage: Map<string, Coverage> };
export type CatalogIndex = {
  catalog: SupplementaryCatalog;
  products: Map<string, SupplementaryProduct>;
  levels: Map<string, Level[]>;
  tagLabels: Map<string, string>;
  insurerNames: Map<string, string>;
  matcher: VariantMatcher;
};
export type RankedProduct = {
  productKey: string;
  variant: string | null;
  monthlyMinor: number | null;
  score: number;
  matchedTags: string[];
  reasons: string[];
  withinBudget: boolean;
};

const periods: Record<string, string> = {
  year: " par an",
  "2_years": " sur 2 ans",
  "3_years": " sur 3 ans",
  "5_years": " sur 5 ans",
  case: " par cas",
  day: " par jour",
  lifetime: " à vie",
};
const francs = new Intl.NumberFormat("fr-CH", { maximumFractionDigits: 2 });
// A benefit whose wording limits it to accidents ("après un accident", "(accident)").
const accidentOnly = (benefit: SupplementaryBenefit) => /\baccidents?\b/iu.test(benefit.label);
const shortLabel = (label: string) => label.replace(/\s*\(.*$/u, "").trim() || label;

export function buildCatalogIndex(catalog: SupplementaryCatalog): CatalogIndex {
  const largest = new Map<string, number>();
  for (const product of catalog.products)
    for (const benefit of product.benefits)
      if (benefit.maxAmountMinor)
        for (const tag of benefit.tags)
          largest.set(tag, Math.max(largest.get(tag) ?? 0, benefit.maxAmountMinor));
  const strength = (benefit: SupplementaryBenefit, tag: string) => {
    const parts: number[] = [];
    if (benefit.unlimited) parts.push(1);
    else if (benefit.maxAmountMinor) {
      const top = largest.get(tag) ?? benefit.maxAmountMinor;
      parts.push(Math.min(1, Math.log10(1 + benefit.maxAmountMinor) / Math.log10(1 + top)));
    }
    if (benefit.ratePercent !== null) parts.push(benefit.ratePercent / 100);
    return parts.length ? parts.reduce((sum, part) => sum + part, 0) / parts.length : 0;
  };
  const levels = new Map<string, Level[]>();
  for (const product of catalog.products) {
    const keys = product.variants.length ? product.variants.map((variant) => variant.key) : [null];
    levels.set(
      product.key,
      keys.map((key) => {
        const coverage = new Map<string, Coverage>();
        for (const benefit of product.benefits) {
          if (benefit.variant !== null && benefit.variant !== key) continue;
          benefit.tags.forEach((tag, position) => {
            const value = {
              // Main tag 1, secondary 0.6; halved when the benefit is limited to accidents.
              weight: (position === 0 ? 1 : 0.6) * (accidentOnly(benefit) ? 0.5 : 1),
              strength: strength(benefit, tag),
              benefit,
            };
            const current = coverage.get(tag);
            const total = (item: Coverage) => item.weight * (0.85 + 0.15 * item.strength);
            if (!current || total(value) > total(current)) coverage.set(tag, value);
          });
        }
        return { key, coverage };
      }),
    );
  }
  return {
    catalog,
    products: new Map(catalog.products.map((product) => [product.key, product])),
    levels,
    tagLabels: new Map(catalog.tags.map((tag) => [tag.key, shortLabel(tag.label)])),
    insurerNames: new Map(catalog.insurers.map((insurer) => [insurer.key, insurer.name])),
    matcher: createVariantMatcher(),
  };
}

function reason(label: string, benefit: SupplementaryBenefit) {
  const parts: string[] = [];
  if (benefit.ratePercent !== null) parts.push(`${francs.format(benefit.ratePercent)} %`);
  if (benefit.unlimited) parts.push("sans plafond");
  else if (benefit.maxAmountMinor !== null)
    parts.push(
      `max. CHF ${francs.format(benefit.maxAmountMinor / 100)}${periods[benefit.maxPeriod ?? ""] ?? ""}`,
    );
  const detail = parts.length ? parts.join(", ") : benefit.coverage || benefit.label;
  return `${label} : ${detail}`.slice(0, 300);
}

function audienceFits(product: SupplementaryProduct, age: number) {
  if (product.audience === "child") return age <= 18;
  if (product.audience === "adult") return age >= 19;
  return true;
}

export function rankProducts(
  index: CatalogIndex,
  interpretation: Pick<Interpretation, "tags" | "categories" | "insurers" | "maxMonthlyMinor">,
  prices: SupplementaryPrice[],
  age: number,
): RankedProduct[] {
  const requested = interpretation.tags.filter((tag) => index.tagLabels.has(tag));
  const byProduct = new Map<string, SupplementaryPrice[]>();
  for (const price of prices)
    byProduct.set(price.productKey, [...(byProduct.get(price.productKey) ?? []), price]);
  const budget = interpretation.maxMonthlyMinor;
  const ranked: Array<RankedProduct & { categoryMatch: boolean }> = [];
  for (const product of index.catalog.products) {
    if (interpretation.insurers.length && !interpretation.insurers.includes(product.insurer))
      continue;
    const categoryMatch = interpretation.categories.includes(product.category);
    if (!requested.length && interpretation.categories.length && !categoryMatch) continue;
    const productPrices = byProduct.get(product.key) ?? [];
    if (product.priced ? !productPrices.length : !audienceFits(product, age)) continue;
    // The calculator's default (empty option) when there is one, otherwise every option.
    const defaults = productPrices.some((price) => price.option === "")
      ? productPrices.filter((price) => price.option === "")
      : productPrices;
    const levelPrice = new Map<string | null, number>();
    let unattributed: number | null = null;
    for (const price of defaults) {
      const keys: Array<string | null> = product.variants.length
        ? index.matcher(product, price.variant, price.option)
        : [null];
      if (!keys.length) unattributed = Math.min(unattributed ?? Infinity, price.minMinor);
      for (const key of keys)
        levelPrice.set(key, Math.min(levelPrice.get(key) ?? Infinity, price.minMinor));
    }
    // Calculator variants on another axis (insured sums…): their prices stand for every variant.
    // When some do belong to a variant, a variant without a price of its own has none.
    if (levelPrice.size) unattributed = null;
    const candidates = (index.levels.get(product.key) ?? []).map((level) => {
      const matched = requested.filter((tag) => level.coverage.has(tag));
      const full = matched.filter((tag) => level.coverage.get(tag)!.weight === 1).length;
      const total = requested.reduce((sum, tag) => {
        const item = level.coverage.get(tag);
        return sum + (item ? item.weight * (0.85 + 0.15 * item.strength) : 0);
      }, 0);
      return {
        level,
        matched,
        full,
        score: requested.length ? Math.round((100 * total) / requested.length) : 50,
        price: levelPrice.get(level.key) ?? unattributed,
      };
    });
    // The variants that cover the need best: most tags as main tag, then most tags at all.
    const most = Math.max(0, ...candidates.map((candidate) => candidate.matched.length));
    if (requested.length && most === 0) continue;
    const bestFull = Math.max(...candidates.map((candidate) => candidate.full));
    const covering = candidates.filter(
      (candidate) =>
        candidate.full === bestFull &&
        candidate.matched.length ===
          Math.max(...candidates.filter((c) => c.full === bestFull).map((c) => c.matched.length)),
    );
    const priced = covering
      .filter((candidate) => candidate.price !== null)
      .sort((a, b) => a.price! - b.price! || b.score - a.score);
    const chosen =
      priced.find((candidate) => budget === null || candidate.price! <= budget) ??
      priced[0] ??
      covering.toSorted((a, b) => b.score - a.score)[0];
    if (!chosen) continue;
    ranked.push({
      productKey: product.key,
      variant: chosen.level.key,
      monthlyMinor: chosen.price,
      score: chosen.score,
      matchedTags: chosen.matched,
      reasons: chosen.matched
        .slice(0, 6)
        .map((tag) => reason(index.tagLabels.get(tag)!, chosen.level.coverage.get(tag)!.benefit)),
      withinBudget: budget === null || chosen.price === null || chosen.price <= budget,
      categoryMatch,
    });
  }
  return ranked
    .sort(
      (a, b) =>
        Number(b.withinBudget) - Number(a.withinBudget) ||
        b.score - a.score ||
        Number(a.monthlyMinor === null) - Number(b.monthlyMinor === null) ||
        Number(b.categoryMatch) - Number(a.categoryMatch) ||
        (a.monthlyMinor ?? 0) - (b.monthlyMinor ?? 0) ||
        a.productKey.localeCompare(b.productKey),
    )
    .map((item) => ({
      productKey: item.productKey,
      variant: item.variant,
      monthlyMinor: item.monthlyMinor,
      score: item.score,
      matchedTags: item.matchedTags,
      reasons: item.reasons,
      withinBudget: item.withinBudget,
    }));
}
