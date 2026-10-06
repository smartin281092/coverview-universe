import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Label,
} from "@coverview/ui";
import type { LeadDetail } from "@coverview/contracts/partner";
import {
  complementItemSchema,
  type AnalysisGaps,
  type ComplementRequest,
} from "@coverview/contracts/partner-complements";
import { PartnerApiError } from "@coverview/api-client/partner";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
import { formatDate, readDate, readText } from "./Field";

const area = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
type Mutation =
  | { kind: "request"; input: Parameters<typeof partnerApi.requestComplement>[1] }
  | { kind: "close"; id: string; input: Parameters<typeof partnerApi.closeComplement>[2] };

function Gaps({ gaps }: { gaps: AnalysisGaps }) {
  const { t } = useTranslation("complements");
  const professional = [
    gaps.offersToVerify > 0 && t("offersToVerify", { count: gaps.offersToVerify }),
    gaps.valuesToVerify > 0 && t("valuesToVerify", { count: gaps.valuesToVerify }),
    gaps.contractReviewPending && t("contractReviewPending"),
  ].filter((line): line is string => !!line);
  return (
    <div className="space-y-3 text-sm">
      <p className={gaps.incomplete ? "font-medium" : "text-muted-foreground"}>
        {t(gaps.incomplete ? "incomplete" : "complete")}
      </p>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
        <dt className="font-medium">{t("origin.client")}</dt>
        <dd>{t(`reference.${gaps.referenceContract}`)}</dd>
        <dt className="font-medium">{t("origin.professional")}</dt>
        <dd>{professional.length ? professional.join(" ") : t("nothingProfessional")}</dd>
        <dt className="font-medium">{t("origin.company")}</dt>
        <dd>
          {gaps.missingBenefits > 0
            ? t("missingBenefits", { count: gaps.missingBenefits })
            : t("nothingCompany")}
        </dd>
      </dl>
      <p className="text-xs text-muted-foreground">{t("humanNote")}</p>
    </div>
  );
}

