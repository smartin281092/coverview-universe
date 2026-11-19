// Swiss francs as the site writes them (19 November 2026): apostrophe between thousands, point
// before the centimes, "CHF 1'234.50". The same in the assistant's text, its reasons and the order
// notice, whatever ICU data the server has.
const format = (fraction: number) =>
  new Intl.NumberFormat("fr-CH", {
    style: "currency",
    currency: "CHF",
    minimumFractionDigits: fraction,
    maximumFractionDigits: 2,
  });
const cents = format(2);
const whole = format(0);

export function chf(minor: number, options: { round?: boolean } = {}) {
  const value = minor / 100;
  const formatter = options.round && minor % 100 === 0 ? whole : cents;
  const digits = formatter
    .formatToParts(value)
    .filter((part) => part.type !== "currency" && part.type !== "literal")
    .map((part) => (part.type === "group" ? "'" : part.type === "decimal" ? "." : part.value))
    .join("");
  return `CHF ${digits}`;
}
