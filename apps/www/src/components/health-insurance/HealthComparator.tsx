import { HealthGradient } from "./HealthGradient";
import { useEffect, useMemo, useState } from "react";
import { createApiClient } from "@coverview/api-client";
import {
  createHealthClient,
  type HealthStatus,
  type HealthComparison,
  type HealthCompareInput,
  type HealthLocality,
  type HealthOffer,
} from "@coverview/api-client/health-insurance";
import logo from "../../../../../assets/logo-coverview.svg?url";
import { healthCopy as copy } from "../../content/fr/health-insurance";
import { HealthIcon } from "./HealthIcon";
import { HealthDialog } from "./HealthDialog";
import { LocalitySearch } from "./LocalitySearch";
import { SwissPremiumMap } from "./SwissPremiumMap";
import { HealthModelPanel } from "./HealthModelPanel";
import { AdaptiveHealthGuide } from "./AdaptiveHealthGuide";
import { HealthSelect } from "./HealthSelect";
import { HealthLocate } from "./HealthLocate";
import { HealthCheckout, type CheckoutCandidate } from "./HealthCheckout";
import { offerCopy } from "../../content/fr/insurance-requests";
import { interpolate, money, regionName } from "./health-format";

type Category = NonNullable<HealthCompareInput["categories"]>[number];
export default function HealthComparator({
  apiUrl,
  walletUrl,
}: {
  apiUrl: string;
  walletUrl: string | undefined;
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
  const [refine, setRefine] = useState(0);
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
  const reset = () => {
    setBirth("");
    setSex(null);
    setOptimize(false);
    setRegionKnown(false);
    setAccident(true);
    setDeductible(2500);
    setCategories([]);
    setInsurerIds([]);
    setBenefitKeys([]);
    setLocality(null);
    setRegion("VD-1");
    setOffset(0);
  };
  const filterCount =
    categories.length + insurerIds.length + benefitKeys.length + Number(optimize && !foreign);
  return (
    <div className="health-comparator">
      <header className="hi-header">
        <a href="/" aria-label={copy.back} className="hi-logo">
          <img src={logo} width="118" height="20" alt="CoverView" />
        </a>
        <span className="hi-header-divider" />
        <a href="/comparateur-assurance-maladie-2027" className="hi-header-title">
          {copy.toolName}
        </a>
        <div className="hi-header-right">
          <button
            className="hi-cart-link"
            aria-label={`${offerCopy.cart} (${cartCount})`}
            onClick={() => setCheckout(true)}
          >
            <HealthIcon name="bag" size={19} />
            <span className="hi-cart-label">{offerCopy.cart}</span>{" "}
            <span className="hi-cart-count">{cartCount}</span>
          </button>
          <a className="hi-sign-in" href={createApiClient({ baseUrl: apiUrl }).loginUrl("wallet")}>
            {copy.signIn}
          </a>
          <a
            className="hi-primary hi-create-account"
            href={walletUrl ? `${walletUrl}/profile` : "/account"}
          >
            <HealthGradient />
            {copy.createAccount}
          </a>
        </div>
      </header>
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
      <div className="hi-workspace">
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
            {!birth && <p className="hi-field-help">{copy.defaultAdult}</p>}
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
              <p className="hi-field-help">{copy.sexHint}</p>
            </div>
            <fieldset className="hi-fieldset">
              <legend>{copy.accident}</legend>
              <div className="hi-segmented">
                <button aria-pressed={accident} onClick={() => setAccident(true)}>
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
                    {new Intl.NumberFormat("fr-CH").format(value)}
                  </button>
                ))}
              </div>
            </fieldset>
            <button className="hi-more" onClick={() => setShowFilters(true)}>
              <HealthIcon name="sliders" size={17} />
              {copy.more}
              {filterCount > 0 ? (
                <span className="hi-filter-count">{filterCount}</span>
              ) : (
                <span>+</span>
              )}
            </button>
            <div className="hi-profile-footer">
              <span className="hi-live-dot" />
              <p>{copy.sourceBadge}</p>
              <button onClick={reset}>{copy.reset}</button>
            </div>
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
            comparison={comparison}
            selected={region}
            localityId={locality?.id}
            onRegion={selectRegion}
            onOffer={setOffer}
            onList={() => setShowList(true)}
            loading={loading}
          />
          <div className="hi-guide-container">
            {foreign && (
              <div className="hi-guide hi-foreign-guide">
                <h2>{copy.crossBorder}</h2>
                <p className="hi-small">{copy.foreignGuide}</p>
                <button className="hi-primary" onClick={() => setShowList(true)}>
                  <HealthGradient />
                  {copy.viewAll}
                </button>
              </div>
            )}
            <AdaptiveHealthGuide
              apiUrl={apiUrl}
              profile={profile}
              tariffKnown={{ birth: birthKnown, locality: Boolean(locality), region: regionKnown }}
              sex={sex}
              scope={optimize ? "optimize_deductible" : "same_deductible"}
              enabled={!foreign}
              trigger={refine}
              onOffer={setOffer}
            />
          </div>
        </div>
      </div>
      <footer className="hi-footer">
        <span>© CoverView</span>
        <p>{copy.gross}</p>
        <button onClick={() => setShowSources(true)}>{copy.sources} ↗</button>
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
        <p className="hi-result-region">{regionName(region)}</p>
        <p className="hi-small">
          {interpolate(copy.resultsCount, { count: comparison?.total ?? 0 })}
        </p>
        {loading ? (
          <p role="status">{copy.loading}</p>
        ) : comparison?.offers.length ? (
          <div className="hi-results-list">
            {comparison.offers.map((item, index) => (
              <button
                className="hi-result-row"
                key={item.id}
                onClick={() => {
                  setShowList(false);
                  setOffer(item);
                }}
              >
                <span className="hi-offer-rank">{offset + index + 1}</span>
                <span>
                  <strong>{item.insurerBrand ?? item.insurerName}</strong>
                  <small>{item.name}</small>
                  <em>{copy.categoryLabels[item.category]}</em>
                  {item.eligibility === "municipality_required" && <em>{copy.chooseLocality}</em>}
                </span>
                <span className="hi-list-price">
                  <strong>{money(item.monthlyPremiumMinor)}</strong>
                  <small>
                    {copy.currency} {copy.perMonth}
                  </small>
                </span>
                <HealthIcon name="chevron" size={16} />
              </button>
            ))}
          </div>
        ) : (
          <p>{failed ? copy.unavailable : copy.empty}</p>
        )}
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
      </HealthDialog>
      <HealthModelPanel
        apiUrl={apiUrl}
        year={profile.year ?? 2027}
        onRefine={() => {
          setOffer(null);
          setRefine((value) => value + 1);
        }}
        offer={offer}
        onClose={() => setOffer(null)}
        onRequest={(item) => {
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
        }}
      />
      <HealthCheckout
        apiUrl={apiUrl}
        healthApi={api}
        status={status}
        candidate={candidate}
        open={checkout}
        onClose={() => setCheckout(false)}
        onCount={setCartCount}
      />
      <noscript>
        <p className="hi-note">{copy.noScript}</p>
      </noscript>
    </div>
  );
}
