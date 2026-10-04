import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import { createPartnerClient, PartnerApiError } from "@coverview/api-client/partner";
import {
  counselActionInputSchema,
  collaborationTermsSchema,
  type CounselRequest,
  type CounselCandidate,
  type CounselActionInput,
} from "@coverview/contracts/partner";
import {
  Badge,
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

const api = createPartnerClient(
  import.meta.env.VITE_API_URL ??
    (import.meta.env.DEV ? "http://127.0.0.1:4100" : window.location.origin),
);
const policy = { gcTime: 0, staleTime: 0, retry: false, refetchInterval: 10000 } as const;
const control = "w-full rounded-md border border-input bg-background p-3 text-sm";
const root = (identity: IdentityMe) => [
  "private",
  identity.user.id,
  identity.session.id,
  "partner-counsel",
];
type Selection = {
  request: CounselRequest;
  action: "follow_up" | "resolve" | "propose";
  candidate?: CounselCandidate;
};

function ActionForm({
  selection,
  current,
  candidate,
  identity,
  blocked,
  onBusy,
  onSaved,
  onBack,
}: {
  selection: Selection;
  current: CounselRequest | undefined;
  candidate: CounselCandidate | undefined;
  identity: IdentityMe;
  blocked: boolean;
  onBusy: (v: boolean) => void;
  onSaved: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation("partner"),
    client = useQueryClient();
  const [pending, setPending] = useState(false),
    [denied, setDenied] = useState(false),
    [error, setError] = useState("");
  const attempt = useRef<{ input: CounselActionInput; key: string } | null>(null);
  const schema = z
    .object({
      reason: z.string(),
      nextAction: z.string(),
      dueAt: z.string(),
      mode: collaborationTermsSchema.shape.mode,
      access: collaborationTermsSchema.shape.access,
      communication: collaborationTermsSchema.shape.communication,
      scope: z.string(),
      responsibilities: z.string(),
      economicNote: z.string(),
      confirmed: z.boolean(),
      transmitted: z.boolean(),
      rights: z.boolean(),
    })
    .transform((v, ctx): unknown => {
      const base = {
        action: selection.action,
        revision: selection.request.revision,
        reason: v.reason,
      };
      if (selection.action === "resolve") return base;
      let dueAt: string;
      try {
        dueAt = parseZurichDateTime(v.dueAt);
      } catch {
        ctx.addIssue({ code: "custom", path: ["dueAt"], message: "Invalid date" });
        return z.NEVER;
      }
      const follow = { ...base, nextAction: v.nextAction, dueAt };
      return selection.action === "follow_up"
        ? follow
        : {
            ...follow,
            candidateBasis: selection.candidate?.basis,
            humanReviewConfirmed: v.confirmed,
            terms: {
              targetId: selection.candidate?.id,
              mode: v.mode,
              access: v.mode === "co_advice" ? v.access : "contribute",
              communication: v.mode === "co_advice" ? v.communication : "client_direct",
              scope: v.scope,
              responsibilities: v.responsibilities,
              reason: v.reason,
              economicNote: v.economicNote,
              existingRightsPreserved: v.rights,
              transmissionConfirmed: v.transmitted,
            },
          };
    })
    .transform((value, ctx) => {
      const result = counselActionInputSchema.safeParse(value);
      if (!result.success) {
        const aliases: Record<string, string> = {
          humanReviewConfirmed: "confirmed",
          transmissionConfirmed: "transmitted",
          existingRightsPreserved: "rights",
        };
        for (const issue of result.error.issues) {
          const path = issue.path
            .filter((p) => p !== "terms")
            .map((p) => (typeof p === "string" ? (aliases[p] ?? p) : p));
          ctx.addIssue({ code: "custom", path, message: issue.message });
        }
        return z.NEVER;
      }
      return result.data;
    });
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      reason: "",
      nextAction: "",
      dueAt: "",
      mode: "co_advice",
      access: "read",
      communication: "referent_only",
      scope: "",
      responsibilities: "",
      economicNote: "",
      confirmed: false,
      transmitted: false,
      rights: false,
    },
  });
  const changed =
    !current ||
    !current.canAct ||
    current.revision !== selection.request.revision ||
    current.state !== selection.request.state ||
    (selection.action === "propose" &&
      (!candidate || candidate.basis !== selection.candidate?.basis));
  async function send() {
    if (pending || denied || blocked || !attempt.current) return;
    setPending(true);
    onBusy(true);
    setError("");
    try {
      await api.actCounsel(selection.request.id, attempt.current.input, {
        csrfToken: identity.csrfToken,
        idempotencyKey: attempt.current.key,
      });
      await client.cancelQueries({ queryKey: root(identity) });
      await client.invalidateQueries({ queryKey: root(identity) });
      attempt.current = null;
      onBusy(false);
      onSaved();
    } catch (cause) {
      const definitive =
        cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500;
      setDenied(definitive);
      setError(t(definitive ? "counsel.conflict" : "counsel.uncertain"));
      if (definitive) onBusy(false);
    } finally {
      setPending(false);
    }
  }
  const mode = form.watch("mode"),
    locked = pending || !!attempt.current || changed || denied || blocked;
  return (
    <form
      className="space-y-4"
      onSubmit={(e) =>
        void form.handleSubmit((input) => {
          if (locked || attempt.current) return;
          attempt.current = { input, key: crypto.randomUUID() };
          void send();
        })(e)
      }
    >
      <h3 className="font-medium">{t(`counsel.action.${selection.action}`)}</h3>
      {current && candidate && !blocked && selection.candidate && (
        <p>
          {t("counsel.person", {
            name: selection.candidate.name,
            organization: selection.candidate.organization,
          })}
        </p>
      )}
      {changed && !attempt.current && <p role="alert">{t("counsel.conflict")}</p>}
      {error && <p role="alert">{error}</p>}
      <fieldset
        disabled={locked}
        hidden={!current || blocked}
        className="space-y-4"
        aria-describedby={
          Object.keys(form.formState.errors).length ? "counsel-action-errors" : undefined
        }
      >
        <legend className="sr-only">{t("counsel.decision")}</legend>
        <Label htmlFor="counsel-action-reason">{t("counsel.reason")}</Label>
        <textarea
          id="counsel-action-reason"
          className={control}
          rows={3}
          maxLength={2000}
          {...form.register("reason")}
        />
        {selection.action !== "resolve" && (
          <>
            <Label htmlFor="counsel-action-next">{t("counsel.nextAction")}</Label>
            <Input id="counsel-action-next" maxLength={240} {...form.register("nextAction")} />
            <Label htmlFor="counsel-action-due">{t("counsel.dueAt")}</Label>
            <Input id="counsel-action-due" type="datetime-local" {...form.register("dueAt")} />
          </>
        )}
        {selection.action === "propose" && (
          <>
            <Label htmlFor="counsel-action-mode">{t("counsel.modeLabel")}</Label>
            <select id="counsel-action-mode" className={control} {...form.register("mode")}>
              {["co_advice", "one_off", "transfer"].map((v) => (
                <option key={v} value={v}>
                  {t(`counsel.mode.${v}`)}
                </option>
              ))}
            </select>
            <p className="text-sm text-muted-foreground">{t(`counsel.modeHelp.${mode}`)}</p>
            {mode === "co_advice" && (
              <>
                <Label htmlFor="counsel-action-access">{t("counsel.accessLabel")}</Label>
                <select id="counsel-action-access" className={control} {...form.register("access")}>
                  {["read", "contribute"].map((v) => (
                    <option key={v} value={v}>
                      {t(`counsel.access.${v}`)}
                    </option>
                  ))}
                </select>
                <Label htmlFor="counsel-action-communication">
                  {t("counsel.communicationLabel")}
                </Label>
                <select
                  id="counsel-action-communication"
                  className={control}
                  {...form.register("communication")}
                >
                  {["referent_only", "client_direct"].map((v) => (
                    <option key={v} value={v}>
                      {t(`counsel.communication.${v}`)}
                    </option>
                  ))}
                </select>
              </>
            )}
            {(["scope", "responsibilities", "economicNote"] as const).map((name) => (
              <div key={name} className="space-y-2">
                <Label htmlFor={`counsel-action-${name}`}>{t(`counsel.${name}`)}</Label>
                <textarea
                  id={`counsel-action-${name}`}
                  rows={3}
                  className={control}
                  maxLength={2000}
                  {...form.register(name)}
                />
              </div>
            ))}
            <p className="text-sm text-muted-foreground">{t("counsel.economicHelp")}</p>
            {(["confirmed", "transmitted", "rights"] as const).map((name) => (
              <label key={name} className="flex items-start gap-3">
                <input type="checkbox" {...form.register(name)} />
                <span>{t(`counsel.${name}`)}</span>
              </label>
            ))}
          </>
        )}
      </fieldset>
      {Object.keys(form.formState.errors).length > 0 && (
        <p id="counsel-action-errors" role="alert">
          {t("counsel.invalid")}
        </p>
      )}
      {!attempt.current && (
        <Button type="submit" disabled={locked}>
          {t("counsel.save")}
        </Button>
      )}
      {attempt.current && !denied && (
        <Button disabled={pending || blocked} onClick={() => void send()}>
          {t(pending ? "loading" : "counsel.retryExact")}
        </Button>
      )}
      <Button
        variant="outline"
        disabled={pending || (!!attempt.current && !denied)}
        onClick={onBack}
      >
        {t("counsel.back")}
      </Button>
    </form>
  );
}

