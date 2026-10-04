import {
  leadOrientationSchema,
  orientationVersion,
  type LeadOrientation,
} from "@coverview/contracts/partner-orientation";
import type { OfferComparison } from "@coverview/contracts/partner-comparison";
import type { CurrentContract, LeadOffer } from "@coverview/contracts/partner";

type Row = OfferComparison["rows"][number];
type Item = LeadOrientation["offers"][number];
const ref = (row: Row) => ({ key: row.key, category: row.category, label: row.label });

// orientation-v1: facts read from the verified comparison only, never a recommendation.
// - incomplete: a premium or a cell still to verify;
// - advantage: not dearer, no verified loss, and a saving or a verified gain;
// - keep_current: not cheaper and no verified gain;
// - tradeoff: anything else. Without a current contract, offers are only "comparable", and the
//   orientation stays insufficient while one of them is incomplete.
export function orientOffers(
  comparison: OfferComparison,
  offers: LeadOffer[],
  current: CurrentContract | null,
): LeadOrientation {
  const reference = comparison.reference === "current_contract",
    offset = reference ? 1 : 0,
    base = reference ? comparison.columns[0]! : null;
  const items: Item[] = comparison.columns.slice(offset).map((column, index) => {
    const at = index + offset;
    const rows = (test: (row: Row) => boolean) => comparison.rows.filter(test).map(ref);
    const change = (row: Row) => row.cells[at]?.change ?? null;
    const improves = rows((row) => ["added", "better"].includes(change(row) ?? ""));
    const loses = rows((row) => ["removed", "worse"].includes(change(row) ?? ""));
    const notes = rows((row) => ["exclusions_changed", "changed"].includes(change(row) ?? ""));
    const unverified = (row: Row) =>
      change(row) === "to_verify" || row.cells[at]?.verification === "to_verify";
    const toVerify = rows(unverified);
    // An absence is information to obtain, never an exclusion.
    const missing = rows(
      (row) =>
        !unverified(row) &&
        (change(row) === "missing" ||
          (!row.cells[at] && (reference ? !!row.cells[0] : true)) ||
          row.cells[at]?.verification === "missing"),
    );
    const premiumVerified =
      column.premiumStatus === "verified" && (!base || base.premiumStatus === "verified");
    const difference = column.annualDifferenceMinor;
    let status: Item["status"];
    if (!premiumVerified || toVerify.length) status = "incomplete";
    else if (!reference) status = "comparable";
    else if (difference === null) status = "incomplete";
    else if (difference <= 0 && !loses.length && (difference < 0 || improves.length > 0))
      status = "advantage";
    else if (difference >= 0 && !improves.length) status = "keep_current";
    else status = "tradeoff";
    return {
      offerId: column.offerId!,
      offerVersion: column.offerVersion!,
      status,
      annualDifferenceMinor: difference,
      improves,
      loses,
      notes,
      toVerify,
      missing,
      premiumVerified,
      availability: {
        present: true,
        admission: "not_established",
        distribution: "not_established",
      },
    };
  });
  const complete = items.filter((item) => item.status !== "incomplete");
  const advantages = items
    .filter((item) => item.status === "advantage")
    .sort(
      (a, b) =>
        (a.annualDifferenceMinor ?? 0) - (b.annualDifferenceMinor ?? 0) ||
        b.improves.length - a.improves.length,
    );
  let kind: LeadOrientation["kind"],
    suggestion: LeadOrientation["suggestion"] = null;
  // Every compared offer must be complete before anything is said about them together.
  if (!reference)
    kind = items.length && complete.length === items.length ? "offers_only" : "insufficient";
  else if (advantages.length) {
    kind = "offer_advantage";
    suggestion = {
      kind: "offer",
      offerId: advantages[0]!.offerId,
      offerVersion: advantages[0]!.offerVersion,
    };
  } else if (!items.length || complete.length < items.length) kind = "insufficient";
  else if (complete.every((item) => item.status === "keep_current")) {
    kind = "keep_current";
    suggestion = { kind: "keep_current" };
  } else kind = "tradeoff";
  const factor = base?.annualFactor ?? null;
  return leadOrientationSchema.parse({
    version: orientationVersion,
    kind,
    reference: comparison.reference,
    suggestion,
    offers: items,
    transparency: {
      asOf:
        [
          ...comparison.columns
            .slice(offset)
            .map((column) => offers.find((offer) => offer.id === column.offerId)?.reviewedAt),
          reference ? current?.confirmedAt : null,
        ]
          .filter((value): value is string => !!value)
          .sort()
          .at(-1) ?? null,
      currentReviewVersion: reference ? (current?.reviewVersion ?? null) : null,
      annualFactor: factor,
      offers: comparison.columns.slice(offset).map((column) => ({
        offerId: column.offerId,
        offerVersion: column.offerVersion,
        company: column.company,
        reviewedAt: offers.find((offer) => offer.id === column.offerId)?.reviewedAt ?? null,
      })),
      companies: new Set(comparison.columns.slice(offset).map((column) => column.company)).size,
      assumptions: [
        "chf_only",
        "verified_sources_only",
        "structured_amounts_only",
        ...(factor !== null && factor > 1 ? (["annualized_current_premium"] as const) : []),
      ],
    },
  });
}
