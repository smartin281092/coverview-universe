import type { LeadOffer } from "@coverview/api-client/partner";

type MetricLabel = "capital" | "premium" | "monthly" | "deductible" | "annual" | "validUntil";
// An amount in CHF centimes, a date, the text as written, or nothing known.
export type MetricValue =
  | { kind: "amount"; minor: number; per?: "month" | "year" }
  | { kind: "date"; at: string }
  | { kind: "text"; text: string }
  | { kind: "missing" };
export type OfferMetric = { label: MetricLabel; value: MetricValue };

const missing: MetricValue = { kind: "missing" };

/** "CHF 588 par mois", "CHF 185'000": the amount and its period when the text says only that. */
export function amountText(text: string): MetricValue {
  const match = /^CHF\s*(\d[\d'’ ]*(?:[.,]\d{1,2})?)\s*(?:par\s+(mois|an|année))?$/iu.exec(
    text.trim(),
  );
  if (!match) return { kind: "text", text: text.trim() };
  const minor = Math.round(Number(match[1]!.replace(/['’ ]/gu, "").replace(",", ".")) * 100);
  if (!Number.isFinite(minor)) return { kind: "text", text: text.trim() };
  const period = match[2]?.toLowerCase();
  return {
    kind: "amount",
    minor,
    ...(period ? { per: period === "mois" ? "month" : "year" } : {}),
  };
}

function benefit(offer: LeadOffer, category: string): MetricValue {
  const item = offer.features.find((feature) => feature.category === category && feature.value);
  if (!item) return missing;
  return item.limit?.unit === "chf"
    ? { kind: "amount", minor: item.limit.value }
    : amountText(item.value);
}

/**
 * The two figures shown over an offer (8 October 2026): for a 3rd pillar, the projected capital at
 * retirement and the premium as it is paid; for basic health insurance, the monthly premium and
 * the deductible; otherwise the yearly premium and the validity.
 */
export function offerMetrics(offer: LeadOffer, category: string): [OfferMetric, OfferMetric] {
  const annual: MetricValue =
    offer.annualPremiumMinor === null
      ? missing
      : { kind: "amount", minor: offer.annualPremiumMinor, per: "year" };
  if (category === "pension") {
    const contribution = benefit(offer, "contribution");
    return [
      { label: "capital", value: benefit(offer, "maturity") },
      { label: "premium", value: contribution.kind === "missing" ? annual : contribution },
    ];
  }
  if (category === "health")
    return [
      {
        label: "monthly",
        // Basic insurance premiums are set per month: the yearly amount holds twelve of them.
        value:
          offer.annualPremiumMinor === null
            ? missing
            : { kind: "amount", minor: Math.round(offer.annualPremiumMinor / 12), per: "month" },
      },
      { label: "deductible", value: benefit(offer, "deductible") },
    ];
  return [
    { label: "annual", value: annual },
    {
      label: "validUntil",
      value: offer.validUntil ? { kind: "date", at: offer.validUntil } : missing,
    },
  ];
}
