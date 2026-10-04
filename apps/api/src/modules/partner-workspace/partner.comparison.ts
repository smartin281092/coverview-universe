import {
  benefitCatalog,
  benefitCatalogVersion,
  benefitCategoryOf,
  benefitCategorySchema,
  type BenefitCategory,
  type BenefitLimit,
} from "@coverview/contracts/partner-benefits";
import {
  offerComparisonSchema,
  type ComparisonChange,
  type OfferComparison,
} from "@coverview/contracts/partner-comparison";
import type { CurrentContract, LeadOffer } from "@coverview/contracts/partner";
import { currentAnnualFactor, currentAnnualPremium } from "./partner.contract.js";

type Coverage = "included" | "excluded" | "unknown";
type Cell = {
  label: string;
  value: string;
  limit: BenefitLimit | null;
  coverage: Coverage;
  conditions: string;
  exclusions: string;
  verification: "verified" | "to_verify" | "missing";
  source: string;
  page: number | null;
  calculated: boolean;
};
type Feature = { key: string; label: string; category?: BenefitCategory | undefined };

const order = new Map(benefitCategorySchema.options.map((category, index) => [category, index]));
const text = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/gu, " ");
// "Other" benefits group by normalized label only; ambiguity never fabricates a gain.
const rowKey = (feature: Feature) => {
  const category = benefitCategoryOf(feature);
  return category === "other" ? `other:${text(feature.label)}` : category;
};
const comparable = (a: BenefitLimit | null, b: BenefitLimit | null): a is BenefitLimit =>
  !!a && !!b && a.unit === b.unit && a.period === b.period;
// A reviewed, sourced and not calculated value; an amount must also cite its page.
const trusted = (cell: Cell | null, ready: boolean) =>
  !!cell && ready && cell.verification === "verified" && !!cell.source.trim() && !cell.calculated;
const measured = (cell: Cell | null, ready: boolean) =>
  trusted(cell, ready) && cell!.page !== null && !!cell!.limit;

// One reviewed value against the reference. Numbers compare only when both are structured,
// verified and sourced with the same unit and period; a differing free value stays "changed".
function change(
  category: BenefitCategory,
  reference: Cell | null,
  cell: Cell | null,
  ready: { reference: boolean; offer: boolean },
): ComparisonChange {
  // An unverified offer value says so even when the reference does not mention it.
  if (!cell || cell.verification === "missing") return "missing";
  if (!trusted(cell, ready.offer)) return "to_verify";
  if (!reference || reference.verification === "missing") return "missing";
  if (!trusted(reference, ready.reference)) return "to_verify";
  if (reference.coverage === "excluded" && cell.coverage === "included") return "added";
  if (reference.coverage === "included" && cell.coverage === "excluded") return "removed";
  const { mode } = benefitCatalog[category];
  const numeric =
    (mode === "higher" || mode === "lower") &&
    measured(reference, ready.reference) &&
    measured(cell, ready.offer) &&
    comparable(reference.limit, cell.limit);
  if (numeric && reference.limit!.value !== cell.limit!.value)
    return cell.limit!.value > reference.limit!.value === (mode === "higher") ? "better" : "worse";
  const sameValue = numeric || text(reference.value) === text(cell.value);
  if (
    !sameValue ||
    reference.coverage !== cell.coverage ||
    text(reference.conditions) !== text(cell.conditions)
  )
    return "changed";
  return text(reference.exclusions) === text(cell.exclusions) ? "identical" : "exclusions_changed";
}

function merge(cells: Cell[]): Cell | null {
  if (!cells.length) return null;
  if (cells.length === 1) return cells[0]!;
  // Two lines under one category cannot be weighed automatically.
  return {
    ...cells[0]!,
    label: cells.map((cell) => cell.label).join(" · "),
    value: cells.map((cell) => cell.value).join(" · "),
    limit: null,
    verification: "to_verify",
  };
}

