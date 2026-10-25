import { HealthGradient } from "./HealthGradient";
import { useEffect, useState } from "react";
import type {
  createHealthClient,
  HealthCompareInput,
  HealthLocality,
  HealthStatus,
  HealthOffer,
  HealthPremiumDifference as Difference,
} from "@coverview/api-client/health-insurance";
import { HealthPremiumDifference } from "./HealthPremiumDifference";
import { healthCopy as copy } from "../../content/fr/health-insurance";
import { offerCopy } from "../../content/fr/insurance-requests";
import { HealthEvidence } from "./HealthEvidence";
import { modelBenefits, useHealthEvidence } from "./use-health-evidence";
import { HealthProductImage } from "./HealthProductImage";
import { HealthDialog } from "./HealthDialog";
import { HealthIcon } from "./HealthIcon";
import { HealthFirstContacts, HealthInsurerLogo, HealthOfferBadges } from "./HealthOfferIdentity";
import { HealthPartnerBadge } from "./HealthPartnerBadge";
import { HealthPartnerSuggestion } from "./HealthPartnerSuggestion";
import { interpolate, money, regionName } from "./health-format";
import { HealthModelData } from "./HealthModelData";
import { useModelConfiguration } from "./use-model-configuration";
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
  difference,
  api,
  profile,
  locality,
  status,
  onConfigured,
  suggestion,
  suggestionDifference,
  onOpenOffer,
}: {
  offer: HealthOffer;
  onClose: () => void;
  // Absent where offer requests cannot be completed: the panel then only informs.
  onRequest?: ((offer: HealthOffer) => void) | undefined;
  apiUrl: string;
  year: number;
  onBack: () => void;
  cheapest: boolean;
  preferred: boolean;
  provisional: boolean;
  difference?: Difference | undefined;
  api: ReturnType<typeof createHealthClient>;
  profile: HealthCompareInput;
  locality: HealthLocality | null;
  status: HealthStatus | null;
  onConfigured: (offer: HealthOffer) => void;
  // A model CoverView can handle, shown when this one's request cannot be yet (25 October 2026).
  suggestion?: HealthOffer | null;
  suggestionDifference?: Difference | undefined;
  onOpenOffer?: (offer: HealthOffer) => void;
}) {
  const [tab, setTab] = useState<"coverage" | "benefits" | "club">("coverage");
  const evidence = useHealthEvidence(apiUrl, year, !!offer && !offer.residenceCountry);
  useEffect(() => setTab("coverage"), [offer?.id]);
  const configuration = useModelConfiguration(api, offer, profile, locality, onConfigured);
  const regions = offer.residenceCountry
    ? (status?.foreign?.countries ?? []).map((country) => ({
        value: `EU-${country.code}`,
        label: country.name,
      }))
    : (status?.regions ?? []).map((region) => ({ value: region.id, label: regionName(region.id) }));
  if (!regions.some((item) => item.value === offer.regionId))
    regions.push({ value: offer.regionId, label: regionName(offer.regionId) });
  const deductibles = offer.residenceCountry
    ? [offer.ageGroup === "child" ? 0 : 300]
    : offer.ageGroup === "child"
      ? [0, 100, 200, 300, 400, 500, 600]
      : [300, 500, 1000, 1500, 2000, 2500];
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
            <div className="hi-model-brand-head">
              <HealthInsurerLogo offer={offer} labelled />
              {offer.partner && <HealthPartnerBadge />}
            </div>
            <div>
              <div className="hi-model-title">
                <h3>{offer.name}</h3>
              </div>
            </div>
          </div>
          <HealthFirstContacts offer={offer} />
          <HealthOfferBadges preferred={preferred} provisional={provisional} />
          {preferred && provisional && <p className="hi-small">* {copy.provisionalBadge}</p>}
          <HealthProductImage offer={offer} />
          <div className="hi-model-price-area" aria-busy={configuration.busy}>
            <div
              aria-hidden={!configuration.ready}
              inert={!configuration.ready}
              style={configuration.ready ? undefined : { visibility: "hidden" }}
            >
              <div className="hi-model-price">
                <div className="hi-model-price-line">
                  <HealthOfferBadges cheapest={cheapest} />
                  <p>
                    {money(offer.monthlyPremiumMinor)}
                    <span className="hi-price-unit">
                      <small>{copy.currency}</small>
                      <em>{copy.perMonth}</em>
                    </span>
                  </p>
                </div>
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
              <HealthPremiumDifference value={difference} detail />
              {onRequest &&
                (offer.partner ? (
                  <button
                    className="hi-primary hi-full hi-request-cta"
                    onClick={() => onRequest(offer)}
                  >
                    <HealthGradient />
                    {offerCopy.request}
                    <HealthIcon name="arrow" size={16} />
                  </button>
                ) : (
                  // Requests go only to the insurers with a CoverView agreement, the partners
                  // (health.partner.1); the others' models suggest one (25 October 2026).
                  <>
                    <button
                      className="hi-primary hi-full hi-request-cta"
                      disabled
                      aria-describedby="hi-request-unavailable"
                    >
                      {offerCopy.request}
                      <HealthIcon name="arrow" size={16} />
                    </button>
                    <p id="hi-request-unavailable" className="hi-request-unavailable">
                      {interpolate(copy.requestUnavailable, {
                        brand: offer.insurerBrand ?? offer.insurerName,
                      })}
                    </p>
                    {suggestion && onOpenOffer && (
                      <HealthPartnerSuggestion
                        offer={suggestion}
                        difference={suggestionDifference}
                        onOpen={onOpenOffer}
                        onRequest={onRequest}
                      />
                    )}
                  </>
                ))}
            </div>
            {!configuration.ready && (
              <div
                className="hi-model-configuration-status"
                role={configuration.issue ? "alert" : "status"}
              >
                {configuration.issue === "unavailable"
                  ? copy.configurationUnavailable
                  : configuration.issue === "failed"
                    ? copy.configurationFailed
                    : copy.configurationLoading}
                {configuration.issue === "failed" && (
                  <button className="hi-text-link" onClick={() => configuration.change({})}>
                    {copy.retry}
                  </button>
                )}
              </div>
            )}
          </div>
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
                  {value !== "coverage" && evidence.catalog && (
                    <span className="hi-tab-count">
                      {modelBenefits(evidence.catalog, offer.modelId, value).length}
                    </span>
                  )}
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
            {offer.residenceCountry || tab === "coverage" ? (
              <HealthModelData
                configuration={configuration}
                year={year}
                regions={regions}
                deductibles={deductibles}
                foreign={!!offer.residenceCountry}
              />
            ) : (
              <HealthEvidence {...evidence} modelId={offer.modelId} year={year} view={tab} />
            )}
          </div>
        </>
      )}
    </HealthDialog>
  );
}
