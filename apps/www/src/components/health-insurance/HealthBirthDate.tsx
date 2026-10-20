import { useState } from "react";
import { healthCopy as copy } from "../../content/fr/health-insurance";

// Day first, with Swiss dots (20 October 2026): the browser's own date field follows its language,
// so a person with an English browser saw the month first. Digits only, dots added while typing.
const shown = (iso: string) =>
  /^\d{4}-\d{2}-\d{2}$/u.test(iso)
    ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`
    : "";
const grouped = (digits: string) =>
  [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join(".");
// A complete, real date between 1900 and today, as yyyy-mm-dd; anything else counts as unknown.
function parsed(digits: string) {
  if (digits.length !== 8) return "";
  const [day, month, year] = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].map(
    Number,
  ) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  const iso = `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
  return year >= 1900 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    iso <= new Date().toISOString().slice(0, 10)
    ? iso
    : "";
}

export function HealthBirthDate({
  value,
  onChange,
}: {
  value: string;
  onChange: (iso: string) => void;
}) {
  const [text, setText] = useState(() => shown(value));
  const digits = text.replace(/\D/gu, "");
  const invalid = digits.length === 8 && !parsed(digits);
  return (
    <>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="bday"
        placeholder={copy.birthPlaceholder}
        maxLength={10}
        value={text}
        aria-invalid={invalid || undefined}
        onChange={(event) => {
          const next = grouped(event.target.value.replace(/\D/gu, "").slice(0, 8));
          setText(next);
          onChange(parsed(next.replace(/\D/gu, "")));
        }}
      />
      {invalid && (
        <span className="hi-field-help" role="alert">
          {copy.birthInvalid}
        </span>
      )}
    </>
  );
}
