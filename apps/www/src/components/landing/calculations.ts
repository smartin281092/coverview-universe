/** Illustrations mathématiques, sans règle de contrat ni recommandation. */
export const savingsDefaults = { monthly: 300, years: 30, rateA: 2, rateB: 16 } as const;

export function futureCapital(monthly: number, years: number, annualRate: number): number {
  if (
    ![monthly, years, annualRate].every(Number.isFinite) ||
    monthly < 0 ||
    years < 0 ||
    annualRate <= -1
  )
    return 0;
  const periods = Math.round(years * 12);
  if (annualRate === 0) return monthly * periods;
  const rate = Math.expm1(Math.log1p(annualRate) / 12);
  return (monthly * Math.expm1(periods * Math.log1p(rate))) / rate;
}
export function purchasingPower(capital: number, years: number, inflation: number): number {
  if (
    ![capital, years, inflation].every(Number.isFinite) ||
    capital < 0 ||
    years < 0 ||
    inflation <= -1
  )
    return 0;
  return capital / Math.pow(1 + inflation, years);
}
export const formatNumber = (value: number, digits = 0) =>
  new Intl.NumberFormat("fr-CH", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);

export function chartPath(monthly: number, years: number, rate: number, max: number): string {
  return Array.from({ length: 61 }, (_, i) => {
    const x = 16 + (i / 60) * 688;
    const y = 236 - (futureCapital(monthly, (years * i) / 60, rate) / Math.max(max, 1)) * 206;
    return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}
