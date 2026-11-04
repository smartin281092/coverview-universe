// Nombres de l’audit en français de Suisse (INTL-04) : apostrophe pour les milliers, virgule décimale.
const integer = new Intl.NumberFormat("fr-CH", { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat("fr-CH", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const twoDecimals = new Intl.NumberFormat("fr-CH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const swiss = (text: string) => text.replace(/[\u202f\u00a0 ]/gu, "’").replace(/\./gu, ",");

/** 1’234’567 */
export const chf = (value: number) => swiss(integer.format(Math.round(value)));
/** 12,3 % ou 12,34 % */
export const pct = (fraction: number, digits: 1 | 2 = 1) =>
  `${swiss((digits === 2 ? twoDecimals : oneDecimal).format(fraction * 100))} %`;
/** +12,3 % / −4,2 % */
export const signedPct = (fraction: number, digits: 1 | 2 = 1) =>
  `${fraction > 0 ? "+" : fraction < 0 ? "−" : ""}${pct(Math.abs(fraction), digits)}`;
export const interpolate = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, String(value)),
    template,
  );
/** Saisie libre → entier, apostrophes et espaces tolérés. */
export const digitsOf = (text: string) => {
  const cleaned = text.replace(/[^\d]/gu, "");
  return cleaned ? Number(cleaned) : null;
};
