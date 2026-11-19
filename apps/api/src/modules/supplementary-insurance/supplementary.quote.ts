import type {
  SupplementaryPrice,
  SupplementarySex,
} from "@coverview/contracts/supplementary-insurance";

export type PremiumRecord = {
  productKey: string;
  variant: string;
  option: string;
  birthYear: number;
  postalCode: string;
  sex: SupplementarySex;
  accident: boolean | null;
  monthlyMinor: number;
  note: string | null;
};

// Prices of one person (19 November 2026). Without a sex, each price is the range between the
// female and male premiums; with a sex, min = max. When a product, variant and option has rows with
// and without accident cover, only the standard profile (accident included) is kept; products
// without that option keep accident = null.
export function quotePrices(
  rows: PremiumRecord[],
  birthYear: number,
  sex: SupplementarySex | null,
): SupplementaryPrice[] {
  const groups = new Map<string, PremiumRecord[]>();
  for (const row of rows) {
    if (row.birthYear !== birthYear || (sex && row.sex !== sex)) continue;
    const key = JSON.stringify([row.productKey, row.variant, row.option]);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  const prices: SupplementaryPrice[] = [];
  for (const group of groups.values()) {
    const accident = group.some((row) => row.accident === true)
      ? true
      : group.some((row) => row.accident === false)
        ? false
        : null;
    const kept = group
      .filter((row) => row.accident === accident)
      .sort((a, b) => a.sex.localeCompare(b.sex) || a.monthlyMinor - b.monthlyMinor);
    const first = kept[0]!;
    prices.push({
      productKey: first.productKey,
      variant: first.variant,
      option: first.option,
      accident,
      minMinor: Math.min(...kept.map((row) => row.monthlyMinor)),
      maxMinor: Math.max(...kept.map((row) => row.monthlyMinor)),
      note: kept.find((row) => row.note)?.note ?? null,
    });
  }
  return prices.sort(
    (a, b) =>
      a.productKey.localeCompare(b.productKey) ||
      a.variant.localeCompare(b.variant) ||
      a.option.localeCompare(b.option),
  );
}