function RequestDialog({
  id,
  identity,
  blocked,
  onClose,
}: {
  id: string;
  identity: IdentityMe;
  blocked: boolean;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation("partner");
  const [selection, setSelection] = useState<Selection | null>(null),
    [candidatesOpen, setCandidatesOpen] = useState(false),
    [cursor, setCursor] = useState<string>(),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  const query = useQuery({
    queryKey: [...root(identity), id],
    queryFn: ({ signal }) => api.counselRequest(id, signal),
    enabled: !blocked,
    ...policy,
  });
  const candidates = useQuery({
    queryKey: [...root(identity), id, "candidates", cursor],
    queryFn: ({ signal }) => api.counselCandidates(id, cursor, signal),
    enabled: !blocked && candidatesOpen && query.data?.state === "open",
    ...policy,
  });
  const current = !blocked && !query.isError ? query.data : undefined;
  const candidatesValue =
    current?.state === "open" && !candidates.isError && !blocked ? candidates.data : undefined;
  const date = (v: string | null) =>
    v
      ? new Intl.DateTimeFormat(i18n.language, {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Europe/Zurich",
        }).format(new Date(v))
      : t("counsel.unspecified");
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent
        closeLabel={t("counsel.close")}
        showCloseButton={!busy}
        className="max-h-[90svh] overflow-y-auto sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>{t("counsel.title")}</DialogTitle>
          <DialogDescription>{t("counsel.description")}</DialogDescription>
        </DialogHeader>
        {saved && <p role="status">{t("counsel.saved")}</p>}
        {query.isPending && <p role="status">{t("loading")}</p>}
        {(blocked || query.isError) && (
          <>
            <p role="alert">{t("counsel.failed")}</p>
            <Button disabled={blocked || busy} onClick={() => void query.refetch()}>
              {t("retry")}
            </Button>
          </>
        )}
        {current && (
          <section className="space-y-2">
            <p className="font-medium">{current.leadTitle}</p>
            <Badge variant="outline">{t(`counsel.state.${current.state}`)}</Badge>
            <p>
              {t("counsel.authorAt", { name: current.authorName, date: date(current.createdAt) })}
            </p>
            <p>{t(`counsel.kind.${current.request.kind}`)}</p>
            <p className="whitespace-pre-wrap">{current.request.summary}</p>
            <p>{current.nextAction}</p>
            <p>{date(current.dueAt)}</p>
            {current.history.map((h) => (
              <p key={h.revision} className="text-sm">
                {t("counsel.historyEntry", { date: date(h.recordedAt), reason: h.reason })}
              </p>
            ))}
            {current.history.length === 20 && <p>{t("counsel.historyLimit")}</p>}
            {current.collaboration && (
              <p>
                {t("counsel.collaborationState", {
                  state: t(`counsel.collaboration.${current.collaboration.state}`),
                  name: current.collaboration.targetName,
                })}
              </p>
            )}
          </section>
        )}
        {selection ? (
          <ActionForm
            key={`${selection.request.id}:${selection.request.revision}:${selection.action}:${selection.candidate?.basis ?? ""}`}
            selection={selection}
            current={current}
            candidate={candidatesValue?.items.find((c) => c.id === selection.candidate?.id)}
            identity={identity}
            blocked={blocked}
            onBusy={setBusy}
            onSaved={() => {
              setSelection(null);
              setSaved(true);
              setCandidatesOpen(false);
              void query.refetch();
            }}
            onBack={() => {
              setSelection(null);
              void query.refetch();
              void candidates.refetch();
            }}
          />
        ) : (
          current?.canAct && (
            <>
              <div className="flex flex-wrap gap-3">
                {["open", "awaiting_specialist"].includes(current.state) && (
                  <Button onClick={() => setSelection({ request: current, action: "follow_up" })}>
                    {t("counsel.action.follow_up")}
                  </Button>
                )}
                {current.collaboration?.state !== "proposed" && (
                  <Button
                    variant="outline"
                    onClick={() => setSelection({ request: current, action: "resolve" })}
                  >
                    {t("counsel.action.resolve")}
                  </Button>
                )}
                {current.state === "open" && (
                  <Button variant="outline" onClick={() => setCandidatesOpen(!candidatesOpen)}>
                    {t("counsel.candidates")}
                  </Button>
                )}
              </div>
              {candidatesOpen && current.state === "open" && (
                <section className="space-y-4">
                  <h3 className="font-medium">{t("counsel.candidates")}</h3>
                  <p>{t("counsel.candidateHelp")}</p>
                  {candidates.isPending ? (
                    <p role="status">{t("loading")}</p>
                  ) : candidates.isError ? (
                    <>
                      <p role="alert">{t("counsel.failed")}</p>
                      <Button onClick={() => void candidates.refetch()}>{t("retry")}</Button>
                    </>
                  ) : (
                    candidatesValue && (
                      <>
                        {!candidatesValue.items.length && <p>{t("counsel.noCandidates")}</p>}
                        {candidatesValue.items.map((c) => (
                          <article key={c.id} className="space-y-3 rounded-lg border p-4">
                            <h4 className="font-medium">
                              {t("counsel.person", { name: c.name, organization: c.organization })}
                            </h4>
                            {c.confirmedReferent && (
                              <Badge variant="outline">{t("counsel.referent")}</Badge>
                            )}
                            <p className="text-sm">
                              {t("counsel.assessedAt", { date: date(c.assessedAt) })}
                            </p>
                            <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2 text-sm">
                              {(["language", "region", "mode"] as const).map((k) => (
                                <div key={k} className="contents">
                                  <dt>{t(`counsel.criterion.${k}`)}</dt>
                                  <dd>{t(`counsel.comparison.${c[k]}`)}</dd>
                                </div>
                              ))}
                              <dt>{t("counsel.criterion.competence")}</dt>
                              <dd>
                                {t("counsel.competenceScope", {
                                  state: t(`counsel.competence.${c.competence.status}`),
                                  scope: c.competence.scope || t("counsel.unspecified"),
                                })}
                                <p>{t(`counsel.sourceStatus.${c.competenceSourceStatus}`)}</p>
                              </dd>
                              <dt>{t("counsel.criterion.capacity")}</dt>
                              <dd>
                                {t(
                                  c.capacity.position
                                    ? `counsel.capacity.${c.capacity.position}`
                                    : `counsel.capacity.${c.capacity.status}`,
                                )}
                              </dd>
                            </dl>
                            <p className="text-sm">
                              {t("counsel.sourceDates", {
                                competence: date(c.competence.reviewedAt),
                                practice: date(c.practice.declaredAt),
                                availability: date(c.availabilityDeclaredAt),
                                capacity: date(c.capacity.declaration?.declaredAt ?? null),
                              })}
                            </p>
                            <p className="text-sm">{t("counsel.remaining")}</p>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSaved(false);
                                setSelection({ request: current, action: "propose", candidate: c });
                              }}
                            >
                              {t("counsel.action.propose")}
                            </Button>
                          </article>
                        ))}
                        <div className="flex gap-3">
                          {cursor && (
                            <Button variant="outline" onClick={() => setCursor(undefined)}>
                              {t("counsel.first")}
                            </Button>
                          )}
                          {candidatesValue.nextCursor && (
                            <Button
                              variant="outline"
                              onClick={() => setCursor(candidatesValue.nextCursor ?? undefined)}
                            >
                              {t("counsel.more")}
                            </Button>
                          )}
                        </div>
                      </>
                    )
                  )}
                </section>
              )}
            </>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}

export function CounselQueue({ identity, blocked }: { identity: IdentityMe; blocked: boolean }) {
  const { t, i18n } = useTranslation("partner"),
    [cursor, setCursor] = useState<string>(),
    [selected, setSelected] = useState<string | null>(null);
  const query = useQuery({
    queryKey: [...root(identity), "queue", cursor],
    queryFn: ({ signal }) => api.counselQueue(cursor, signal),
    enabled: !blocked,
    ...policy,
  });
  return (
    <section className="space-y-4" aria-labelledby="counsel-queue">
      <h2 id="counsel-queue" className="text-xl font-semibold">
        {t("counsel.queue")}
      </h2>
      <p>{t("counsel.queueHelp")}</p>
      {selected && (
        <RequestDialog
          key={`${identity.user.id}:${identity.session.id}:${selected}`}
          id={selected}
          identity={identity}
          blocked={blocked}
          onClose={() => setSelected(null)}
        />
      )}
      {blocked || query.isError ? (
        <>
          <p role="alert">{t("counsel.failed")}</p>
          <Button disabled={blocked} onClick={() => void query.refetch()}>
            {t("retry")}
          </Button>
        </>
      ) : query.isPending ? (
        <p role="status">{t("loading")}</p>
      ) : (
        <>
          {!query.data.items.length && <p>{t("counsel.empty")}</p>}
          <ul className="space-y-3">
            {query.data.items.map((r) => (
              <li key={r.id} className="space-y-2 rounded-lg border p-4">
                <p className="font-medium">{r.leadTitle}</p>
                <p>
                  {t("counsel.authorState", {
                    name: r.authorName,
                    state: t(`counsel.state.${r.state}`),
                  })}
                </p>
                <p>{r.nextAction}</p>
                {r.dueAt && (
                  <p>
                    {new Intl.DateTimeFormat(i18n.language, {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Europe/Zurich",
                    }).format(new Date(r.dueAt))}{" "}
                    {Date.parse(r.dueAt) < Date.now() && t("counsel.overdue")}
                  </p>
                )}
                <Button variant="outline" onClick={() => setSelected(r.id)}>
                  {t("counsel.open")}
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex gap-3">
            {cursor && (
              <Button variant="outline" onClick={() => setCursor(undefined)}>
                {t("counsel.first")}
              </Button>
            )}
            {query.data.nextCursor && (
              <Button
                variant="outline"
                onClick={() => setCursor(query.data.nextCursor ?? undefined)}
              >
                {t("counsel.more")}
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
