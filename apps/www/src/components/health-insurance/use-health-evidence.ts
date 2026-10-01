import { useEffect, useMemo, useState } from "react";
import {
  createRecommendationClient,
  type EvidenceCatalog,
} from "@coverview/api-client/health-recommendation";

export function useHealthEvidence(apiUrl: string, year: number, enabled: boolean) {
  const api = useMemo(() => createRecommendationClient(apiUrl), [apiUrl]);
  const [catalog, setCatalog] = useState<EvidenceCatalog | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController();
    setError(false);
    setCatalog(null);
    void api
      .catalog(year, abort.signal)
      .then((value) => {
        if (abort.signal.aborted) return;
        setCatalog(value);
        setError(value === null);
      })
      .catch(() => {
        if (!abort.signal.aborted) setError(true);
      });
    return () => abort.abort();
  }, [api, year, enabled]);
  return { catalog: catalog?.year === year ? catalog : null, error };
}

export function modelBenefits(
  catalog: EvidenceCatalog | null,
  modelId: string,
  view: "all" | "benefits" | "club",
) {
  const model = catalog?.models.find((item) => item.id === modelId);
  return (
    catalog?.benefits.filter(
      (fact) =>
        (fact.modelIds.includes(modelId) ||
          (!fact.modelIds.length && fact.insurerId === model?.insurerId)) &&
        (view === "all" ||
          (view === "club") ===
            (fact.category === "members" ||
              fact.classification === "commercial" ||
              fact.classification === "supplementary")),
    ) ?? []
  );
}
