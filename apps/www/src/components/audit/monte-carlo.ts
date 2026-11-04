/**
 * Monte Carlo par bootstrap historique (méthode du comparateur Horizon 3) : chaque année future
 * de chaque trajectoire tire avec remise un rendement annuel de la série, converti en taux
 * mensuel ; versements en début de mois. Générateur pseudo-aléatoire à graine fixe : les mêmes
 * réponses donnent les mêmes chiffres. Pur, exécuté dans un Web Worker par l’îlot.
 */
import {
  investedMonthly,
  percentile,
  scenarioRanges,
  yearFactors,
  type ContributionModel,
  type ScenarioRange,
} from "./projection";

const DEFAULT_SIMULATIONS = 100_000;
/** Trajectoires conservées année par année pour l’éventail des percentiles. */
const YEARLY_SAMPLE = 10_000;

export type SimulationInput = {
  returns: readonly number[];
  monthly: number;
  initial: number;
  years: number;
  model: ContributionModel;
  contractYearsElapsed?: number;
  simulations?: number;
  seed?: number;
  /** Capital cible dont la fréquence d’atteinte est mesurée. */
  target?: number | null;
};

type YearlyPercentiles = {
  year: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
};

export type SimulationResult = {
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
  ranges: ScenarioRange[];
  probabilityAtOrAbove: number | null;
  yearly: YearlyPercentiles[];
  /** Total des versements bruts sur l’horizon. */
  invested: number;
};

/** mulberry32 : rapide, déterministe, suffisant pour un tirage uniforme d’indices. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Graine stable dérivée d’une chaîne (FNV-1a). */
export function seedFrom(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function simulate(input: SimulationInput): SimulationResult {
  const simulations = Math.max(1, Math.floor(input.simulations ?? DEFAULT_SIMULATIONS));
  const observations = input.returns.filter((rate) => Number.isFinite(rate) && rate > -1);
  const years = Math.max(0, Math.floor(input.years));
  const elapsed = input.contractYearsElapsed ?? 0;
  const factors = observations.map((rate) => yearFactors(rate));
  const invested = Array.from({ length: years }, (_, index) =>
    investedMonthly(input.model, input.monthly, elapsed + index + 1),
  );
  const random = createRandom(input.seed ?? 1);
  const finals = new Float64Array(simulations);
  const stride = Math.max(1, Math.floor(simulations / YEARLY_SAMPLE));
  const sampled = Math.ceil(simulations / stride);
  const snapshots = Array.from({ length: years }, () => new Float64Array(sampled));
  const count = factors.length;
  for (let trajectory = 0; trajectory < simulations; trajectory += 1) {
    let capital = input.initial;
    const keep = trajectory % stride === 0;
    const slot = trajectory / stride;
    for (let year = 0; year < years; year += 1) {
      const factor = factors[count > 1 ? Math.floor(random() * count) : 0];
      if (!factor) break;
      capital = capital * factor.growth + (invested[year] ?? 0) * factor.contributions;
      if (keep) {
        const snapshot = snapshots[year];
        if (snapshot) snapshot[slot] = capital;
      }
    }
    finals[trajectory] = capital;
  }
  finals.sort();
  const at = (fraction: number) => percentile(finals, fraction);
  const yearly: YearlyPercentiles[] = [
    {
      year: 0,
      p10: input.initial,
      p25: input.initial,
      p50: input.initial,
      p75: input.initial,
      p90: input.initial,
    },
    ...snapshots.map((snapshot, index) => {
      snapshot.sort();
      return {
        year: index + 1,
        p10: percentile(snapshot, 0.1),
        p25: percentile(snapshot, 0.25),
        p50: percentile(snapshot, 0.5),
        p75: percentile(snapshot, 0.75),
        p90: percentile(snapshot, 0.9),
      };
    }),
  ];
  const target = input.target;
  let reached = 0;
  if (target !== null && target !== undefined && Number.isFinite(target))
    for (let index = 0; index < simulations; index += 1)
      if ((finals[index] ?? 0) >= target) reached += 1;
  return {
    simulations,
    observations: observations.length,
    percentiles: {
      p5: at(0.05),
      p10: at(0.1),
      p25: at(0.25),
      p50: at(0.5),
      p75: at(0.75),
      p90: at(0.9),
      p95: at(0.95),
    },
    ranges: scenarioRanges(finals),
    probabilityAtOrAbove:
      target !== null && target !== undefined && Number.isFinite(target)
        ? reached / simulations
        : null,
    yearly,
    invested: input.monthly * 12 * years,
  };
}

/** Messages entre l’îlot et le worker. */
export type SimulationJob = { key: string; input: SimulationInput };
export type WorkerRequest = { id: number; jobs: SimulationJob[] };
export type WorkerResponse =
  | { id: number; key: string; result: SimulationResult }
  | { id: number; done: true }
  | { id: number; error: string };
