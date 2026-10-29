import { useEffect, useState } from "react";
import type {
  createHealthClient,
  HealthCurrentSelection,
  HealthPremiumDifference,
} from "@coverview/api-client/health-insurance";

type Item = { id: string; birthYear: number; offer: { id: string } };
type Savings = Pick<
  HealthPremiumDifference,
  "direction" | "annualSavingMinor" | "monthlySavingMinor" | "baselineYear"
>;

// Each cart person's savings against the current model given for them in the comparator (user
// request, 29 October 2026), measured by the API as in the list, then their sum for the cart.
export function useCartSavings(
  api: ReturnType<typeof createHealthClient>,
  items: Item[],
  currents: Record<string, HealthCurrentSelection>,
) {
  const key = JSON.stringify(
    items.flatMap((item) => {
      const current = currents[item.id];
      // A person born after 2026 has no 2026 contract to compare with.
      return current && item.birthYear <= 2026
        ? [
            {
              id: item.id,
              input: { birthYear: item.birthYear, current, offerIds: [item.offer.id] },
            },
          ]
        : [];
    }),
  );
  const [response, setResponse] = useState<{
    key: string;
    value: Map<string, HealthPremiumDifference>;
  } | null>(null);
  useEffect(() => {
    const requests = JSON.parse(key) as {
      id: string;
      input: { birthYear: number; current: HealthCurrentSelection; offerIds: string[] };
    }[];
    if (!requests.length) return;
    const abort = new AbortController();
    void Promise.all(
      requests.map(({ id, input }) =>
        api
          .currentCompare(input, abort.signal)
          .then((value) => [id, value.differences[0]] as const)
          // Without an answer, that person's cart line simply shows no savings.
          .catch(() => [id, undefined] as const),
      ),
    ).then((entries) => {
      if (abort.signal.aborted) return;
      const value = new Map<string, HealthPremiumDifference>();
      for (const [id, difference] of entries) if (difference) value.set(id, difference);
      setResponse({ key, value });
    });
    return () => abort.abort();
  }, [api, key]);
  const byPerson =
    response?.key === key ? response.value : new Map<string, HealthPremiumDifference>();
  const known = [...byPerson.values()];
  const annual = known.reduce((sum, item) => sum + item.annualSavingMinor, 0);
  const total: Savings | undefined = known.length
    ? {
        direction: annual > 0 ? "saving" : annual < 0 ? "increase" : "equal",
        annualSavingMinor: annual,
        monthlySavingMinor: known.reduce((sum, item) => sum + item.monthlySavingMinor, 0),
        baselineYear: known.every((item) => item.baselineYear === 2027) ? 2027 : 2026,
      }
    : undefined;
  return { byPerson, total, known: known.length };
}
