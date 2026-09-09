import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useBlocker, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import { actionCenterIdSchema, type ActionCenterItem } from "@coverview/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  LoadingState,
  NotFoundState,
} from "@coverview/ui";
import { api } from "../api";
import { IdentityBoundary } from "../features/identity/IdentityBoundary";
import { ActionFailure } from "../features/actions/ActionFailure";
import { ActionProgress } from "../features/actions/ActionProgress";
import { ActionResolution } from "../features/actions/ActionResolution";
import { ActionRequirements } from "../features/actions/ActionRequirements";
import { ActionContext } from "../features/actions/ActionContext";
import { useActionLabel } from "../features/actions/use-action-label";

function ActionDetails({ identity, id }: { identity: IdentityMe; id: string }) {
  const { t } = useTranslation("actions");
  const label = useActionLabel();
  const navigate = useNavigate();
  const [action, setAction] = useState<ActionCenterItem | null>(null);
  const [state, setState] = useState({ pending: false, dirty: false });
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const completed = useRef(false);
  const onStateChange = useCallback(
    (value: { pending: boolean; dirty: boolean }) => setState(value),
    [],
  );
  const root = ["private", identity.user.id, identity.session.id, "action-center"];
  const query = useQuery({
    queryKey: [...root, "detail", id],
    queryFn: ({ signal }) => api.actionCenterAction(id, { signal }),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const summary = useQuery({
    queryKey: [...root, "summary"],
    queryFn: ({ signal }) => api.actionCenterSummary({ signal }),
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
  useEffect(() => {
    if (!action && query.data && query.isFetchedAfterMount) setAction(query.data.action);
  }, [action, query.data, query.isFetchedAfterMount]);
  const blocker = useBlocker({
    shouldBlockFn: () => !completed.current && (state.pending || state.dirty),
    enableBeforeUnload: () => !completed.current && (state.pending || state.dirty),
    withResolver: true,
  });
  if (query.isError)
    return <ActionFailure error={query.error} onRetry={() => void query.refetch()} />;
  if (!action) return <LoadingState label={t("loading")} />;
  return (
    <div ref={setPortalContainer} className="mx-auto max-w-4xl space-y-8">
      <Button asChild variant="ghost">
        <Link to="/actions" search={action.state === "in_progress" ? { tab: "in_progress" } : {}}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("backToActions")}
        </Link>
      </Button>
      {summary.data ? (
        <ActionProgress summary={summary.data} />
      ) : summary.isError ? (
        <ActionFailure error={summary.error} onRetry={() => void summary.refetch()} />
      ) : (
        <LoadingState label={t("loading")} />
      )}
      <nav className="flex flex-wrap justify-between gap-3" aria-label={t("actionNavigation")}>
        <Button
          variant="outline"
          disabled={!query.data?.previousId || state.pending}
          onClick={() => {
            if (query.data?.previousId)
              void navigate({
                to: "/actions/$actionId",
                params: { actionId: query.data.previousId },
              });
          }}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("previousAction")}
        </Button>
        <Button
          variant="outline"
          disabled={!query.data?.nextId || state.pending}
          onClick={() => {
            if (query.data?.nextId)
              void navigate({ to: "/actions/$actionId", params: { actionId: query.data.nextId } });
          }}
        >
          {t("nextAction")}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </nav>
      <header className="space-y-3">
        <p className="cv-meta text-muted-foreground">
          {t("profile", { name: action.profileName })}
        </p>
        <h1 className="cv-app-heading">{label(action)}</h1>
      </header>
      <ActionRequirements action={action} />
      {action.state === "complete" ? (
        <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
          {t("states.complete")}
        </p>
      ) : (
        <ActionResolution
          key={`${action.id}:${action.fingerprint}`}
          action={action}
          identity={identity}
          onStateChange={onStateChange}
          onRefresh={() => {
            void query.refetch().then((result) => {
              if (result.data) setAction(result.data.action);
            });
          }}
          onDone={(result) => {
            setState({ pending: false, dirty: false });
            if (result.nextId === action.id) {
              completed.current = false;
              setAction(result.action);
              void query.refetch();
              return;
            }
            completed.current = true;
            if (result.nextId)
              void navigate({ to: "/actions/$actionId", params: { actionId: result.nextId } });
            else void navigate({ to: "/actions", search: {} });
          }}
        />
      )}
      <ActionContext action={action} />

      <Dialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open && !state.pending) blocker.reset?.();
        }}
      >
        <DialogContent portalContainer={portalContainer} className="p-6 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("guard.title")}</DialogTitle>
            <DialogDescription>{t("guard.description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={state.pending} onClick={() => blocker.reset?.()}>
              {t("guard.stay")}
            </Button>
            <Button disabled={state.pending} onClick={() => blocker.proceed?.()}>
              {t("guard.leave")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export function ActionDetailsPage() {
  const { actionId } = useParams({ from: "/actions/$actionId" });
  const { t } = useTranslation("actions");
  if (!actionCenterIdSchema.safeParse(actionId).success)
    return <NotFoundState title={t("missingTitle")} description={t("missingDescription")} />;
  return (
    <IdentityBoundary>
      {(identity) => <ActionDetails key={actionId} identity={identity} id={actionId} />}
    </IdentityBoundary>
  );
}
