import { HealthGradient } from "./HealthGradient";
import { useEffect, useMemo, useState } from "react";
import { createApiClient } from "@coverview/api-client";
import { openConsentSettings } from "@coverview/ui/analytics";
import {
  createHealthClient,
  type HealthStatus,
  type HealthComparison,
  type HealthCompareInput,
  type HealthLocality,
  type HealthOffer,
  type HealthCurrentSelection,
} from "@coverview/api-client/health-insurance";
import { healthCopy as copy } from "../../content/fr/health-insurance";
import { HealthIcon } from "./HealthIcon";
import { SiteHeader } from "../site/SiteHeader";
import { HealthDialog } from "./HealthDialog";
import { LocalitySearch } from "./LocalitySearch";
import { SwissPremiumMap } from "./SwissPremiumMap";
import { HealthModelPanel } from "./HealthModelPanel";
import { AdaptiveHealthGuide, type HealthGuideSnapshot } from "./AdaptiveHealthGuide";
import { HealthContactTags, HealthInsurerLogo } from "./HealthOfferIdentity";
import { RecommendationResults } from "./RecommendationResults";
import { HealthSelect } from "./HealthSelect";
import { HealthLocate } from "./HealthLocate";
import { HealthCheckout, type CheckoutCandidate } from "./HealthCheckout";
import { integer, interpolate, money, regionName } from "./health-format";
import { HealthCurrentInsurance } from "./HealthCurrentInsurance";
import { HealthPremiumDifference } from "./HealthPremiumDifference";
import { useCurrentInsurance } from "./use-current-insurance";
import { healthCurrentCopy } from "../../content/fr/health-current";

