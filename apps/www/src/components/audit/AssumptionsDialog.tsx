import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@coverview/ui";
import { auditCopy as copy } from "../../content/fr/audit";
import { AuditDialog } from "./AuditDialog";
import { LIMITS, type Answers } from "./audit-state";
import { digitsOf, chf } from "./format";
import { ACCOUNT_ID, strategies } from "./strategies";

/**
 * Hypothèses, méthode et sources dans un dialogue (FRONT-14) : les paramètres se modifient et se
 * recalculent ; le texte explique d’où viennent les chiffres et ce qu’ils ne disent pas.
 */
export function AssumptionsDialog({
  open,
  answers,
  onClose,
  onApply,
}: {
  open: boolean;
  answers: Answers;
  onClose: () => void;
  onApply: (answers: Answers) => void;
}) {
  const d = copy.results.dialog;
  const [draft, setDraft] = useState(answers);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const field = (
    label: string,
    value: string,
    onChange: (text: string) => void,
    unit?: string,
    inputMode: "numeric" | "decimal" = "numeric",
  ) => (
    <label className="audit-field">
      <span>{label}</span>
      <span className="audit-field-input">
        <input
          type="text"
          inputMode={inputMode}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {unit && <em>{unit}</em>}
      </span>
    </label>
  );
  const bounded = (value: number | null, min: number, max: number, fallback: number) =>
    value === null ? fallback : Math.min(max, Math.max(min, value));
  const apply = () => {
    onApply({
      ...draft,
      retirementAge: bounded(
        draft.retirementAge,
        LIMITS.retirementAge.min,
        LIMITS.retirementAge.max,
        answers.retirementAge,
      ),
      retirementYears: bounded(draft.retirementYears, 1, 40, answers.retirementYears),
      replacement: Math.min(1, Math.max(0, draft.replacement)),
      inflation: Math.min(0.15, Math.max(0, draft.inflation)),
      monthly: bounded(
        draft.monthly,
        LIMITS.monthly.min,
        LIMITS.monthly.max,
        answers.monthly ?? LIMITS.monthly.min,
      ),
    });
    onClose();
  };
  return (
    <AuditDialog open={open} title={d.title} closeLabel={d.close} onClose={onClose}>
      <div ref={setHost} className="audit-dialog-body">
        <section>
          <h3>{d.parameters}</h3>
          <div className="audit-fields">
            {field(d.retirementAge, String(draft.retirementAge), (text) =>
              setDraft({ ...draft, retirementAge: digitsOf(text) ?? draft.retirementAge }),
            )}
            {field(
              d.replacement,
              String(Math.round(draft.replacement * 100)),
              (text) => setDraft({ ...draft, replacement: (digitsOf(text) ?? 0) / 100 }),
              "%",
            )}
            {field(d.duration, String(draft.retirementYears), (text) =>
              setDraft({ ...draft, retirementYears: digitsOf(text) ?? draft.retirementYears }),
            )}
            {field(
              d.inflation,
              String(Math.round(draft.inflation * 1000) / 10).replace(".", ","),
              (text) => {
                const parsed = Number(text.replace(",", ".").replace(/[^\d.]/gu, ""));
                if (Number.isFinite(parsed)) setDraft({ ...draft, inflation: parsed / 100 });
              },
              "%",
              "decimal",
            )}
            {field(
              d.monthly,
              draft.monthly === null ? "" : chf(draft.monthly),
              (text) => setDraft({ ...draft, monthly: digitsOf(text) }),
              "CHF",
            )}
            {field(
              d.capital,
              draft.capital === null ? "" : chf(draft.capital),
              (text) => setDraft({ ...draft, capital: digitsOf(text) }),
              "CHF",
            )}
            {draft.has && (
              <label className="audit-field">
                <span>{d.strategy}</span>
                <Select
                  value={draft.strategy ?? ""}
                  onValueChange={(value) => setDraft({ ...draft, strategy: value || null })}
                >
                  <SelectTrigger aria-label={d.strategy} className="audit-select-trigger">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent portalContainer={host} position="popper">
                    {strategies
                      .filter((strategy) => strategy.id !== ACCOUNT_ID)
                      .map((strategy) => (
                        <SelectItem key={strategy.id} value={strategy.id}>
                          {strategy.provider} · {strategy.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </label>
            )}
          </div>
          <div className="audit-actions">
            <button type="button" className="audit-button" onClick={apply}>
              {d.apply}
            </button>
          </div>
        </section>
        <section>
          <h3>{d.method}</h3>
          {d.methodText.map((paragraph) => (
            <p key={paragraph.slice(0, 24)}>{paragraph}</p>
          ))}
        </section>
        <section>
          <h3>{d.data}</h3>
          <p>{d.dataText}</p>
        </section>
        <section>
          <h3>{d.sources}</h3>
          <ul className="audit-sources">
            {copy.results.sources.map((source) => (
              <li key={source.href}>
                <a href={source.href} rel="noopener noreferrer" target="_blank">
                  {source.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3>{d.limits}</h3>
          <p>{d.limitsText}</p>
        </section>
      </div>
    </AuditDialog>
  );
}
