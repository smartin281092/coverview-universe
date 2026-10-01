import { HealthGradient } from "./HealthGradient";
import { useEffect, useState } from "react";
import type { HealthOffer } from "@coverview/api-client/health-insurance";
import { healthCopy as copy } from "../../content/fr/health-insurance";
import { offerCopy } from "../../content/fr/insurance-requests";
import { recommendationCopy } from "../../content/fr/health-recommendation";
import { HealthEvidence } from "./HealthEvidence";
import { HealthDialog } from "./HealthDialog";
import { HealthIcon } from "./HealthIcon";
import { HealthContactTags, HealthInsurerLogo, HealthOfferBadges } from "./HealthOfferIdentity";
import { francs, interpolate, money, regionName } from "./health-format";
export function HealthModelPanel({
  offer,
  onClose,
  onRequest,
  apiUrl,
  year,
  onBack,
  cheapest,
  preferred,
  provisional,
}: {
  offer: HealthOffer | null;
  onClose: () => void;
  onRequest: (offer: HealthOffer) => void;
  apiUrl: string;
  year: number;
  onBack: () => void;
  cheapest: boolean;
  preferred: boolean;
  provisional: boolean;
}) {
  const [tab, setTab] = useState<"coverage" | "benefits" | "club">("coverage");
  useEffect(() => setTab("coverage"), [offer?.id]);
  return (
    <HealthDialog
      open={!!offer}
      onClose={onClose}
      title={offer?.name ?? copy.modelDetails}
      sheet
      header={
        <button className="hi-back-to-list" onClick={onBack}>
          <HealthIcon name="back" size={18} />
          {copy.backToList}
        </button>
      }
    >
      {offer && (
        <>
          <div className="hi-model-brand">
            <HealthInsurerLogo offer={offer} />
            <div>
              <p>{offer.insurerBrand ?? offer.insurerName}</p>
              <div className="hi-model-title">
                <h3>{offer.name}</h3>
                <HealthContactTags offer={offer} />
              </div>
            </div>
          </div>
          <HealthOfferBadges cheapest={cheapest} preferred={preferred} provisional={provisional} />
          {preferred && provisional && <p className="hi-small">* {copy.provisionalBadge}</p>}
          <div className="hi-model-price">
            <p>
              {money(offer.monthlyPremiumMinor)}
              <span className="hi-price-unit">
                <small>{copy.currency}</small>
                <em>{copy.perMonth}</em>
              </span>
            </p>
            {offer.redistribution?.year === year && (
              <div className="hi-redistribution">
                <span>
                  − {money(offer.redistribution.monthlyMinor)} CHF {copy.perMonth} ·{" "}
                  {copy.redistributionLabel}
                </span>
                <span className="hi-info-tooltip">
                  <button
                    type="button"
                    aria-label={copy.redistributionHelp}
                    aria-describedby="health-redistribution-tooltip"
                  >
                    <HealthIcon name="info" size={16} />
                  </button>
                  <span role="tooltip" id="health-redistribution-tooltip">
                    {interpolate(copy.redistributionExplanation, {
                      year,
                      annual: money(offer.redistribution.annualMinor),
                      monthly: money(offer.redistribution.monthlyMinor),
                    })}
                    <a href={offer.redistribution.sourceUrl} target="_blank" rel="noreferrer">
                      {copy.redistributionSource} ↗
                    </a>
                  </span>
                </span>
              </div>
            )}
          </div>
          <button className="hi-primary hi-full hi-request-cta" onClick={() => onRequest(offer)}>
            <HealthGradient />
            {offerCopy.request}
            <HealthIcon name="arrow" size={16} />
          </button>
          {offer.residenceCountry && <p className="hi-small">{copy.foreignConditions}</p>}
          {!offer.residenceCountry && (
            <div className="hi-tabs" role="tablist">
              {(["coverage", "benefits", "club"] as const).map((value) => (
                <button
                  key={value}
                  className={`hi-tab-${value}`}
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
                  <HealthIcon
                    name={value === "coverage" ? "info" : value === "benefits" ? "shield" : "gift"}
                    size={18}
                  />
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
                    <dd className={offer.accident ? "hi-included" : undefined}>
                      {offer.accident ? copy.accidentIncluded : copy.accidentExcluded}
                    </dd>
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
                    <dd className={offer.accident ? "hi-included" : undefined}>
                      {offer.accident ? copy.accidentIncluded : copy.accidentExcluded}
                    </dd>
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
