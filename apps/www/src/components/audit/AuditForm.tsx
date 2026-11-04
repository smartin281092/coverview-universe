import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Building2, Landmark } from "lucide-react";
import { auditCopy as copy } from "../../content/fr/audit";
import { LIMITS, type Answers } from "./audit-state";
import type { ContractReading } from "./contract-reader";
import { interpolate } from "./format";
import { providerLogos } from "./provider-logos";
import { StepChoice, type ChoiceOption } from "./StepChoice";
import { StepNumber } from "./StepNumber";
import { StepUpload } from "./StepUpload";
import { LAST_YEAR, profileIds, providerById, providers, type ProfileId } from "./strategies";
import { loadGsap, splitWords, useReducedMotion } from "./use-motion";

export type StepId =
  | "upload"
  | "has"
  | "provider"
  | "profile"
  | "monthly"
  | "start"
  | "capital"
  | "savings"
  | "income"
  | "birth";

/** Les questions dépendent des réponses : le dépôt est facultatif, la banque n’a pas de profil. */
function stepsFor(answers: Answers, skipUpload: boolean): StepId[] {
  const steps: StepId[] = skipUpload ? [] : ["upload"];
  steps.push("has");
  if (answers.has) {
    steps.push("provider");
    const provider = answers.provider ? providerById(answers.provider) : undefined;
    if (provider && !provider.strategyId) steps.push("profile");
    steps.push("monthly", "start", "capital");
  } else if (answers.has === false) steps.push("monthly", "savings");
  else steps.push("monthly");
  steps.push("income", "birth");
  return steps;
}

const yearPresets = [LAST_YEAR, LAST_YEAR - 2, LAST_YEAR - 5, LAST_YEAR - 10, LAST_YEAR - 15];
const monthlyPresets = [100, 200, 300, 500, 604];
const incomePresets = [4000, 5500, 7000, 9000, 12000];

