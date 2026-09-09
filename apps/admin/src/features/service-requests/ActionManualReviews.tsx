import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { ApiError, type IdentityMe } from "@coverview/api-client";
import {
  actionCenterManualTransitionInputSchema,
  type ActionCenterManualReview,
  type ActionCenterManualTransitionInput,
} from "@coverview/contracts";
import {
  Button,
  EmptyState,
  Label,
  LoadingState,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@coverview/ui";
import { api } from "../../api";
import { ServiceRequestFailure } from "./ServiceRequestFailure";

function ManualReviewEditor({
  review,
  identity,
  blocked,
  onPending,
  onDone,
}: {
  review: ActionCenterManualReview;
  identity: IdentityMe;
  blocked: boolean;
  onPending: (value: boolean) => void;
  onDone: () => void;
}) {
  const { t } = useTranslation("serviceRequests");
  const client = useQueryClient();
  const form = useForm<ActionCenterManualTransitionInput>({
    resolver: zodResolver(actionCenterManualTransitionInputSchema),
    defaultValues: {
      userId: review.userId,
      id: review.id,
      revision: review.revision,
      state: "resolved",
      resolution: "",
    },
  });
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const command = useRef<{ signature: string; key: string } | null>(null);
  const attempted = useRef<ActionCenterManualTransitionInput | null>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
      onPending(false);
    },
    [onPending],
  );
  const run = async (input: ActionCenterManualTransitionInput) => {
    if (busy.current || blocked) return;
    busy.current = true;
    attempted.current = input;
    setPending(true);
    onPending(true);
    setFailure(null);
    const active = new AbortController();
    controller.current = active;
    const signature = JSON.stringify(input);
    if (command.current?.signature !== signature)
      command.current = { signature, key: crypto.randomUUID() };
    try {
      await api.transitionActionManualReview(input, {
        csrfToken: identity.csrfToken,
        idempotencyKey: command.current.key,
        signal: active.signal,
      });
      if (active.signal.aborted) return;
      await client.invalidateQueries({
        queryKey: ["private", identity.user.id, identity.session.id, "action-reviews"],
      });
      if (!active.signal.aborted) {
        onPending(false);
        onDone();
      }
    } catch (error) {
      if (!active.signal.aborted) setFailure(error);
    } finally {
      if (!active.signal.aborted) {
        busy.current = false;
        setPending(false);
        onPending(false);
      }
    }
  };
  const conflict = failure instanceof ApiError && failure.status === 409;
  return (
    <form className="space-y-5" onSubmit={(event) => void form.handleSubmit(run)(event)}>
      <p className="whitespace-pre-wrap break-words text-sm">{review.response}</p>
      <Button asChild variant="outline" disabled={pending}>
        <Link
          to="/users/$userId"
          params={{ userId: review.userId }}
          search={{ profile: review.profileId, tab: "general" }}
        >
          {t("openProfile")}
        </Link>
      </Button>
      {review.state === "resolved" ? (
        <div className="space-y-2">
          <h3 className="font-medium">{t("manual.resolution")}</h3>
          <p className="whitespace-pre-wrap break-words text-sm">{review.resolution}</p>
        </div>
      ) : (
        <fieldset disabled={pending || blocked || conflict} className="space-y-3">
          <Label htmlFor="manual-resolution">{t("manual.resolution")}</Label>
          <textarea
            id="manual-resolution"
            rows={4}
            maxLength={2000}
            className="w-full rounded-xl border border-input bg-transparent p-3 text-sm"
            {...form.register("resolution")}
          />
          <p className="text-xs text-muted-foreground">{t("manual.resolutionHelp")}</p>
          <div className="flex flex-wrap gap-3">
            {review.state === "requested" && (
              <Button
                variant="outline"
                type="button"
                disabled={form.formState.isDirty}
                onClick={() =>
                  void run({
                    userId: review.userId,
                    id: review.id,
                    revision: review.revision,
                    state: "in_progress",
                  })
                }
              >
                {t("transitions.in_progress")}
              </Button>
            )}
            <Button type="submit">{t(pending ? "saving" : "manual.resolve")}</Button>
          </div>
        </fieldset>
      )}
      {form.formState.errors.resolution && (
        <p role="alert" className="text-sm text-destructive">
          {t("manual.invalid")}
        </p>
      )}
      {failure ? (
        <ServiceRequestFailure
          error={failure}
          onRetry={() => {
            if (conflict) onDone();
            else if (attempted.current) void run(attempted.current);
          }}
        />
      ) : null}
    </form>
  );
}

