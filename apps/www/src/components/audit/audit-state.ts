/**
 * Réponses de l’audit et leur représentation dans l’URL (4 novembre 2026) : un lien de résultats
 * se recharge et se partage (FRONT-11). Aucune réponse n’est conservée ailleurs que dans la page.
 */
import {
  ACCOUNT_ID,
  HYPERION_ID,
  INSURANCE_REDUCTION,
  LAST_YEAR,
  profileIds,
  profileStrategyId,
  providerById,
  strategyById,
  type ProfileId,
  type Strategy,
  type StrategyKind,
  type YearNature,
} from "./strategies";

export type Answers = {
  has: boolean | null;
  provider: string | null;
  profile: ProfileId | null;
  /** Stratégie choisie explicitement dans les résultats ; sinon celle du prestataire ou du profil. */
  strategy: string | null;
  monthly: number | null;
  startYear: number | null;
  /** Capital actuel déclaré (3e pilier) ou épargne de départ (sans 3e pilier) ; null = à estimer / aucune. */
  capital: number | null;
  income: number | null;
  birthYear: number | null;
  retirementAge: number;
  replacement: number;
  retirementYears: number;
  inflation: number;
  /** Solutions comparées en plus de la sienne. */
  compare: string[];
};

const DEFAULT_ASSUMPTIONS = {
  retirementAge: 65,
  replacement: 0.6,
  retirementYears: 17,
  inflation: 0.04,
} as const;

export const emptyAnswers = (): Answers => ({
  has: null,
  provider: null,
  profile: null,
  strategy: null,
  monthly: null,
  startYear: null,
  capital: null,
  income: null,
  birthYear: null,
  ...DEFAULT_ASSUMPTIONS,
  compare: [],
});

export const LIMITS = {
  monthly: { min: 1, max: 20000 },
  startYear: { min: 1980, max: LAST_YEAR },
  capital: { min: 0, max: 5_000_000 },
  income: { min: 1000, max: 100000 },
  birthYear: { min: LAST_YEAR - 85, max: LAST_YEAR - 18 },
  retirementAge: { min: 58, max: 70 },
} as const;

const number = (value: string | null, min: number, max: number, integer = false) => {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return integer ? Math.round(parsed) : parsed;
};

export function encodeAnswers(answers: Answers): URLSearchParams {
  const params = new URLSearchParams();
  if (answers.has !== null) params.set("h", answers.has ? "1" : "0");
  if (answers.provider) params.set("p", answers.provider);
  if (answers.profile) params.set("pf", answers.profile);
  if (answers.strategy) params.set("s", answers.strategy);
  if (answers.monthly !== null) params.set("m", String(answers.monthly));
  if (answers.startYear !== null) params.set("y", String(answers.startYear));
  if (answers.capital !== null) params.set("k", String(answers.capital));
  if (answers.income !== null) params.set("i", String(answers.income));
  if (answers.birthYear !== null) params.set("b", String(answers.birthYear));
  if (answers.retirementAge !== DEFAULT_ASSUMPTIONS.retirementAge)
    params.set("ra", String(answers.retirementAge));
  if (answers.replacement !== DEFAULT_ASSUMPTIONS.replacement)
    params.set("rp", String(Math.round(answers.replacement * 100)));
  if (answers.retirementYears !== DEFAULT_ASSUMPTIONS.retirementYears)
    params.set("ry", String(answers.retirementYears));
  if (answers.inflation !== DEFAULT_ASSUMPTIONS.inflation)
    params.set("inf", String(Math.round(answers.inflation * 100)));
  if (answers.compare.length) params.set("cmp", answers.compare.join(","));
  return params;
}

