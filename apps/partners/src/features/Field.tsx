import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Input, Label } from "@coverview/ui";
import { numberFormat } from "@coverview/ui/number-format";
export function Field({
  name,
  label,
  type = "text",
  defaultValue = "",
  required = false,
  children,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children ? (
        <select
          id={id}
          name={name}
          defaultValue={defaultValue}
          required={required}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {children}
        </select>
      ) : type === "textarea" ? (
        <textarea
          id={id}
          name={name}
          defaultValue={defaultValue}
          required={required}
          rows={3}
          maxLength={4000}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      ) : (
        <Input
          id={id}
          name={name}
          type={type}
          defaultValue={defaultValue}
          required={required}
          step={type === "number" ? "0.01" : undefined}
        />
      )}
    </div>
  );
}
export function SelectOptions({ values, prefix }: { values: readonly string[]; prefix: string }) {
  const { t } = useTranslation();
  return values.map((value) => (
    <option key={value} value={value}>
      {t(`${prefix}.${value}`)}
    </option>
  ));
}
export const localDateTime = (iso: string | null) => {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
};
export function zurichInstant(value: string) {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/u.test(value)) throw new Error("Invalid date");
  const expected = Date.parse(`${value}:00Z`);
  let instant = expected;
  for (let step = 0; step < 3; step++) {
    const local = localDateTime(new Date(instant).toISOString());
    instant += expected - Date.parse(`${local}:00Z`);
  }
  const result = new Date(instant).toISOString();
  if (localDateTime(result) !== value) throw new Error("Invalid local time");
  return result;
}
export const readText = (data: FormData, key: string) => {
  const value = data.get(key);
  return typeof value === "string" ? value.trim() : "";
};
export const readDate = (data: FormData, key: string) => {
  const value = readText(data, key);
  return value ? zurichInstant(value) : null;
};
export const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("fr-CH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Zurich",
      }).format(new Date(value))
    : "—";
export const formatMoney = (minor: number) =>
  numberFormat("fr-CH", { style: "currency", currency: "CHF" }).format(minor / 100);
