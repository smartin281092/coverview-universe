import { healthCopy as copy } from "../../content/fr/health-insurance";
import { recommendationCopy } from "../../content/fr/health-recommendation";
import { HealthSelect } from "./HealthSelect";
import { HealthIcon } from "./HealthIcon";
import { francs } from "./health-format";
import type { useModelConfiguration } from "./use-model-configuration";

export function HealthModelData({
  configuration,
  year,
  regions,
  deductibles,
  foreign,
}: {
  configuration: ReturnType<typeof useModelConfiguration>;
  year: number;
  regions: { value: string; label: string }[];
  deductibles: number[];
  foreign: boolean;
}) {
  const { draft, change } = configuration;
  return (
    <dl className="hi-specs hi-editable-specs">
      <div>
        <dt>{recommendationCopy.year}</dt>
        <dd>
          <HealthSelect
            label={recommendationCopy.year}
            value={String(year)}
            options={[{ value: String(year), label: String(year) }]}
            disabled
            onChange={() => {}}
          />
        </dd>
      </div>
      <div>
        <dt>{foreign ? copy.country : copy.selectedRegion}</dt>
        <dd>
          <HealthSelect
            label={foreign ? copy.country : copy.selectedRegion}
            value={draft.regionId}
            options={regions}
            onChange={(regionId) => change({ regionId })}
          />
        </dd>
      </div>
      <div>
        <dt>{copy.deductible}</dt>
        <dd>
          <HealthSelect
            label={copy.deductible}
            value={String(draft.deductible)}
            options={deductibles.map((value) => ({ value: String(value), label: francs(value) }))}
            onChange={(value) => change({ deductible: Number(value) })}
          />
        </dd>
      </div>
      <div>
        <dt>{copy.accident}</dt>
        <dd className={draft.accident ? "hi-included" : undefined}>
          <HealthSelect
            label={copy.accident}
            value={String(draft.accident)}
            options={[
              { value: "true", label: copy.accidentIncluded },
              { value: "false", label: copy.accidentExcluded },
            ]}
            onChange={(value) => change({ accident: value === "true" })}
          />
        </dd>
      </div>
      {/* Every model pays providers directly (user statement, 23 October 2026), said plainly. */}
      <div>
        <dt>{copy.paymentLabel}</dt>
        <dd className="hi-payment">
          {copy.paymentValue}
          <span className="hi-info-tooltip">
            <button
              type="button"
              aria-label={copy.paymentHelp}
              aria-describedby="health-payment-tooltip"
            >
              <HealthIcon name="info" size={16} />
            </button>
            <span role="tooltip" id="health-payment-tooltip">
              {copy.paymentExplanation}
            </span>
          </span>
        </dd>
      </div>
    </dl>
  );
}
