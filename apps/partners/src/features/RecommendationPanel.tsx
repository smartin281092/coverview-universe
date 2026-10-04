import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
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
  recommendationInputSchema,
  type Recommendation,
  type RecommendationInput,
} from "@coverview/contracts/partner-recommendations";
import { PartnerApiError } from "@coverview/api-client/partner";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
import { readText } from "./Field";

const date = (value: string) =>
  new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium", timeZone: "Europe/Zurich" }).format(
    new Date(value),
  );
const area = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function Summary({ item, lead }: { item: Recommendation; lead: LeadDetail }) {
  const { t } = useTranslation("recommendations");
  return (
    <div className="space-y-2 text-sm">
      <p className="font-medium">
        {item.kind === "offer"
          ? t("choice.offer", { company: item.company ?? "", product: item.product ?? "" })
          : t(`choice.${item.kind}`)}
      </p>
      <p className="text-muted-foreground">
        {t("meta", { version: item.version, author: item.author, date: date(item.createdAt) })}
      </p>
      {item.status === "to_review" && <p role="status">{t("toReview")}</p>}
      <p className="whitespace-pre-wrap">{item.rationale}</p>
      {item.attention && (
        <p className="whitespace-pre-wrap text-muted-foreground">
          {t("attentionValue", { value: item.attention })}
        </p>
      )}
      {item.deviation && item.deviationReason && (
        <p className="whitespace-pre-wrap text-muted-foreground">
          {t("deviationValue", { value: item.deviationReason })}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {t("orientationAt", { kind: t(`orientationKind.${item.orientationKind}`) })}
      </p>
      {lead.stage === "completed" && <p className="text-xs">{t("closed")}</p>}
    </div>
  );
}

// The recommendation names a published version, keeping the current contract, or nothing; the
// server decides whether the choice departs from the orientation and requires a reason.
export function RecommendationPanel({ lead }: { lead: LeadDetail }) {
  const { t } = useTranslation("recommendations"),
    session = usePartner(),
    cache = useQueryClient(),
    form = useId(),
    key = [...session.queryKey, "recommendations", lead.id],
    [open, setOpen] = useState(false),
    [history, setHistory] = useState(false),
    [choice, setChoice] = useState<string>("none"),
    [error, setError] = useState<string | null>(null),
    attempt = useRef<{ payload: string; key: string } | null>(null),
    abort = useRef(new AbortController());
  useEffect(() => {
    const controller = new AbortController();
    abort.current = controller;
    return () => controller.abort();
  }, []);
  const dossier = useQuery({
    queryKey: [...key, lead.revision],
    queryFn: ({ signal }) => partnerApi.recommendations(lead.id, signal),
    gcTime: 0,
  });
  const save = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: (input: RecommendationInput) => {
      const parsed = recommendationInputSchema.parse(input),
        payload = JSON.stringify(parsed);
      if (attempt.current?.payload !== payload)
        attempt.current = { payload, key: crypto.randomUUID() };
      return partnerApi.recommend(lead.id, parsed, {
        csrfToken: session.identity.csrfToken,
        idempotencyKey: attempt.current.key,
        signal: abort.current.signal,
      });
    },
    onSuccess: () => {
      setOpen(false);
      setError(null);
      void cache.invalidateQueries({ queryKey: session.queryKey });
    },
    onError: (cause) =>
      setError(
        cause instanceof PartnerApiError && cause.code === "PARTNER_CONFLICT"
          ? t("conflict")
          : t("error"),
      ),
  });
  if (dossier.isPending || dossier.isError) return null;
  const data = dossier.data;
  const selected = data.choices.find((item) => (item.offerId ?? item.kind) === choice);
  const offerName = (offerId: string | null) => {
    const offer = lead.offers.find((item) => item.id === offerId);
    return offer ? t("choice.offer", { company: offer.company, product: offer.product }) : "";
  };
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (save.isPending || !selected) return;
    const values = new FormData(event.currentTarget);
    const reason = readText(values, "deviationReason").trim();
    save.mutate({
      kind: selected.kind,
      offerId: selected.offerId,
      rationale: readText(values, "rationale"),
      attention: readText(values, "attention"),
      deviationReason: selected.deviation ? reason : null,
      basis: data.basis,
    });
  }
  return (
    <section className="space-y-4 rounded-xl border border-border p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="font-semibold">{t("title")}</h3>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.history.length > 1 && (
            <Button variant="outline" onClick={() => setHistory(true)}>
              {t("history")}
            </Button>
          )}
          {data.canRecommend && lead.stage !== "completed" && (
            <Button onClick={() => setOpen(true)}>{t(data.current ? "revise" : "create")}</Button>
          )}
        </div>
      </div>
      {data.current ? (
        <Summary item={data.current} lead={lead} />
      ) : (
        <p className="text-sm">{t("none")}</p>
      )}
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!save.isPending) setOpen(value);
        }}
      >
        <DialogContent
          className="max-h-[90svh] overflow-y-auto sm:max-w-2xl"
          closeLabel={t("close")}
        >
          <DialogHeader>
            <DialogTitle>{t(data.current ? "revise" : "create")}</DialogTitle>
            <DialogDescription>
              {t("orientationNow", { kind: t(`orientationKind.${data.orientation.kind}`) })}
            </DialogDescription>
          </DialogHeader>
          <form id={form} className="space-y-4" onSubmit={submit}>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t("choiceLabel")}</legend>
              {data.choices.map((item) => {
                const value = item.offerId ?? item.kind;
                return (
                  <label key={value} className="flex items-start gap-3 text-sm">
                    <input
                      type="radio"
                      name="choice"
                      value={value}
                      checked={choice === value}
                      onChange={() => setChoice(value)}
                      className="mt-1"
                    />
                    <span>
                      {item.kind === "offer" ? offerName(item.offerId) : t(`choice.${item.kind}`)}
                      {item.deviation && (
                        <span className="block text-xs text-muted-foreground">
                          {t("deviationHint")}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor={`${form}-rationale`}>{t("rationale")}</Label>
              <textarea
                id={`${form}-rationale`}
                name="rationale"
                required
                minLength={20}
                maxLength={3000}
                rows={4}
                className={area}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${form}-attention`}>{t("attention")}</Label>
              <textarea
                id={`${form}-attention`}
                name="attention"
                maxLength={2000}
                rows={2}
                className={area}
              />
            </div>
            {selected?.deviation && (
              <div className="space-y-2">
                <Label htmlFor={`${form}-deviation`}>{t("deviation")}</Label>
                <textarea
                  id={`${form}-deviation`}
                  name="deviationReason"
                  required
                  minLength={20}
                  maxLength={2000}
                  rows={3}
                  className={area}
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">{t("publishNotice")}</p>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={save.isPending || !selected}>
              {t("publish")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={history} onOpenChange={setHistory}>
        <DialogContent
          className="max-h-[90svh] overflow-y-auto sm:max-w-2xl"
          closeLabel={t("close")}
        >
          <DialogHeader>
            <DialogTitle>{t("history")}</DialogTitle>
            <DialogDescription>{t("historyDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {data.history.map((item) => (
              <article key={item.id} className="rounded-lg border border-border p-4">
                <Summary item={item} lead={lead} />
              </article>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
