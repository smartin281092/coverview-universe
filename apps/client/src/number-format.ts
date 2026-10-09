/**
 * Numbers in the Wallet (9 October 2026): Intl formats them in the active locale (INTL-04), the
 * Swiss apostrophe separates the thousands and, in French, a comma marks the decimals, as in
 * 1'234,50 (fr-CH alone writes CHF amounts with a point).
 */
export function numberFormat(locale: string, options?: Intl.NumberFormatOptions) {
  const format = new Intl.NumberFormat(locale, options);
  const french = format.resolvedOptions().locale.split("-")[0] === "fr";
  return {
    format: (value: number) =>
      format
        .formatToParts(value)
        .map((part) =>
          part.type === "group" ? "'" : part.type === "decimal" && french ? "," : part.value,
        )
        .join(""),
  };
}

// An amount written next to CHF in a partner's text: plain or grouped digits, then the centimes.
const integer = String.raw`\d{1,3}(?:['’\p{Zs}]\d{3})+|\d+`;
const centimes = String.raw`[.,]\d{1,2}(?!\d)`;
const afterUnit = new RegExp(String.raw`(CHF\p{Zs}?)(${integer})(${centimes})?(?![\d'’])`, "giu");
const beforeUnit = new RegExp(
  String.raw`(?<![\d'’.,])(${integer})(${centimes})?(\p{Zs}?CHF)`,
  "giu",
);

/**
 * A partner's text as written, with its amounts in the Wallet's numbers: "CHF 185000 par cas"
 * reads "CHF 185'000 par cas", "588.50 CHF" reads "588,50 CHF". Other numbers stay untouched.
 */
export function amountsInText(text: string, locale: string) {
  const amount = (digits: string, decimals = "") =>
    numberFormat(locale, {
      minimumFractionDigits: decimals ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(Number(digits.replace(/\D/gu, "") + (decimals ? `.${decimals.slice(1)}` : "")));
  return text
    .replace(afterUnit, (_match, unit: string, digits: string, decimals?: string) =>
      unit.concat(amount(digits, decimals)),
    )
    .replace(beforeUnit, (_match, digits: string, decimals: string | undefined, unit: string) =>
      amount(digits, decimals).concat(unit),
    );
}
