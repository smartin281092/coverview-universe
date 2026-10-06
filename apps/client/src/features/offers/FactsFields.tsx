import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Input, Label } from "@coverview/ui";
import type { ClientFacts } from "@coverview/contracts/partner-quality";

const facts = ["contact", "appointment", "documents", "contract"] as const;
const answers = ["yes", "no", "unknown"] as const;
export const unknownFacts: ClientFacts = {
  contact: "unknown",
  appointment: "unknown",
  documents: "unknown",
  contract: "unknown",
  insurer: null,
  signedOn: null,
};
/** Only a yes or a no tells CoverView something; a form left at "unknown" sends nothing. */
export const statesFacts = (value: ClientFacts) => facts.some((fact) => value[fact] !== "unknown");

// What happened with the request, in the client's words (C8d, brief I.17.2).
export function FactsFields({
  value,
  onChange,
}: {
  value: ClientFacts;
  onChange: (value: ClientFacts) => void;
}) {
  const { t } = useTranslation("quality"),
    prefix = useId();
  return (
    <fieldset className="space-y-4">
      <legend className="font-medium">{t("facts.title")}</legend>
      <p className="text-sm text-muted-foreground">{t("facts.description")}</p>
      {facts.map((fact) => (
        <fieldset key={fact} className="space-y-1">
          <legend className="text-sm">{t(`facts.question.${fact}`)}</legend>
          <div className="flex flex-wrap gap-x-4">
            {answers.map((answer) => (
              <label key={answer} className="flex min-h-11 items-center gap-2">
                <input
                  type="radio"
                  name={`${prefix}-${fact}`}
                  checked={value[fact] === answer}
                  onChange={() =>
                    onChange({
                      ...value,
                      [fact]: answer,
                      // A company or a date belongs to a contract the client says they signed.
                      ...(fact === "contract" && answer !== "yes"
                        ? { insurer: null, signedOn: null }
                        : {}),
                    })
                  }
                />
                {t(`facts.answers.${answer}`)}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {value.contract === "yes" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${prefix}-insurer`}>{t("facts.insurer")}</Label>
            <Input
              id={`${prefix}-insurer`}
              maxLength={120}
              value={value.insurer ?? ""}
              onChange={(event) => onChange({ ...value, insurer: event.target.value || null })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}-signed`}>{t("facts.signedOn")}</Label>
            <Input
              id={`${prefix}-signed`}
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={value.signedOn ?? ""}
              onChange={(event) => onChange({ ...value, signedOn: event.target.value || null })}
            />
          </div>
        </div>
      )}
    </fieldset>
  );
}
