import { hyperionUi } from "../../content/fr/hyperion-ui";
import { formatFrancs } from "./hyperion-model";
import type { HyperionConfig } from "./hyperion-store";

const copy = hyperionUi.buy;
// Monthly bounds: 100 CHF (risk premium scale) to the 3a cap without a pension fund, 36'288 / 12.
const bounds = {
  monthly: { min: 100, max: 3024, cap: 605, step: 10 },
  annual: { min: 1200, max: 36288, cap: 7258, step: 100 },
};

// The product's parameters, shared by the hero's buy box and the simulator.
export function HyperionFields({
  config,
  onChange,
  currentYear,
  prefix,
}: {
  config: HyperionConfig;
  onChange: (patch: Partial<HyperionConfig>) => void;
  currentYear: number;
  // Two islands render these fields: explicit ids keep every label attached to one input.
  prefix: string;
}) {
  const id = prefix;
  const limits = bounds[config.frequency];
  const clamp = (value: number, min: number, max: number) =>
    Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : min;
  const setFrequency = (frequency: HyperionConfig["frequency"]) => {
    if (frequency === config.frequency) return;
    const investment =
      frequency === "annual"
        ? clamp(config.investment * 12, bounds.annual.min, bounds.annual.max)
        : clamp(config.investment / 12, bounds.monthly.min, bounds.monthly.max);
    onChange({ frequency, investment });
  };
  const fill =
    ((Math.min(config.investment, limits.cap) - limits.min) / (limits.cap - limits.min)) * 100;
  return (
    <div className="hp-fields">
      <div className="hp-field">
        <div className="hp-field-head">
          <label htmlFor={`${id}-investment`}>{copy.investment}</label>
          <div className="hp-segmented" role="group" aria-label={copy.frequency}>
            <button
              type="button"
              aria-pressed={config.frequency === "monthly"}
              onClick={() => setFrequency("monthly")}
            >
              {copy.monthly}
            </button>
            <button
              type="button"
              aria-pressed={config.frequency === "annual"}
              onClick={() => setFrequency("annual")}
            >
              {copy.annual}
            </button>
          </div>
        </div>
        <div className="hp-number">
          <input
            id={`${id}-investment`}
            type="number"
            inputMode="numeric"
            min={limits.min}
            max={limits.max}
            step={limits.step}
            value={config.investment}
            onChange={(event) => {
              const value = event.target.valueAsNumber;
              if (Number.isFinite(value)) onChange({ investment: value });
            }}
            onBlur={(event) =>
              onChange({ investment: clamp(event.target.valueAsNumber, limits.min, limits.max) })
            }
          />
          <span>{config.frequency === "annual" ? copy.perYear : copy.perMonth}</span>
        </div>
        <input
          aria-label={copy.investment}
          type="range"
          min={limits.min}
          max={limits.cap}
          step={limits.step}
          value={Math.min(config.investment, limits.cap)}
          style={{ ["--fill" as string]: `${Math.max(0, Math.min(100, fill))}%` }}
          onChange={(event) => onChange({ investment: event.target.valueAsNumber })}
        />
        <p className="hp-field-note">
          {config.investment > limits.cap ? copy.capExceeded : copy.cap}
        </p>
      </div>
      <div className="hp-field-row">
        <div className="hp-field">
          <label htmlFor={`${id}-birth`}>{copy.birthYear}</label>
          <div className="hp-number hp-number-small">
            <input
              id={`${id}-birth`}
              type="number"
              inputMode="numeric"
              min={currentYear - 80}
              max={currentYear - 16}
              step={1}
              value={config.birthYear}
              onChange={(event) => {
                const value = event.target.valueAsNumber;
                if (Number.isFinite(value)) onChange({ birthYear: value });
              }}
              onBlur={(event) =>
                onChange({
                  birthYear: clamp(event.target.valueAsNumber, currentYear - 80, currentYear - 16),
                })
              }
            />
          </div>
        </div>
        <div className="hp-field">
          <label htmlFor={`${id}-capital`}>{copy.initialCapital}</label>
          <div className="hp-number hp-number-small">
            <input
              id={`${id}-capital`}
              type="number"
              inputMode="numeric"
              min={0}
              max={10_000_000}
              step={1000}
              value={config.initialCapital}
              onChange={(event) => {
                const value = event.target.valueAsNumber;
                if (Number.isFinite(value)) onChange({ initialCapital: value });
              }}
              onBlur={(event) =>
                onChange({ initialCapital: clamp(event.target.valueAsNumber, 0, 10_000_000) })
              }
            />
            <span>{copy.currency}</span>
          </div>
          <p className="hp-field-note">{copy.initialCapitalHint}</p>
        </div>
      </div>
      <p className="hp-visually-hidden" aria-live="polite">
        {`${formatFrancs(config.investment)} ${config.frequency === "annual" ? copy.perYear : copy.perMonth}`}
      </p>
    </div>
  );
}
