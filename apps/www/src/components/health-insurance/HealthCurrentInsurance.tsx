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
import { HealthSelect } from "./HealthSelect";
import { LocalitySearch } from "./LocalitySearch";
import { money, regionName } from "./health-format";

type Props = {
  api: ReturnType<typeof createHealthClient>;
  profile: HealthCompareInput;
  birthKnown: boolean;
  locality: HealthLocality | null;
  selection: HealthCurrentSelection | null;
  onSelect: (value: HealthCurrentSelection | null) => void;
  comparison: {
    value: HealthCurrentComparison | null;
    busy: boolean;
    error: boolean;
    retry: () => void;
  };
};
function CurrentPicker({
  api,
  profile,
  birthKnown,
  locality,
  selection,
  onSelect,
  onClose,
}: Omit<Props, "onSelect"> & {
  onClose: () => void;
  onSelect: (selection: HealthCurrentSelection, model: HealthCurrentOffer) => void;
}) {
  const [insurer, setInsurer] = useState<{ id: number; name: string; brand: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [insurer?.id]);
  const [deductible, setDeductible] = useState(selection?.deductible ?? profile.deductible);
  const [accident, setAccident] = useState(selection?.accident ?? profile.accident);
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
      insurerId: insurer?.id,
    }),
    [birthYear, region, municipality, deductible, accident, insurer?.id],
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
  const filter = (value: string) =>
    value
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .includes(search.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase());
  const companies = data?.insurers.filter((company) => filter(company.brand)) ?? [];
  const models = data?.offers.filter((model) => filter(model.name)) ?? [];
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
          <details
            className="hi-current-configuration"
            open={
              data?.status === "invalid_deductible" ||
              data?.status === "location_required" ||
              undefined
            }
          >
            <summary>
              {copy.configuration} · {money(deductible * 100)} CHF ·{" "}
              {accident ? healthCopy.accidentIncluded : healthCopy.accidentExcluded}
            </summary>
            <p className="hi-field-help">{copy.configurationHint}</p>
            <div className="hi-current-settings">
              <div className="hi-field">
                {healthCopy.deductible}
                <HealthSelect
                  label={`${healthCopy.deductible} 2026`}
                  value={String(deductible)}
                  onChange={(value) => setDeductible(Number(value))}
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
                  onChange={(value) => setAccident(value === "true")}
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
                  }}
                />
              </div>
            )}
          </details>
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
                  ? companies.map((company) => (
                      <button
                        key={company.id}
                        className="hi-current-card"
                        onClick={() => {
                          setInsurer(company);
                          setSearch("");
                        }}
                      >
                        <HealthInsurerLogo
                          offer={{
                            insurerId: company.id,
                            insurerName: company.name,
                            insurerBrand: company.brand,
                          }}
                        />
                        <strong>{company.brand}</strong>
                      </button>
                    ))
                  : models.map((model) => (
                      <button
                        key={model.id}
                        className="hi-current-card"
                        disabled={model.eligibility === "municipality_required"}
                        onClick={() => {
                          onSelect(
                            {
                              year: 2026,
                              modelId: model.modelId,
                              regionId: model.regionId,
                              ...(data.municipalityId
                                ? { municipalityId: data.municipalityId }
                                : {}),
                              deductible: model.deductible,
                              accident: model.accident,
                            },
                            model,
                          );
                          onClose();
                        }}
                      >
                        <HealthInsurerLogo offer={model} />
                        <strong>{model.name}</strong>
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
                  {money(current.monthlyPremiumMinor)} CHF {healthCopy.perMonth}
                </span>
              )}
              <small>
                {money(props.selection.deductible * 100)} CHF ·{" "}
                {props.selection.accident
                  ? healthCopy.accidentIncluded
                  : healthCopy.accidentExcluded}
              </small>
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
          onClose={() => setOpen(false)}
          onSelect={(selection, model) => {
            setSelectedModel(model);
            props.onSelect(selection);
          }}
        />
      )}
    </section>
  );
}