export function compareOffers(
  current: CurrentContract | null,
  offers: LeadOffer[],
  now = Date.now(),
): OfferComparison {
  const reference = current?.status === "available" ? current : null;
  const active = offers
    .filter((offer) => offer.active && !["cancelled", "replaced", "expired"].includes(offer.state))
    .slice(0, 20);
  const ready = active.map(
    (offer) =>
      offer.canCompare === true &&
      !!offer.reviewedAt &&
      (!offer.validUntil || new Date(offer.validUntil).getTime() > now),
  );
  const annual = reference ? currentAnnualPremium(reference) : null;
  const columns: OfferComparison["columns"] = [
    ...(reference
      ? [
          {
            kind: "current" as const,
            offerId: null,
            offerVersion: null,
            company: reference.source?.facts.companyId ?? "",
            product: reference.source?.contract.title ?? "",
            annualPremiumMinor: annual,
            annualFactor: currentAnnualFactor(reference),
            premiumStatus:
              annual === null
                ? ("missing" as const)
                : reference.premiumVerified
                  ? ("verified" as const)
                  : ("to_verify" as const),
            annualDifferenceMinor: null,
            summary: null,
          },
        ]
      : []),
    ...active.map((offer, index) => {
      const verified = ready[index]! && offer.annualPremiumMinor !== null;
      return {
        kind: "offer" as const,
        offerId: offer.id,
        offerVersion: offer.version,
        company: offer.company,
        product: offer.product,
        annualPremiumMinor: offer.annualPremiumMinor,
        annualFactor: null,
        premiumStatus:
          offer.annualPremiumMinor === null
            ? ("missing" as const)
            : verified
              ? ("verified" as const)
              : ("to_verify" as const),
        annualDifferenceMinor:
          verified && reference?.premiumVerified && annual !== null
            ? offer.annualPremiumMinor! - annual
            : null,
        summary: null as OfferComparison["columns"][number]["summary"],
      };
    }),
  ];
  const referenceCells = new Map<string, Cell[]>();
  for (const feature of reference?.features ?? []) {
    const key = rowKey(feature);
    referenceCells.set(key, [
      ...(referenceCells.get(key) ?? []),
      {
        label: feature.label,
        value: feature.value,
        limit: feature.limit ?? null,
        coverage: feature.coverage,
        conditions: feature.conditions,
        exclusions: feature.exclusions,
        verification: feature.verification,
        source: feature.quote,
        page: feature.page,
        calculated: false,
      },
    ]);
  }
  const offerCells = active.map((offer) => {
    const cells = new Map<string, Cell[]>();
    for (const feature of offer.features) {
      const key = rowKey(feature);
      cells.set(key, [
        ...(cells.get(key) ?? []),
        {
          label: feature.label,
          value: feature.value,
          limit: feature.limit ?? null,
          coverage: feature.coverage ?? "unknown",
          conditions: feature.conditions,
          exclusions: feature.exclusions ?? "",
          verification: feature.origin === "missing" ? "missing" : feature.verification,
          source: feature.source,
          page: feature.sourcePage ?? null,
          calculated: feature.origin === "calculated",
        },
      ]);
    }
    return cells;
  });
  const categories = new Map<string, { category: BenefitCategory; label: string | null }>();
  for (const feature of [
    ...(reference?.features ?? []),
    ...active.flatMap((offer) => offer.features),
  ]) {
    const key = rowKey(feature);
    if (!categories.has(key))
      categories.set(key, {
        category: benefitCategoryOf(feature),
        label: benefitCategoryOf(feature) === "other" ? feature.label.trim() : null,
      });
  }
  const summaries = active.map(() => ({
    gains: 0,
    losses: 0,
    exclusionsChanged: 0,
    toVerify: 0,
    missing: 0,
  }));
  const rows = [...categories.entries()]
    .sort(
      ([a, x], [b, y]) =>
        (order.get(x.category) ?? 0) - (order.get(y.category) ?? 0) || a.localeCompare(b),
    )
    .slice(0, 200)
    .map(([key, { category, label }]) => {
      const base = merge(referenceCells.get(key) ?? []);
      const cells = active.map((_, index) => {
        const cell = merge(offerCells[index]!.get(key) ?? []);
        const result = reference
          ? change(category, base, cell, {
              reference: true,
              offer: ready[index]!,
            })
          : null;
        const summary = summaries[index]!;
        if (result === "added" || result === "better") summary.gains += 1;
        if (result === "removed" || result === "worse") summary.losses += 1;
        if (result === "exclusions_changed") summary.exclusionsChanged += 1;
        if (result === "to_verify") summary.toVerify += 1;
        // A row both sides ignore is no missing information for this offer.
        if (result === "missing" && (cell || base)) summary.missing += 1;
        return cell ? { cell, change: result } : null;
      });
      // Best structured amount among offers, when at least two compare and differ.
      const { mode } = benefitCatalog[category];
      const candidates = cells
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry, index }) => !!entry && measured(entry.cell, ready[index]!));
      // Within the amounts sharing the first one's unit and period; others are not ranked.
      const first = candidates[0]?.entry?.cell.limit ?? null;
      const group = candidates.filter(({ entry }) => comparable(first, entry!.cell.limit));
      const scored =
        (mode === "higher" || mode === "lower") && group.length >= 2
          ? group.map(({ entry, index }) => ({ index, value: entry!.cell.limit!.value }))
          : [];
      const values = scored.map((item) => item.value);
      const target = mode === "higher" ? Math.max(...values) : Math.min(...values);
      const best = new Set(
        values.length && new Set(values).size > 1
          ? scored.filter((item) => item.value === target).map((item) => item.index)
          : [],
      );
      // "calculated" stays internal: the cell schema strips unknown keys on parse.
      const display = (cell: Cell, value: ComparisonChange | null, isBest: boolean) => ({
        ...cell,
        change: value,
        best: isBest,
      });
      return {
        key,
        category,
        label,
        primary: cells.some(
          (entry) =>
            !!entry?.change &&
            ["added", "removed", "better", "worse", "exclusions_changed"].includes(entry.change),
        ),
        cells: [
          ...(reference ? [base ? display(base, null, false) : null] : []),
          ...cells.map((entry, index) =>
            entry ? display(entry.cell, entry.change, best.has(index)) : null,
          ),
        ],
      };
    });
  if (reference)
    summaries.forEach((summary, index) => {
      columns[index + 1]!.summary = summary;
    });
  return offerComparisonSchema.parse({
    catalog: benefitCatalogVersion,
    reference: reference ? "current_contract" : "none",
    columns,
    rows,
  });
}