function RequestItem({
  lead,
  item,
  onClose,
}: {
  lead: LeadDetail;
  item: ComplementRequest;
  onClose: () => void;
}) {
  const { t } = useTranslation("complements");
  return (
    <article className="space-y-2 border-t border-border pt-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={item.state === "answered" ? "default" : "outline"}>
          {t(`states.${item.state}`)}
        </Badge>
        <span className="text-muted-foreground">
          {t("requestedBy", { name: item.requestedBy, date: formatDate(item.createdAt) })}
        </span>
      </div>
      <p>{item.items.map((value) => t(`items.${value}`)).join(" · ")}</p>
      <p className="whitespace-pre-wrap">{item.message}</p>
      <p className={item.overdue ? "text-destructive" : "text-muted-foreground"}>
        {t(item.overdue ? "overdue" : "due", { date: formatDate(item.dueAt) })}
      </p>
      {item.pauseFollowUp && <p className="text-muted-foreground">{t("paused")}</p>}
      {item.referenceConfirmedAt && (
        <p>{t("referenceConfirmed", { date: formatDate(item.referenceConfirmedAt) })}</p>
      )}
      {item.answer && (
        <div className="space-y-2 rounded-lg bg-muted/40 p-3">
          <p className="font-medium">{t("answer", { date: formatDate(item.answer.answeredAt) })}</p>
          {item.answer.text && <p className="whitespace-pre-wrap">{item.answer.text}</p>}
          {item.answer.documents.length > 0 && (
            <>
              <p className="text-muted-foreground">{t("documents")}</p>
              <ul className="space-y-1">
                {item.answer.documents.map((document) => (
                  <li key={document.documentId}>
                    {document.canDownload && document.name ? (
                      <a
                        className="underline"
                        href={partnerApi.complementSourceUrl(lead.id, item.id, document.documentId)}
                      >
                        {document.name}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">{t("changedDocument")}</span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      {item.closure && (
        <p className="text-muted-foreground">
          {t("closure", {
            outcome: t(`outcomes.${item.closure.outcome}`),
            date: formatDate(item.closure.closedAt),
          })}
          {item.closure.note && ` — ${item.closure.note}`}
        </p>
      )}
      {item.canClose && (
        <Button variant="outline" onClick={onClose}>
          {t("close")}
        </Button>
      )}
    </article>
  );
}

// What the comparative analysis lacks by origin, and the complements asked of the client (C8e).
export function ComplementPanel({ lead }: { lead: LeadDetail }) {
  const { t } = useTranslation("complements"),
    session = usePartner(),
    cache = useQueryClient(),
    form = useId(),
    [asking, setAsking] = useState(false),
    [closing, setClosing] = useState<ComplementRequest | null>(null),
    [error, setError] = useState<string | null>(null),
    attempt = useRef<{ payload: string; key: string } | null>(null),
    abort = useRef(new AbortController());
  useEffect(() => {
    const controller = new AbortController();
    abort.current = controller;
    return () => controller.abort();
  }, []);
  const dossier = useQuery({
    queryKey: [...session.queryKey, "complements", lead.id, lead.revision],
    queryFn: ({ signal }) => partnerApi.partnerComplements(lead.id, signal),
    gcTime: 0,
    retry: false,
  });
  const save = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: (mutation: Mutation) => {
      const payload = JSON.stringify(mutation);
      if (attempt.current?.payload !== payload)
        attempt.current = { payload, key: crypto.randomUUID() };
      const options = {
        csrfToken: session.identity.csrfToken,
        idempotencyKey: attempt.current.key,
        signal: abort.current.signal,
      };
      return mutation.kind === "request"
        ? partnerApi.requestComplement(lead.id, mutation.input, options)
        : partnerApi.closeComplement(lead.id, mutation.id, mutation.input, options);
    },
    onSuccess: () => {
      setAsking(false);
      setClosing(null);
      setError(null);
      void cache.invalidateQueries({ queryKey: session.queryKey });
    },
    onError: (cause) =>
      setError(
        cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500
          ? t("conflict")
          : t("error"),
      ),
  });
  if (dossier.isPending || dossier.isError) return null;
  const data = dossier.data;
  function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (save.isPending) return;
    const values = new FormData(event.currentTarget);
    let dueAt: string | null;
    try {
      dueAt = readDate(values, "dueAt");
    } catch {
      dueAt = null;
    }
    const items = complementItemSchema.options.filter((value) => values.get(value) === "on");
    const message = readText(values, "message");
    if (!dueAt || !items.length || message.length < 10 || values.get("confirmed") !== "on") {
      setError(t("invalid"));
      return;
    }
    save.mutate({
      kind: "request",
      input: {
        items,
        message,
        dueAt,
        pauseFollowUp: values.get("pause") === "on",
        confirmed: true,
      },
    });
  }
  function close(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (save.isPending || !closing) return;
    const values = new FormData(event.currentTarget);
    const outcome = readText(values, "outcome");
    if (
      !["completed", "unanswered", "withdrawn"].includes(outcome) ||
      values.get("confirmed") !== "on"
    ) {
      setError(t("invalid"));
      return;
    }
    save.mutate({
      kind: "close",
      id: closing.id,
      input: {
        outcome: outcome as "completed" | "unanswered" | "withdrawn",
        note: readText(values, "note"),
        confirmed: true,
      },
    });
  }
  const outcomes = closing
    ? closing.state === "answered"
      ? (["completed"] as const)
      : closing.overdue
        ? (["unanswered", "withdrawn"] as const)
        : (["withdrawn"] as const)
    : [];
  return (
    <section className="space-y-4 rounded-xl border border-border p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="font-semibold">{t("title")}</h3>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        {data.canRequest && (
          <Button
            onClick={() => {
              setError(null);
              setAsking(true);
            }}
          >
            {t("request")}
          </Button>
        )}
      </div>
      <Gaps gaps={data.gaps} />
      {data.items.map((item) => (
        <RequestItem
          key={item.id}
          lead={lead}
          item={item}
          onClose={() => {
            setError(null);
            setClosing(item);
          }}
        />
      ))}
      <Dialog
        open={asking}
        onOpenChange={(value) => {
          if (!save.isPending) setAsking(value);
        }}
      >
        <DialogContent
          className="max-h-[90svh] overflow-y-auto sm:max-w-xl"
          closeLabel={t("dismiss")}
        >
          <DialogHeader>
            <DialogTitle>{t("request")}</DialogTitle>
            <DialogDescription>{t("requestDescription")}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4 text-sm" onSubmit={ask}>
            <fieldset className="space-y-2">
              <legend className="font-medium">{t("itemsLabel")}</legend>
              {complementItemSchema.options.map((value) => (
                <label key={value} className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    name={value}
                    defaultChecked={
                      value === "reference_contract" && data.gaps.referenceContract !== "confirmed"
                    }
                  />
                  {t(`items.${value}`)}
                </label>
              ))}
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor={`${form}-message`}>{t("message")}</Label>
              <textarea
                id={`${form}-message`}
                name="message"
                required
                minLength={10}
                maxLength={2000}
                rows={4}
                className={area}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${form}-due`}>{t("dueAt")}</Label>
              <input
                id={`${form}-due`}
                name="dueAt"
                type="datetime-local"
                required
                className="h-10 w-full rounded-md border border-input bg-background px-3"
              />
            </div>
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" name="pause" />
              {t("pause")}
            </label>
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" name="confirmed" required />
              {t("confirm")}
            </label>
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={save.isPending}>
              {t("send")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!closing}
        onOpenChange={(value) => {
          if (!value && !save.isPending) setClosing(null);
        }}
      >
        <DialogContent className="sm:max-w-lg" closeLabel={t("dismiss")}>
          <DialogHeader>
            <DialogTitle>{t("close")}</DialogTitle>
            <DialogDescription>{t("closeDescription")}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4 text-sm" onSubmit={close}>
            <div className="space-y-2">
              <Label htmlFor={`${form}-outcome`}>{t("outcome")}</Label>
              <select
                id={`${form}-outcome`}
                name="outcome"
                required
                className="min-h-11 w-full rounded-md border border-input bg-background px-3"
              >
                {outcomes.map((value) => (
                  <option key={value} value={value}>
                    {t(`outcomes.${value}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${form}-note`}>{t("note")}</Label>
              <textarea
                id={`${form}-note`}
                name="note"
                maxLength={2000}
                rows={3}
                className={area}
              />
            </div>
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" name="confirmed" required />
              {t("closeConfirm")}
            </label>
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={save.isPending}>
              {t("closeSubmit")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
