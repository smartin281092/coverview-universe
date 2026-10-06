import { healthCopy as copy } from "../../content/fr/health-insurance";
// Text rendered at build time must match every browser on hydration, whatever its ICU data:
// integers shown before any data loads use the fr-CH narrow no-break space explicitly.
export const integer = (value: number) =>
  String(Math.trunc(value)).replace(/\B(?=(\d{3})+(?!\d))/gu, " ");
export const money = (minor: number) =>
  new Intl.NumberFormat("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    minor / 100,
  );
export const francs = (amount: number) =>
  new Intl.NumberFormat("fr-CH", {
    style: "currency",
    currency: "CHF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
export const interpolate = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, String(value)),
    template,
  );
export function regionName(id: string) {
  if (id.startsWith("EU-"))
    return `${new Intl.DisplayNames(["fr-CH"], { type: "region" }).of(id.slice(3)) ?? id.slice(3)} · ${copy.crossBorder}`;
  const [canton, number] = id.split("-");
  const name = copy.cantons[canton as keyof typeof copy.cantons] ?? canton ?? "";
  return interpolate(copy.regionTitle, {
    canton: name,
    region: number === "0" ? copy.singleRegion : interpolate(copy.region, { number: number ?? "" }),
  });
}