export function AuditForm({
  answers,
  skipUpload,
  onChange,
  onComplete,
}: {
  answers: Answers;
  skipUpload: boolean;
  onChange: (next: Answers) => void;
  onComplete: (answers: Answers) => void;
}) {
  const reduced = useReducedMotion();
  const steps = useMemo(() => stepsFor(answers, skipUpload), [answers, skipUpload]);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const panel = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const animating = useRef(false);
  const current = steps[Math.min(index, steps.length - 1)] ?? "has";
  const total = steps.length;
  const position = Math.min(index, total - 1) + 1;

  const update = useCallback(
    (patch: Partial<Answers>) => onChange({ ...answers, ...patch }),
    [answers, onChange],
  );

  const move = useCallback(
    (to: number, nextDirection: 1 | -1, nextAnswers: Answers = answers) => {
      const list = stepsFor(nextAnswers, skipUpload);
      if (to >= list.length) {
        onComplete(nextAnswers);
        return;
      }
      if (to < 0 || animating.current) return;
      setDirection(nextDirection);
      if (reduced || !panel.current) {
        setIndex(to);
        return;
      }
      animating.current = true;
      void loadGsap().then((gsap) => {
        gsap.to(panel.current, {
          y: -36 * nextDirection,
          opacity: 0,
          duration: 0.22,
          ease: "power2.in",
          onComplete: () => {
            animating.current = false;
            setIndex(to);
          },
        });
      });
    },
    [answers, onComplete, reduced, skipUpload],
  );

  const next = useCallback(
    (nextAnswers: Answers = answers) => move(index + 1, 1, nextAnswers),
    [answers, index, move],
  );
  const back = useCallback(() => move(index - 1, -1), [index, move]);

  // Entrée dans une question : panneau et mots du titre se révèlent ; le focus suit.
  useLayoutEffect(() => {
    const node = panel.current;
    if (!node) return;
    if (reduced) {
      node.style.opacity = "1";
      node.style.transform = "";
      return;
    }
    node.style.opacity = "0";
    void loadGsap().then((gsap) => {
      gsap.fromTo(
        node,
        { y: 40 * direction, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: "power3.out", clearProps: "transform" },
      );
      gsap.fromTo(
        node.querySelectorAll(".audit-word"),
        { y: "0.7em", opacity: 0 },
        { y: 0, opacity: 1, duration: 0.55, stagger: 0.035, ease: "power3.out", delay: 0.06 },
      );
    });
  }, [current, direction, reduced]);

  useEffect(() => {
    if (index === 0) return;
    const timer = window.setTimeout(() => {
      const focusable = panel.current?.querySelector<HTMLElement>("input, button.audit-choice");
      if (!focusable) heading.current?.focus({ preventScroll: true });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [index]);

  const title = (text: string) => (
    <h1 className="audit-question" id="audit-question" ref={heading} tabIndex={-1}>
      {splitWords(text).map((part, position) =>
        /^\s+$/u.test(part) ? (
          " "
        ) : (
          <span className="audit-word" key={`${part}-${position}`}>
            {part}
          </span>
        ),
      )}
    </h1>
  );

  const applyReading = (reading: ContractReading) => {
    const patch: Partial<Answers> = {};
    if (reading.provider) {
      patch.has = true;
      patch.provider = reading.provider;
    }
    if (reading.monthly) patch.monthly = reading.monthly;
    if (reading.startYear) patch.startYear = reading.startYear;
    if (reading.birthYear) patch.birthYear = reading.birthYear;
    const merged = { ...answers, ...patch };
    onChange(merged);
    next(merged);
  };

  const providerOptions: ChoiceOption<string>[] = providers.map((provider) => {
    const logo = providerLogos[provider.id];
    return {
      id: provider.id,
      label: provider.label,
      meta: provider.kind === "bank" ? copy.steps.provider.bank : copy.steps.provider.insurance,
      visual: logo ? (
        <img
          src={logo.src}
          alt=""
          className={`audit-logo ${logo.background ? "is-dark" : ""} ${logo.tall ? "is-tall" : ""}`}
          style={logo.background ? { background: logo.background } : undefined}
          width="64"
          height="30"
          loading="lazy"
          decoding="async"
        />
      ) : provider.kind === "bank" ? (
        <Landmark aria-hidden="true" />
      ) : (
        <Building2 aria-hidden="true" />
      ),
    };
  });

  const profileOptions: ChoiceOption<ProfileId>[] = profileIds
    .filter((id) => id !== "hyperion" || answers.provider === "liechtenstein-life")
    .map((id) => ({ id, ...copy.steps.profile.options[id] }));

  const choose = <K extends keyof Answers>(key: K, value: Answers[K]) => {
    const merged = { ...answers, [key]: value };
    onChange(merged);
    window.setTimeout(() => move(index + 1, 1, merged), 180);
  };

  const content = () => {
    switch (current) {
      case "upload":
        return (
          <>
            {title(copy.steps.upload.title)}
            <p className="audit-lead">{copy.steps.upload.text}</p>
            <StepUpload onRead={applyReading} onSkip={() => next()} />
          </>
        );
      case "has":
        return (
          <>
            {title(copy.steps.has.title)}
            <p className="audit-lead">{copy.steps.has.text}</p>
            <StepChoice
              value={answers.has === null ? null : answers.has ? "yes" : "no"}
              options={[
                { id: "yes", label: copy.steps.has.yes, hint: copy.steps.has.yesHint },
                { id: "no", label: copy.steps.has.no, hint: copy.steps.has.noHint },
              ]}
              onSelect={(id) => choose("has", id === "yes")}
            />
          </>
        );
      case "provider":
        return (
          <>
            {title(copy.steps.provider.title)}
            <p className="audit-lead">{copy.steps.provider.text}</p>
            <StepChoice
              value={answers.provider}
              options={providerOptions}
              columns={3}
              onSelect={(id) => {
                const provider = providerById(id);
                const merged = {
                  ...answers,
                  provider: id,
                  profile: provider?.strategyId ? null : answers.profile,
                  strategy: null,
                };
                onChange(merged);
                window.setTimeout(() => move(index + 1, 1, merged), 180);
              }}
            />
          </>
        );
      case "profile":
        return (
          <>
            {title(copy.steps.profile.title)}
            <p className="audit-lead">{copy.steps.profile.text}</p>
            <StepChoice
              value={answers.profile}
              options={profileOptions}
              onSelect={(id) => choose("profile", id)}
            />
          </>
        );
      case "monthly":
        return (
          <>
            {title(answers.has ? copy.steps.monthly.title : copy.steps.monthly.capacityTitle)}
            <p className="audit-lead">{copy.steps.monthly.text}</p>
            <StepNumber
              key="monthly"
              id="audit-monthly"
              value={answers.monthly}
              min={LIMITS.monthly.min}
              max={LIMITS.monthly.max}
              unit={copy.steps.monthly.unit}
              presets={monthlyPresets}
              invalid={copy.steps.monthly.invalid}
              onChange={(value) => update({ monthly: value })}
              onNext={() => next()}
            />
            <p className="audit-hint">{copy.steps.monthly.hint}</p>
          </>
        );
      case "start":
        return (
          <>
            {title(copy.steps.start.title)}
            <p className="audit-lead">{copy.steps.start.text}</p>
            <StepNumber
              key="start"
              id="audit-start"
              value={answers.startYear}
              min={LIMITS.startYear.min}
              max={LIMITS.startYear.max}
              presets={yearPresets}
              year
              invalid={interpolate(copy.steps.start.invalid, { max: LIMITS.startYear.max })}
              onChange={(value) => update({ startYear: value })}
              onNext={() => next()}
            />
          </>
        );
      case "capital":
        return (
          <>
            {title(copy.steps.capital.title)}
            <p className="audit-lead">{copy.steps.capital.text}</p>
            <StepNumber
              key="capital"
              id="audit-capital"
              value={answers.capital}
              min={LIMITS.capital.min}
              max={LIMITS.capital.max}
              unit={copy.steps.capital.unit}
              invalid={copy.steps.capital.invalid}
              secondary={{
                label: copy.steps.capital.unknown,
                onSelect: () => {
                  const merged = { ...answers, capital: null };
                  onChange(merged);
                  next(merged);
                },
              }}
              onChange={(value) => update({ capital: value })}
              onNext={() => next()}
            />
          </>
        );
      case "savings":
        return (
          <>
            {title(copy.steps.capital.savingsTitle)}
            <p className="audit-lead">{copy.steps.capital.savingsText}</p>
            <StepNumber
              key="savings"
              id="audit-savings"
              value={answers.capital}
              min={LIMITS.capital.min}
              max={LIMITS.capital.max}
              unit={copy.steps.capital.unit}
              invalid={copy.steps.capital.invalid}
              secondary={{
                label: copy.steps.capital.none,
                onSelect: () => {
                  const merged = { ...answers, capital: null };
                  onChange(merged);
                  next(merged);
                },
              }}
              onChange={(value) => update({ capital: value })}
              onNext={() => next()}
            />
          </>
        );
      case "income":
        return (
          <>
            {title(copy.steps.income.title)}
            <p className="audit-lead">{copy.steps.income.text}</p>
            <StepNumber
              key="income"
              id="audit-income"
              value={answers.income}
              min={LIMITS.income.min}
              max={LIMITS.income.max}
              unit={copy.steps.income.unit}
              presets={incomePresets}
              invalid={copy.steps.income.invalid}
              onChange={(value) => update({ income: value })}
              onNext={() => next()}
            />
          </>
        );
      case "birth":
        return (
          <>
            {title(copy.steps.birth.title)}
            <p className="audit-lead">{copy.steps.birth.text}</p>
            <StepNumber
              key="birth"
              id="audit-birth"
              value={answers.birthYear}
              min={LIMITS.birthYear.min}
              max={LIMITS.birthYear.max}
              year
              invalid={interpolate(copy.steps.birth.invalid, {
                min: LIMITS.birthYear.min,
                max: LIMITS.birthYear.max,
              })}
              onChange={(value) => update({ birthYear: value })}
              onNext={() => next()}
            />
          </>
        );
    }
  };

  return (
    <section className="audit-form" aria-labelledby="audit-question">
      <div className="audit-form-top">
        <p className="audit-eyebrow">{copy.eyebrow}</p>
        <p className="audit-counter" aria-live="polite">
          {interpolate(copy.nav.step, { current: position, total })}
        </p>
      </div>
      <div
        className="audit-progress"
        role="progressbar"
        aria-label={copy.nav.progress}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={position}
      >
        <span style={{ width: `${(position / total) * 100}%` }} />
      </div>
      <div className="audit-panel" ref={panel} key={current}>
        {content()}
      </div>
      <div className="audit-form-bottom">
        {index > 0 ? (
          <button type="button" className="audit-back" onClick={back}>
            <ArrowLeft aria-hidden="true" />
            {copy.nav.back}
          </button>
        ) : (
          <span />
        )}
      </div>
    </section>
  );
}
