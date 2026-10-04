import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { PartnerApiError } from "@coverview/api-client/partner";
import {
  counselRequestInputSchema,
  counselActionInputSchema,
  type CounselRequestInput,
  type CounselActionInput,
  type CounselRequest,
} from "@coverview/contracts/partner";
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  parseZurichDateTime,
} from "@coverview/ui";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
import { formatDate } from "./Field";

const schema = counselRequestInputSchema
  .extend({
    dueAt: z.string().transform((v, ctx) => {
      try {
        return parseZurichDateTime(v);
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid date" });
        return z.NEVER;
      }
    }),
    shareConfirmed: z.boolean(),
  })
  .pipe(counselRequestInputSchema);
const withdrawal = z
  .object({ reason: z.string() })
  .transform((v): unknown => ({ ...v, action: "withdraw", revision: 0 }))
  .pipe(counselActionInputSchema);
export function CounselDialog({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const { t } = useTranslation(),
    session = usePartner(),
    client = useQueryClient();
  const [cursor, setCursor] = useState<string>(),
    [draft, setDraft] = useState<string | null>(null),
    [selected, setSelected] = useState<CounselRequest | null>(null);
  const [pending, setPending] = useState(false),
    [blocked, setBlocked] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const attempt = useRef<
    | { type: "request"; input: CounselRequestInput; key: string }
    | { type: "withdraw"; id: string; input: CounselActionInput; key: string }
    | null
  >(null);
  const queryKey = [...session.queryKey, "counsel", leadId, cursor];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => partnerApi.counselPersonal(leadId, cursor, signal),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 10000,
  });
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { summary: "", nextAction: "", dueAt: "", shareConfirmed: false },
  });
  const withdraw = useForm<z.input<typeof withdrawal>, unknown, z.output<typeof withdrawal>>({
    resolver: zodResolver(withdrawal),
    defaultValues: { reason: "" },
  });
  const current = !query.isError && !blocked ? query.data : undefined;
  const changed =
    !current ||
    (!!draft && draft !== current.basis) ||
    (!!selected &&
      !current.requests.items.some(
        (r) => r.id === selected.id && r.revision === selected.revision && r.canWithdraw,
      ));
  async function send() {
    if (pending || blocked || !attempt.current) return;
    setPending(true);
    setError("");
    try {
      const a = attempt.current,
        options = { csrfToken: session.identity.csrfToken, idempotencyKey: a.key };
      if (a.type === "request") await partnerApi.requestCounsel(leadId, a.input, options);
      else await partnerApi.actCounsel(a.id, a.input, options);
      attempt.current = null;
      setDraft(null);
      setSelected(null);
      setSaved(true);
      await client.cancelQueries({ queryKey });
      await query.refetch();
    } catch (cause) {
      const definitive =
        cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500;
      setBlocked(definitive);
      setError(t(definitive ? "counsel.conflict" : "counsel.uncertain"));
      client.removeQueries({ queryKey });
    } finally {
      setPending(false);
    }
  }
  const locked = pending || !!attempt.current;
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !pending && !(attempt.current && !blocked)) onClose();
      }}
    >
      <DialogContent
        closeLabel={t("close")}
        showCloseButton={!pending && !(attempt.current && !blocked)}
        className="max-h-[90svh] overflow-y-auto sm:max-w-xl"
      >
        <DialogHeader>
          <DialogTitle>{t("counsel.title")}</DialogTitle>
          <DialogDescription>{t("counsel.description")}</DialogDescription>
        </DialogHeader>
        {saved && <p role="status">{t("counsel.saved")}</p>}
        {error && <p role="alert">{error}</p>}
        {!!attempt.current && !blocked && (
          <Button disabled={pending} onClick={() => void send()}>
            {t(pending ? "loading" : "counsel.retryExact")}
          </Button>
        )}
        {(query.isError || blocked) && !(attempt.current && !blocked) && (
          <>
            <p role="alert">{t("counsel.failed")}</p>
            <Button
              onClick={() => {
                attempt.current = null;
                setBlocked(false);
                setError("");
                setDraft(null);
                setSelected(null);
                void query.refetch();
              }}
            >
              {t("retry")}
            </Button>
          </>
        )}
        {query.isPending && !error && <p role="status">{t("loading")}</p>}
        {current && (
          <>
            {draft ? (
              <form
                className="space-y-4"
                onSubmit={(event) =>
                  void form.handleSubmit((input) => {
                    if (changed || locked || attempt.current) return;
                    attempt.current = { type: "request", input, key: crypto.randomUUID() };
                    void send();
                  })(event)
                }
              >
                {changed && <p role="alert">{t("counsel.conflict")}</p>}
                <fieldset
                  disabled={locked || changed}
                  className="space-y-4"
                  aria-describedby={
                    Object.keys(form.formState.errors).length ? "counsel-input-errors" : undefined
                  }
                >
                  <legend className="sr-only">{t("counsel.create")}</legend>
                  <Label htmlFor="counsel-kind">{t("counsel.kindLabel")}</Label>
                  <select
                    id="counsel-kind"
                    aria-invalid={!!form.formState.errors.kind}
                    className="w-full rounded-md border bg-background p-3"
                    {...form.register("kind")}
                  >
                    <option value="">{t("counsel.choose")}</option>
                    {["specialist", "reassignment", "clarification"].map((k) => (
                      <option key={k} value={k}>
                        {t(`counsel.kind.${k}`)}
                      </option>
                    ))}
                  </select>
                  <Label htmlFor="counsel-summary">{t("counsel.summary")}</Label>
                  <textarea
                    id="counsel-summary"
                    aria-invalid={!!form.formState.errors.summary}
                    className="min-h-28 w-full rounded-md border bg-background p-3"
                    maxLength={1500}
                    {...form.register("summary")}
                  />
                  <p className="text-sm text-muted-foreground">{t("counsel.privacy")}</p>
                  <Label htmlFor="counsel-next">{t("counsel.nextAction")}</Label>
                  <Input
                    id="counsel-next"
                    maxLength={240}
                    aria-invalid={!!form.formState.errors.nextAction}
                    {...form.register("nextAction")}
                  />
                  <Label htmlFor="counsel-due">{t("counsel.dueAt")}</Label>
                  <Input
                    id="counsel-due"
                    type="datetime-local"
                    aria-invalid={!!form.formState.errors.dueAt}
                    {...form.register("dueAt")}
                  />
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      aria-invalid={!!form.formState.errors.shareConfirmed}
                      {...form.register("shareConfirmed")}
                    />
                    <span>{t("counsel.shareConfirmed")}</span>
                  </label>
                </fieldset>
                {Object.keys(form.formState.errors).length > 0 && (
                  <p id="counsel-input-errors" role="alert">
                    {t("counsel.invalid")}
                  </p>
                )}
                <Button type="submit" disabled={locked || changed}>
                  {t("counsel.send")}
                </Button>
                <Button variant="outline" disabled={locked} onClick={() => setDraft(null)}>
                  {t("cancel")}
                </Button>
              </form>
            ) : selected ? (
              <form
                className="space-y-4"
                onSubmit={(event) =>
                  void withdraw.handleSubmit((values) => {
                    if (changed || locked || attempt.current) return;
                    attempt.current = {
                      type: "withdraw",
                      id: selected.id,
                      input: { ...values, revision: selected.revision },
                      key: crypto.randomUUID(),
                    };
                    void send();
                  })(event)
                }
              >
                <p>{selected.request.summary}</p>
                {changed && <p role="alert">{t("counsel.conflict")}</p>}
                <Label htmlFor="counsel-withdraw-reason">{t("counsel.withdrawReason")}</Label>
                <Input
                  id="counsel-withdraw-reason"
                  disabled={locked || changed}
                  {...withdraw.register("reason")}
                />
                {!!withdraw.formState.errors.reason && <p role="alert">{t("counsel.invalid")}</p>}
                <Button type="submit" disabled={locked || changed}>
                  {t("counsel.withdraw")}
                </Button>
                <Button variant="outline" disabled={locked} onClick={() => setSelected(null)}>
                  {t("cancel")}
                </Button>
              </form>
            ) : (
              <>
                <section className="space-y-3">
                  <h3 className="font-medium">{t("counsel.personal")}</h3>
                  <p className="text-sm">
                    {t("counsel.assessedAt", { date: formatDate(current.assessedAt) })}
                  </p>
                  {(
                    [
                      ["needCapacity", current.capacity],
                      ["needConflict", current.conflict],
                      ["needExpertise", current.expertise],
                    ] as const
                  ).map(([prefix, value]) => (
                    <p key={prefix}>
                      {t("counsel.assessment", {
                        name: t(`${prefix}.title`),
                        result: t(
                          value.effectivePosition
                            ? `${prefix}.position.${value.effectivePosition}`
                            : `${prefix}.status.${value.status}`,
                        ),
                      })}
                    </p>
                  ))}
                  <p className="text-sm text-muted-foreground">{t("counsel.distribution")}</p>
                  <Button
                    disabled={locked || !current.canRequest}
                    onClick={() => {
                      setSaved(false);
                      setDraft(current.basis);
                      form.reset({
                        basis: current.basis,
                        summary: "",
                        nextAction: "",
                        dueAt: "",
                        shareConfirmed: false,
                      });
                    }}
                  >
                    {t("counsel.create")}
                  </Button>
                </section>
                <section className="space-y-4">
                  <h3 className="font-medium">{t("counsel.history")}</h3>
                  {!current.requests.items.length && <p>{t("counsel.empty")}</p>}
                  {current.requests.items.map((r) => (
                    <article key={r.id} className="space-y-2 rounded-lg border p-4">
                      <p className="font-medium">{t(`counsel.state.${r.state}`)}</p>
                      <p>{r.request.summary}</p>
                      <p>{r.nextAction}</p>
                      <p>{formatDate(r.dueAt)}</p>
                      {r.history.map((h) => (
                        <p key={h.revision} className="text-sm">
                          {t("counsel.historyEntry", {
                            date: formatDate(h.recordedAt),
                            reason: h.reason,
                          })}
                        </p>
                      ))}
                      {r.history.length === 20 && <p>{t("counsel.historyLimit")}</p>}
                      {r.canWithdraw && (
                        <Button
                          variant="outline"
                          disabled={locked}
                          onClick={() => {
                            setSelected(r);
                            withdraw.reset({ reason: "" });
                          }}
                        >
                          {t("counsel.withdraw")}
                        </Button>
                      )}
                    </article>
                  ))}
                  <div className="flex gap-3">
                    {cursor && (
                      <Button variant="outline" onClick={() => setCursor(undefined)}>
                        {t("counsel.first")}
                      </Button>
                    )}
                    {current.requests.nextCursor && (
                      <Button
                        variant="outline"
                        onClick={() => setCursor(current.requests.nextCursor ?? undefined)}
                      >
                        {t("counsel.more")}
                      </Button>
                    )}
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
