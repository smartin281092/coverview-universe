import { HealthGradient } from "./HealthGradient";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  createRecommendationClient,
  createLatestRecommendationRequest,
  type RecommendationAnswer,
  type RecommendationInput,
  type RecommendationQuestion,
  type RecommendationResult,
} from "@coverview/api-client/health-recommendation";
import type { HealthCompareInput } from "@coverview/api-client/health-insurance";
import { healthCompareInputSchema } from "@coverview/api-client/health-insurance";
import { recommendationCopy as copy } from "../../content/fr/health-recommendation";
import { HealthDialog } from "./HealthDialog";
import { HealthIcon } from "./HealthIcon";
export type HealthGuideSnapshot = { result: RecommendationResult | null; busy: boolean };

function AnswerCard({
  question,
  answer,
  note,
  onNote,
  onAnswer,
}: {
  question: RecommendationQuestion;
  answer?: RecommendationAnswer | undefined;
  note: string;
  onNote: (value: string) => void;
  onAnswer: (answer: RecommendationAnswer) => void;
}) {
  const [selected, setSelected] = useState<string[]>(answer?.values ?? []);
  const [amount, setAmount] = useState(
    answer?.amountMinor === undefined ? "" : String(answer.amountMinor / 100),
  );
  const [upper, setUpper] = useState(
    answer?.upperMinor == null ? "" : String(answer.upperMinor / 100),
  );
  const submit = (values: string[]) => {
    const status = values.includes("unknown")
      ? "unknown"
      : values.includes("declined")
        ? "declined"
        : "answered";
    onAnswer({
      version: 2,
      status,
      values: status === "answered" ? values : [],
      ...(status === "answered" && values.includes("exact")
        ? {
            amountMinor: Math.round(Number(amount) * 100),
            ...(question.amount === "care" && upper !== ""
              ? { upperMinor: Math.round(Number(upper) * 100) }
              : {}),
          }
        : {}),
    });
  };
  const choose = (value: string) => {
    if (!question.multiple) {
      setSelected([value]);
      if (value !== "exact") submit([value]);
      return;
    }
    const option = question.options.find((item) => item.value === value)!;
    setSelected((current) =>
      option.exclusive
        ? [value]
        : current.includes(value)
          ? current.filter((x) => x !== value)
          : [
              ...current.filter(
                (x) => !question.options.find((item) => item.value === x)?.exclusive,
              ),
              value,
            ],
    );
  };
  const exact = selected.includes("exact");
  const validAmount =
    amount !== "" &&
    Number.isFinite(Number(amount)) &&
    Number(amount) >= 0 &&
    Number(amount) <= 1000000 &&
    (upper === "" || Number(upper) >= Number(amount));
  return (
    <>
      <h2>{question.title}</h2>
      <p className="hi-small">{question.help}</p>
      {question.multiple && <p className="hi-small">{copy.multiple}</p>}
      {question.id === "tariff" && <p className="hi-note">{copy.tariff}</p>}
      <div className="hi-guide-choices" role="group" aria-label={question.title}>
        {question.options.map((option, index) => (
          <button
            type="button"
            aria-pressed={selected.includes(option.value)}
            className={`hi-guide-choice ${selected.includes(option.value) ? "is-selected" : ""}`}
            key={option.value}
            onClick={() => choose(option.value)}
          >
            <span className="hi-choice-number">
              {selected.includes(option.value) ? "✓" : index + 1}
            </span>
            <span>{option.label}</span>
          </button>
        ))}
      </div>
      {exact && (
        <div className="hi-guide-review">
          <label>
            {copy.amount}
            <input
              type="number"
              min="0"
              max="1000000"
              step="0.01"
              autoFocus
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          {question.amount === "care" && (
            <label>
              {copy.upper}
              <input
                type="number"
                min={amount || "0"}
                max="1000000"
                step="0.01"
                value={upper}
                onChange={(event) => setUpper(event.target.value)}
              />
            </label>
          )}
        </div>
      )}
      <div className="hi-guide-bottom">
        <div className="hi-guide-free">
          <span className="hi-choice-number">
            <HealthIcon name="pencil" size={14} />
          </span>
          <input
            aria-label={copy.note}
            placeholder={copy.notePlaceholder}
            maxLength={300}
            value={note}
            onChange={(event) => onNote(event.target.value)}
          />
        </div>
        <div className="hi-guide-actions">
          <button
            className="hi-guide-skip"
            onClick={() => onAnswer({ version: 2, status: "skipped", values: [] })}
          >
            {copy.skip}
          </button>
          {(question.multiple || exact) && (
            <button
              className="hi-guide-send"
              disabled={!selected.length || (exact && !validAmount)}
              onClick={() => submit(selected)}
            >
              {copy.continue}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
export function AdaptiveHealthGuide({
  apiUrl,
  profile,
  tariffKnown,
  sex,
  scope,
  enabled,
  onUpdate,
}: {
  apiUrl: string;
  profile: HealthCompareInput;
  tariffKnown: RecommendationInput["tariffKnown"];
  sex: RecommendationInput["sex"];
  scope: RecommendationInput["scope"];
  enabled: boolean;
  onUpdate: (value: HealthGuideSnapshot) => void;
}) {
  const api = useMemo(() => createRecommendationClient(apiUrl), [apiUrl]);
  const requests = useMemo(() => createLatestRecommendationRequest(api.recommend), [api]);
  const [started, setStarted] = useState(false),
    [open, setOpen] = useState(true),
    [stopped, setStopped] = useState(false);
  const [answers, setAnswers] = useState<RecommendationInput["answers"]>({}),
    [notes, setNotes] = useState<Record<string, string>>({});
  const [result, setResult] = useState<RecommendationResult | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const [review, setReview] = useState(false),
    [editing, setEditing] = useState<string | null>(null),
    [retry, setRetry] = useState(0),
    [changed, setChanged] = useState(false);
  const version = useRef(0),
    previousLeaders = useRef<string | null>(null);
  const layout = useRef<HTMLDivElement>(null),
    reservedHeight = useRef(0),
    changedAnswer = useRef<string | null>(null);
  const previousQuestion = useRef<string[]>([]);
  // Publish the question and its ranking before paint, including invalidation on each edit.
  useLayoutEffect(() => {
    onUpdate({ result: enabled && !busy ? result : null, busy: enabled && busy });
  }, [result, busy, enabled, onUpdate]);
  useEffect(() => {
    changedAnswer.current = null;
  }, [profile, scope]);
  useLayoutEffect(() => {
    if (!started || !enabled) return;
    const current = ++version.current,
      abort = new AbortController();
    reservedHeight.current = layout.current?.getBoundingClientRect().height ?? 0;
    setBusy(true);
    setError(false);
    setResult(null);
    const timer = setTimeout(
      () =>
        void requests
          .run({
            profileVersion: current,
            tariff: healthCompareInputSchema.parse(profile),
            tariffKnown,
            sex,
            scope,
            answers,
            legacyAnswers: [],
            optIn: true,
            explore: [],
            stop: stopped,
          })
          .then((value) => {
            if (!value || abort.signal.aborted || version.current !== value.profileVersion) return;
            const leaders = value.leaders.preferred.join();
            setChanged(previousLeaders.current !== null && previousLeaders.current !== leaders);
            previousLeaders.current = leaders;
            setResult(value);
          })
          .catch(() => {
            if (!abort.signal.aborted && version.current === current) setError(true);
          })
          .finally(() => {
            if (!abort.signal.aborted && version.current === current) setBusy(false);
          }),
      80,
    );
    return () => {
      clearTimeout(timer);
      abort.abort();
      requests.cancel();
    };
  }, [
    requests,
    started,
    enabled,
    profile,
    tariffKnown.birth,
    tariffKnown.locality,
    tariffKnown.region,
    sex,
    scope,
    answers,
    stopped,
    retry,
  ]);
  const answer = (id: string, value: RecommendationAnswer) => {
    changedAnswer.current = id;
    previousQuestion.current.push(id);
    setEditing(null);
    setAnswers((current) => ({
      ...current,
      [id]: { ...value, confirmedAtVersion: version.current + 1 },
    }));
  };
  const q = editing
    ? result?.questionStates.find((item) => item.id === editing)?.question
    : result?.nextQuestion;
  const clear = () => {
    version.current++;
    setStarted(false);
    setAnswers({});
    setNotes({});
    setResult(null);
    setStopped(false);
    setEditing(null);
    setReview(false);
    previousLeaders.current = null;
    previousQuestion.current = [];
  };
  if (!enabled) return null;
  return (
    <div
      id="adaptive-health-guide"
      ref={layout}
      style={busy ? { minHeight: reservedHeight.current } : undefined}
    >
      {!open ? (
        <button className="hi-guide-launch" onClick={() => setOpen(true)}>
          <HealthIcon name="spark" />
          {started ? copy.resume : copy.start}
        </button>
      ) : (
        <section className="hi-guide hi-adaptive-guide" aria-label={copy.start} aria-busy={busy}>
          <div className="hi-guide-heading">
            <span>
              <HealthIcon name="message" size={17} />
              {copy.question}
            </span>
            <div>
              <span className="hi-guide-step">{q?.topic ?? copy.start}</span>
              <button
                className="hi-icon-button"
                aria-label={copy.close}
                onClick={() => setOpen(false)}
              >
                <HealthIcon name="close" size={15} />
              </button>
            </div>
          </div>
          {!started ? (
            <>
              <h2>{copy.start}</h2>
              <p className="hi-small">{copy.intro}</p>
              <p className="hi-small">{copy.privacy}</p>
              <button className="hi-primary" onClick={() => setStarted(true)}>
                <HealthGradient />
                {copy.consent}
                <HealthIcon name="arrow" size={16} />
              </button>
            </>
          ) : (
            <>
              {busy ? (
                <p className="hi-recalculation" role="status">
                  {copy.loading}
                </p>
              ) : error ? (
                <div role="alert">
                  <p>{copy.failed}</p>
                  <button className="hi-secondary" onClick={() => setRetry((x) => x + 1)}>
                    {copy.retry}
                  </button>
                </div>
              ) : result && !result.active ? (
                <p>{copy.disabled}</p>
              ) : q ? (
                <>
                  <AnswerCard
                    key={`${q.id}:${editing ?? "next"}`}
                    question={q}
                    answer={answers[q.id]}
                    note={notes[q.id] ?? ""}
                    onNote={(value) => setNotes((current) => ({ ...current, [q.id]: value }))}
                    onAnswer={(value) => answer(q.id, value)}
                  />
                </>
              ) : result ? (
                <h2>{copy.outcomes[result.outcome]}</h2>
              ) : null}
              <div className="hi-recommendation-toolbar">
                <button
                  className="hi-text-link"
                  onClick={() => {
                    setStopped(!stopped);
                    setEditing(null);
                  }}
                >
                  {stopped ? copy.resume : copy.stop}
                </button>
                <button
                  className="hi-text-link"
                  disabled={busy || !previousQuestion.current.length}
                  onClick={() => setEditing(previousQuestion.current.at(-1) ?? null)}
                >
                  {copy.back}
                </button>
                <button className="hi-text-link" disabled={!result} onClick={() => setReview(true)}>
                  {copy.edit}
                </button>
              </div>
            </>
          )}
        </section>
      )}
      {started && !busy && result?.active && (
        <>
          {(changed || q) && (
            <p aria-live="polite" className="hi-question-reason">
              {changed ? copy.changed : copy.outcomes[result.outcome]}
              {changed && changedAnswer.current
                ? ` ${result.questionStates.find((state) => state.id === changedAnswer.current)?.question.title ?? ""}`
                : ""}
            </p>
          )}
        </>
      )}
      <HealthDialog open={review} onClose={() => setReview(false)} title={copy.edit} sheet>
        <p className="hi-small">{copy.privacy}</p>
        <div className="hi-answer-review">
          {result?.questionStates
            .filter(
              (item) => item.id !== "tariff" && (!item.question.subjectId || answers[item.id]),
            )
            .map((item) => (
              <article key={item.id}>
                <button
                  className="hi-text-link"
                  onClick={() => {
                    setReview(false);
                    setOpen(true);
                    setEditing(item.id);
                  }}
                >
                  {item.question.title}
                </button>
                <p className="hi-small">
                  {item.responseStatus === "answered"
                    ? item.question.options
                        .filter((option) => answers[item.id]?.values.includes(option.value))
                        .map((option) => option.label)
                        .join(" · ")
                    : item.responseStatus === "skipped"
                      ? copy.ignored
                      : item.responseStatus === "declined"
                        ? copy.declined
                        : item.responseStatus === "unknown"
                          ? copy.unknown
                          : copy.notAsked}
                  {answers[item.id]?.amountMinor !== undefined
                    ? ` · ${answers[item.id]!.amountMinor! / 100} CHF`
                    : ""}
                </p>
                {item.display === "inactive" && <p className="hi-small">{copy.inactive}</p>}
                {notes[item.id] && <p className="hi-small">{notes[item.id]}</p>}
              </article>
            ))}
        </div>
        <button className="hi-secondary" onClick={clear}>
          {copy.clear}
        </button>
      </HealthDialog>
    </div>
  );
}
