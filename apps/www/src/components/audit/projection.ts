/**
 * Calculs déterministes de l’audit 3e pilier (4 novembre 2026), repris du comparateur Horizon 3 :
 * taux annualisé composé, capitalisation mensuelle avec versements en début de mois, modèle de
 * versements des assurances, reconstitution d’un capital depuis l’année de début, capital
 * nécessaire à la retraite et années de cotisation encore nécessaires. Francs en nombres
 * flottants d’illustration, jamais des montants persistés (DATA-11 ne s’applique pas ici).
 */
import { FIRST_YEAR, LAST_YEAR, type StrategyKind } from "./strategies";

export type ContributionModel = {
  kind: StrategyKind;
  /** Part retenue chaque année de contrat, à partir de la première année. */
  reduction: readonly number[];
};

/** Taux de croissance annuel composé d’une série de rendements. */
export function cagr(returns: readonly number[]): number {
  if (!returns.length) return 0;
  const growth = returns.reduce((product, rate) => product * (1 + rate), 1);
  return growth <= 0 ? -1 : Math.pow(growth, 1 / returns.length) - 1;
}

/**
 * Prime de risque mensuelle d’une assurance, telle que modélisée par Horizon 3 : 5 CHF pour
 * 100 CHF versés, 30 CHF pour 605 CHF et au-delà, linéaire entre les deux, proportionnelle en
 * dessous de 100 CHF.
 */
export function riskPremium(monthly: number): number {
  if (!Number.isFinite(monthly) || monthly <= 0) return 0;
  if (monthly < 100) return (monthly * 5) / 100;
  return 5 + 25 * Math.min(1, (monthly - 100) / 505);
}

/** Versement mensuel effectivement investi pendant une année de contrat donnée (1 = première). */
export function investedMonthly(
  model: ContributionModel,
  monthly: number,
  contractYear: number,
): number {
  if (!Number.isFinite(monthly) || monthly <= 0) return 0;
  const afterPremium =
    model.kind === "insurance" ? Math.max(0, monthly - riskPremium(monthly)) : monthly;
  const reduction = contractYear >= 1 ? (model.reduction[contractYear - 1] ?? 0) : 0;
  return afterPremium * (1 - reduction);
}

/** Facteurs d’une année : croissance du capital et croissance cumulée de douze versements en début de mois. */
export function yearFactors(annual: number): { growth: number; contributions: number } {
  const growth = 1 + annual;
  const month = Math.pow(growth, 1 / 12);
  let contributions = 0;
  for (let index = 0; index < 12; index += 1) contributions = (contributions + 1) * month;
  return { growth, contributions };
}

export type ProjectionInput = {
  monthly: number;
  initial: number;
  years: number;
  annualReturn: number;
  model: ContributionModel;
  /** Années de contrat déjà écoulées avant la projection (retenues des premières années). */
  contractYearsElapsed?: number;
};

/** Capital année par année à rendement constant ; `path[0]` est le capital initial. */
export function projectConstant(input: ProjectionInput): { final: number; path: number[] } {
  const elapsed = input.contractYearsElapsed ?? 0;
  const { growth, contributions } = yearFactors(input.annualReturn);
  const path = [input.initial];
  let capital = input.initial;
  for (let year = 1; year <= input.years; year += 1) {
    capital =
      capital * growth +
      investedMonthly(input.model, input.monthly, elapsed + year) * contributions;
    path.push(capital);
  }
  return { final: capital, path };
}

export type ReconstructedYear = {
  year: number;
  rate: number;
  /** Année sans donnée de la série : taux annualisé appliqué. */
  estimated: boolean;
  value: number;
};

/**
 * Capital reconstitué depuis l’année de début avec les rendements de la série ; les années
 * antérieures à la première observation prennent le taux annualisé, signalé. L’année en cours
 * compte comme une année complète.
 */
export function reconstructCapital(input: {
  returns: readonly number[];
  monthly: number;
  startYear: number;
  model: ContributionModel;
  untilYear?: number;
}): { capital: number; invested: number; years: ReconstructedYear[] } {
  const until = input.untilYear ?? LAST_YEAR;
  const annualised = cagr(input.returns);
  const years: ReconstructedYear[] = [];
  let capital = 0;
  let invested = 0;
  for (let year = input.startYear; year <= until; year += 1) {
    const index = year - FIRST_YEAR;
    const known = index >= 0 && index < input.returns.length ? input.returns[index] : undefined;
    const rate = known ?? annualised;
    const { growth, contributions } = yearFactors(rate);
    const monthly = investedMonthly(input.model, input.monthly, year - input.startYear + 1);
    capital = capital * growth + monthly * contributions;
    invested += input.monthly * 12;
    years.push({ year, rate, estimated: known === undefined, value: capital });
  }
  return { capital, invested, years };
}

export type NeedInput = {
  /** Revenu net mensuel actuel. */
  income: number;
  /** Part du revenu couverte par les 1er et 2e piliers (0,6 chez Horizon 3). */
  replacement: number;
  /** Années de retraite à financer (65 à 82 ans chez Horizon 3). */
  retirementYears: number;
  inflation: number;
  yearsToRetirement: number;
};

