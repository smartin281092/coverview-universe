// Hyperion (Liechtenstein Life): the data and the calculation engine of the product page,
// ported from the horizon3.finance comparator (repository smartin281092/horizon3, commit b96fad6,
// files client/src/data/thirdPillarProducts.js, returnHistory.js and lib/monteCarlo.js) so that
// both sites show the same figures for the same parameters. Pure functions, no I/O.

type ReturnKind = "reported" | "current-year";
export type HistoryPoint = {
  year: number;
  // Return as communicated, before the modelled annual fee.
  grossReturn: number;
  kind: ReturnKind;
  // "legacy": initial comparator data, not independently verified; "communicated": figure given
  // by the person in charge of the comparator for the current year (audit 2026-10-13).
  source: "legacy" | "communicated";
};

export const HYPERION = {
  productId: 0,
  strategyId: "prosperity",
  name: "Hyperion",
  company: "Liechtenstein Life",
  type: "insurance",
  // Annual fee applied once to each return: r_net = (1 + r)(1 − fee) − 1.
  annualFee: 0.0221,
  // Share of each contribution withheld during the first years (acquisition and management
  // costs of the contract, modelled as in the comparator).
  reductionYears: 5,
  reductionRate: 0.67,
  // Monthly risk premium, linear from 5 CHF at 100 CHF to 30 CHF at 605 CHF per month.
  premiumScale: {
    minimumContribution: 100,
    maximumContribution: 605,
    minimumCost: 5,
    maximumCost: 30,
  },
  retirementAge: 65,
  maxYears: 45,
  // 3a cap 2026 for people affiliated to a pension fund (OFAS): 7'258 CHF a year.
  annualCap: 7258,
  history: [
    { year: 2016, grossReturn: 0.1225, kind: "reported", source: "legacy" },
    { year: 2017, grossReturn: 0.1716, kind: "reported", source: "legacy" },
    { year: 2018, grossReturn: -0.0436, kind: "reported", source: "legacy" },
    { year: 2019, grossReturn: 0.4176, kind: "reported", source: "legacy" },
    { year: 2020, grossReturn: 0.4384, kind: "reported", source: "legacy" },
    { year: 2021, grossReturn: 0.3162, kind: "reported", source: "legacy" },
    { year: 2022, grossReturn: -0.3082, kind: "reported", source: "legacy" },
    { year: 2023, grossReturn: 0.4582, kind: "reported", source: "legacy" },
    { year: 2024, grossReturn: 0.3268, kind: "reported", source: "legacy" },
    { year: 2025, grossReturn: 0.2647, kind: "reported", source: "legacy" },
    { year: 2026, grossReturn: 0.3821, kind: "current-year", source: "communicated" },
  ] as readonly HistoryPoint[],
  historyReviewedAt: "2026-10-13",
} as const;

export type Frequency = "monthly" | "annual";
export type SimulationInput = {
  // Contribution per period, in francs.
  investment: number;
  frequency: Frequency;
  years: number;
  initialCapital: number;
};

export const netReturn = (grossReturn: number, annualFee = HYPERION.annualFee) =>
  (1 + grossReturn) * (1 - annualFee) - 1;

// Geometric mean of a series of annual returns: expm1(mean(log1p(r))).
export function annualisedReturn(returns: readonly number[]) {
  if (!returns.length || returns.some((value) => !Number.isFinite(value) || value <= -1))
    throw new Error("HYPERION_RETURN_SERIES_INVALID");
  return Math.expm1(returns.reduce((sum, value) => sum + Math.log1p(value), 0) / returns.length);
}

export const cumulativeGrowth = (returns: readonly number[]) =>
  returns.reduce((factor, value) => factor * (1 + value), 1);

export const grossReturns = () => HYPERION.history.map((point) => point.grossReturn);
export const netReturns = () => HYPERION.history.map((point) => netReturn(point.grossReturn));
export const historyYears = (to: number) =>
  HYPERION.history.filter((point) => point.year <= to).map((point) => point.grossReturn);

