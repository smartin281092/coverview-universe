import { useEffect, useMemo, useRef, useState } from "react";
import type {
  createHealthClient,
  HealthCompareInput,
  HealthCurrentComparison,
  HealthCurrentOffer,
  HealthCurrentOptions,
  HealthCurrentSelection,
  HealthLocality,
} from "@coverview/api-client/health-insurance";
import { healthCurrentCopy as copy } from "../../content/fr/health-current";
import { healthCopy } from "../../content/fr/health-insurance";
import { HealthDialog } from "./HealthDialog";
import { HealthIcon } from "./HealthIcon";
import { HealthInsurerLogo } from "./HealthOfferIdentity";
import { HealthProductImage } from "./HealthProductImage";
import { HealthSelect } from "./HealthSelect";
import { LocalitySearch } from "./LocalitySearch";
import { interpolate, money, regionName } from "./health-format";

type Props = {
  api: ReturnType<typeof createHealthClient>;
  profile: HealthCompareInput;
  birthKnown: boolean;
  locality: HealthLocality | null;
  selection: HealthCurrentSelection | null;
  // `adjusted`: a setting of the saved model changed in the open picker, which stays open.
  onSelect: (value: HealthCurrentSelection | null, adjusted?: boolean) => void;
  comparison: {
    value: HealthCurrentComparison | null;
    busy: boolean;
    error: boolean;
    retry: () => void;
  };
};
// One entry per company, or per group of companies sharing regions (Groupe Mutuel).
type Entry = {
  key: string;
  label: string;
  ids: number[];
  logo: { insurerId: number; insurerName: string; insurerBrand: string };
  terms: string;
  group: boolean;
};
// The saved choice of a model under the picker's settings.
const choice = (
  model: HealthCurrentOffer,
  municipalityId: number | null,
): HealthCurrentSelection => ({
  year: 2026,
  modelId: model.modelId,
  regionId: model.regionId,
  ...(municipalityId ? { municipalityId } : {}),
  deductible: model.deductible,
  accident: model.accident,
});
const sameChoice = (a: HealthCurrentSelection, b: HealthCurrentSelection | null) =>
  !!b &&
  a.modelId === b.modelId &&
  a.regionId === b.regionId &&
  (a.municipalityId ?? null) === (b.municipalityId ?? null) &&
  a.deductible === b.deductible &&
  a.accident === b.accident;
