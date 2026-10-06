import { useId, useRef, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PartnerApiError } from "@coverview/api-client/partner";
import type { ClientFacts, QualityContactInput } from "@coverview/contracts/partner-quality";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Label,
} from "@coverview/ui";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
import { readDate, readText } from "./Field";

const facts = ["contact", "appointment", "documents", "contract"] as const;
const answers = ["yes", "no", "unknown"] as const;

// What the client said during a CoverView quality call or email (C8d, brief I.17.2).
export function QualityContactDialog({
  leadId,
  onClose,
  onSaved,
}: {
  leadId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation("quality"),
    session = usePartner(),
    ids = { occurredAt: useId(), note: useId(), insurer: useId(), signedOn: useId() },
    attempt = useRef<{ payload: string; key: string } | null>(null),
    [invalid, setInvalid] = useState(false);
  const save = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: (input: QualityContactInput) => {
      const payload = JSON.stringify(input);
      if (attempt.current?.payload !== payload)
        attempt.current = { payload, key: crypto.randomUUID() };
      return partnerApi.recordQualityContact(leadId, input, {
        csrfToken: session.identity.csrfToken,
        idempotencyKey: attempt.current.key,
      });
    },
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (save.isPending) return;
    const data = new FormData(event.currentTarget);
    let occurredAt: string | null;
    try {
      occurredAt = readDate(data, "occurredAt");
    } catch {
      occurredAt = null;
    }
    const pick = (name: string) => {
      const value = readText(data, name);
      return answers.find((answer) => answer === value) ?? "unknown";
    };
    const stated: ClientFacts = {
      contact: pick("contact"),
      appointment: pick("appointment"),
      documents: pick("documents"),
      contract: pick("contract"),
      insurer: readText(data, "insurer") || null,
      signedOn: readText(data, "signedOn") || null,
    };
    const channel = readText(data, "channel") === "email" ? "email" : "call";
    const note = readText(data, "note");
    if (!occurredAt || note.length < 10 || data.get("confirmed") !== "on") {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    save.mutate({ channel, facts: stated, note, occurredAt, confirmed: true });
  }
  return (
    <Dialog open onOpenChange={(open) => !open && !save.isPending && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("contact.title")}</DialogTitle>
          <DialogDescription>{t("contact.description")}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4 text-sm" onSubmit={submit}>
          <fieldset className="space-y-2">
            <legend className="font-medium">{t("contact.channel")}</legend>
            {(["call", "email"] as const).map((value, index) => (
              <label key={value} className="mr-4 inline-flex items-center gap-2">
                <input type="radio" name="channel" value={value} defaultChecked={index === 0} />
                {t(`contact.channels.${value}`)}
              </label>
            ))}
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor={ids.occurredAt}>{t("contact.occurredAt")}</Label>
            <input
              id={ids.occurredAt}
              name="occurredAt"
              type="datetime-local"
              required
              className="h-10 w-full rounded-md border border-input bg-background px-3"
            />
          </div>
          {facts.map((fact) => (
            <fieldset key={fact} className="space-y-1">
              <legend className="font-medium">{t(`confirmations.fact.${fact}`)}</legend>
              {answers.map((answer) => (
                <label key={answer} className="mr-4 inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name={fact}
                    value={answer}
                    defaultChecked={answer === "unknown"}
                  />
                  {t(`confirmations.answers.${answer}`)}
                </label>
              ))}
            </fieldset>
          ))}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={ids.insurer}>{t("contact.insurer")}</Label>
              <input
                id={ids.insurer}
                name="insurer"
                maxLength={120}
                className="h-10 w-full rounded-md border border-input bg-background px-3"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={ids.signedOn}>{t("contact.signedOn")}</Label>
              <input
                id={ids.signedOn}
                name="signedOn"
                type="date"
                className="h-10 w-full rounded-md border border-input bg-background px-3"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={ids.note}>{t("contact.note")}</Label>
            <textarea
              id={ids.note}
              name="note"
              required
              minLength={10}
              maxLength={2000}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </div>
          <label className="flex items-start gap-3">
            <input type="checkbox" name="confirmed" required className="mt-1" />
            {t("contact.confirm")}
          </label>
          {(invalid || save.isError) && (
            <p role="alert" className="text-destructive">
              {invalid
                ? t("invalid")
                : save.error instanceof PartnerApiError
                  ? t("changed")
                  : t("uncertain")}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
              {t("close")}
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {t("contact.submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
