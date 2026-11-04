import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { auditCopy as copy } from "../../content/fr/audit";
import {
  buildInputs,
  deterministicOutcome,
  runSimulations,
  simulationJobs,
  type AuditReport,
} from "./audit-compute";
import {
  decodeAnswers,
  emptyAnswers,
  encodeAnswers,
  isComplete,
  type Answers,
} from "./audit-state";
import { AuditForm } from "./AuditForm";
import { AuditLoading, loadingKeys, type LoadingKey, type LoadingState } from "./AuditLoading";

const AuditResults = lazy(() => import("./AuditResults"));

type View = "form" | "loading" | "results";
const MINIMUM_LOADING_MS = 2600;

const initialLoading = (): LoadingState =>
  Object.fromEntries(loadingKeys.map((key) => [key, "pending"])) as LoadingState;

/**
 * L’audit 3e pilier (4 novembre 2026) : questionnaire, calcul dans le navigateur, résultats.
 * Les réponses vivent dans l’URL ; rien n’est envoyé ni conservé ailleurs.
 */
export default function PillarAudit({ walletUrl }: { walletUrl: string }) {
  const [view, setView] = useState<View>("form");
  const [answers, setAnswers] = useState<Answers>(emptyAnswers);
  const [skipUpload, setSkipUpload] = useState(false);
  const [loading, setLoading] = useState<LoadingState>(initialLoading);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancel = useRef<() => void>(() => {});
  const timers = useRef<number[]>([]);

  const clear = () => {
    cancel.current();
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];
  };

  const writeUrl = (next: Answers, replace: boolean) => {
    const params = encodeAnswers(next);
    if (skipUpload) params.set("contrat", "non");
    const query = params.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
    if (replace) window.history.replaceState(window.history.state, "", url);
    else window.history.pushState(window.history.state, "", url);
  };

  const compute = useCallback((next: Answers, options: { silent: boolean }) => {
    clear();
    const inputs = buildInputs(next);
    if (!inputs) return;
    setError(null);
    const started = performance.now();
    const outcomes = inputs.solutions.map((solution) => deterministicOutcome(inputs, solution));
    if (!options.silent) {
      setView("loading");
      setLoading(initialLoading());
      window.scrollTo({ top: 0, behavior: "auto" });
    } else setBusy(true);
    const mark = (key: LoadingKey, status: LoadingState[LoadingKey]) =>
      setLoading((state) => ({ ...state, [key]: status }));
    const stage = (key: LoadingKey, delay: number, nextKey?: LoadingKey) =>
      timers.current.push(
        window.setTimeout(() => {
          mark(key, "done");
          if (nextKey) mark(nextKey, "active");
        }, delay),
      );
    mark("situation", "active");
    stage("situation", 350, "capital");
    stage("capital", 800, "need");
    stage("need", 1250, "own");
    let received = 0;
    cancel.current = runSimulations(simulationJobs(inputs), {
      onResult: (key, result) => {
        const outcome = outcomes.find((item) => item.solution.id === key);
        if (outcome) outcome.simulation = result;
        received += 1;
        if (key === "own") {
          mark("own", "done");
          mark("others", "active");
        }
      },
      onDone: () => {
        mark("others", "done");
        mark("yearly", "active");
        const finish = () => {
          mark("yearly", "done");
          mark("layout", "done");
          setReport({ inputs, outcomes });
          setBusy(false);
          setView("results");
        };
        const elapsed = performance.now() - started;
        const wait = options.silent ? 0 : Math.max(0, MINIMUM_LOADING_MS - elapsed);
        timers.current.push(
          window.setTimeout(() => {
            mark("yearly", "done");
            mark("layout", "active");
            timers.current.push(window.setTimeout(finish, options.silent ? 0 : 320));
          }, wait),
        );
        if (received === 0) setError(copy.errors.worker);
      },
      onError: () => {
        setBusy(false);
        setError(copy.errors.worker);
        setView(options.silent ? "results" : "form");
      },
    });
  }, []);

  // Au chargement : des réponses complètes dans l’URL mènent directement au calcul.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const decoded = decodeAnswers(params);
    const skip = params.get("contrat") === "non";
    setSkipUpload(skip);
    setAnswers(decoded);
    if (isComplete(decoded)) compute(decoded, { silent: false });
    return clear;
  }, [compute]);

  const complete = (next: Answers) => {
    setAnswers(next);
    writeUrl(next, false);
    compute(next, { silent: false });
  };

  const revise = (next: Answers) => {
    setAnswers(next);
    writeUrl(next, true);
    compute(next, { silent: true });
  };

  const restart = () => {
    clear();
    setBusy(false);
    setView("form");
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  if (view === "loading") return <AuditLoading state={loading} />;
  if (view === "results" && report)
    return (
      <Suspense fallback={<AuditLoading state={loading} />}>
        <AuditResults
          report={report}
          answers={answers}
          busy={busy}
          error={error}
          walletUrl={walletUrl}
          onRevise={revise}
          onRestart={restart}
        />
      </Suspense>
    );
  return (
    <>
      {error && (
        <p className="audit-error audit-error-banner" role="alert">
          {error}
        </p>
      )}
      <AuditForm
        answers={answers}
        skipUpload={skipUpload}
        onChange={setAnswers}
        onComplete={complete}
      />
    </>
  );
}
