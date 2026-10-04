import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { IdentityMe } from "@coverview/api-client";
import { PartnerApiError } from "@coverview/api-client/partner";
import {
  marketMandateInputSchema,
  type MarketReservation,
} from "@coverview/contracts/partner-economy";
import {
  Button,
  Badge,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@coverview/ui";
import { partnerApi } from "../../partner-api";
const schema = z.object({
  reason: z.string().trim().min(10).max(2000),
  confirmed: z.boolean().refine((v) => v),
});
export function MarketMandatesDialog({
  identity,
  leadId,
  onClose,
}: {
  identity: IdentityMe;
  leadId: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation("offers"),
    client = useQueryClient(),
    tr = (s: string) => t(`marketMandates.${s}`);
  const queryKey = [
    "private",
    identity.user.id,
    identity.session.id,
    "wallet-leads",
    "market-mandates",
    leadId,
  ];
  const [cursor, setCursor] = useState<string>(),
    [choice, setChoice] = useState<{
      reservation: MarketReservation;
      decision: "accept" | "decline" | "withdraw";
    }>(),
    [review, setReview] = useState<z.infer<typeof marketMandateInputSchema>>(),
    [pending, setPending] = useState(false),
    [blocked, setBlocked] = useState(false),
    [error, setError] = useState("");
  const attempt = useRef<{
      id: string;
      input: z.infer<typeof marketMandateInputSchema>;
      key: string;
    } | null>(null),
    controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const query = useQuery({
    queryKey: [...queryKey, cursor],
    queryFn: ({ signal }) => partnerApi.marketMandates(leadId, cursor, signal),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 10000,
  });
  const data = query.isError || blocked ? undefined : query.data;
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { reason: "", confirmed: false },
  });
  const date = (s: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Zurich",
    }).format(new Date(s));
  const current = data?.items.find((r) => r.id === choice?.reservation.id),
    canSend =
      !!current?.canMandate &&
      (choice?.decision === "withdraw"
        ? current.mandate === "accepted"
        : current.state === "reserved" && current.mandate === "pending");
  async function send() {
    if (!choice || !review || pending || blocked || (!canSend && !attempt.current)) return;
    attempt.current ??= { id: choice.reservation.id, input: review, key: crypto.randomUUID() };
    setPending(true);
    setError("");
    controller.current = new AbortController();
    try {
      await partnerApi.decideMarketMandate(attempt.current.id, attempt.current.input, {
        csrfToken: identity.csrfToken,
        idempotencyKey: attempt.current.key,
        signal: controller.current.signal,
      });
      attempt.current = null;
      setChoice(undefined);
      setReview(undefined);
      form.reset();
      void client.invalidateQueries({
        queryKey: ["private", identity.user.id, identity.session.id, "wallet-leads"],
      });
    } catch (cause) {
      if (controller.current.signal.aborted) return;
      const definitive =
        cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500;
      setBlocked(definitive);
      setError(tr(definitive ? "changed" : "uncertain"));
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent
        className="max-h-[90svh] overflow-y-auto sm:max-w-2xl"
        closeLabel={tr("close")}
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>{tr("title")}</DialogTitle>
          <DialogDescription>{tr("intro")}</DialogDescription>
        </DialogHeader>
        {!data ? (
          <div role={query.isError || blocked ? "alert" : "status"}>
            <p>{tr(query.isError || blocked ? "changed" : "loading")}</p>
            <Button variant="outline" disabled={pending} onClick={() => void query.refetch()}>
              {tr("retry")}
            </Button>
          </div>
        ) : choice ? (
          <div className="space-y-4">
            <h3 className="font-semibold">
              {tr(`decision.${choice.decision}`)}
              {tr("separator")}
              {choice.reservation.targetName}
            </h3>
            {current && (
              <>
                <p className="whitespace-pre-wrap">{current.mission.scope}</p>
                <p>
                  {tr("validUntil")} {date(current.mission.validUntil)}
                </p>
              </>
            )}
            {!canSend && <p role="alert">{tr("changed")}</p>}
            {review ? (
              <>
                <p className="whitespace-pre-wrap">{review.reason}</p>
                <p>{tr("review")}</p>
                <Button
                  disabled={pending || blocked || (!canSend && !attempt.current)}
                  onClick={() => void send()}
                >
                  {tr(pending ? "saving" : attempt.current ? "retrySame" : "confirm")}
                </Button>
              </>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(e) =>
                  void form.handleSubmit((v) =>
                    setReview(marketMandateInputSchema.parse({ ...v, decision: choice.decision })),
                  )(e)
                }
              >
                <Label htmlFor="market-mandate-reason">{tr("reason")}</Label>
                <textarea
                  id="market-mandate-reason"
                  rows={3}
                  maxLength={2000}
                  className="w-full rounded-md border border-input bg-background p-3 text-sm"
                  {...form.register("reason")}
                  required
                />
                <label className="flex gap-3 text-sm">
                  <input type="checkbox" {...form.register("confirmed")} required />
                  {tr("consent")}
                </label>
                {Object.keys(form.formState.errors).length > 0 && (
                  <p role="alert">{tr("invalid")}</p>
                )}
                <Button type="submit" disabled={!canSend}>
                  {tr("review")}
                </Button>
              </form>
            )}
            <Button
              variant="outline"
              disabled={pending || !!attempt.current}
              onClick={() => {
                setChoice(undefined);
                setReview(undefined);
                form.reset();
              }}
            >
              {tr("back")}
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {!data.items.length && <p>{tr("empty")}</p>}
            {data.items.map((r) => (
              <article key={r.id} className="space-y-4 rounded-xl border border-border p-5">
                <h3 className="font-semibold">
                  {r.publisherName}
                  {tr("arrow")}
                  {r.targetName}
                </h3>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{tr(`state.${r.state}`)}</Badge>
                  <Badge variant="outline">{tr(`state.${r.mandate}`)}</Badge>
                </div>
                <p>
                  {tr(`mode.${r.mission.mode}`)}
                  {tr("separator")}
                  {tr(`access.${r.mission.access}`)}
                  {tr("separator")} {tr(`communication.${r.mission.communication}`)}
                </p>
                <dl className="space-y-3">
                  {(["scope", "responsibilities", "powers", "limitations"] as const).map((k) => (
                    <div key={k}>
                      <dt className="text-sm text-muted-foreground">{tr(k)}</dt>
                      <dd className="whitespace-pre-wrap">{r.mission[k]}</dd>
                    </div>
                  ))}
                </dl>
                <p>
                  {tr("validUntil")} {date(r.mission.validUntil)}
                </p>
                <p>
                  {tr("responseUntil")} {date(r.expiresAt)}
                </p>
                {r.canMandate && (
                  <div className="flex flex-wrap gap-3">
                    {(r.mandate === "accepted"
                      ? ["withdraw" as const]
                      : r.mandate === "pending"
                        ? ["accept" as const, "decline" as const]
                        : []
                    ).map((decision) => (
                      <Button
                        key={decision}
                        variant={decision === "accept" ? "default" : "outline"}
                        onClick={() => {
                          setChoice({ reservation: r, decision });
                          setError("");
                        }}
                      >
                        {tr(`decision.${decision}`)}
                      </Button>
                    ))}
                  </div>
                )}
              </article>
            ))}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setCursor(undefined)}>
                {tr("first")}
              </Button>
              <Button
                variant="outline"
                disabled={!data.nextCursor}
                onClick={() => setCursor(data.nextCursor ?? undefined)}
              >
                {tr("next")}
              </Button>
            </div>
          </div>
        )}
        {!data && attempt.current && !blocked && (
          <Button disabled={pending} onClick={() => void send()}>
            {tr("retrySame")}
          </Button>
        )}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
