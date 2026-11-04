/**
 * Orchestration des calculs de l’audit (4 novembre 2026) : des réponses aux entrées communes,
 * projections déterministes, puis 100 000 simulations par solution dans un Web Worker (ou dans
 * la page si les workers manquent). Tout reste dans le navigateur.
 */
import {
  ageOf,
  contractYearsElapsed,
  isComplete,
  ownSolution,
  solutionFromStrategy,
  yearsToRetirement,
  type Answers,
  type Solution,
} from "./audit-state";
import {
  seedFrom,
  type SimulationJob,
  type SimulationResult,
  type WorkerRequest,
  type WorkerResponse,
} from "./monte-carlo";
import { simulate } from "./monte-carlo";
import {
  cagr,
  neededCapital,
  projectConstant,
  reconstructCapital,
  yearsNeeded,
  type ContributionModel,
} from "./projection";
import { HYPERION_ID, strategyById } from "./strategies";

const DEFAULT_COMPARISONS = ["viac-global-100", "finpension-global-100"];
export const MAX_COMPARISONS = 6;

export type AuditInputs = {
  answers: Answers;
  own: Solution;
  monthly: number;
  initial: number;
  initialDeclared: boolean;
  reconstructed: ReturnType<typeof reconstructCapital> | null;
  age: number;
  yearsToRetirement: number;
  pastRetirement: boolean;
  contractYearsElapsed: number;
  need: ReturnType<typeof neededCapital>;
  /** La sienne d’abord, puis Hyperion, puis les solutions comparées. */
  solutions: Solution[];
  seed: number;
};

const modelOf = (solution: Solution): ContributionModel => ({
  kind: solution.kind,
  reduction: solution.reduction,
});

function comparedIds(answers: Answers, ownStrategyId: string): string[] {
  const chosen = answers.compare.length ? answers.compare : DEFAULT_COMPARISONS;
  const ids = [HYPERION_ID, ...chosen].filter(
    (id, index, all) => id !== ownStrategyId && all.indexOf(id) === index && strategyById(id),
  );
  return ids.slice(0, MAX_COMPARISONS);
}

export function buildInputs(answers: Answers): AuditInputs | null {
  if (!isComplete(answers)) return null;
  const own = ownSolution(answers);
  if (!own || answers.monthly === null || answers.income === null || answers.birthYear === null)
    return null;
  const elapsed = contractYearsElapsed(answers);
  const reconstructed =
    answers.has && answers.capital === null && answers.startYear !== null
      ? reconstructCapital({
          returns: own.returns,
          monthly: answers.monthly,
          startYear: answers.startYear,
          model: modelOf(own),
        })
      : null;
  const initial = answers.capital ?? reconstructed?.capital ?? 0;
  const left = yearsToRetirement(answers);
  const years = Math.max(1, left);
  const need = neededCapital({
    income: answers.income,
    replacement: answers.replacement,
    retirementYears: answers.retirementYears,
    inflation: answers.inflation,
    yearsToRetirement: years,
  });
  const solutions = [
    own,
    ...comparedIds(answers, own.strategyId).map((id) => solutionFromStrategy(strategyById(id)!)),
  ];
  return {
    answers,
    own,
    monthly: answers.monthly,
    initial,
    initialDeclared: answers.capital !== null,
    reconstructed,
    age: ageOf(answers.birthYear),
    yearsToRetirement: years,
    pastRetirement: left <= 0,
    contractYearsElapsed: elapsed,
    need,
    solutions,
    seed: seedFrom(
      JSON.stringify([answers.monthly, initial, years, answers.income, answers.inflation]),
    ),
  };
}

export type Outcome = {
  solution: Solution;
  cagr: number;
  deterministic: { final: number; path: number[] };
  yearsNeeded: number | null;
  simulation: SimulationResult | null;
};
export type AuditReport = { inputs: AuditInputs; outcomes: Outcome[] };

export function deterministicOutcome(inputs: AuditInputs, solution: Solution): Outcome {
  const rate = cagr(solution.returns);
  const model = modelOf(solution);
  // Les retenues des premières années ne s’appliquent qu’au contrat déjà en cours ; une autre
  // solution commencerait aujourd’hui avec ses propres retenues.
  const elapsed = solution.id === "own" ? inputs.contractYearsElapsed : 0;
  return {
    solution,
    cagr: rate,
    deterministic: projectConstant({
      monthly: inputs.monthly,
      initial: inputs.initial,
      years: inputs.yearsToRetirement,
      annualReturn: rate,
      model,
      contractYearsElapsed: elapsed,
    }),
    yearsNeeded: yearsNeeded({
      capital: inputs.initial,
      monthly: inputs.monthly,
      annualReturn: rate,
      targetToday: inputs.need.today,
      inflation: inputs.answers.inflation,
      model,
      contractYearsElapsed: elapsed,
    }),
    simulation: null,
  };
}

export function simulationJobs(inputs: AuditInputs): SimulationJob[] {
  return inputs.solutions.map((solution) => ({
    key: solution.id,
    input: {
      returns: solution.returns,
      monthly: inputs.monthly,
      initial: inputs.initial,
      years: inputs.yearsToRetirement,
      model: modelOf(solution),
      contractYearsElapsed: solution.id === "own" ? inputs.contractYearsElapsed : 0,
      seed: inputs.seed,
      target: inputs.need.atRetirement,
    },
  }));
}

let requestId = 0;

/** Lance les simulations ; renvoie une fonction d’annulation. */
export function runSimulations(
  jobs: SimulationJob[],
  handlers: {
    onResult: (key: string, result: SimulationResult) => void;
    onDone: () => void;
    onError: (message: string) => void;
  },
): () => void {
  const id = ++requestId;
  let cancelled = false;
  if (typeof Worker === "undefined") {
    // Sans worker : une solution par tour de boucle d’événements pour laisser respirer la page.
    const queue = [...jobs];
    const next = () => {
      if (cancelled) return;
      const job = queue.shift();
      if (!job) return handlers.onDone();
      try {
        handlers.onResult(job.key, simulate(job.input));
      } catch (error) {
        handlers.onError(error instanceof Error ? error.message : "simulation");
        return;
      }
      window.setTimeout(next, 0);
    };
    window.setTimeout(next, 0);
    return () => {
      cancelled = true;
    };
  }
  const worker = new Worker(new URL("./monte-carlo.worker.ts", import.meta.url), {
    type: "module",
  });
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const message = event.data;
    if (cancelled || message.id !== id) return;
    if ("error" in message) handlers.onError(message.error);
    else if ("done" in message) handlers.onDone();
    else handlers.onResult(message.key, message.result);
  };
  worker.onerror = () => {
    if (!cancelled) handlers.onError("worker");
  };
  worker.postMessage({ id, jobs } satisfies WorkerRequest);
  return () => {
    cancelled = true;
    worker.terminate();
  };
}
