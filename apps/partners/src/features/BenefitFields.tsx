import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input, Label } from "@coverview/ui";
import type { LeadDetail } from "@coverview/contracts/partner";
import {
  benefitCatalog,
  benefitCategorySchema,
  suggestBenefitCategory,
  type BenefitCategory,
  type BenefitLimit,
} from "@coverview/contracts/partner-benefits";

const select = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
// CHF in centimes, percent in hundredths, days as whole days (benefit-catalog-v1).
function parse(text: string, unit: BenefitLimit["unit"]) {
  const clean = text.replace(/['’\s]/gu, "").replace(",", ".");
  if (!/^\d{1,9}(?:\.\d{1,2})?$/u.test(clean)) return null;
  const [units = "0", decimals = ""] = clean.split(".");
  if (unit === "days") return decimals ? null : Number(units);
  return Number(units) * 100 + Number(decimals.padEnd(2, "0"));
}
const shown = (limit: BenefitLimit | null) =>
  !limit
    ? ""
    : limit.unit === "days"
      ? String(limit.value)
      : `${Math.floor(limit.value / 100)}${limit.value % 100 ? `.${String(limit.value % 100).padStart(2, "0")}` : ""}`;

// Normalized category (suggested from the insurer's label, confirmed by the reviewer) and an
// optional structured amount. The comparison itself stays on the server.
export function BenefitFields({
  id,
  need,
  label,
  category,
  limit,
  onCategory,
  onLimit,
}: {
  id: string;
  need: LeadDetail["category"];
  label: string;
  category: BenefitCategory;
  limit: BenefitLimit | null;
  onCategory: (category: BenefitCategory) => void;
  onLimit: (limit: BenefitLimit | null) => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(shown(limit)),
    [unit, setUnit] = useState<BenefitLimit["unit"]>(limit?.unit ?? "chf"),
    [period, setPeriod] = useState<BenefitLimit["period"]>(limit?.period ?? "event");
  const suggestion = suggestBenefitCategory(label, need);
  const own = benefitCategorySchema.options.filter((item) =>
    benefitCatalog[item].needs.includes(need),
  );
  const others = benefitCategorySchema.options.filter((item) => !own.includes(item));
  const invalid = !!text.trim() && parse(text, unit) === null;
  function update(next: {
    text?: string;
    unit?: BenefitLimit["unit"];
    period?: BenefitLimit["period"];
  }) {
    const value = { text, unit, period, ...next };
    setText(value.text);
    setUnit(value.unit);
    setPeriod(value.period);
    const parsed = value.text.trim() ? parse(value.text, value.unit) : null;
    onLimit(parsed === null ? null : { value: parsed, unit: value.unit, period: value.period });
  }
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${id}-category`}>{t("benefitField.category")}</Label>
        <select
          id={`${id}-category`}
          value={category}
          onChange={(event) => onCategory(benefitCategorySchema.parse(event.target.value))}
          className={select}
        >
          <optgroup label={t("benefitField.forNeed")}>
            {own.map((item) => (
              <option key={item} value={item}>
                {t(`comparison.benefit.${item}`)}
              </option>
            ))}
          </optgroup>
          <optgroup label={t("benefitField.others")}>
            {others.map((item) => (
              <option key={item} value={item}>
                {t(`comparison.benefit.${item}`)}
              </option>
            ))}
          </optgroup>
        </select>
        {suggestion && suggestion !== category && (
          <button
            type="button"
            className="text-left text-xs underline underline-offset-4"
            onClick={() => onCategory(suggestion)}
          >
            {t("benefitField.suggestion", { category: t(`comparison.benefit.${suggestion}`) })}
          </button>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-amount`}>{t("benefitField.amount")}</Label>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
          <Input
            id={`${id}-amount`}
            inputMode="decimal"
            value={text}
            aria-invalid={invalid}
            aria-describedby={`${id}-amount-help`}
            onChange={(event) => update({ text: event.target.value })}
          />
          <select
            aria-label={t("benefitField.unit")}
            value={unit}
            onChange={(event) => update({ unit: event.target.value as BenefitLimit["unit"] })}
            className={select}
          >
            {(["chf", "percent", "days"] as const).map((item) => (
              <option key={item} value={item}>
                {t(`benefitField.units.${item}`)}
              </option>
            ))}
          </select>
          <select
            aria-label={t("benefitField.period")}
            value={period}
            onChange={(event) => update({ period: event.target.value as BenefitLimit["period"] })}
            className={select}
          >
            {(["event", "day", "year", "total"] as const).map((item) => (
              <option key={item} value={item}>
                {t(`benefitField.periods.${item}`)}
              </option>
            ))}
          </select>
        </div>
        <p id={`${id}-amount-help`} className="text-xs text-muted-foreground">
          {invalid ? t("benefitField.invalid") : t("benefitField.amountHelp")}
        </p>
      </div>
    </>
  );
}