/** Capital nécessaire pour combler l’écart de revenu, en francs d’aujourd’hui puis à la retraite. */
export function neededCapital(input: NeedInput): {
  gapMonthly: number;
  today: number;
  atRetirement: number;
} {
  const gapMonthly = Math.max(0, input.income) * (1 - input.replacement);
  const today = gapMonthly * 12 * input.retirementYears;
  return {
    gapMonthly,
    today,
    atRetirement: today * Math.pow(1 + input.inflation, Math.max(0, input.yearsToRetirement)),
  };
}

export const MAX_YEARS_NEEDED = 150;

/**
 * Années de cotisation encore nécessaires, au rythme actuel et au taux donné, pour rejoindre un
 * capital cible revalorisé de l’inflation chaque année. 0 si la cible est déjà atteinte, `null`
 * si elle ne l’est pas en 150 ans.
 */
export function yearsNeeded(input: {
  capital: number;
  monthly: number;
  annualReturn: number;
  targetToday: number;
  inflation: number;
  model: ContributionModel;
  contractYearsElapsed?: number;
}): number | null {
  if (input.targetToday <= 0 || input.capital >= input.targetToday) return 0;
  const elapsed = input.contractYearsElapsed ?? 0;
  const { growth, contributions } = yearFactors(input.annualReturn);
  let capital = input.capital;
  for (let year = 1; year <= MAX_YEARS_NEEDED; year += 1) {
    capital =
      capital * growth +
      investedMonthly(input.model, input.monthly, elapsed + year) * contributions;
    if (capital >= input.targetToday * Math.pow(1 + input.inflation, year)) return year;
  }
  return null;
}

/** Percentile par interpolation linéaire d’un tableau trié croissant. */
export function percentile(sorted: ArrayLike<number>, fraction: number): number {
  if (!sorted.length) return 0;
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const weight = position - lower;
  const low = sorted[lower] ?? 0;
  const high = sorted[Math.min(lower + 1, sorted.length - 1)] ?? low;
  return weight === 0 ? low : low + (high - low) * weight;
}

type RangeId =
  | "extremes"
  | "central-low"
  | "central-mid-low"
  | "median-low"
  | "median-high"
  | "central-mid-high"
  | "central-high";
export type ScenarioRange = {
  id: RangeId;
  from: number;
  to: number;
  min: number;
  max: number;
  probability: number;
  /** Tranches des 10 % les plus bas et les plus hauts, regroupées. */
  extremes?: { lowMax: number; highMin: number; lowProbability: number; highProbability: number };
};

const centralRanges: readonly { id: RangeId; from: number; to: number }[] = [
  { id: "central-low", from: 0.1, to: 0.25 },
  { id: "central-mid-low", from: 0.25, to: 0.4 },
  { id: "median-low", from: 0.4, to: 0.5 },
  { id: "median-high", from: 0.5, to: 0.6 },
  { id: "central-mid-high", from: 0.6, to: 0.75 },
  { id: "central-high", from: 0.75, to: 0.9 },
];

/** Fourchettes de résultats de Horizon 3 : les extrêmes (sous p10 et au-delà de p90) puis six tranches centrales. */
export function scenarioRanges(sorted: ArrayLike<number>): ScenarioRange[] {
  const total = sorted.length;
  if (!total) return [];
  const bounds = centralRanges.map((range) => ({
    ...range,
    min: percentile(sorted, range.from),
    max: percentile(sorted, range.to),
  }));
  const low = percentile(sorted, 0.1);
  const median = percentile(sorted, 0.5);
  const high = percentile(sorted, 0.9);
  const counts = new Map<RangeId, number>();
  let extremeLow = 0;
  let extremeHigh = 0;
  for (let index = 0; index < total; index += 1) {
    const value = sorted[index] ?? 0;
    if (value < low) extremeLow += 1;
    else if (value > high) extremeHigh += 1;
    else {
      const bucket =
        value === median
          ? bounds.find((range) => range.id === "median-high")
          : (bounds.find((range) => value < range.max) ?? bounds[bounds.length - 1]);
      if (bucket) counts.set(bucket.id, (counts.get(bucket.id) ?? 0) + 1);
    }
  }
  return [
    {
      id: "extremes",
      from: 0,
      to: 1,
      min: sorted[0] ?? 0,
      max: sorted[total - 1] ?? 0,
      probability: (extremeLow + extremeHigh) / total,
      extremes: {
        lowMax: low,
        highMin: high,
        lowProbability: extremeLow / total,
        highProbability: extremeHigh / total,
      },
    },
    ...bounds.map((range) => ({ ...range, probability: (counts.get(range.id) ?? 0) / total })),
  ];
}

/** Indice cumulé d’une série (base 100 avant la première année). */
export function cumulativeIndex(returns: readonly number[]): number[] {
  const index = [100];
  for (const rate of returns) index.push((index[index.length - 1] ?? 100) * (1 + rate));
  return index;
}
