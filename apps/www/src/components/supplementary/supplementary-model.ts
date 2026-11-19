import type {
  SupplementaryBenefit,
  SupplementaryCanton,
  SupplementaryCatalog,
  SupplementaryPrice,
  SupplementaryProduct,
  SupplementarySex,
} from "@coverview/api-client/supplementary-insurance";
import { supplementaryCopy as copy } from "../../content/fr/supplementary";

// Display only: prices, coverages and order come from the API; this file arranges them.

export type Profile = {
  // null = not given by the visitor: the prices use the default, the assistant knows it is one.
  birthYear: number | null;
  sex: SupplementarySex | null;
  canton: SupplementaryCanton | null;
};
export const defaultBirthYear = 1990;
export const defaultCanton: SupplementaryCanton = "VD";
export const maxCompared = 4;

export const interpolate = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, String(value)),
    template,
  );
const plurals = new Intl.PluralRules("fr-CH");
export const plural = (forms: { one: string; other: string }, count: number) =>
  interpolate(plurals.select(count) === "one" ? forms.one : forms.other, {
    count: new Intl.NumberFormat("fr-CH").format(count),
  });

// Swiss francs as the currency style writes them, 1'234.50, without the currency sign.
const francFormat = (fraction: number) =>
  new Intl.NumberFormat("fr-CH", {
    style: "currency",
    currency: "CHF",
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  });
const cents = francFormat(2);
const whole = francFormat(0);
// Browsers' ICU data differ on the fr-CH group sign (apostrophe or narrow space): the Swiss
// apostrophe is set explicitly, as in @coverview/ui/number-format.
const amountOnly = (format: Intl.NumberFormat, value: number) =>
  format
    .formatToParts(value)
    .filter((part) => part.type !== "currency")
    .map((part) => (part.type === "group" ? "'" : part.value))
    .join("")
    .trim();
export const chf = (minor: number) => amountOnly(cents, minor / 100);
export const chfRound = (minor: number) =>
  minor % 100 === 0 ? amountOnly(whole, minor / 100) : chf(minor);
const percent = new Intl.NumberFormat("fr-CH", { style: "percent", maximumFractionDigits: 1 });

export const effectiveProfile = (profile: Profile) => ({
  year: 2027 as const,
  birthYear: profile.birthYear ?? defaultBirthYear,
  sex: profile.sex,
  canton: profile.canton ?? defaultCanton,
});

export const shortLabel = (label: string) => label.replace(/\s*\([^)]*\)\s*$/u, "");
export const isTaxonomyTag = (tag: string) => !tag.startsWith("other:");

export type CatalogIndex = {
  catalog: SupplementaryCatalog;
  products: Map<string, SupplementaryProduct>;
  insurers: Map<string, SupplementaryCatalog["insurers"][number]>;
  tags: Map<string, SupplementaryCatalog["tags"][number]>;
  families: Map<string, SupplementaryCatalog["families"][number]>;
  categories: Map<string, SupplementaryCatalog["categories"][number]>;
  familyOrder: Map<string, number>;
  tagOrder: Map<string, number>;
  categoryOrder: Map<string, number>;
  // Families of the common benefits; the catalogue's « other » family groups benefits without
  // an equivalent elsewhere, kept for the detail but out of filters and comparison lines.
  taxonomyFamilies: Set<string>;
};
export function indexCatalog(catalog: SupplementaryCatalog): CatalogIndex {
  const order = <T extends { key: string }>(items: T[]) =>
    new Map(items.map((item, index) => [item.key, index]));
  return {
    catalog,
    products: new Map(catalog.products.map((item) => [item.key, item])),
    insurers: new Map(catalog.insurers.map((item) => [item.key, item])),
    tags: new Map(catalog.tags.map((item) => [item.key, item])),
    families: new Map(catalog.families.map((item) => [item.key, item])),
    categories: new Map(catalog.categories.map((item) => [item.key, item])),
    familyOrder: order(catalog.families),
    tagOrder: order(catalog.tags),
    categoryOrder: order(catalog.categories),
    taxonomyFamilies: new Set(
      catalog.tags.filter((tag) => isTaxonomyTag(tag.key)).map((tag) => tag.family),
    ),
  };
}
export const tagLabel = (index: CatalogIndex, tag: string) =>
  shortLabel(index.tags.get(tag)?.label ?? tag);
