import type { WalletOffers } from "@coverview/contracts/partner-wallet-offers";

export type OfferGroupItem = WalletOffers["items"][number];

/** Requests about the same object (same category and object, case aside) share one block. */
export function offerGroups(items: OfferGroupItem[]) {
  const groups = new Map<string, OfferGroupItem[]>();
  for (const item of items) {
    const object = item.lead.object.trim().toLowerCase();
    const key = object ? `${item.lead.category}:${object}` : item.lead.id;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.values()];
}
