import { useEffect, useRef, useState } from "react";
import { auditCopy as copy } from "../../content/fr/audit";
import { chf, digitsOf } from "./format";

/**
 * Une question à réponse numérique (versement, année, capital, revenu) : un grand champ, des
 * raccourcis, une validation visible, Entrée pour continuer. Une action secondaire permet de
 * répondre « je ne sais pas » quand la question l’admet.
 */
export function StepNumber({
  id,
  value,
  min,
  max,
  unit,
  presets,
  year = false,
  invalid,
  secondary,
  onChange,
  onNext,
}: {
  id: string;
  value: number | null;
  min: number;
  max: number;
  unit?: string;
  presets?: readonly number[];
  year?: boolean;
  invalid: string;
  secondary?: { label: string; onSelect: () => void };
  onChange: (value: number | null) => void;
  onNext: () => void;
}) {
  const [text, setText] = useState(value === null ? "" : year ? String(value) : chf(value));
  const [touched, setTouched] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus({ preventScroll: true });
  }, []);
  const parsed = digitsOf(text);
  const valid = parsed !== null && parsed >= min && parsed <= max;
  const showError = touched && text !== "" && !valid;
  const commit = (next: number | null) => {
    onChange(next !== null && next >= min && next <= max ? next : null);
  };
  return (
    <div className="audit-number">
      <label className="audit-number-field" htmlFor={id}>
        <input
          ref={input}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="next"
          value={text}
          aria-invalid={showError || undefined}
          aria-describedby={showError ? `${id}-error` : undefined}
          onChange={(event) => {
            const digits = event.target.value.replace(/[^\d]/gu, "").slice(0, year ? 4 : 8);
            const number = digits ? Number(digits) : null;
            setText(number === null ? "" : year ? digits : chf(number));
            commit(number);
          }}
          onBlur={() => setTouched(true)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            setTouched(true);
            if (valid) onNext();
          }}
        />
        {unit && <span className="audit-number-unit">{unit}</span>}
      </label>
      {showError && (
        <p className="audit-error" id={`${id}-error`} role="alert">
          {invalid}
        </p>
      )}
      {presets && (
        <div className="audit-presets" role="group">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              className={`audit-chip ${parsed === preset ? "is-active" : ""}`}
              onClick={() => {
                setText(year ? String(preset) : chf(preset));
                setTouched(true);
                commit(preset);
                input.current?.focus({ preventScroll: true });
              }}
            >
              {year ? preset : chf(preset)}
            </button>
          ))}
        </div>
      )}
      <div className="audit-actions">
        <button
          type="button"
          className="audit-next"
          disabled={!valid}
          onClick={() => {
            setTouched(true);
            if (valid) onNext();
          }}
        >
          {copy.nav.next}
          <kbd>{copy.nav.enter}</kbd>
        </button>
        {secondary && (
          <button type="button" className="audit-secondary" onClick={secondary.onSelect}>
            {secondary.label}
          </button>
        )}
      </div>
    </div>
  );
}
