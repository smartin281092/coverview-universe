import { useId, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import { createPartnerClient, PartnerApiError } from "@coverview/api-client/partner";
import type {
  AdminDataRequest,
  AdminDataRequestsQuery,
  DataErasureSummary,
  DataRequestOutcome,
} from "@coverview/contracts/partner-data";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  ErrorState,
  Label,
  LoadingState,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@coverview/ui";
import { AdminBoundary } from "../features/users/AdminBoundary";

const client = createPartnerClient(
  import.meta.env.VITE_API_URL ??
    (import.meta.env.DEV ? "http://127.0.0.1:4100" : window.location.origin),
);
const day = new Intl.DateTimeFormat("fr-CH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Zurich",
});
type Filter = AdminDataRequestsQuery["state"];

function useAttempt() {
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  return (payload: unknown) => {
    const text = JSON.stringify(payload);
    if (attempt.current?.payload !== text)
      attempt.current = { payload: text, key: crypto.randomUUID() };
    return attempt.current.key;
  };
}

function Subject({ item }: { item: AdminDataRequest }) {
  const { t } = useTranslation("dataRequests");
  return (
    <>
      {item.subject.kind === "profile"
        ? t("subject.profile", { name: item.subject.name ?? "" })
        : t(`subject.${item.subject.kind}`)}
    </>
  );
}

function Answer({
  item,
  pending,
  failed,
  onSubmit,
}: {
  item: AdminDataRequest;
  pending: boolean;
  failed: boolean;
  onSubmit: (outcome: DataRequestOutcome, answer: string) => void;
}) {
  const { t } = useTranslation("dataRequests"),
    answerId = useId();
  const note =
    item.kind === "erasure"
      ? item.surface === "wallet"
        ? "erasure"
        : "partnerErasure"
      : item.kind === "complete_access"
        ? "access"
        : item.kind === "rectification"
          ? "rectification"
          : null;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const outcome = item.allowedOutcomes.find((value) => value === data.get("outcome"));
    const text = data.get("answer");
    if (outcome && typeof text === "string") onSubmit(outcome, text.trim());
  }
  return (
    <form className="space-y-4" onSubmit={submit}>
      <h3 className="font-medium">{t("answerTitle")}</h3>
      {note && <p className="text-sm text-muted-foreground">{t(`notes.${note}`)}</p>}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("outcomeLabel")}</legend>
        {item.allowedOutcomes.map((outcome, index) => (
          <label key={outcome} className="flex items-center gap-3 text-sm">
            <input
              type="radio"
              name="outcome"
              value={outcome}
              defaultChecked={index === 0}
              required
            />
            {t(`outcome.${outcome}`)}
          </label>
        ))}
      </fieldset>
      <div className="space-y-2">
        <Label htmlFor={answerId}>{t("answerLabel")}</Label>
        <textarea
          id={answerId}
          name="answer"
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          aria-describedby={`${answerId}-hint`}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <p id={`${answerId}-hint`} className="text-xs text-muted-foreground">
          {t("answerHint")}
        </p>
      </div>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {t("saveError")}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {t("send")}
      </Button>
    </form>
  );
}

