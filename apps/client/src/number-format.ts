/**
 * Numbers in the Wallet (9 October 2026): Intl formats them in the active locale (INTL-04), and
 * the Swiss apostrophe separates the thousands, as in 1'234,50.
 */
export function numberFormat(locale: string, options?: Intl.NumberFormatOptions) {
  const format = new Intl.NumberFormat(locale, options);
  return {
    format: (value: number) =>
      format
        .formatToParts(value)
        .map((part) => (part.type === "group" ? "'" : part.value))
        .join(""),
  };
}
