import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  leadCommandSchema,
  type LeadCommand,
  type LeadDetail,
  type LeadOffer,
} from "@coverview/contracts/partner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@coverview/ui";
import { partnerApi } from "../../partner-api";

export type WalletChoice = {
  type: "select" | "refuse" | "question" | "modification" | "keep_current" | "interlocutor";
  lead: LeadDetail;
  scope: string;
  offer?: LeadOffer;
};

export function ChoiceDialog({
  choice,
  lead,
  pending,
  error,
  retryCommand,
  onClose,
  onSend,
}: {
  choice: WalletChoice | null;
  lead: LeadDetail | undefined;
  pending: boolean;
  error: string;
  retryCommand: LeadCommand | null;
  onClose: () => void;
  onSend: (command: LeadCommand) => Promise<LeadDetail | undefined>;
}) {
  const { t, i18n } = useTranslation("offers");
  const [invalid, setInvalid] = useState(false);
  const changed =
    !!choice && (!lead || lead.id !== choice.lead.id || lead.revision !== choice.lead.revision);
  const currentOffer = lead?.offers.find((offer) => offer.id === choice?.offer?.id);
  const unavailable = lead?.stage === "completed" || (!!choice?.offer && !currentOffer?.canChoose);
  const money = (value: number) =>
    new Intl.NumberFormat(i18n.language, { style: "currency", currency: "CHF" }).format(
      value / 100,
    );
  const date = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeZone: "Europe/Zurich",
    }).format(new Date(value));
  return (
    <Dialog
      open={!!choice}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90svh] overflow-y-auto sm:max-w-xl"
        showCloseButton={!pending}
        closeLabel={t("close")}
      >
        <DialogHeader>
          <DialogTitle>
            {t(
              choice?.type === "select"
                ? "confirmTitle"
                : choice?.type === "keep_current"
                  ? "keep"
                  : (choice?.type ?? "question"),
            )}
          </DialogTitle>
          <DialogDescription>
            {t(
              choice?.type === "interlocutor"
                ? "interlocutorHelp"
                : `decision.help.${choice?.type ?? "question"}`,
            )}
          </DialogDescription>
        </DialogHeader>
        {choice && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (pending || changed || unavailable || retryCommand) return;
              const value = new FormData(event.currentTarget).get("message");
              const text = typeof value === "string" ? value.trim() : "";
              const parsed = leadCommandSchema.safeParse(
                choice.type === "interlocutor"
                  ? {
                      action: "client_interlocutor",
                      revision: choice.lead.revision,
                      reason: text,
                    }
                  : {
                      action: "client_choice",
                      revision: choice.lead.revision,
                      choice: choice.type,
                      ...(choice.offer ? { offerId: choice.offer.id } : {}),
                      text,
                    },
              );
              if (!parsed.success || (!["select", "keep_current"].includes(choice.type) && !text)) {
                setInvalid(true);
                return;
              }
              setInvalid(false);
              void onSend(parsed.data);
            }}
          >
            <div className="space-y-2 rounded-lg bg-muted p-4 text-sm">
              <p className="font-semibold">{choice.lead.clientName}</p>
              <p>{choice.lead.title}</p>
              <p>{t("decision.object", { object: choice.lead.object || t("missing") })}</p>
              {choice.offer && (
                <>
                  <p className="pt-2 font-semibold">{t("decision.offer", choice.offer)}</p>
                  <p>
                    {t("decision.premium", {
                      amount:
                        choice.offer.annualPremiumMinor === null
                          ? t("missing")
                          : money(choice.offer.annualPremiumMinor),
                    })}
                  </p>
                  <p>
                    {t("decision.reference", { reference: choice.offer.reference || t("missing") })}
                  </p>
                  {choice.offer.validUntil && (
                    <p>{t("validity", { date: date(choice.offer.validUntil) })}</p>
                  )}
                  <p>
                    {t("effect", {
                      date: choice.offer.effectiveDate
                        ? date(choice.offer.effectiveDate)
                        : t("missing"),
                    })}
                  </p>
                  {currentOffer?.canDownload && (
                    <a
                      className="inline-flex underline underline-offset-4"
                      href={partnerApi.sourceUrl(choice.lead.id, choice.offer.id, true)}
                    >
                      {t("source")}
                    </a>
                  )}
                </>
              )}
            </div>
            {choice.offer?.summary && (
              <p className="whitespace-pre-wrap text-sm">{choice.offer.summary}</p>
            )}
            {choice.offer?.limitations && (
              <div className="space-y-2 text-sm">
                <p className="font-medium">{t("limitations")}</p>
                <p className="whitespace-pre-wrap">{choice.offer.limitations}</p>
              </div>
            )}
            {choice.type !== "select" && (
              <label className="block space-y-2 text-sm">
                <span>{t(choice.type === "refuse" ? "decision.reason" : "message")}</span>
                <textarea
                  name="message"
                  required={choice.type !== "keep_current"}
                  maxLength={2000}
                  rows={4}
                  disabled={pending || !!retryCommand}
                  aria-invalid={invalid}
                  aria-describedby="decision-message-help"
                  onChange={() => setInvalid(false)}
                  className="w-full rounded-md border border-input bg-background p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <span id="decision-message-help" className="block text-xs text-muted-foreground">
                  {t(choice.type === "refuse" ? "decision.reasonHelp" : "decision.messageHelp")}
                </span>
              </label>
            )}
            {(changed || unavailable) && !retryCommand && (
              <p role="alert" className="text-sm text-destructive">
                {t("decision.changed")}
              </p>
            )}
            {retryCommand && (
              <p role="status" className="text-sm">
                {t("decision.unknown")}
              </p>
            )}
            {(error || invalid) && (
              <p role="alert" className="text-sm text-destructive">
                {invalid ? t("decision.required") : error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
                {t("cancel")}
              </Button>
              {retryCommand ? (
                <Button type="button" disabled={pending} onClick={() => void onSend(retryCommand)}>
                  {t(pending ? "decision.sending" : "decision.retry")}
                </Button>
              ) : (
                <Button type="submit" disabled={pending || changed || unavailable}>
                  {t(
                    pending
                      ? "decision.sending"
                      : choice.type === "select"
                        ? "confirm"
                        : choice.type === "refuse"
                          ? "decision.confirmRefusal"
                          : "send",
                  )}
                </Button>
              )}
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
