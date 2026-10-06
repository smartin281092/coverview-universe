import { useId, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import { createPartnerClient } from "@coverview/api-client/partner";
import type {
  AdminDataRequest,
  AdminDataRequestsQuery,
  DataRequestOutcome,
} from "@coverview/contracts/partner-data";
import {
  Badge,
  Button,
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