function CurrentPicker({
  api,
  profile,
  birthKnown,
  locality,
  selection,
  savedInsurerId,
  onSelect,
  onClose,
}: Omit<Props, "onSelect"> & {
  savedInsurerId: number | null;
  onClose: () => void;
  onSelect: (
    selection: HealthCurrentSelection,
    model: HealthCurrentOffer,
    adjusted?: boolean,
  ) => void;
}) {
  const [insurer, setInsurer] = useState<Entry | null>(null);
  // A setting the person changes applies at once to the saved model (user request, 25 October
  // 2026): its premium is recalculated and saved without choosing the company and model again.
  const [adjusted, setAdjusted] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [insurer?.key]);
  const [deductible, setDeductible] = useState(selection?.deductible ?? profile.deductible);
  // Most contracts leave accidents to the employer's insurance (20 October 2026): excluded first.
  const [accident, setAccident] = useState(selection?.accident ?? false);
  const [location, setLocation] = useState(
    locality?.municipalityId === selection?.municipalityId || !selection ? locality : null,
  );
  const [region, setRegion] = useState(selection?.regionId ?? profile.regionId ?? "VD-1");
  const [municipality, setMunicipality] = useState(
    selection?.municipalityId ?? locality?.municipalityId ?? undefined,
  );
  const [search, setSearch] = useState("");
  const [retry, setRetry] = useState(0);
  const [response, setResponse] = useState<{
    key: string;
    value: HealthCurrentOptions | null;
    error: boolean;
  } | null>(null);
  // Browse with the comparator's existing default; only display a personal price once age is known.
  const birthYear = profile.birthYear;
  const input = useMemo(
    () => ({
      year: 2026 as const,
      birthYear,
      regionId: region,
      municipalityId: municipality,
      deductible,
      accident,
    }),
    [birthYear, region, municipality, deductible, accident],
  );
  const key = JSON.stringify(input);
  const eligibleBirth = birthYear <= 2026;
  const historicalLocalities = useMemo(() => ({ localities: api.currentLocalities }), [api]);
  useEffect(() => {
    if (!eligibleBirth) return;
    const abort = new AbortController();
    void api
      .currentOptions(input, abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) setResponse({ key, value, error: false });
      })
      .catch(() => {
        if (!abort.signal.aborted) setResponse({ key, value: null, error: true });
      });
    return () => abort.abort();
  }, [api, input, key, retry, eligibleBirth]);
  const fresh = response?.key === key ? response : null;
  const data = fresh?.value;
  // The saved model under the current settings, saved again as soon as a setting changes.
  const saved =
    data?.status === "available"
      ? data.offers.find((model) => model.modelId === selection?.modelId)
      : undefined;
  const update =
    saved && saved.eligibility !== "municipality_required"
      ? choice(saved, data?.municipalityId ?? null)
      : null;
  const updateKey = adjusted && update ? JSON.stringify(update) : null;
  useEffect(() => {
    if (updateKey && saved && update && !sameChoice(update, selection))
      onSelect(update, saved, true);
  }, [updateKey]);
  const autosave =
    !adjusted || !selection || data?.status !== "available"
      ? null
      : !saved
        ? "unavailable"
        : saved.eligibility === "municipality_required"
          ? "locality"
          : "saved";
  const savedCompany = selection ? (saved?.insurerId ?? savedInsurerId) : null;
  const filter = (value: string) =>
    value
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .includes(search.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase());
  // The companies of a group are one entry; its models are listed together, cheapest first.
  const entries = useMemo(() => {
    const byKey = new Map<string, Entry>();
    for (const company of data?.insurers ?? []) {
      const key = company.group ?? `insurer:${company.id}`;
      const entry = byKey.get(key) ?? {
        key,
        label: company.group ?? company.brand,
        ids: [],
        logo: {
          insurerId: company.id,
          insurerName: company.name,
          insurerBrand: company.group ?? company.brand,
        },
        terms: company.group ?? company.brand,
        group: Boolean(company.group),
      };
      entry.ids.push(company.id);
      if (company.group) entry.terms += ` ${company.brand}`;
      byKey.set(key, entry);
    }
    return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label, "fr-CH"));
  }, [data]);
  const companies = entries.filter((entry) => filter(entry.terms));
  const models = (data?.offers ?? [])
    .filter(
      (model) =>
        insurer?.ids.includes(model.insurerId) &&
        (filter(model.name) || filter(model.insurerBrand ?? model.insurerName)),
    )
    .sort(
      (a, b) =>
        a.monthlyPremiumMinor - b.monthlyPremiumMinor || a.name.localeCompare(b.name, "fr-CH"),
    );
  return (
    <HealthDialog
      open
      onClose={onClose}
      title={insurer ? copy.models : copy.companies}
      header={
        <h2 ref={heading} tabIndex={-1}>
          {insurer ? copy.models : copy.companies}
        </h2>
      }
    >
      <div className="hi-current-steps" aria-label={copy.year}>
        <span aria-current={!insurer ? "step" : undefined}>{copy.companyStep}</span>
        <HealthIcon name="chevron" size={14} />
        <span aria-current={insurer ? "step" : undefined}>{copy.modelStep}</span>
      </div>
      {!eligibleBirth && <p className="hi-field-help">{copy.birthAfter2026}</p>}
      {eligibleBirth && (
        <>
          {insurer && (
            <button
              className="hi-back-to-list"
              onClick={() => {
                setInsurer(null);
                setSearch("");
              }}
            >
              <HealthIcon name="back" size={16} />
              {copy.back}
            </button>
          )}
          <div className="hi-current-configuration">
            <div className="hi-current-settings">
              <div className="hi-field">
                {healthCopy.deductible}
                <HealthSelect
                  label={`${healthCopy.deductible} 2026`}
                  value={String(deductible)}
                  onChange={(value) => {
                    setDeductible(Number(value));
                    setAdjusted(true);
                  }}
                  options={(data?.deductibles ?? [deductible]).map((value) => ({
                    value: String(value),
                    label: `${money(value * 100)} CHF`,
                  }))}
                />
              </div>
              <div className="hi-field">
                {healthCopy.accident}
                <HealthSelect
                  label={`${healthCopy.accident} 2026`}
                  value={String(accident)}
                  onChange={(value) => {
                    setAccident(value === "true");
                    setAdjusted(true);
                  }}
                  options={[
                    { value: "true", label: healthCopy.accidentIncluded },
                    { value: "false", label: healthCopy.accidentExcluded },
                  ]}
                />
              </div>
            </div>
            {!region.startsWith("EU-") && (
              <div className="hi-current-locality">
                <p className="hi-field-help">{copy.location}</p>
                <LocalitySearch
                  api={historicalLocalities}
                  selected={location}
                  onSelect={(value) => {
                    setLocation(value);
                    setMunicipality(value?.municipalityId ?? undefined);
                    if (value) setRegion(value.regionId);
                    setAdjusted(true);
                  }}
                />
              </div>
            )}
          </div>
          <p className={`hi-current-autosave is-${autosave ?? "idle"}`} role="status">
            {autosave === "saved" && (
              <>
                <HealthIcon name="check" size={15} />
                {birthKnown && saved
                  ? interpolate(copy.updatedPrice, { amount: money(saved.monthlyPremiumMinor) })
                  : copy.updated}
              </>
            )}
            {autosave === "locality" && copy.statuses.location_required}
            {autosave === "unavailable" && copy.updateUnavailable}
          </p>
          <p className="hi-field-help">
            {regionName(data?.regionId ?? region)}
            {!region.startsWith("EU-") && !municipality ? ` · ${copy.regionHint}` : ""}
          </p>
          {!fresh ? (
            <p role="status">{copy.loading}</p>
          ) : fresh.error ? (
            <p role="alert">
              {copy.error}{" "}
              <button
                className="hi-text-link"
                onClick={() => {
                  setResponse(null);
                  setRetry((value) => value + 1);
                }}
              >
                {copy.retry}
              </button>
            </p>
          ) : data?.status !== "available" ? (
            <p role="status">{data && copy.statuses[data.status]}</p>
          ) : (
            <>
              <label className="hi-current-search">
                <HealthIcon name="search" size={17} />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label={insurer ? copy.searchModel : copy.searchCompany}
                  placeholder={insurer ? copy.searchModel : copy.searchCompany}
                />
              </label>
              <div className={`hi-current-cards ${insurer ? "is-models" : "is-companies"}`}>
                {!insurer
                  ? companies.map((company) => {
                      // The saved company and model are outlined in blue (25 October 2026).
                      const current = savedCompany !== null && company.ids.includes(savedCompany);
                      return (
                        <button
                          key={company.key}
                          className={`hi-current-card${current ? " is-saved" : ""}`}
                          aria-current={current || undefined}
                          onClick={() => {
                            setInsurer(company);
                            setSearch("");
                          }}
                        >
                          <HealthInsurerLogo offer={company.logo} />
                          <strong>{company.label}</strong>
                        </button>
                      );
                    })
                  : models.map((model) => (
                      <button
                        key={model.id}
                        className={`hi-current-card${model.modelId === selection?.modelId ? " is-saved" : ""}`}
                        aria-current={model.modelId === selection?.modelId || undefined}
                        disabled={model.eligibility === "municipality_required"}
                        onClick={() => {
                          onSelect(choice(model, data.municipalityId), model);
                          onClose();
                        }}
                      >
                        <HealthProductImage
                          offer={{ ...model, modelId: model.nextModelId ?? model.modelId }}
                          thumbnail
                          fallback={<HealthInsurerLogo offer={model} />}
                        />
                        <strong>{model.name}</strong>
                        {insurer.group && (
                          <span className="hi-current-card-company">
                            {model.insurerBrand ?? model.insurerName}
                          </span>
                        )}
                        {birthKnown && (
                          <span className="hi-current-card-price">
                            {money(model.monthlyPremiumMinor)}{" "}
                            <small>CHF {healthCopy.perMonth}</small>
                          </span>
                        )}
                        <span className="hi-current-card-action">
                          {model.eligibility === "municipality_required"
                            ? healthCopy.chooseLocality
                            : copy.selectModel}
                          <HealthIcon name="arrow" size={15} />
                        </span>
                      </button>
                    ))}
              </div>
              {!(insurer ? models : companies).length && (
                <p>{insurer ? copy.noModel : copy.noCompany}</p>
              )}
              <p className="hi-field-help">{copy.historical}</p>
            </>
          )}
        </>
      )}
    </HealthDialog>
  );
}
export function HealthCurrentInsurance(props: Props) {
  const [open, setOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<HealthCurrentOffer | null>(null);
  const current = props.comparison.value?.current;
  const baseline = props.comparison.value?.baseline;
  const identity =
    current ?? (selectedModel?.modelId === props.selection?.modelId ? selectedModel : null);
  return (
    <section className="hi-current-insurance" aria-label={copy.title}>
      <div className="hi-current-heading">
        <h3>{copy.title}</h3>
        <span>2026</span>
      </div>
      {props.selection ? (
        <>
          {identity && (
            <div className="hi-current-selected">
              <HealthInsurerLogo offer={identity} labelled />
              <strong>{identity.name}</strong>
              {current && (
                <span>
                  {interpolate(copy.price2026, { amount: money(current.monthlyPremiumMinor) })}
                </span>
              )}
              {baseline?.year === 2027 && (
                <span className="hi-current-next">
                  {interpolate(copy.price2027, { amount: money(baseline.monthlyPremiumMinor) })}
                </span>
              )}
              <small>
                {money(props.selection.deductible * 100)} CHF ·{" "}
                {props.selection.accident
                  ? healthCopy.accidentIncluded
                  : healthCopy.accidentExcluded}
              </small>
              {baseline?.year === 2027 && current && baseline.ageGroup !== current.ageGroup && (
                <small>{copy.ageGroupNext}</small>
              )}
              {baseline?.year === 2027 && baseline.deductible !== props.selection.deductible && (
                <small>
                  {interpolate(copy.deductibleNext, { amount: money(baseline.deductible * 100) })}
                </small>
              )}
              {baseline?.year === 2026 && <small>{copy.noTariff2027}</small>}
            </div>
          )}
          {props.comparison.busy && (
            <p className="hi-field-help" role="status">
              {copy.comparing}
            </p>
          )}
          {props.comparison.error && (
            <p className="hi-field-help" role="alert">
              {copy.error}
              <button onClick={props.comparison.retry}>{copy.retry}</button>
            </p>
          )}
          {props.comparison.value && props.comparison.value.status !== "available" && (
            <p className="hi-field-help" role="status">
              {copy.statuses[props.comparison.value.status]}
            </p>
          )}
          {props.profile.birthYear > 2026 && <p className="hi-field-help">{copy.birthAfter2026}</p>}
          {!props.birthKnown && <p className="hi-field-help">{copy.birthRequired}</p>}
          <div className="hi-current-controls">
            <button className="hi-more" onClick={() => setOpen(true)}>
              <HealthIcon name="pencil" size={15} />
              {copy.modify}
            </button>
            <button
              className="hi-icon-button"
              onClick={() => props.onSelect(null)}
              aria-label={copy.remove}
            >
              <HealthIcon name="close" size={16} />
            </button>
          </div>
        </>
      ) : (
        <>
          <p>{copy.intro}</p>
          <button className="hi-more" onClick={() => setOpen(true)}>
            <HealthIcon name="plus" size={16} />
            {copy.select}
          </button>
        </>
      )}
      {open && (
        <CurrentPicker
          {...props}
          savedInsurerId={identity?.insurerId ?? null}
          onClose={() => setOpen(false)}
          onSelect={(selection, model, adjusted) => {
            setSelectedModel(model);
            props.onSelect(selection, adjusted);
          }}
        />
      )}
    </section>
  );
}
