// Monte Carlo of the Hyperion page, apart from the core model so that the hero island does not
// load it: the simulator and its worker do (4 November 2026). Same port of horizon3's engine.
import {
  HYPERION,
  netReturns,
  reducedContribution,
  totalInvested,
  type SimulationInput,
} from "./hyperion-model";

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
