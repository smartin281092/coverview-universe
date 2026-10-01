import { HealthGradient } from "./HealthGradient";
import { useEffect, useState } from "react";
import type { HealthOffer } from "@coverview/api-client/health-insurance";
import { healthCopy as copy } from "../../content/fr/health-insurance";
import { offerCopy } from "../../content/fr/insurance-requests";
import { recommendationCopy } from "../../content/fr/health-recommendation";
import { HealthEvidence } from "./HealthEvidence";
import { HealthDialog } from "./HealthDialog";
import { HealthIcon } from "./HealthIcon";
import { francs, money, regionName } from "./health-format";
export function HealthModelPanel({
  offer,
  onClose,
  onRequest,
  apiUrl,
  year,
  onRefine,
}: {
  offer: HealthOffer | null;
  onClose: () => void;
  onRequest: (offer: HealthOffer) => void;
  apiUrl: string;
  year: number;
  onRefine: () => void;
}) {
  const [tab, setTab] = useState<"coverage" | "benefits" | "club">("coverage");
  useEffect(() => setTab("coverage"), [offer?.id]);
  return (
    <HealthDialog open={!!offer} onClose={onClose} title={copy.modelDetails} sheet>
      {offer && (
        <>
          <div className="hi-model-brand">
            <span className="hi-insurer-monogram">
              {(offer.insurerBrand ?? offer.insurerName).slice(0, 1)}
            </span>
            <div>
              <p>{offer.insurerBrand ?? offer.insurerName}</p>
              <h3>{offer.name}</h3>
            </div>
          </div>
          <div className="hi-model-price">
            <span>{copy.monthly}</span>
            <p>
              <small>{copy.currency}</small> {money(offer.monthlyPremiumMinor)}{" "}
              <em>{copy.perMonth}</em>
            </p>
            <small>{copy.gross}</small>
          </div>
          <button className="hi-primary hi-full hi-request-cta" onClick={() => onRequest(offer)}>
            <HealthGradient />
            {offerCopy.request}
            <HealthIcon name="arrow" size={16} />
          </button>
          <p className="hi-small">
            {offer.residenceCountry ? copy.foreignConditions : recommendationCopy.intro}
          </p>
          {!offer.residenceCountry && (
            <button className="hi-secondary hi-full" onClick={onRefine}>
              {recommendationCopy.start}
            </button>
          )}
          {!offer.residenceCountry && (
            <div className="hi-tabs" role="tablist">
              {(["coverage", "benefits", "club"] as const).map((value) => (
                <button
                  key={value}
                  role="tab"
                  id={`health-tab-${value}`}
                  aria-controls={`health-tabpanel-${value}`}
                  aria-selected={value === tab}
                  tabIndex={value === tab ? 0 : -1}
                  onClick={() => setTab(value)}
                  onKeyDown={(event) => {
                    const keys = ["coverage", "benefits", "club"] as const;
                    const direction =
                      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
                    if (!direction) return;
                    event.preventDefault();
                    const next = keys[(keys.indexOf(tab) + direction + keys.length) % keys.length]!;
                    setTab(next);
                    document.getElementById(`health-tab-${next}`)?.focus();
                  }}
                >
                  {value === "coverage"
                    ? copy.priceTab
                    : value === "benefits"
                      ? copy.benefitsTab
                      : copy.clubTab}
                </button>
              ))}
            </div>
          )}
          <div
            role={offer.residenceCountry ? undefined : "tabpanel"}
            id={`health-tabpanel-${tab}`}
            aria-labelledby={offer.residenceCountry ? undefined : `health-tab-${tab}`}
            className="hi-tab-content"
          >
            {offer.residenceCountry ? (
              <>
                <p>{copy.foreignHint}</p>
                <dl className="hi-specs">
                  <div>
                    <dt>{copy.country}</dt>
                    <dd>
                      {new Intl.DisplayNames(["fr-CH"], { type: "region" }).of(
                        offer.residenceCountry,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{copy.deductible}</dt>
                    <dd>{francs(offer.deductible)}</dd>
                  </div>
                  <div>
                    <dt>{copy.accident}</dt>
                    <dd>{offer.accident ? copy.accidentIncluded : copy.accidentExcluded}</dd>
                  </div>
                  <div>
                    <dt>{copy.annual}</dt>
                    <dd>{francs((offer.monthlyPremiumMinor * 12) / 100)}</dd>
                  </div>
                </dl>
                <a
                  className="hi-text-link"
                  href="https://www.priminfo.admin.ch/downloads/gesamtbericht_eu.pdf"
                  target="_blank"
                  rel="noreferrer"
                >
                  {copy.foreignSource} ↗
                </a>
              </>
            ) : tab === "coverage" ? (
              <>
                <p className="hi-detail-intro">{copy.categoryDescriptions[offer.category]}</p>
                <dl className="hi-specs">
                  <div>
                    <dt>{recommendationCopy.year}</dt>
                    <dd>{year}</dd>
                  </div>
                  <div>
                    <dt>{copy.model}</dt>
                    <dd>{copy.categoryLabels[offer.category]}</dd>
                  </div>
                  <div>
                    <dt>{copy.selectedRegion}</dt>
                    <dd>{regionName(offer.regionId)}</dd>
                  </div>
                  <div>
                    <dt>{copy.deductible}</dt>
                    <dd>{francs(offer.deductible)}</dd>
                  </div>
                  <div>
                    <dt>{copy.accident}</dt>
                    <dd>{offer.accident ? copy.accidentIncluded : copy.accidentExcluded}</dd>
                  </div>
                  <div>
                    <dt>{copy.annual}</dt>
                    <dd>{francs((offer.monthlyPremiumMinor * 12) / 100)}</dd>
                  </div>
                </dl>
                <div className="hi-note">
                  <HealthIcon name="pin" />
                  <p>
                    {offer.eligibility === "municipality_required"
                      ? copy.restricted
                      : offer.eligibility === "municipality_confirmed"
                        ? copy.municipalityConfirmed
                        : copy.noRestriction}
                  </p>
                </div>
                <p className="hi-small">{copy.networkNote}</p>
                {offer.ageGroup === "child" && <p className="hi-small">{copy.familyNote}</p>}
                <p className="hi-small">{copy.commonBenefits}</p>
                <a
                  className="hi-text-link"
                  href="https://www.priminfo.admin.ch/fr/praemien"
                  target="_blank"
                  rel="noreferrer"
                >
                  {copy.source} ↗
                </a>
              </>
            ) : (
              <HealthEvidence apiUrl={apiUrl} modelId={offer.modelId} year={year} view={tab} />
            )}
          </div>
        </>
      )}
    </HealthDialog>
  );
}
