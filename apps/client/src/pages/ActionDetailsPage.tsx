import { useWalletProfileScope } from "../features/profile/use-wallet-profile-scope";
import { useCallback, useEffect, useRef, useState } from "react";
import { useBlocker, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import { actionCenterIdSchema, type ActionCardDetails } from "@coverview/contracts";
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
import { ActionCarousel, type ActionDirection } from "../features/actions/ActionCarousel";
import { useActionCards } from "../features/actions/use-action-cards";

function ActionDetails({ identity, id }: { identity: IdentityMe; id: string }) {
  const { scope, filter } = useWalletProfileScope();
  const { t } = useTranslation("actions");
  const navigate = useNavigate();
  const [card, setCard] = useState<ActionCardDetails | null>(null);
  const action = card?.action;
  const [waiting, setWaiting] = useState(false);
  const [moveError, setMoveError] = useState<unknown>(null);
  const target = useRef<ActionCardDetails | null>(null);
  const moving = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [state, setState] = useState({ pending: false, dirty: false });
  const [departure, setDeparture] = useState<ActionDirection | null>(null);
  const [queued, setQueued] = useState<ActionDirection | null>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const completed = useRef(false);
  const formState = useRef(state);
  formState.current = state;
  const onStateChange = useCallback(
    (value: { pending: boolean; dirty: boolean }) => setState(value),
    [],
  );
  const root = ["private", identity.user.id, identity.session.id, "action-center", scope];
  const { query, load } = useActionCards(identity, scope, id);
  const summary = useQuery({
    queryKey: [...root, "summary"],
    queryFn: ({ signal }) => api.actionCenterSummary({ signal }, filter),
    gcTime: 120000,
    staleTime: 60000,
    retry: false,
  });
  useEffect(() => {
    if (query.data && query.data.action.id === id && card?.action.id !== id) {
      setCard(query.data);
      completed.current = false;
      setState({ pending: false, dirty: false });
    }
  }, [card?.action.id, id, query.data]);
  useEffect(() => {
    completed.current = false;
  }, [id]);
  const blocker = useBlocker({
    shouldBlockFn: () => !completed.current && (state.pending || state.dirty),
    enableBeforeUnload: () => !completed.current && (state.pending || state.dirty),
    withResolver: true,
  });
  if (query.isError && !action)
    return <ActionFailure error={query.error} onRetry={() => void query.refetch()} />;
  if (!action) return <LoadingState label={t("loading")} />;
  const prepareMove = async (direction: ActionDirection, discard = false) => {
    if (moving.current || !card) return;
    const nextId = direction === 1 ? card.nextId : card.previousId;
    if (!nextId) return;
    moving.current = true;
    setWaiting(true);
    setMoveError(null);
    try {
      const data = await load(nextId);
      if (!alive.current) return;
      if (formState.current.pending || (formState.current.dirty && !discard)) {
        setQueued(direction);
        return;
      }
      target.current = data;
      completed.current = discard;
      setDeparture(direction);
    } catch (error) {
      if (alive.current) setMoveError(error);
    } finally {
      moving.current = false;
      if (alive.current) setWaiting(false);
    }
  };
  const requestMove = (direction: ActionDirection) => {
    if (state.pending || departure !== null || moving.current) return;
    if (state.dirty) setQueued(direction);
    else void prepareMove(direction);
  };
  return (
    <div ref={setPortalContainer} className="mx-auto max-w-4xl space-y-8">
      {summary.data ? (
        <ActionProgress summary={summary.data} />
      ) : summary.isError ? (
        <ActionFailure error={summary.error} onRetry={() => void summary.refetch()} />
      ) : (
        <LoadingState label={t("loading")} />
      )}
      <nav
        className="relative grid grid-cols-2 gap-2 sm:flex sm:justify-between sm:gap-3"
        aria-label={t("actionNavigation")}
        aria-busy={waiting}
      >
        <Button
          variant="outline"
          className="min-h-11 px-2 text-xs sm:px-4 sm:text-sm"
          aria-label={t("previousAction")}
          disabled={!card?.previousId || state.pending || departure !== null || waiting}
          onClick={() => requestMove(-1)}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span className="sm:hidden">{t("previous")}</span>
          <span className="hidden sm:inline">{t("previousAction")}</span>
        </Button>
        <Button
          variant="outline"
          className="min-h-11 px-2 text-xs sm:px-4 sm:text-sm"
          aria-label={t("nextAction")}
          disabled={!card?.nextId || state.pending || departure !== null || waiting}
          onClick={() => requestMove(1)}
        >
          <span className="sm:hidden">{t("next")}</span>
          <span className="hidden sm:inline">{t("nextAction")}</span>
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
        {waiting && (
          <p
            role="status"
            className="absolute inset-x-0 top-full pt-1 text-center text-xs text-muted-foreground"
          >
            {t("loading")}
          </p>
        )}
      </nav>
      {(moveError || query.isError) && (
        <ActionFailure
          error={moveError ?? query.error}
          onRetry={() => {
            setMoveError(null);
            void query.refetch();
          }}
        />
      )}
      <ActionCarousel
        cardId={action.id}
        direction={departure}
        disabled={state.pending || waiting || queued !== null || blocker.status === "blocked"}
        canPrevious={Boolean(card?.previousId)}
        canNext={Boolean(card?.nextId)}
        label={t("actionNavigation")}
        onRequest={requestMove}
        onExit={() => {
          const next = target.current;
          if (next) {
            target.current = null;
            setDeparture(null);
            void navigate({
              to: "/actions/$actionId",
              params: { actionId: next.action.id },
              search: { profile: scope },
              resetScroll: false,
            });
          }
        }}
      >
        {action.state === "complete" ? (
          <div className="space-y-4 p-4 sm:p-6">
            <h1 className="text-xs text-muted-foreground">
              {t("question.label", { name: action.profileName })}
            </h1>
            <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
              {t("states.complete")}
            </p>
          </div>
        ) : (
          <ActionResolution
            key={`${action.id}:${action.fingerprint}`}
            action={action}
            identity={identity}
            onStateChange={onStateChange}
            onRefresh={() => {
              void query.refetch().then((result) => {
                if (result.data) setCard(result.data);
              });
            }}
            onDone={(result) => {
              setState({ pending: false, dirty: false });
              if (result.nextId === action.id) {
                completed.current = false;
                setCard((current) => (current ? { ...current, action: result.action } : current));
                void query.refetch();
                return;
              }
              completed.current = true;
              if (result.nextId && scope === "all")
                void navigate({ to: "/actions/$actionId", params: { actionId: result.nextId } });
              else void navigate({ to: "/actions", search: {} });
            }}
          />
        )}
        {(action.kind !== "authorization" || action.state === "complete") && (
          <div className="px-4 pb-4 sm:px-6 sm:pb-6">
            <ActionRequirements action={action} />
          </div>
        )}
      </ActionCarousel>
      <ActionContext action={action} leaving={departure !== null} />

      <Dialog
        open={queued !== null || blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open && !state.pending) {
            setQueued(null);
            blocker.reset?.();
          }
        }}
      >
        <DialogContent portalContainer={portalContainer} className="p-6 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("guard.title")}</DialogTitle>
            <DialogDescription>{t("guard.description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={state.pending}
              onClick={() => {
                setQueued(null);
                blocker.reset?.();
              }}
            >
              {t("guard.stay")}
            </Button>
            <Button
              disabled={state.pending}
              onClick={() => {
                if (queued !== null) {
                  void prepareMove(queued, true);
                  setQueued(null);
                } else blocker.proceed?.();
              }}
            >
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
      {(identity) => (
        <ActionDetails
          key={`${identity.user.id}:${identity.session.id}`}
          identity={identity}
          id={actionId}
        />
      )}
    </IdentityBoundary>
  );
}
