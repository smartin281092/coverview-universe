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

// mulberry32: a small seeded generator, reproducible across browsers and Node.
export function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function percentile(sorted: ArrayLike<number>, probability: number) {
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const fraction = index - lower;
  const low = sorted[lower] ?? 0;
  const high = sorted[Math.min(lower + 1, sorted.length - 1)] ?? low;
  return fraction === 0 ? low : low + (high - low) * fraction;
}

type RangeId =
  | "central-low"
  | "central-mid-low"
  | "median-low"
  | "median-high"
  | "central-mid-high"
  | "central-high";
export type CapitalRange = {
  id: RangeId;
  min: number;
  max: number;
  probability: number;
  emphasis: "central" | "standard";
};
const rangeThresholds: {
  id: RangeId;
  from: number;
  to: number;
  emphasis: "central" | "standard";
}[] = [
  { id: "central-low", from: 0.1, to: 0.25, emphasis: "standard" },
  { id: "central-mid-low", from: 0.25, to: 0.4, emphasis: "standard" },
  { id: "median-low", from: 0.4, to: 0.5, emphasis: "central" },
  { id: "median-high", from: 0.5, to: 0.6, emphasis: "central" },
  { id: "central-mid-high", from: 0.6, to: 0.75, emphasis: "standard" },
  { id: "central-high", from: 0.75, to: 0.9, emphasis: "standard" },
];

export function createCapitalRanges(sorted: Float64Array) {
  const thresholds = rangeThresholds.map((range) => ({
    ...range,
    min: percentile(sorted, range.from),
    max: percentile(sorted, range.to),
  }));
  const p10 = percentile(sorted, 0.1);
  const p50 = percentile(sorted, 0.5);
  const p90 = percentile(sorted, 0.9);
  const counts = new Map<string, number>([
    ["extremeLow", 0],
    ["extremeHigh", 0],
    ...thresholds.map(({ id }) => [id, 0] as [string, number]),
  ]);
  const bump = (key: string) => counts.set(key, (counts.get(key) ?? 0) + 1);
  for (const value of sorted) {
    if (value < p10) bump("extremeLow");
    else if (value > p90) bump("extremeHigh");
    else {
      const range =
        value === p50
          ? thresholds.find(({ id }) => id === "median-high")
          : (thresholds.find(({ max }) => value < max) ?? thresholds[thresholds.length - 1]);
      if (range) bump(range.id);
    }
  }
  const total = sorted.length || 1;
  return {
    extremes: {
      low: { max: p10, probability: (counts.get("extremeLow") ?? 0) / total },
      high: { min: p90, probability: (counts.get("extremeHigh") ?? 0) / total },
    },
    central: thresholds.map(({ id, min, max, emphasis }): CapitalRange => ({
      id,
      min,
      max,
      emphasis,
      probability: (counts.get(id) ?? 0) / total,
    })),
  };
}

export type MonteCarloRequest = SimulationInput & {
  historicalProjection: number;
  simulations?: number;
  seed?: number;
  bins?: number;
};
export type MonteCarloResult = {
  simulations: number;
  observations: number;
  percentiles: {
    p5: number;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
  };
  median: number;
  probabilityAboveHistoricalProjection: number;
  probabilityBelowInvested: number;
  ranges: ReturnType<typeof createCapitalRanges>;
  histogram: { from: number; to: number; bins: number[] };
};

const MONTE_CARLO_SIMULATIONS = 100_000;
const MONTE_CARLO_SEED = 20261104;

// Historical bootstrap: every simulated year draws one of the reference returns, with replacement
// and equal probability, independently of the previous year. Same recurrence as the projection,
// written with annual factors and the annuity of twelve start-of-month deposits.
export function monteCarlo(request: MonteCarloRequest): MonteCarloResult {
  const {
    investment,
    frequency,
    years,
    initialCapital,
    simulations = MONTE_CARLO_SIMULATIONS,
    seed = MONTE_CARLO_SEED,
    bins = 36,
  } = request;
  if (!Number.isInteger(years) || years < 1 || years > HYPERION.maxYears)
    throw new Error("HYPERION_HORIZON_OUT_OF_RANGE");
  const factors = netReturns().map((value) => {
    const annual = 1 + value;
    const monthly = Math.pow(annual, 1 / 12);
    let annuity = 0;
    for (let month = 0; month < 12; month += 1) annuity = (annuity + 1) * monthly;
    return { annual, contribution: frequency === "annual" ? annual : annuity };
  });
  const contributions = Array.from({ length: years }, (_, index) =>
    reducedContribution(investment, index + 1, frequency),
  );
  const random = createRandom(seed);
  const results = new Float64Array(simulations);
  const count = factors.length;
  for (let simulation = 0; simulation < simulations; simulation += 1) {
    let capital = initialCapital;
    for (let year = 0; year < years; year += 1) {
      const factor = factors[Math.floor(random() * count)]!;
      capital = capital * factor.annual + contributions[year]! * factor.contribution;
    }
    results[simulation] = Math.round(capital);
  }
  results.sort();
  const p = (value: number) => Math.round(percentile(results, value));
  const percentiles = {
    p5: p(0.05),
    p10: p(0.1),
    p25: p(0.25),
    p50: p(0.5),
    p75: p(0.75),
    p90: p(0.9),
    p95: p(0.95),
  };
  const invested = totalInvested({ investment, frequency, years, initialCapital });
  let above = 0;
  let below = 0;
  for (const value of results) {
    if (value > request.historicalProjection) above += 1;
    if (value < invested) below += 1;
  }
  const from = percentile(results, 0.01);
  const to = Math.max(percentile(results, 0.99), from + 1);
  const histogram = new Array<number>(bins).fill(0);
  for (const value of results) {
    if (value < from || value > to) continue;
    const bin = Math.min(bins - 1, Math.floor(((value - from) / (to - from)) * bins));
    histogram[bin] = (histogram[bin] ?? 0) + 1;
  }
  return {
    simulations,
    observations: count,
    percentiles,
    median: percentiles.p50,
    probabilityAboveHistoricalProjection: above / simulations,
    probabilityBelowInvested: below / simulations,
    ranges: createCapitalRanges(results),
    histogram: { from, to, bins: histogram },
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