export const categoryLabel = (index: CatalogIndex, key: string) =>
  shortLabel(index.categories.get(key)?.label ?? key);
export const familyLabel = (index: CatalogIndex, key: string) =>
  index.families.get(key)?.label ?? key;
export const insurerName = (index: CatalogIndex, key: string) =>
  index.insurers.get(key)?.name ?? key;

// The benefit's family: its main taxonomy tag's, or the first taxonomy tag found.
export function benefitFamily(index: CatalogIndex, benefit: SupplementaryBenefit) {
  for (const tag of benefit.tags) {
    const family = index.tags.get(tag)?.family;
    if (family) return family;
  }
  return null;
}
// A benefit under its common name (« Orthodontie »), else the insurer's own wording.
export function benefitTitle(index: CatalogIndex, benefit: SupplementaryBenefit) {
  const tag = benefit.tags.find((item) => index.tags.has(item));
  return tag ? tagLabel(index, tag) : benefit.label;
}
export const productTags = (product: SupplementaryProduct) => product.tags.filter(isTaxonomyTag);

export function variantName(product: SupplementaryProduct, key: string | null) {
  if (!key) return null;
  return product.variants.find((variant) => variant.key === key)?.name ?? key;
}

// « 90 %, max. 500 CHF / an », « illimité », else the first clause of the insurer's wording.
export function coverageShort(benefit: SupplementaryBenefit) {
  const parts: string[] = [];
  if (benefit.ratePercent !== null) parts.push(percent.format(benefit.ratePercent / 100));
  if (benefit.unlimited) parts.push(copy.coverage.unlimited);
  else if (benefit.maxAmountMinor !== null) {
    const period = benefit.maxPeriod ? copy.coverage.periods[benefit.maxPeriod] : undefined;
    const amount = interpolate(copy.coverage.max, { amount: chfRound(benefit.maxAmountMinor) });
    parts.push(period ? `${amount} ${period}` : amount);
  }
  if (parts.length) return parts.join(", ");
  const clause = benefit.coverage.split(/[.;:](?:\s|$)/u)[0]?.trim() ?? "";
  if (!clause) return copy.coverage.covered;
  if (clause.length <= 72) return clause;
  const cut = clause.slice(0, 72);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 40 ? cut.lastIndexOf(" ") : 72)}…`;
}
export const structured = (benefit: SupplementaryBenefit) =>
  benefit.unlimited || benefit.ratePercent !== null || benefit.maxAmountMinor !== null;

export type BenefitGroup = { family: string | null; benefits: SupplementaryBenefit[] };
export function groupBenefits(
  index: CatalogIndex,
  benefits: SupplementaryBenefit[],
): BenefitGroup[] {
  const groups = new Map<string | null, SupplementaryBenefit[]>();
  for (const benefit of benefits) {
    const family = benefitFamily(index, benefit);
    groups.set(family, [...(groups.get(family) ?? []), benefit]);
  }
  return [...groups.entries()]
    .map(([family, items]) => ({ family, benefits: items }))
    .sort(
      (a, b) =>
        (a.family === null ? 99 : (index.familyOrder.get(a.family) ?? 98)) -
        (b.family === null ? 99 : (index.familyOrder.get(b.family) ?? 98)),
    );
}

// The card's main benefits: the chosen tags first, then quantified ones, one per main tag.
export function mainBenefits(product: SupplementaryProduct, chosen: string[], count: number) {
  const seen = new Set<string>();
  const rank = (benefit: SupplementaryBenefit) =>
    (benefit.tags.some((tag) => chosen.includes(tag)) ? 0 : 2) + (structured(benefit) ? 0 : 1);
  return [...product.benefits]
    .map((benefit, position) => ({ benefit, position }))
    .sort((a, b) => rank(a.benefit) - rank(b.benefit) || a.position - b.position)
    .map((item) => item.benefit)
    .filter((benefit) => {
      const tag = benefit.tags[0] ?? benefit.id;
      if (seen.has(tag)) return false;
      seen.add(tag);
      return true;
    })
    .slice(0, count);
}

// Prices for the profile: default option, accident included when the option exists.
export type PriceSummary =
  | { kind: "quote"; low: number; high: number; from: boolean; cheapest: SupplementaryPrice }
  | { kind: "published"; monthlyMinor: number; profile: string }
  | { kind: "none" };
export function defaultRows(rows: SupplementaryPrice[]) {
  const standard = rows.filter((row) => row.option === "");
  const pool = standard.length ? standard : rows;
  return pool.some((row) => row.accident === true)
    ? pool.filter((row) => row.accident !== false)
    : pool;
}
export function priceSummary(
  product: SupplementaryProduct,
  rows: SupplementaryPrice[] | undefined,
): PriceSummary {
  const pool = defaultRows(rows ?? []);
  if (pool.length) {
    const cheapest = pool.reduce((best, row) => (row.minMinor < best.minMinor ? row : best));
    const variants = new Set(pool.map((row) => `${row.variant}\u0000${row.option}`));
    return {
      kind: "quote",
      low: cheapest.minMinor,
      high: cheapest.maxMinor,
      from: variants.size > 1,
      cheapest,
    };
  }
  const published = product.publishedPrices
    .filter((item) => item.monthlyMinor !== null)
    .sort((a, b) => (a.monthlyMinor ?? 0) - (b.monthlyMinor ?? 0))[0];
  if (published?.monthlyMinor != null)
    return { kind: "published", monthlyMinor: published.monthlyMinor, profile: published.profile };
  return { kind: "none" };
}
export const sortPrice = (summary: PriceSummary) =>
  summary.kind === "quote" ? summary.low : Number.POSITIVE_INFINITY;
export function rowAmount(row: Pick<SupplementaryPrice, "minMinor" | "maxMinor">) {
  return row.minMinor === row.maxMinor
    ? chf(row.minMinor)
    : interpolate(copy.price.range, { low: chf(row.minMinor), high: chf(row.maxMinor) });
}
export function summaryAmount(summary: PriceSummary) {
  if (summary.kind !== "quote") return null;
  if (summary.from) return interpolate(copy.price.from, { amount: chf(summary.low) });
  return rowAmount({ minMinor: summary.low, maxMinor: summary.high });
}
export function rowLabel(row: SupplementaryPrice) {
  const name = [row.variant, row.option].filter(Boolean).join(" · ") || copy.price.defaultVariant;
  if (row.accident === null) return name;
  return `${name} · ${row.accident ? copy.price.accidentIncluded : copy.price.accidentExcluded}`;
}
export const rowKey = (row: SupplementaryPrice) =>
  `${row.variant}\u0000${row.option}\u0000${String(row.accident)}`;

export type Sort =
  "relevance" | "price-asc" | "price-desc" | "benefits" | "insurer" | "name" | "category";
export const sorts: Sort[] = [
  "relevance",
  "price-asc",
  "price-desc",
  "benefits",
  "insurer",
  "name",
  "category",
];
export type Filters = {
  categories: string[];
  tags: string[];
  insurers: string[];
  // Whole francs per month for the profile; null = no limit.
  maxMonthly: number | null;
  tagMode: "all" | "any";
};
export const noFilters: Filters = {
  categories: [],
  tags: [],
  insurers: [],
  maxMonthly: null,
  tagMode: "all",
};
type Facet = "categories" | "tags" | "insurers";
export function matches(
  product: SupplementaryProduct,
  filters: Filters,
  price: PriceSummary,
  skip?: Facet,
) {
  if (
    skip !== "categories" &&
    filters.categories.length &&
    !filters.categories.includes(product.category)
  )
    return false;
  if (skip !== "insurers" && filters.insurers.length && !filters.insurers.includes(product.insurer))
    return false;
  if (skip !== "tags" && filters.tags.length) {
    const covered = (tag: string) => product.tags.includes(tag);
    if (filters.tagMode === "all" ? !filters.tags.every(covered) : !filters.tags.some(covered))
      return false;
  }
  if (
    filters.maxMonthly !== null &&
    (price.kind !== "quote" || price.low > filters.maxMonthly * 100)
  )
    return false;
  return true;
}
// Counters of a facet: products that would match with this facet's own choice left out.
export function facetCounts(
  products: SupplementaryProduct[],
  filters: Filters,
  prices: Map<string, PriceSummary>,
  facet: Facet,
  valueOf: (product: SupplementaryProduct) => string[],
) {
  const counts = new Map<string, number>();
  for (const product of products) {
    if (!matches(product, filters, prices.get(product.key) ?? { kind: "none" }, facet)) continue;
    for (const value of new Set(valueOf(product))) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}
export function sortProducts(
  index: CatalogIndex,
  products: SupplementaryProduct[],
  sort: Sort,
  prices: Map<string, PriceSummary>,
  chosenTags: string[],
  assistantOrder: Map<string, number> | null,
) {
  const price = (product: SupplementaryProduct) =>
    sortPrice(prices.get(product.key) ?? { kind: "none" });
  const byName = (a: SupplementaryProduct, b: SupplementaryProduct) =>
    insurerName(index, a.insurer).localeCompare(insurerName(index, b.insurer), "fr") ||
    a.name.localeCompare(b.name, "fr");
  const compare: Record<Sort, (a: SupplementaryProduct, b: SupplementaryProduct) => number> = {
    relevance: (a, b) => {
      if (assistantOrder)
        return (assistantOrder.get(a.key) ?? 999) - (assistantOrder.get(b.key) ?? 999);
      if (chosenTags.length) {
        const matched = (product: SupplementaryProduct) =>
          chosenTags.filter((tag) => product.tags.includes(tag)).length;
        return matched(b) - matched(a) || price(a) - price(b) || byName(a, b);
      }
      return (
        (index.categoryOrder.get(a.category) ?? 99) - (index.categoryOrder.get(b.category) ?? 99) ||
        byName(a, b)
      );
    },
    "price-asc": (a, b) => price(a) - price(b) || byName(a, b),
    "price-desc": (a, b) => {
      const pa = price(a);
      const pb = price(b);
      if (pa === pb) return byName(a, b);
      if (pa === Number.POSITIVE_INFINITY) return 1;
      if (pb === Number.POSITIVE_INFINITY) return -1;
      return pb - pa;
    },
    benefits: (a, b) => b.benefits.length - a.benefits.length || byName(a, b),
    insurer: byName,
    name: (a, b) => a.name.localeCompare(b.name, "fr") || byName(a, b),
    category: (a, b) =>
      (index.categoryOrder.get(a.category) ?? 99) - (index.categoryOrder.get(b.category) ?? 99) ||
      byName(a, b),
  };
  return [...products].sort(compare[sort]);
}

// Session storage may be missing or refused (private mode, blocked site data).
export function readSession<T>(key: string, parse: (value: unknown) => T | null): T | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? parse(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
export function writeSession(key: string, value: unknown) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Without storage, the choice lasts as long as the page.
  }
}
export const compareKey = "cv-supplementary-compare";
export const profileKey = "cv-supplementary-profile";
export const comparisonPath = "/comparateur-complementaires-2027/comparaison";
export const listPath = "/comparateur-complementaires-2027";
export const comparisonHref = (keys: string[]) =>
  keys.length
    ? `${comparisonPath}?produits=${keys.map(encodeURIComponent).join(",")}`
    : comparisonPath;
