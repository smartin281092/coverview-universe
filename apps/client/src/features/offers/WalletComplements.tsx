import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import { PartnerApiError } from "@coverview/api-client/partner";
import type {
  ComplementAnswerInput,
  ComplementRequest,
} from "@coverview/contracts/partner-complements";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Label,
} from "@coverview/ui";
import { partnerApi } from "../../partner-api";

const queryKey = (identity: IdentityMe, leadId: string) => [
  "private",
  identity.user.id,
  identity.session.id,
  "wallet-leads",
  "complements",
  leadId,
];
function useDate() {
  const { i18n } = useTranslation("complements");
  return (value: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Zurich",
    }).format(new Date(value));
}

// Shown in the request when the advisor asks for something, or once something was asked (C8e).
export function ComplementBanner({
  identity,
  leadId,
  onOpen,
}: {
  identity: IdentityMe;
  leadId: string;
  onOpen: () => void;
}) {
  const { t } = useTranslation("complements");
  const list = useQuery({
    queryKey: queryKey(identity, leadId),
    queryFn: ({ signal }) => partnerApi.walletComplements(leadId, signal),
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
  if (list.isPending || list.isError || !list.data.items.length) return null;
  const waiting = list.data.items.some((item) => item.canAnswer);
  return waiting ? (
    <div role="status" className="space-y-3 rounded-lg border border-border p-4">
      <p className="font-medium">{t("banner")}</p>
      <Button onClick={onOpen}>{t("open")}</Button>
    </div>
  ) : (
    <Button variant="outline" onClick={onOpen}>
      {t("history")}
    </Button>
  );
}

function AnswerForm({
  identity,
  leadId,
  item,
  onLinkContract,
  onSaved,
}: {
  identity: IdentityMe;
  leadId: string;
  item: ComplementRequest;
  onLinkContract: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation("complements"),
    date = useDate(),
    ids = { text: useId() },
    [text, setText] = useState(""),
    [selected, setSelected] = useState<Record<string, string>>({}),
    [confirmed, setConfirmed] = useState(false),
    [cursor, setCursor] = useState<string>(),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [blocked, setBlocked] = useState(false);
  const attempt = useRef<{ input: ComplementAnswerInput; key: string } | null>(null),
    controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const candidates = useQuery({
    queryKey: [...queryKey(identity, leadId), "candidates", cursor],
    queryFn: ({ signal }) => partnerApi.complementCandidates(leadId, cursor, signal),
    gcTime: 0,
    retry: false,
  });
  async function send() {
    if (!attempt.current || pending || blocked) return;
    setPending(true);
    setError("");
    controller.current = new AbortController();
    try {
      await partnerApi.answerComplement(leadId, item.id, attempt.current.input, {
        csrfToken: identity.csrfToken,
        idempotencyKey: attempt.current.key,
        signal: controller.current.signal,
      });
      if (controller.current.signal.aborted) return;
      attempt.current = null;
      onSaved();
    } catch (cause) {
      if (controller.current.signal.aborted) return;
      const definitive =
        cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500;
      setBlocked(definitive);
      setError(t(definitive ? "changed" : "uncertain"));
    } finally {
      if (!controller.current.signal.aborted) setPending(false);
    }
  }
  const documents = Object.entries(selected).map(([documentId, fingerprint]) => ({
    documentId,
    fingerprint,
  }));
  return (
    <form
      className="space-y-4 border-t border-border pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (attempt.current || pending) return;
        if ((text.trim().length < 10 && !documents.length) || !confirmed) {
          setError(t("invalid"));
          return;
        }
        attempt.current = {
          input: { text: text.trim(), documents, confirmed: true },
          key: crypto.randomUUID(),
        };
        void send();
      }}
    >
      <h4 className="font-semibold">{t("answerTitle")}</h4>
      <fieldset disabled={pending || !!attempt.current || blocked} className="space-y-4">
        {item.items.includes("reference_contract") && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t("contractHelp")}</p>
            {item.referenceConfirmedAt ? (
              <p className="text-sm">
                {t("referenceConfirmed", { date: date(item.referenceConfirmedAt) })}
              </p>
            ) : (
              <Button type="button" variant="outline" onClick={onLinkContract}>
                {t("contract")}
              </Button>
            )}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor={ids.text}>{t("text")}</Label>
          <textarea
            id={ids.text}
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={2000}
            rows={4}
            className="w-full rounded-md border border-input bg-background p-3"
          />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t("documents")}</legend>
          <p className="text-xs text-muted-foreground">{t("documentsHelp")}</p>
          {candidates.isPending ? (
            <p className="text-sm">{t("loading")}</p>
          ) : candidates.isError ? (
            <Button type="button" variant="outline" onClick={() => void candidates.refetch()}>
              {t("reload")}
            </Button>
          ) : candidates.data.items.length ? (
            <>
              {candidates.data.items.map((candidate) => (
                <label key={candidate.documentId} className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={candidate.documentId in selected}
                    disabled={
                      !(candidate.documentId in selected) && Object.keys(selected).length >= 5
                    }
                    onChange={(event) =>
                      setSelected((current) => {
                        const next = { ...current };
                        if (event.target.checked)
                          next[candidate.documentId] = candidate.fingerprint;
                        else delete next[candidate.documentId];
                        return next;
                      })
                    }
                  />
                  {candidate.name}
                </label>
              ))}
              {candidates.data.nextCursor && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCursor(candidates.data.nextCursor!)}
                >
                  {t("more")}
                </Button>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noDocuments")}</p>
          )}
        </fieldset>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          {t("confirm")}
        </label>
        <Button type="submit">{t("send")}</Button>
      </fieldset>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {attempt.current && !blocked && (
        <Button type="button" disabled={pending} onClick={() => void send()}>
          {t("retryExact")}
        </Button>
      )}
    </form>
  );
}
export function WalletComplementsDialog({
  identity,
  leadId,
  onClose,
  onLinkContract,
}: {
  identity: IdentityMe;
  leadId: string;
  onClose: () => void;
  onLinkContract: () => void;
}) {
  const { t } = useTranslation("complements"),
    date = useDate(),
    [sent, setSent] = useState(false);
  const list = useQuery({
    queryKey: queryKey(identity, leadId),
    queryFn: ({ signal }) => partnerApi.walletComplements(leadId, signal),
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl" closeLabel={t("close")}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {sent && <p role="status">{t("sent")}</p>}
        {list.isPending ? (
          <p>{t("loading")}</p>
        ) : list.isError ? (
          <div role="alert" className="space-y-2">
            <p>{t("changed")}</p>
            <Button variant="outline" onClick={() => void list.refetch()}>
              {t("reload")}
            </Button>
          </div>
        ) : !list.data.items.length ? (
          <p className="text-muted-foreground">{t("empty")}</p>
        ) : (
          list.data.items.map((item) => (
            <article key={item.id} className="space-y-2 border-t border-border py-4 text-sm">
              <p className="font-medium">{t(`states.${item.state}`)}</p>
              <p className="text-muted-foreground">
                {t("requestedBy", { name: item.requestedBy, date: date(item.createdAt) })}
              </p>
              <ul className="list-disc pl-5">
                {item.items.map((value) => (
                  <li key={value}>{t(`items.${value}`)}</li>
                ))}
              </ul>
              <p className="whitespace-pre-wrap">{item.message}</p>
              {item.state === "open" && (
                <p className={item.overdue ? "text-destructive" : "text-muted-foreground"}>
                  {t(item.overdue ? "overdue" : "due", { date: date(item.dueAt) })}
                </p>
              )}
              {item.answer && (
                <div className="space-y-1 rounded-lg bg-muted/40 p-3">
                  <p className="font-medium">
                    {t("answered", { date: date(item.answer.answeredAt) })}
                  </p>
                  {item.answer.text && <p className="whitespace-pre-wrap">{item.answer.text}</p>}
                  {item.answer.documents.length > 0 && (
                    <ul className="space-y-1">
                      {item.answer.documents.map((document) => (
                        <li key={document.documentId}>
                          {document.canDownload && document.name ? (
                            <a
                              className="underline"
                              href={partnerApi.complementSourceUrl(
                                leadId,
                                item.id,
                                document.documentId,
                                true,
                              )}
                            >
                              {document.name}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">{t("changedDocument")}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {item.closure && (
                <p className="text-muted-foreground">
                  {t("closure", {
                    outcome: t(`outcomes.${item.closure.outcome}`),
                    date: date(item.closure.closedAt),
                  })}
                </p>
              )}
              {item.canAnswer && (
                <AnswerForm
                  identity={identity}
                  leadId={leadId}
                  item={item}
                  onLinkContract={onLinkContract}
                  onSaved={() => {
                    setSent(true);
                    void list.refetch();
                  }}
                />
              )}
            </article>
          ))
        )}
      </DialogContent>
    </Dialog>
  );
}