export function insuranceMonthlyCost(monthlyContribution: number) {
  const { minimumContribution, maximumContribution, minimumCost, maximumCost } =
    HYPERION.premiumScale;
  if (!Number.isFinite(monthlyContribution) || monthlyContribution <= 0) return 0;
  if (monthlyContribution < minimumContribution)
    return (monthlyContribution * minimumCost) / minimumContribution;
  return (
    minimumCost +
    (maximumCost - minimumCost) *
      Math.min(
        1,
        (monthlyContribution - minimumContribution) / (maximumContribution - minimumContribution),
      )
  );
}

// Contribution invested after the risk premium; the annual mode pays twelve premiums computed on
// the equivalent monthly contribution.
export function effectiveContribution(investment: number, frequency: Frequency) {
  const periods = frequency === "annual" ? 12 : 1;
  return Math.max(0, investment - insuranceMonthlyCost(investment / periods) * periods);
}

const reductionRateForYear = (year: number) =>
  year > HYPERION.reductionYears ? 0 : HYPERION.reductionRate;

export const reducedContribution = (investment: number, year: number, frequency: Frequency) =>
  effectiveContribution(investment, frequency) * (1 - reductionRateForYear(year));

export function yearsUntilRetirement(birthYear: number, currentYear: number) {
  if (!Number.isInteger(birthYear) || !Number.isInteger(currentYear)) return 0;
  return Math.max(
    0,
    Math.min(HYPERION.maxYears, HYPERION.retirementAge - (currentYear - birthYear)),
  );
}

export const totalInvested = ({ investment, frequency, years, initialCapital }: SimulationInput) =>
  initialCapital + investment * years * (frequency === "annual" ? 1 : 12);

type ProjectionPoint = { year: number; invested: number; capital: number };
export type Projection = {
  annualRate: number;
  points: ProjectionPoint[];
  finalCapital: number;
  totalInvested: number;
};

// Deterministic projection at one constant annual rate, deposits at the start of each month.
export function historicalProjection(input: SimulationInput, annualRate: number): Projection {
  const { investment, frequency, years, initialCapital } = input;
  const points: ProjectionPoint[] = [];
  let capital = initialCapital;
  let invested = initialCapital;
  if (frequency === "annual") {
    for (let year = 1; year <= years; year += 1) {
      invested += investment;
      capital = (capital + reducedContribution(investment, year, frequency)) * (1 + annualRate);
      points.push({ year, invested: Math.round(invested), capital: Math.round(capital) });
    }
  } else {
    const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;
    for (let month = 1; month <= years * 12; month += 1) {
      const year = Math.ceil(month / 12);
      invested += investment;
      capital = (capital + reducedContribution(investment, year, frequency)) * (1 + monthlyRate);
      if (month % 12 === 0)
        points.push({ year, invested: Math.round(invested), capital: Math.round(capital) });
    }
  }
  return {
    annualRate,
    points,
    finalCapital: Math.round(capital),
    totalInvested: Math.round(invested),
  };
}

// Swiss writing shared with the apps: apostrophe between thousands, comma before decimals.
export const formatFrancs = (value: number, digits = 0) => {
  const fixed = Math.abs(value).toFixed(digits);
  const [whole, decimals] = fixed.split(".");
  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/gu, "’");
  return `${value < 0 ? "−" : ""}${grouped}${decimals ? `,${decimals}` : ""}`;
};
export const formatPercent = (ratio: number, digits = 1) =>
  `${ratio < 0 ? "−" : ""}${formatFrancs(Math.abs(ratio) * 100, digits)} %`;
export const formatSignedPercent = (ratio: number, digits = 2) =>
  `${ratio >= 0 ? "+" : "−"}${formatFrancs(Math.abs(ratio) * 100, digits)} %`;
export const formatProbability = (probability: number) =>
  probability === 0 ? "0 %" : probability < 0.001 ? "<0,1 %" : formatPercent(probability, 1);