type Category = NonNullable<HealthCompareInput["categories"]>[number];
export default function HealthComparator({
  apiUrl,
  walletUrl,
  requestsEnabled = true,
}: {
  apiUrl: string;
  walletUrl: string | undefined;
  // Without accounts and email in the environment, comparing stays available but nothing
  // invites a sign-in or an offer request that could not be completed.
  requestsEnabled?: boolean;
}) {
  const api = useMemo(() => createHealthClient(apiUrl), [apiUrl]);
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [birth, setBirth] = useState("");
  const [sex, setSex] = useState<"female" | "male" | "other" | "declined" | null>(null);
  const [profileOpen, setProfileOpen] = useState(true);
  const [optimize, setOptimize] = useState(false);
  const [regionKnown, setRegionKnown] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(max-width:760px)").matches) setProfileOpen(false);
  }, []);
  const [accident, setAccident] = useState(true);
  const [deductible, setDeductible] = useState(2500);
  const [region, setRegion] = useState("VD-1");
  const [locality, setLocality] = useState<HealthLocality | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [insurerIds, setInsurerIds] = useState<number[]>([]);
  const [benefitKeys, setBenefitKeys] = useState<string[]>([]);
  const [offset, setOffset] = useState(0);
  const [comparison, setComparison] = useState<HealthComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState<HealthOffer | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [showList, setShowList] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [candidate, setCandidate] = useState<CheckoutCandidate | null>(null);
  const [cartCount, setCartCount] = useState(0);
  useEffect(() => {
    const address = new URL(window.location.href);
    if (address.searchParams.get("panier") !== "1") return;
    address.searchParams.delete("panier");
    window.history.replaceState(window.history.state, "", address);
    if (requestsEnabled) setCheckout(true);
  }, [requestsEnabled]);
  const [currentInsurance, setCurrentInsurance] = useState<HealthCurrentSelection | null>(null);
  const [profileRevision, setProfileRevision] = useState(0);
  const [recommendation, setRecommendation] = useState<HealthGuideSnapshot>({
    result: null,
    busy: false,
  });
  const birthKnown =
    /^\d{4}-\d{2}-\d{2}$/.test(birth) &&
    Number(birth.slice(0, 4)) >= 1900 &&
    birth <= new Date().toISOString().slice(0, 10);
  const child = birthKnown && 2027 - Number(birth.slice(0, 4)) <= 18;
  const foreign = region.startsWith("EU-");
  const franchises = foreign
    ? [child ? 0 : 300]
    : child
      ? [0, 100, 200, 300, 400, 500, 600]
      : [300, 500, 1000, 1500, 2000, 2500];
  useEffect(() => {
    if (!franchises.includes(deductible)) setDeductible(child ? 0 : foreign ? 300 : 2500);
  }, [child, deductible, foreign]);
  const profile = useMemo<HealthCompareInput>(
    () => ({
      year: 2027,
      birthYear: birthKnown ? Number(birth.slice(0, 4)) : 1990,
      accident,
      deductible,
      regionId: region,
      ...(locality?.municipalityId ? { municipalityId: locality.municipalityId } : {}),
      categories,
      insurerIds,
      benefitKeys,
    }),
    [
      birth,
      birthKnown,
      accident,
      deductible,
      region,
      locality,
      categories,
      insurerIds,
      benefitKeys,
    ],
  );
  useEffect(() => {
    const abort = new AbortController();
    setFailed(false);
    void api
      .status(abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) {
          setStatus(value);
          if (!value.available) {
            setFailed(true);
            setLoading(false);
          }
        }
      })
      .catch(() => {
        if (!abort.signal.aborted) {
          setFailed(true);
          setLoading(false);
        }
      });
    return () => abort.abort();
  }, [api, retry]);
  useEffect(() => {
    setOffset(0);
  }, [profile]);
  useEffect(() => {
    if (!status?.available) return;
    const abort = new AbortController();
    setLoading(true);
    setFailed(false);
    const timer = setTimeout(() => {
      void api
        .compare({ ...profile, offset }, abort.signal)
        .then((value) => {
          if (!abort.signal.aborted) setComparison(value);
        })
        .catch(() => {
          if (!abort.signal.aborted) {
            setFailed(true);
            setComparison(null);
          }
        })
        .finally(() => {
          if (!abort.signal.aborted) setLoading(false);
        });
    }, 120);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [api, status, profile, offset, retry]);
  const selectRegion = (id: string) => {
    setRegion(id);
    setRegionKnown(true);
    if (id.startsWith("EU-")) {
      setLocality(
        status?.foreign?.countries.find((country) => country.code === id.slice(3))?.locality ??
          null,
      );
      setDeductible(child ? 0 : 300);
      setCategories([]);
      setBenefitKeys([]);
    } else if (locality?.regionId !== id) setLocality(null);
    setOffset(0);
  };
  const selectLocality = (value: HealthLocality | null) => {
    setLocality(value);
    if (value) {
      setRegion(value.regionId);
      setRegionKnown(true);
      if (value.country && value.country !== "CH") {
        setDeductible(child ? 0 : 300);
        setCategories([]);
        setBenefitKeys([]);
      }
    }
    setOffset(0);
  };
  const toggleCategory = (value: Category) =>
    setCategories((current) =>
      current.includes(value) ? current.filter((x) => x !== value) : [...current, value],
    );
  const toggleBenefit = (value: string) =>
    setBenefitKeys((current) =>
      current.includes(value) ? current.filter((x) => x !== value) : [...current, value],
    );
  const filterCount =
    categories.length + insurerIds.length + benefitKeys.length + Number(optimize && !foreign);
  const addPerson = () => {
    setCheckout(false);
    setCandidate(null);
    setOffer(null);
    setShowList(false);
    setShowFilters(false);
    setBirth("");
    setSex(null);
    setAccident(true);
    setDeductible(2500);
    setCurrentInsurance(null);
    setOptimize(false);
    setCategories([]);
    setInsurerIds([]);
    setBenefitKeys([]);
    setLocality(null);
    setRegion("VD-1");
    setRegionKnown(false);
    setOffset(0);
    setComparison(null);
    setLoading(true);
    setRecommendation({ result: null, busy: false });
    setProfileRevision((value) => value + 1);
    setProfileOpen(true);
  };
  const currentComparison = useCurrentInsurance(
    api,
    birthKnown ? currentInsurance : null,
    profile.birthYear,
    [
      ...(!loading ? (comparison?.offers.map((item) => item.id) ?? []) : []),
      ...(!loading
        ? (comparison?.regions.flatMap((item) => item.offers.map((offer) => offer.id)) ?? [])
        : []),
      ...(!recommendation.busy
        ? (recommendation.result?.ranked.map((row) => row.offer.id) ?? [])
        : []),
      ...(offer ? [offer.id] : []),
    ],
  );
  const differences = new Map(
    currentComparison.value?.differences.map((item) => [item.offerId, item]),
  );
  return (
    <div className="health-comparator">
      <SiteHeader
        pathname="/comparateur-assurance-maladie-2027"
        requestsEnabled={requestsEnabled}
        loginUrl={createApiClient({ baseUrl: apiUrl }).loginUrl("wallet")}
        accountUrl={walletUrl ? `${walletUrl}/profile` : "/account"}
        cart={{
          count: cartCount,
          onOpen: () => {
            setCandidate(null);
            setCheckout(true);
          },
        }}
      />
      <section className="hi-intro">
        <div>
          <p className="hi-eyebrow">{copy.eyebrow}</p>
          <h1>
            {copy.heading} <span>{copy.headingSoft}</span>
          </h1>
          <p className="hi-lead">{copy.intro}</p>
        </div>
        <div className="hi-intro-stamp">
          <HealthIcon name="shield" size={22} />
          <span>
            {copy.sourceBadge}
            <small>{copy.gross}</small>
          </span>
        </div>
      </section>
      <div className="hi-workspace" key={profileRevision}>
        <aside className={`hi-profile ${profileOpen ? "" : "is-collapsed"}`}>
          <div className="hi-profile-title">
            <div>
              <h2>{copy.profile}</h2>
            </div>
            <button
              className="hi-icon-button hi-profile-toggle"
              aria-label={profileOpen ? copy.profileCollapse : copy.profileExpand}
              aria-expanded={profileOpen}
              aria-controls="hi-profile-fields"
              onClick={() => setProfileOpen(!profileOpen)}
            >
              <HealthIcon name={profileOpen ? "minus" : "plus"} size={18} />
            </button>
          </div>
          <div id="hi-profile-fields" hidden={!profileOpen}>
            <label className="hi-field">
              {copy.birthDate}
              <input
                type="date"
                min="1900-01-01"
                max={new Date().toISOString().slice(0, 10)}
                value={birth}
                onChange={(event) => setBirth(event.target.value)}
                onInput={(event) => setBirth(event.currentTarget.value)}
                onBlur={(event) => setBirth(event.currentTarget.value)}
              />
            </label>
            <div className="hi-field hi-sex-field">
              {copy.sex}
              <HealthSelect
                label={copy.sex}
                value={sex === "male" || sex === "female" ? sex : ""}
                placeholder={copy.sexPlaceholder}
                onChange={(value) =>
                  setSex(value === "unset" ? null : (value as NonNullable<typeof sex>))
                }
                options={Object.entries(copy.sexOptions).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
            </div>
            <fieldset className="hi-fieldset">
              <legend>{copy.accident}</legend>
              <div className="hi-segmented">
                <button
                  className="hi-accident-included"
                  aria-pressed={accident}
                  onClick={() => setAccident(true)}
                >
                  {copy.accidentIncluded}
                </button>
                <button aria-pressed={!accident} onClick={() => setAccident(false)}>
                  {copy.accidentExcluded}
                </button>
              </div>
              {!accident && <p className="hi-field-help">{copy.accidentHint}</p>}
            </fieldset>
            <fieldset className="hi-fieldset">
              <legend>
                {copy.deductible}
                <span>{copy.currency}</span>
              </legend>
              <div className="hi-franchises">
                {franchises.map((value) => (
                  <button
                    key={value}
                    aria-pressed={deductible === value}
                    onClick={() => setDeductible(value)}
                  >
                    {integer(value)}
                  </button>
                ))}
              </div>
            </fieldset>
            <HealthCurrentInsurance
              api={api}
              profile={profile}
              birthKnown={birthKnown}
              locality={locality}
              selection={currentInsurance}
              onSelect={setCurrentInsurance}
              comparison={currentComparison}
            />
            <button className="hi-more" onClick={() => setShowFilters(true)}>
              <HealthIcon name="sliders" size={17} />
              {copy.more}
              {filterCount > 0 ? (
                <span className="hi-filter-count">{filterCount}</span>
              ) : (
                <span>+</span>
              )}
            </button>
          </div>
        </aside>
        <div className="hi-explorer">
          <div className="hi-map-toolbar">
            <LocalitySearch api={api} selected={locality} onSelect={selectLocality} />
            <HealthLocate api={api} onSelect={selectLocality} />
            <div className="hi-region-select">
              <HealthSelect
                label={copy.chooseRegion}
                value={region}
                onChange={selectRegion}
                options={[
                  ...(status?.regions ?? [{ id: "VD-1" }]),
                  ...(status?.foreign?.countries ?? []).map((country) => ({
                    id: `EU-${country.code}`,
                  })),
                ].map((item) => ({
                  value: item.id,
                  label: regionName(item.id),
                }))}
              />
            </div>
          </div>
          <p className="hi-location-hint">
            {foreign
              ? copy.foreignHint
              : locality
                ? `${locality.municipality} · ${regionName(locality.regionId)}`
                : copy.searchHint}
          </p>
          {failed && (
            <div className="hi-network-error" role="alert">
              <span>{copy.unavailable}</span>
              <button onClick={() => setRetry((x) => x + 1)}>{copy.retry}</button>
            </div>
          )}
          <SwissPremiumMap
            differences={differences}
            comparison={comparison}
            selected={region}
            localityId={locality?.id}
            onRegion={selectRegion}
            onOffer={setOffer}
            onList={() => setShowList(true)}
            loading={loading}
          />
        </div>
      </div>
      <footer className="hi-footer">
        <span>© CoverView</span>
        <p>{copy.gross}</p>
        <button onClick={() => setShowSources(true)}>{copy.sources} ↗</button>
        {import.meta.env.PUBLIC_POSTHOG_KEY && (
          <button type="button" onClick={openConsentSettings}>
            {copy.cookies}
          </button>
        )}
      </footer>
      <HealthDialog open={showFilters} onClose={() => setShowFilters(false)} title={copy.filters}>
        {foreign && <p className="hi-small">{copy.foreignNoFilters}</p>}
        {!foreign && (
          <label className="hi-check">
            <input
              type="checkbox"
              checked={optimize}
              onChange={(event) => setOptimize(event.target.checked)}
            />
            <span>
              {copy.optimize}
              <small className="hi-field-help">{copy.optimizeHint}</small>
            </span>
          </label>
        )}
        <fieldset className="hi-filter-group" disabled={foreign} hidden={foreign}>
          <legend>{copy.categories}</legend>
          {(Object.keys(copy.categoryLabels) as Category[]).map((value) => (
            <label className="hi-check" key={value}>
              <input
                type="checkbox"
                checked={categories.includes(value)}
                onChange={() => toggleCategory(value)}
              />
              <span>
                <strong>{copy.categoryLabels[value]}</strong>
                <small>{copy.categoryDescriptions[value]}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="hi-field">
          {copy.insurers}
          <HealthSelect
            label={copy.insurers}
            value={String(insurerIds[0] ?? "all")}
            onChange={(value) => setInsurerIds(value === "all" ? [] : [Number(value)])}
            options={[
              { value: "all", label: copy.allInsurers },
              ...(status?.insurers ?? []).map((item) => ({
                value: String(item.id),
                label: item.brand ?? item.name,
              })),
            ]}
          />
        </div>
        {status?.benefitTypes?.length ? (
          <fieldset className="hi-filter-group" disabled={foreign} hidden={foreign}>
            <legend>{copy.benefitTypesFilter}</legend>
            <p className="hi-small">{copy.benefitTypesFilterHint}</p>
            {(Object.keys(copy.benefitFamilies) as (keyof typeof copy.benefitFamilies)[]).map(
              (family) => {
                const items = status.benefitTypes!.filter((item) => item.family === family);
                return (
                  items.length > 0 && (
                    <div className="hi-filter-family" key={family}>
                      <p>{copy.benefitFamilies[family]}</p>
                      {items.map((item) => (
                        <label className="hi-check" key={item.key}>
                          <input
                            type="checkbox"
                            checked={benefitKeys.includes(item.key)}
                            disabled={!benefitKeys.includes(item.key) && benefitKeys.length >= 12}
                            onChange={() => toggleBenefit(item.key)}
                          />
                          <span>
                            <strong>{item.label}</strong>
                            <small>{copy.benefitTypeModels(item.models)}</small>
                          </span>
                        </label>
                      ))}
                    </div>
                  )
                );
              },
            )}
          </fieldset>
        ) : (
          <fieldset className="hi-filter-group" disabled={foreign} hidden={foreign}>
            <legend>{copy.benefitsFilter}</legend>
            <p className="hi-small">{copy.benefitFilterHint}</p>
            {copy.filtersList.map((item) => (
              <label className="hi-check" key={item.key}>
                <input
                  type="checkbox"
                  checked={benefitKeys.includes(item.key)}
                  onChange={() => toggleBenefit(item.key)}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </fieldset>
        )}
        <button className="hi-primary hi-full" onClick={() => setShowFilters(false)}>
          <HealthGradient />
          {copy.apply}
          <HealthIcon name="arrow" size={16} />
        </button>
      </HealthDialog>
      <HealthDialog
        open={showSources}
        onClose={() => setShowSources(false)}
        title={copy.sourcesTitle}
      >
        <p className="hi-detail-intro">{copy.sourceIntro}</p>
        {status?.available && (
          <div className="hi-data-counts">
            <div>
              <strong>{new Intl.NumberFormat("fr-CH").format(status.premiumCount)}</strong>
              <span>{copy.premiumCountLabel}</span>
            </div>
            <div>
              <strong>{status.modelCount}</strong>
              <span>{copy.modelCountLabel}</span>
            </div>
            <div>
              <strong>{status.insurerCount}</strong>
              <span>{copy.insurerCountLabel}</span>
            </div>
          </div>
        )}
        <p className="hi-small">{copy.sourcePrice}</p>
        <p className="hi-small">{copy.sourceBenefits}</p>
        <p className="hi-small">{copy.sourceMap}</p>
        <a
          className="hi-text-link"
          href="https://www.priminfo.admin.ch/fr/downloads/aktuell"
          target="_blank"
          rel="noreferrer"
        >
          Priminfo / OFSP ↗
        </a>
        <a
          className="hi-text-link"
          href="https://opendata.swiss/fr/dataset/health-insurance-premiums"
          target="_blank"
          rel="noreferrer"
        >
          opendata.swiss ↗
        </a>
        <a
          className="hi-text-link"
          href="https://www.swisstopo.admin.ch/fr/modele-du-territoire-swissboundaries3d"
          target="_blank"
          rel="noreferrer"
        >
          swisstopo ↗
        </a>
      </HealthDialog>
      <HealthDialog open={showList} onClose={() => setShowList(false)} title={copy.results} sheet>
        <AdaptiveHealthGuide
          key={profileRevision}
          apiUrl={apiUrl}
          profile={profile}
          tariffKnown={{ birth: birthKnown, locality: Boolean(locality), region: regionKnown }}
          sex={sex}
          scope={optimize ? "optimize_deductible" : "same_deductible"}
          enabled={!foreign}
          onUpdate={setRecommendation}
        />
        {foreign && <p className="hi-small">{copy.foreignGuide}</p>}
        <p className="hi-result-region">{regionName(region)}</p>
        {currentComparison.value?.current && (
          <p className="hi-current-comparison-note">
            {healthCurrentCopy.baseline} · {currentComparison.value.current.insurerBrand} ·{" "}
            {currentComparison.value.current.name} ·{" "}
            {money(currentComparison.value.current.monthlyPremiumMinor)} CHF {copy.perMonth}
          </p>
        )}
        <p className="hi-small" hidden={loading || recommendation.busy}>
          {interpolate(copy.resultsCount, {
            count: recommendation.result?.active
              ? recommendation.result.ranked.length
              : (comparison?.total ?? 0),
          })}
        </p>
        {loading || recommendation.busy ? (
          <p role="status">{copy.loading}</p>
        ) : recommendation.result?.active ? (
          <RecommendationResults
            result={recommendation.result}
            differences={differences}
            onOffer={(item) => {
              setShowList(false);
              setOffer(item);
            }}
          />
        ) : comparison?.offers.length ? (
          <div className="hi-results-list">
            {comparison.offers.map((item) => (
              <button
                className="hi-result-row"
                key={item.id}
                onClick={() => {
                  setShowList(false);
                  setOffer(item);
                }}
              >
                <HealthInsurerLogo offer={item} labelled />
                <span>
                  <strong>{item.name}</strong>
                  <HealthContactTags offer={item} />
                  {item.eligibility === "municipality_required" && <em>{copy.chooseLocality}</em>}
                </span>
                <span className="hi-list-price">
                  <strong>{money(item.monthlyPremiumMinor)}</strong>
                  <small>
                    {copy.currency} {copy.perMonth}
                  </small>
                </span>
                <HealthIcon name="chevron" size={16} />
                <HealthPremiumDifference value={differences.get(item.id)} />
              </button>
            ))}
          </div>
        ) : (
          <p>{failed ? copy.unavailable : copy.empty}</p>
        )}
        {!recommendation.result?.active && !recommendation.busy && (
          <div className="hi-pagination">
            <button
              disabled={loading || offset === 0}
              onClick={() => setOffset(Math.max(0, offset - 15))}
            >
              {copy.previous}
            </button>
            <span>{interpolate(copy.page, { page: Math.floor(offset / 15) + 1 })}</span>
            <button
              disabled={loading || comparison?.nextOffset == null}
              onClick={() => setOffset(comparison?.nextOffset ?? 0)}
            >
              {copy.next}
            </button>
          </div>
        )}
      </HealthDialog>
      {offer && (
        <HealthModelPanel
          key={offer.modelId}
          api={api}
          profile={profile}
          locality={locality}
          status={status}
          onConfigured={(value) => {
            selectRegion(value.regionId);
            setDeductible(value.deductible);
            setAccident(value.accident);
            setOffer(value);
          }}
          apiUrl={apiUrl}
          difference={offer ? differences.get(offer.id) : undefined}
          year={profile.year ?? 2027}
          onBack={() => {
            if (offer && offer.regionId !== region) selectRegion(offer.regionId);
            setOffer(null);
            setShowList(true);
          }}
          cheapest={
            !loading &&
            !!offer &&
            (recommendation.result?.active && offer.regionId === region
              ? recommendation.result.leaders.premium.includes(offer.id)
              : comparison?.regions.find((r) => r.regionId === offer.regionId)?.offers[0]
                  ?.monthlyPremiumMinor === offer.monthlyPremiumMinor)
          }
          preferred={
            !!offer &&
            !!recommendation.result?.questionStates.some(
              (q) => q.id === "priority" && q.responseStatus === "answered",
            ) &&
            !!recommendation.result.leaders.preferred.includes(offer.id)
          }
          provisional={recommendation.result?.outcome !== "established"}
          offer={offer}
          onClose={() => setOffer(null)}
          onRequest={
            requestsEnabled
              ? (item) => {
                  setOffer(null);
                  setCandidate({
                    key: crypto.randomUUID(),
                    offer: item,
                    profile: {
                      ...profile,
                      deductible: item.deductible,
                      accident: item.accident,
                      regionId: item.regionId,
                      municipalityId:
                        locality?.regionId === item.regionId
                          ? (locality.municipalityId ?? undefined)
                          : undefined,
                    },
                    locality:
                      locality?.regionId === item.regionId
                        ? locality
                        : (status?.foreign?.countries.find(
                            (country) => country.code === item.residenceCountry,
                          )?.locality ?? null),
                    birth,
                    ...(sex && sex !== "declined" ? { sex } : {}),
                  });
                  setCheckout(true);
                }
              : undefined
          }
        />
      )}
      {requestsEnabled && (
        <HealthCheckout
          apiUrl={apiUrl}
          healthApi={api}
          status={status}
          candidate={candidate}
          open={checkout}
          onClose={() => setCheckout(false)}
          onAddPerson={addPerson}
          onCount={setCartCount}
        />
      )}
      <noscript>
        <p className="hi-note">{copy.noScript}</p>
      </noscript>
    </div>
  );
}
