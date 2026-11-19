import { useEffect, useId, useRef, useState } from "react";
import type {
  SupplementaryAssistantQuestion,
  SupplementaryAssistantResult,
} from "@coverview/api-client/supplementary-insurance";
import { supplementaryCopy as copy } from "../../content/fr/supplementary";
import { HealthIcon } from "../health-insurance/HealthIcon";
import type { ProfileSetting } from "./ProfilePills";
import { categoryLabel, insurerName, tagLabel, type CatalogIndex } from "./supplementary-model";

const text = copy.assistant;

// The chat bar: a short text, sent with Enter (Shift+Enter for a new line), and examples.
export function AssistantBar({ busy, onAsk }: { busy: boolean; onAsk: (message: string) => void }) {
  const [message, setMessage] = useState("");
  const id = useId();
  const send = (value: string) => {
    const clean = value.trim().slice(0, 800);
    if (!clean || busy) return;
    setMessage(clean);
    onAsk(clean);
  };
  return (
    <div className="sc-assistant-bar">
      <form
        className="sc-chat"
        onSubmit={(event) => {
          event.preventDefault();
          send(message);
        }}
      >
        <label className="hi-sr-only" htmlFor={`${id}-message`}>
          {text.label}
        </label>
        <HealthIcon name="spark" size={20} />
        <textarea
          id={`${id}-message`}
          rows={1}
          maxLength={800}
          value={message}
          placeholder={text.placeholder}
          aria-describedby={`${id}-privacy`}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send(message);
            }
          }}
        />
        <button
          type="submit"
          className="sc-chat-send"
          disabled={busy || !message.trim()}
          aria-busy={busy}
          aria-label={busy ? text.sending : text.send}
        >
          {busy ? (
            <span className="sc-spinner" aria-hidden="true" />
          ) : (
            <HealthIcon name="arrow" size={18} />
          )}
        </button>
      </form>
      <div className="sc-examples">
        <span>{text.examplesLabel}</span>
        {text.examples.map((example) => (
          <button key={example} type="button" disabled={busy} onClick={() => send(example)}>
            {example}
          </button>
        ))}
      </div>
      <p className="sc-chat-privacy" id={`${id}-privacy`}>
        {text.privacy}
      </p>
    </div>
  );
}

// An assumption names the setting it stands for: it opens it when there is one.
function settingOf(assumption: string): ProfileSetting | null {
  if (/naissance|âge|\bans\b|\bné/iu.test(assumption)) return "birth";
  if (/sexe|femme|homme/iu.test(assumption)) return "sex";
  if (/canton|vaud|genève|fribourg|valais|neuchâtel|jura|lausanne|sion|delémont/iu.test(assumption))
    return "canton";
  return null;
}

// The question, as Wallet's action centre asks one: numbered choices, then a free answer.
function AssistantQuestion({
  question,
  busy,
  onAnswer,
}: {
  question: SupplementaryAssistantQuestion;
  busy: boolean;
  onAnswer: (value: string) => void;
}) {
  const [custom, setCustom] = useState("");
  const id = useId();
  useEffect(() => setCustom(""), [question.id]);
  return (
    <section className="sc-question" aria-labelledby={`${id}-question`} aria-busy={busy}>
      <p className="sc-question-label">
        <HealthIcon name="question" size={16} />
        {text.questionLabel}
      </p>
      <h3 id={`${id}-question`}>{question.text}</h3>
      <ol className="sc-question-options">
        {question.options.map((option, position) => (
          <li key={option.value}>
            <button type="button" disabled={busy} onClick={() => onAnswer(option.value)}>
              <span className="sc-question-number" aria-hidden="true">
                {position + 1}
              </span>
              <span>{option.label}</span>
              <HealthIcon name="arrow" size={16} />
            </button>
          </li>
        ))}
      </ol>
      {question.allowCustom && (
        <form
          className="sc-question-custom"
          onSubmit={(event) => {
            event.preventDefault();
            const value = custom.trim().slice(0, 200);
            if (value && !busy) onAnswer(value);
          }}
        >
          <span className="sc-question-number" aria-hidden="true">
            <HealthIcon name="pencil" size={14} />
          </span>
          <input
            aria-label={text.other}
            placeholder={text.otherPlaceholder}
            maxLength={200}
            value={custom}
            disabled={busy}
            onChange={(event) => setCustom(event.target.value)}
          />
          <button type="submit" className="hi-secondary" disabled={busy || !custom.trim()}>
            {text.answer}
          </button>
        </form>
      )}
    </section>
  );
}

export function AssistantResult({
  index,
  query,
  result,
  busy,
  failed,
  onRetry,
  onClear,
  onAnswer,
  onSetting,
}: {
  index: CatalogIndex;
  // The message sent: each new one scrolls to the answer.
  query: string;
  result: SupplementaryAssistantResult | null;
  busy: boolean;
  failed: boolean;
  onRetry: () => void;
  onClear: () => void;
  onAnswer: (id: string, value: string) => void;
  onSetting: (setting: ProfileSetting) => void;
}) {
  const section = useRef<HTMLElement>(null);
  // A new search brings its answer into view, under the band.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    section.current?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
  }, [query]);
  const understood = result
    ? [
        ...result.interpretation.tags.map((tag) => tagLabel(index, tag)),
        ...result.interpretation.categories.map((key) => categoryLabel(index, key)),
        ...result.interpretation.insurers.map((key) => insurerName(index, key)),
      ]
    : [];
  return (
    <section ref={section} className="sc-assistant-result" aria-live="polite" aria-busy={busy}>
      <header>
        <h2>
          <HealthIcon name="spark" size={18} />
          {text.title}
        </h2>
        <button type="button" className="sc-link-button" onClick={onClear}>
          {text.clear}
        </button>
      </header>
      {failed ? (
        <p className="sc-inline-error" role="alert">
          {text.failed}
          <button type="button" className="sc-link-button" onClick={onRetry}>
            {copy.retry}
          </button>
        </p>
      ) : !result ? (
        <div className="sc-assistant-loading" role="status">
          <span className="sc-spinner" aria-hidden="true" />
          {text.sending}
        </div>
      ) : (
        <>
          {result.summary && <p className="sc-assistant-summary">{result.summary}</p>}
          {understood.length > 0 && (
            <p className="sc-assistant-understood">
              <span>{text.understood}</span> {understood.join(" · ")}
            </p>
          )}
          {result.assumptions.length > 0 && (
            <div className="sc-assumptions">
              <span className="sc-assumptions-label">{text.assumptions}</span>
              <ul>
                {result.assumptions.map((assumption) => {
                  const setting = settingOf(assumption);
                  return (
                    <li key={assumption}>
                      {setting ? (
                        <button
                          type="button"
                          title={text.assumptionHint}
                          onClick={() => onSetting(setting)}
                        >
                          {assumption}
                          <HealthIcon name="pencil" size={13} />
                        </button>
                      ) : (
                        <span>{assumption}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {result.results.length === 0 && <p className="sc-assistant-empty">{text.noResult}</p>}
          {result.question && (
            <AssistantQuestion
              question={result.question}
              busy={busy}
              onAnswer={(value) => result.question && onAnswer(result.question.id, value)}
            />
          )}
        </>
      )}
    </section>
  );
}
