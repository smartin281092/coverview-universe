import { useEffect, useMemo, useState } from "react";
import {
  createRecommendationClient,
  type EvidenceCatalog,
} from "@coverview/api-client/health-recommendation";
import { recommendationCopy as copy } from "../../content/fr/health-recommendation";
export function HealthEvidence({
  apiUrl,
  modelId,
  year,
  view = "all",
}: {
  apiUrl: string;
  modelId: string;
  year: number;
  view?: "all" | "benefits" | "club";
}) {
  const api = useMemo(() => createRecommendationClient(apiUrl), [apiUrl]);
  const [catalog, setCatalog] = useState<EvidenceCatalog | null>(null),
    [error, setError] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    setError(false);
    setCatalog(null);
    void api
      .catalog(year, abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) setCatalog(value);
      })
      .catch(() => {
        if (!abort.signal.aborted) setError(true);
      });
    return () => abort.abort();
  }, [api, year]);
  const model = catalog?.models.find((item) => item.id === modelId);
  const benefits =
    catalog?.benefits.filter(
      (fact) =>
        (fact.modelIds.includes(modelId) ||
          (!fact.modelIds.length && fact.insurerId === model?.insurerId)) &&
        (view === "all" ||
          (view === "club") ===
            (fact.category === "members" ||
              fact.classification === "commercial" ||
              fact.classification === "supplementary")),
    ) ?? [];
  return (
    <section className="hi-evidence">
      <h3 className="hi-subheading">
        {copy.evidence.title} · {year}
      </h3>
      <p className="hi-small">{copy.evidence.partial}</p>
      {error ? (
        <p>{copy.failed}</p>
      ) : !catalog ? (
        <p role="status">{copy.loading}</p>
      ) : (
        <>
          {model && view !== "club" && (
            <article className="hi-benefit">
              <h4>{copy.conditions}</h4>
              <p>{model.access.obligations || model.confirmed}</p>
              <p className="hi-small">{model.missing}</p>
              {model.access.networkUrl && (
                <a
                  className="hi-text-link"
                  href={model.access.networkUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {copy.evidence.source} ↗
                </a>
              )}
            </article>
          )}
          {benefits.map((fact) => (
            <article className="hi-benefit" key={fact.id}>
              <h4>{fact.title}</h4>
              <span className="hi-source-status">{copy.evidence.nature[fact.classification]}</span>
              <span
                className={`hi-source-status ${fact.yearConfirmed && fact.verification === "verified" ? "is-confirmed" : ""}`}
              >
                {fact.yearConfirmed && fact.verification === "verified"
                  ? copy.evidence.confirmed
                  : copy.evidence.pending}
              </span>
              <p>{fact.effect}</p>
              {fact.telemedicine !== "not_applicable" && (
                <p className="hi-small">{copy.evidence.telemedicine[fact.telemedicine]}</p>
              )}
              <p className="hi-small">
                {copy.evidence.conditions} : {fact.conditions} {fact.activation}
              </p>
              <p className="hi-small">
                {copy.evidence.exclusions} : {fact.exclusions}
              </p>
              {fact.sourceIds.map((id) => {
                const source = catalog.sources.find((item) => item.id === id);
                return (
                  source && (
                    <details key={id}>
                      <summary>
                        {source.title}
                        {source.page ? ` · p. ${source.page}` : ""}
                      </summary>
                      <p className="hi-small">{source.passage}</p>
                      <a
                        className="hi-text-link"
                        href={source.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {copy.evidence.source} ↗ · {source.checkedAt}
                      </a>
                    </details>
                  )
                );
              })}
            </article>
          ))}
          {!benefits.length && <p className="hi-small">{copy.evidence.empty}</p>}
        </>
      )}
    </section>
  );
}
