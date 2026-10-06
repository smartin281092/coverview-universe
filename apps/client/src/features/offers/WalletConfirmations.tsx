import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import { PartnerApiError } from "@coverview/api-client/partner";
import type { ClientFacts, WalletConfirmationInput } from "@coverview/contracts/partner-quality";
import { Button, Label } from "@coverview/ui";
import { partnerApi } from "../../partner-api";
import { FactsFields, statesFacts, unknownFacts } from "./FactsFields";

const facts = ["contact", "appointment", "documents", "contract"] as const;

// The client tells CoverView what happened with a request, for example a contract signed
// (C8d, brief I.17.2), and rereads what they said. CoverView verifies; the client is never told
// whether the request declared otherwise.
export function WalletConfirmations({
  identity,
  leadId,
}: {
  identity: IdentityMe;
  leadId: string;
}) {
  const { t, i18n } = useTranslation("quality"),
    ids = { comment: useId() },
    [reporting, setReporting] = useState(false),
    [stated, setStated] = useState<ClientFacts>(unknownFacts),
    [comment, setComment] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [invalid, setInvalid] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const attempt = useRef<{ input: WalletConfirmationInput; key: string } | null>(null),
    controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const mine = useQuery({
    queryKey: [
      "private",
      identity.user.id,
      identity.session.id,
      "wallet-leads",
      "confirmations",
      leadId,
    ],
    queryFn: ({ signal }) => partnerApi.walletConfirmations(leadId, signal),
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
  const date = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Zurich",
    }).format(new Date(value));
  async function send() {
    if (!attempt.current || pending) return;
    setPending(true);
    setError("");
    controller.current = new AbortController();
    try {
      await partnerApi.confirmFromWallet(leadId, attempt.current.input, {
        csrfToken: identity.csrfToken,
        idempotencyKey: attempt.current.key,
        signal: controller.current.signal,
      });
      if (controller.current.signal.aborted) return;
      attempt.current = null;
      setReporting(false);
      setSaved(true);
      await mine.refetch();
    } catch (cause) {
      if (controller.current.signal.aborted) return;
      if (cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500) {
        // A refused statement is final: the client starts again from the form.
        attempt.current = null;
        setError(t(cause.status === 429 ? "report.limit" : "changed"));
      } else setError(t("uncertain"));
    } finally {
      if (!controller.current.signal.aborted) setPending(false);
    }
  }
  if (reporting)
    return (
      <form
        className="space-y-4 border-t border-border pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (attempt.current || pending) return;
          if (!statesFacts(stated) || !confirmed) {
            setInvalid(true);
            return;
          }
          setInvalid(false);
          attempt.current = {
            input: { facts: stated, comment: comment.trim(), confirmed: true },
            key: crypto.randomUUID(),
          };
          void send();
        }}
      >
        <h3 className="font-semibold">{t("report.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("report.description")}</p>
        <fieldset disabled={pending || !!attempt.current} className="space-y-4">
          <FactsFields value={stated} onChange={setStated} />
          <div className="space-y-2">
            <Label htmlFor={ids.comment}>{t("report.comment")}</Label>
            <textarea
              id={ids.comment}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={2000}
              rows={3}
              className="w-full rounded-md border border-input bg-background p-3"
            />
          </div>
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            {t("report.confirm")}
          </label>
          {invalid && <p role="alert">{t("report.invalid")}</p>}
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => setReporting(false)}>
              {t("back")}
            </Button>
            <Button type="submit">{t("report.send")}</Button>
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {attempt.current && (
          <Button type="button" disabled={pending} onClick={() => void send()}>
            {t(pending ? "saving" : "retryExact")}
          </Button>
        )}
      </form>
    );
  return (
    <section className="space-y-3 border-t border-border pt-4">
      <h3 className="font-semibold">{t("report.mine")}</h3>
      {saved && <p role="status">{t("report.saved")}</p>}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <Button
        variant="outline"
        onClick={() => {
          setStated(unknownFacts);
          setComment("");
          setConfirmed(false);
          setInvalid(false);
          setError("");
          setSaved(false);
          setReporting(true);
        }}
      >
        {t("report.action")}
      </Button>
      {mine.isPending ? (
        <p>{t("loading")}</p>
      ) : mine.isError ? (
        <div role="alert" className="space-y-2">
          <p>{t("changed")}</p>
          <Button variant="outline" onClick={() => void mine.refetch()}>
            {t("reload")}
          </Button>
        </div>
      ) : mine.data.items.length === 0 ? (
        <p className="text-muted-foreground">{t("report.empty")}</p>
      ) : (
        mine.data.items.map((item) => (
          <article key={item.id} className="space-y-1 border-t border-border py-3 text-sm">
            <p className="text-muted-foreground">
              {date(item.createdAt)}
              {t("separator")}
              {t(`report.channel.${item.channel}`)}
            </p>
            <ul className="space-y-1">
              {facts
                .filter((fact) => item.facts[fact] !== "unknown")
                .map((fact) => (
                  <li key={fact}>
                    {t(`facts.question.${fact}`)} {t(`facts.answers.${item.facts[fact]}`)}
                  </li>
                ))}
            </ul>
            {item.facts.insurer && <p>{t("report.insurer", { name: item.facts.insurer })}</p>}
            {item.facts.signedOn && (
              <p>
                {t("report.signedOn", {
                  date: new Intl.DateTimeFormat(i18n.language, {
                    dateStyle: "medium",
                    timeZone: "UTC",
                  }).format(new Date(`${item.facts.signedOn}T00:00:00Z`)),
                })}
              </p>
            )}
            {item.comment && <p className="whitespace-pre-wrap">{item.comment}</p>}
          </article>
        ))
      )}
    </section>
  );
}