export function ActionManualReviews({
  identity,
  blocked,
  onPending,
}: {
  identity: IdentityMe;
  blocked: boolean;
  onPending: (value: boolean) => void;
}) {
  const { t, i18n } = useTranslation("serviceRequests");
  const [cursor, setCursor] = useState<string | undefined>();
  const [selected, setSelected] = useState<ActionCenterManualReview | null>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const [pending, setPending] = useState(false);
  const query = useQuery({
    queryKey: ["private", identity.user.id, identity.session.id, "action-reviews", cursor],
    queryFn: ({ signal }) => api.actionManualReviews(cursor ? { cursor } : {}, { signal }),
    enabled: !blocked,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: (current) => (selected || current.state.status === "error" ? false : 30_000),
    refetchOnWindowFocus: false,
  });
  const handlePending = useCallback(
    (value: boolean) => {
      setPending(value);
      onPending(value);
    },
    [onPending],
  );
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" });
  return (
    <div ref={setPortalContainer} className="space-y-6 py-5">
      {query.isPending ? (
        <LoadingState label={t("loading")} />
      ) : query.isError ? (
        <ServiceRequestFailure error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.reviews.length === 0 ? (
        <EmptyState title={t("manual.empty")} description={t("manual.emptyDescription")} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {(["requested", "in_progress", "resolved"] as const).map((state) => (
            <section key={state} className="space-y-4">
              <h2 className="border-b border-border pb-3 font-medium">
                {t(`manual.states.${state}`)}
              </h2>
              <ul className="space-y-3">
                {query.data.reviews
                  .filter((review) => review.state === state)
                  .map((review) => (
                    <li key={review.id}>
                      <button
                        type="button"
                        className="w-full space-y-2 rounded-xl border border-border p-4 text-left"
                        onClick={() => setSelected(review)}
                        disabled={blocked || pending}
                      >
                        <span className="block font-medium">{review.profileName}</span>
                        <span className="block text-sm text-muted-foreground">
                          {t("manual.responseReceived")}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {date.format(new Date(review.createdAt))}
                        </span>
                        <span className="block text-sm text-indigo-600">{t("details")}</span>
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {(cursor || query.data?.nextCursor) && (
        <nav className="flex gap-3" aria-label={t("manual.pagination")}>
          <Button
            variant="outline"
            disabled={!cursor || pending || blocked}
            onClick={() => setCursor(undefined)}
          >
            {t("firstPage")}
          </Button>
          <Button
            variant="outline"
            disabled={!query.data?.nextCursor || pending || blocked}
            onClick={() => {
              if (query.data?.nextCursor) setCursor(query.data.nextCursor);
            }}
          >
            {t("next")}
          </Button>
        </nav>
      )}
      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !pending) setSelected(null);
        }}
      >
        <SheetContent
          portalContainer={portalContainer}
          showCloseButton
          closeLabel={t("close")}
          className="gap-6 overflow-y-auto p-6 data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
        >
          {selected && (
            <>
              <SheetHeader className="p-0 pr-8">
                <SheetTitle>{t("manual.title")}</SheetTitle>
                <SheetDescription>{t("profile", { name: selected.profileName })}</SheetDescription>
              </SheetHeader>
              <ManualReviewEditor
                key={`${selected.id}:${selected.revision}`}
                review={selected}
                identity={identity}
                blocked={blocked}
                onPending={handlePending}
                onDone={() => {
                  setSelected(null);
                  void query.refetch();
                }}
              />
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
