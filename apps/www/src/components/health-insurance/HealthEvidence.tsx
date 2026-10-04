import type { EvidenceCatalog } from "@coverview/api-client/health-recommendation";
import { recommendationCopy as copy } from "../../content/fr/health-recommendation";
import { HealthIcon } from "./HealthIcon";
import { modelBenefits } from "./use-health-evidence";
import { HealthClubBenefits } from "./HealthClubBenefits";
export function HealthEvidence({
  catalog,
  error,
  modelId,
  year,
  view = "all",
}: {
  catalog: EvidenceCatalog | null;
  error: boolean;
  modelId: string;
  year: number;
  view?: "all" | "benefits" | "club";
}) {
  const model = catalog?.models.find((item) => item.id === modelId);
  const benefits = modelBenefits(catalog, modelId, view);
  if (view === "club") {
    if (error) return <p role="alert">{copy.failed}</p>;
    if (!catalog) return <p role="status">{copy.loading}</p>;
    if (!benefits.length) return <p className="hi-small">{copy.evidence.empty}</p>;
    return <HealthClubBenefits key={modelId} benefits={benefits} catalog={catalog} year={year} />;
  }
  if (view === "benefits") {
    if (error) return <p role="alert">{copy.failed}</p>;
    if (!catalog) return <p role="status">{copy.loading}</p>;
    if (!benefits.length) return <p className="hi-small">{copy.evidence.empty}</p>;
    return (
      <ul className="hi-benefits-list">
        {benefits.map((fact) => {
          return (
            <li key={fact.id}>
              <span className="hi-benefit-check">
                <HealthIcon name="check-circle" size={19} />
              </span>
              <details>
                <summary>
                  <span>{fact.title}</span>
                </summary>
                <p>{fact.effect}</p>
                {fact.telemedicine !== "not_applicable" && (
                  <p>{copy.evidence.telemedicine[fact.telemedicine]}</p>
                )}
                <p>
                  {fact.conditions} {fact.activation}
                </p>
                {fact.exclusions && (
                  <p>
                    {copy.evidence.exclusions} : {fact.exclusions}
                  </p>
                )}
              </details>
            </li>
          );
        })}
      </ul>
    );
  }
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
          {model && (
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
              {fact.yearConfirmed && fact.verification === "verified" && (
                <span className="hi-source-status is-confirmed">{copy.evidence.confirmed}</span>
              )}
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