function ErasureSummary({ summary }: { summary: DataErasureSummary }) {
  const { t } = useTranslation("dataRequests");
  const holds = (values: string[]) =>
    new Intl.ListFormat("fr-CH", { type: "conjunction" }).format(
      values.map((hold) => t(`erasure.holds.${hold}`)),
    );
  return (
    <section className="space-y-3">
      <h3 className="font-medium">
        {t("erasure.summaryTitle", { date: day.format(new Date(summary.executedAt)) })}
      </h3>
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1">
        {Object.entries(summary.erased).map(([key, count]) => (
          <div key={key} className="contents">
            <dt className="text-muted-foreground">{t(`erasure.erased.${key}`)}</dt>
            <dd className="text-right font-medium">{count}</dd>
          </div>
        ))}
      </dl>
      {summary.kept.length > 0 && (
        <div className="space-y-1">
          <p className="font-medium">{t("erasure.keptTitle")}</p>
          <ul className="space-y-1">
            {summary.kept.map((lead) => (
              <li key={lead.leadId}>{t("erasure.kept", { holds: holds(lead.holds) })}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// The server's preview of a Wallet erasure, then its execution under an explicit attestation.
function ErasurePanel({
  item,
  identity,
  queryKey,
  onDone,
}: {
  item: AdminDataRequest;
  identity: IdentityMe;
  queryKey: unknown[];
  onDone: () => void;
}) {
  const { t } = useTranslation("dataRequests"),
    attemptFor = useAttempt(),
    answerId = useId(),
    [attested, setAttested] = useState(false),
    [answer, setAnswer] = useState(""),
    [confirming, setConfirming] = useState(false);
  const plan = useQuery({
    queryKey: [...queryKey, "erasure", item.id, item.revision],
    queryFn: ({ signal }) => client.erasurePlan(item.id, signal),
    gcTime: 0,
    retry: false,
  });
  const execute = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: (input: { revision: number; basis: string; answer: string }) =>
      client.executeErasure(
        item.id,
        { ...input, attestation: true },
        {
          csrfToken: identity.csrfToken,
          idempotencyKey: attemptFor({ action: "erasure", id: item.id, ...input }),
        },
      ),
    onSuccess: () => {
      setConfirming(false);
      onDone();
    },
    onError: () => setConfirming(false),
  });
  if (plan.isPending) return <LoadingState label={t("erasure.loading")} />;
  if (plan.isError)
    return (
      <ErrorState
        title={t("error")}
        description={t("error")}
        retryLabel={t("retry")}
        pendingLabel={t("loading")}
        onRetry={() => void plan.refetch()}
      />
    );
  const erasable = plan.data.leads.filter((lead) => lead.status === "erasable").length;
  const holds = (values: string[]) =>
    new Intl.ListFormat("fr-CH", { type: "conjunction" }).format(
      values.map((hold) => t(`erasure.holds.${hold}`)),
    );
  const ready = !plan.data.blocked && erasable > 0 && attested && answer.trim().length >= 10;
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h3 className="font-medium">{t("erasure.title")}</h3>
        <p className="text-muted-foreground">{t("erasure.description")}</p>
      </div>
      {plan.data.leads.length === 0 ? (
        <p>{t("erasure.none")}</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {plan.data.leads.map((lead) => (
            <li key={lead.id} className="space-y-1 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 break-words font-medium">{lead.title}</span>
                <Badge variant={lead.status === "erasable" ? "default" : "secondary"}>
                  {t(`erasure.status.${lead.status}`)}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {lead.holds.length > 0
                  ? t("erasure.leadKept", {
                      date: day.format(new Date(lead.createdAt)),
                      holds: holds(lead.holds),
                    })
                  : day.format(new Date(lead.createdAt))}
              </p>
            </li>
          ))}
        </ul>
      )}
      {plan.data.blocked ? (
        <p role="alert" className="text-destructive">
          {t(`erasure.blocked.${plan.data.blocked}`)}
        </p>
      ) : (
        <p className="text-muted-foreground">{t("erasure.erases")}</p>
      )}
      <div className="space-y-1">
        <p className="font-medium">{t("erasure.retainedTitle")}</p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          {plan.data.retained.map((key) => (
            <li key={key}>{t(`erasure.retained.${key}`)}</li>
          ))}
        </ul>
      </div>
      <Button variant="outline" size="sm" onClick={() => void plan.refetch()}>
        {t("erasure.refresh")}
      </Button>
      {!plan.data.blocked && erasable > 0 && (
        <div className="space-y-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={attested}
              onChange={(event) => setAttested(event.target.checked)}
              className="mt-1"
            />
            <span>{t("erasure.attestation")}</span>
          </label>
          <div className="space-y-2">
            <Label htmlFor={answerId}>{t("erasure.answerLabel")}</Label>
            <textarea
              id={answerId}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              minLength={10}
              maxLength={2000}
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          {execute.isError && (
            <p role="alert" className="text-destructive">
              {t(
                execute.error instanceof PartnerApiError &&
                  execute.error.code === "PARTNER_CONFLICT"
                  ? "erasure.stale"
                  : "erasure.failed",
              )}
            </p>
          )}
          <Button
            variant="destructive"
            disabled={!ready || execute.isPending}
            onClick={() => setConfirming(true)}
          >
            {t("erasure.execute")}
          </Button>
        </div>
      )}
      <Dialog open={confirming} onOpenChange={(open) => !execute.isPending && setConfirming(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("erasure.confirmTitle")}</DialogTitle>
            <DialogDescription>{t("erasure.confirm", { count: erasable })}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              variant="outline"
              disabled={execute.isPending}
              onClick={() => setConfirming(false)}
            >
              {t("erasure.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={execute.isPending}
              onClick={() =>
                execute.mutate({
                  revision: item.revision,
                  basis: plan.data.basis,
                  answer: answer.trim(),
                })
              }
            >
              {t("erasure.confirmAction")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function RequestSheet({
  id,
  identity,
  queryKey,
  onClose,
}: {
  id: string;
  identity: IdentityMe;
  queryKey: unknown[];
  onClose: () => void;
}) {
  const { t } = useTranslation("dataRequests"),
    cache = useQueryClient(),
    attemptFor = useAttempt(),
    [failed, setFailed] = useState(false);
  const detail = useQuery({
    queryKey: [...queryKey, "detail", id],
    queryFn: ({ signal }) => client.adminDataRequest(id, signal),
    gcTime: 0,
    retry: false,
  });
  const refresh = () => {
    setFailed(false);
    void cache.invalidateQueries({ queryKey });
  };
  const take = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: (revision: number) =>
      client.takeDataRequest(id, revision, {
        csrfToken: identity.csrfToken,
        idempotencyKey: attemptFor({ action: "take", id, revision }),
      }),
    onSuccess: refresh,
    onError: () => setFailed(true),
  });
  const answer = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: (input: { revision: number; outcome: DataRequestOutcome; answer: string }) =>
      client.answerDataRequest(id, input, {
        csrfToken: identity.csrfToken,
        idempotencyKey: attemptFor({ action: "answer", id, ...input }),
      }),
    onSuccess: refresh,
    onError: () => setFailed(true),
  });
  const pending = take.isPending || answer.isPending;
  const item = detail.data;
  return (
    <Sheet open onOpenChange={(open) => !open && !pending && onClose()}>
      <SheetContent
        className="w-full overflow-y-auto sm:max-w-lg"
        showCloseButton
        closeLabel={t("close")}
      >
        <SheetHeader>
          <SheetTitle>{item ? t(`kind.${item.kind}`) : t("loading")}</SheetTitle>
          <SheetDescription>
            {item
              ? t("requester", {
                  name: item.requester.name ?? t("unnamed"),
                  email: item.requester.email,
                })
              : ""}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-4 pb-6 text-sm">
          {detail.isPending ? (
            <LoadingState label={t("loading")} />
          ) : detail.isError ? (
            <ErrorState
              title={t("error")}
              description={t("error")}
              retryLabel={t("retry")}
              pendingLabel={t("loading")}
              onRetry={() => void detail.refetch()}
            />
          ) : item ? (
            <>
              <dl className="space-y-3">
                <div>
                  <dt className="text-muted-foreground">{t(`surface.${item.surface}`)}</dt>
                  <dd>
                    <Subject item={item} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("sheet.category")}</dt>
                  <dd>
                    {item.category ? t(`categories.${item.category}`) : t("sheet.noCategory")}
                  </dd>
                </div>
                {item.lead && (
                  <div>
                    <dt className="text-muted-foreground">{t("sheet.lead")}</dt>
                    <dd className="break-words">{item.lead.title}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-muted-foreground">{t("sheet.message")}</dt>
                  <dd className="whitespace-pre-wrap break-words rounded-lg bg-muted p-3">
                    {item.message}
                  </dd>
                </div>
              </dl>
              <ul className="space-y-1 text-muted-foreground">
                <li>{t("sheet.received", { date: day.format(new Date(item.createdAt)) })}</li>
                {item.takenAt && item.takenBy && (
                  <li>
                    {t("sheet.taken", {
                      name: item.takenBy.name ?? item.takenBy.email,
                      date: day.format(new Date(item.takenAt)),
                    })}
                  </li>
                )}
                {item.withdrawnAt && (
                  <li>{t("sheet.withdrawn", { date: day.format(new Date(item.withdrawnAt)) })}</li>
                )}
                {item.answeredAt && item.answeredBy && (
                  <li>
                    {t("sheet.answered", {
                      name: item.answeredBy.name ?? item.answeredBy.email,
                      date: day.format(new Date(item.answeredAt)),
                    })}
                  </li>
                )}
                {item.accessUntil && (
                  <li>
                    {t("sheet.accessUntil", { date: day.format(new Date(item.accessUntil)) })}
                  </li>
                )}
              </ul>
              {item.state === "answered" && item.outcome && (
                <section className="space-y-2">
                  <Badge variant="secondary">{t(`outcome.${item.outcome}`)}</Badge>
                  <p className="whitespace-pre-wrap break-words">{item.answer}</p>
                </section>
              )}
              {item.erasure && <ErasureSummary summary={item.erasure} />}
              {item.kind === "erasure" &&
                item.surface === "wallet" &&
                (item.state === "received" || item.state === "in_progress") && (
                  <ErasurePanel
                    item={item}
                    identity={identity}
                    queryKey={queryKey}
                    onDone={refresh}
                  />
                )}
              {item.state === "received" && (
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => take.mutate(item.revision)}
                >
                  {t("take")}
                </Button>
              )}
              {(item.state === "received" || item.state === "in_progress") &&
                item.allowedOutcomes.length > 0 && (
                  <Answer
                    key={item.revision}
                    item={item}
                    pending={pending}
                    failed={failed}
                    onSubmit={(outcome, text) =>
                      answer.mutate({ revision: item.revision, outcome, answer: text })
                    }
                  />
                )}
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Workspace({ identity, blocked }: { identity: IdentityMe; blocked: boolean }) {
  const { t } = useTranslation("dataRequests"),
    [filter, setFilter] = useState<Filter>("open"),
    [cursors, setCursors] = useState<string[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    key = ["private", identity.user.id, identity.session.id, "partner-data-requests"],
    cursor = cursors.at(-1);
  const list = useQuery({
    queryKey: [...key, filter, cursor ?? null],
    queryFn: ({ signal }) =>
      client.adminDataRequests({ state: filter, ...(cursor ? { cursor } : {}) }, signal),
    enabled: !blocked,
    gcTime: 0,
    retry: false,
  });
  return (
    <div className="space-y-8">
      <header>
        <Link to="/partner" className="text-sm text-muted-foreground">
          {t("back")}
        </Link>
        <h1 className="cv-app-heading mt-3">{t("title")}</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">{t("description")}</p>
        {list.data && <p className="mt-3 font-medium">{t("open", { count: list.data.open })}</p>}
      </header>
      <div role="group" aria-label={t("filters.label")} className="flex flex-wrap gap-2">
        {(["open", "closed", "all"] as const).map((value) => (
          <Button
            key={value}
            variant={filter === value ? "default" : "outline"}
            aria-pressed={filter === value}
            onClick={() => {
              setFilter(value);
              setCursors([]);
            }}
          >
            {t(`filters.${value}`)}
          </Button>
        ))}
      </div>
      {list.isPending ? (
        <LoadingState label={t("loading")} />
      ) : list.isError ? (
        <ErrorState
          title={t("error")}
          description={t("error")}
          retryLabel={t("retry")}
          pendingLabel={t("loading")}
          onRetry={() => void list.refetch()}
        />
      ) : list.data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t(`empty.${filter}`)}</p>
      ) : (
        <>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {list.data.items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">
                    {t("item", {
                      kind: t(`kind.${item.kind}`),
                      surface: t(`surface.${item.surface}`),
                      date: day.format(new Date(item.createdAt)),
                    })}
                  </p>
                  <p className="break-words text-sm text-muted-foreground">
                    {t("requester", {
                      name: item.requester.name ?? t("unnamed"),
                      email: item.requester.email,
                    })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <Subject item={item} />
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={item.state === "received" ? "default" : "secondary"}>
                    {t(`state.${item.state}`)}
                  </Badge>
                  <Button variant="outline" onClick={() => setSelected(item.id)}>
                    {item.state === "received" || item.state === "in_progress"
                      ? t("open")
                      : t("view")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            {cursors.length > 0 && (
              <Button variant="outline" onClick={() => setCursors([])}>
                {t("first")}
              </Button>
            )}
            {list.data.nextCursor && (
              <Button
                variant="outline"
                onClick={() => setCursors([...cursors, list.data.nextCursor!])}
              >
                {t("next")}
              </Button>
            )}
          </div>
        </>
      )}
      {selected && (
        <RequestSheet
          id={selected}
          identity={identity}
          queryKey={key}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

// Rights of the people concerned (C7b): CoverView answers each request, from the oldest open one.
export function PartnerDataRequestsPage() {
  return (
    <AdminBoundary>
      {(identity, blocked) => <Workspace identity={identity} blocked={blocked} />}
    </AdminBoundary>
  );
}