export function decodeAnswers(params: URLSearchParams): Answers {
  const answers = emptyAnswers();
  const has = params.get("h");
  if (has === "1") answers.has = true;
  else if (has === "0") answers.has = false;
  const provider = params.get("p");
  if (provider && providerById(provider)) answers.provider = provider;
  const profile = params.get("pf");
  if (profile && (profileIds as readonly string[]).includes(profile))
    answers.profile = profile as ProfileId;
  const strategy = params.get("s");
  if (strategy && strategyById(strategy)) answers.strategy = strategy;
  answers.monthly = number(params.get("m"), LIMITS.monthly.min, LIMITS.monthly.max);
  answers.startYear = number(params.get("y"), LIMITS.startYear.min, LIMITS.startYear.max, true);
  answers.capital = number(params.get("k"), LIMITS.capital.min, LIMITS.capital.max);
  answers.income = number(params.get("i"), LIMITS.income.min, LIMITS.income.max);
  answers.birthYear = number(params.get("b"), LIMITS.birthYear.min, LIMITS.birthYear.max, true);
  answers.retirementAge =
    number(params.get("ra"), LIMITS.retirementAge.min, LIMITS.retirementAge.max, true) ??
    DEFAULT_ASSUMPTIONS.retirementAge;
  const replacement = number(params.get("rp"), 0, 100, true);
  if (replacement !== null) answers.replacement = replacement / 100;
  answers.retirementYears =
    number(params.get("ry"), 1, 40, true) ?? DEFAULT_ASSUMPTIONS.retirementYears;
  const inflation = number(params.get("inf"), 0, 15, true);
  if (inflation !== null) answers.inflation = inflation / 100;
  answers.compare = (params.get("cmp") ?? "")
    .split(",")
    .filter((id) => id && strategyById(id))
    .slice(0, 6);
  return answers;
}

/** Les réponses suffisent-elles à calculer l’audit ? */
export function isComplete(answers: Answers): boolean {
  if (answers.has === null || answers.monthly === null || answers.income === null) return false;
  if (answers.birthYear === null) return false;
  if (!answers.has) return true;
  return answers.startYear !== null && resolveStrategyId(answers) !== null;
}

/** Solution retenue pour la personne : une série, un type et un modèle de versements. */
export type Solution = {
  id: string;
  strategyId: string;
  label: string;
  provider: string;
  kind: StrategyKind;
  returns: readonly number[];
  natures: readonly YearNature[];
  reduction: readonly number[];
  /** Profil de placement dont la série est une approximation. */
  profile: ProfileId | null;
  coverview: boolean;
};

export function resolveStrategyId(answers: Answers): string | null {
  if (!answers.has) return ACCOUNT_ID;
  if (answers.strategy) return answers.strategy;
  const provider = answers.provider ? providerById(answers.provider) : undefined;
  if (provider?.strategyId) return provider.strategyId;
  if (provider && answers.profile) return profileStrategyId(answers.profile, provider.kind);
  return null;
}

export function solutionFromStrategy(strategy: Strategy): Solution {
  return {
    id: strategy.id,
    strategyId: strategy.id,
    label: strategy.name,
    provider: strategy.provider,
    kind: strategy.kind,
    returns: strategy.returns,
    natures: strategy.natures,
    reduction: strategy.reduction,
    profile: null,
    coverview: Boolean(strategy.coverview),
  };
}

/** La solution de la personne : la stratégie du prestataire, ou une série de référence pour son profil. */
export function ownSolution(answers: Answers): Solution | null {
  const strategyId = resolveStrategyId(answers);
  const strategy = strategyId ? strategyById(strategyId) : undefined;
  if (!strategy) return null;
  const provider = answers.provider ? providerById(answers.provider) : undefined;
  const base = solutionFromStrategy(strategy);
  if (!answers.has) return { ...base, id: "own", provider: "" };
  const explicit = answers.strategy !== null;
  const reference = provider?.strategyId === strategy.id;
  if (explicit || reference || !provider) return { ...base, id: "own" };
  // Série empruntée pour un profil : le type et les retenues sont ceux du prestataire.
  const hyperion = answers.profile === "hyperion" && strategy.id === HYPERION_ID;
  return {
    ...base,
    id: "own",
    provider: provider.label,
    kind: hyperion ? strategy.kind : provider.kind,
    reduction: hyperion
      ? strategy.reduction
      : provider.kind === "insurance"
        ? INSURANCE_REDUCTION
        : [],
    profile: answers.profile,
    coverview: hyperion,
  };
}

/** Années de contrat déjà écoulées, l’année en cours comptant comme une année complète. */
export const contractYearsElapsed = (answers: Answers) =>
  answers.has && answers.startYear !== null ? Math.max(0, LAST_YEAR - answers.startYear + 1) : 0;

export const ageOf = (birthYear: number) => LAST_YEAR - birthYear;
export const yearsToRetirement = (answers: Answers) =>
  answers.birthYear === null ? 0 : answers.retirementAge - ageOf(answers.birthYear);
