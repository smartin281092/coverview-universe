import { useEffect, useState } from "react";
import type {
  createHealthClient,
  HealthCompareInput,
  HealthLocality,
  HealthOffer,
} from "@coverview/api-client/health-insurance";

// The model suggested on the page of a model whose request CoverView cannot handle yet (user
// request, 25 October 2026): the API's recommended model of that model's list, for the same
// person, deductible and accident, without the list's filters.
export function usePartnerSuggestion(
  api: ReturnType<typeof createHealthClient>,
  offer: HealthOffer | null,
  profile: HealthCompareInput,
  locality: HealthLocality | null,
) {
  const municipalityId =
    offer && locality?.regionId === offer.regionId ? locality.municipalityId : null;
  const key =
    offer && !offer.partner
      ? JSON.stringify({
          year: profile.year,
          birthYear: profile.birthYear,
          accident: offer.accident,
          deductible: offer.deductible,
          regionId: offer.regionId,
          ...(municipalityId ? { municipalityId } : {}),
          categories: [],
          insurerIds: [],
          benefitKeys: [],
          offset: 0,
        } satisfies HealthCompareInput)
      : null;
  const [response, setResponse] = useState<{ key: string; value: HealthOffer | null } | null>(null);
  useEffect(() => {
    if (!key) return;
    const abort = new AbortController();
    void api
      .compare(JSON.parse(key) as HealthCompareInput, abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) setResponse({ key, value: value.recommendedOffer ?? null });
      })
      .catch(() => {
        // Without an answer, the page simply shows no suggestion.
        if (!abort.signal.aborted) setResponse({ key, value: null });
      });
    return () => abort.abort();
  }, [api, key]);
  return key && response?.key === key ? response.value : null;
}
