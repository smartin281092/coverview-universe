import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import type { ActionCenterHistoryItem } from "@coverview/contracts";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  LoadingState,
} from "@coverview/ui";
import { api } from "../../api";
import { AdminFailure } from "./AdminFailure";

type Context = {
  identity: IdentityMe;
  userId: string;
  profileId: string;
  blocked: boolean;
  portalContainer: HTMLDivElement | null;
};
function ActionDetails({ identity, userId, profileId, blocked, id }: Context & { id: string }) {
  const { t } = useTranslation("dossier");
  const { t: users } = useTranslation("users");
  const query = useQuery({
    queryKey: [
      "private",
      identity.user.id,
      identity.session.id,
      "admin-user",
      userId,
      "client-action",
      profileId,
      id,
    ],
    queryFn: ({ signal }) => api.adminClientAction(userId, profileId, id, { signal }),
    enabled: !blocked,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const field = (key: string) =>
    users(`fields.${key.replace(/^authorization:/, "")}`, {
      defaultValue: t(`actions.topics.${key.replace(/^authorization:/, "")}`, {
        defaultValue: t("actions.topics.profile_information"),
      }),
    });
  if (query.isError)
    return <AdminFailure error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data) return <LoadingState label={t("loading")} />;
  const action = query.data.action;
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="font-medium">{t(`actions.kinds.${action.kind}`)}</p>
        <p>{field(action.topic)}</p>
        <Badge variant="secondary">{t(`actions.states.${action.state}`)}</Badge>
      </div>
      {action.requiredFields.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-medium">{t("actions.required")}</h3>
          <ul className="list-inside list-disc text-sm">
            {action.requiredFields.map((key) => (
              <li key={key}>{field(key)}</li>
            ))}
          </ul>
        </section>
      )}
      {Object.keys(action.currentValues).length > 0 && (
        <section className="space-y-2">
          <h3 className="font-medium">{t("actions.current")}</h3>
          <dl className="space-y-2 text-sm">
            {Object.entries(action.currentValues).map(([key, value]) => (
              <div key={key} className="grid gap-1 sm:grid-cols-2">
                <dt className="text-muted-foreground">{field(key)}</dt>
                <dd className="break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {action.requirements.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-medium">{t("actions.requirements")}</h3>
          <ul className="space-y-2 text-sm">
            {action.requirements.map((item) => (
              <li key={item.kind} className="flex flex-wrap justify-between gap-2">
                <span>{t(`actions.topics.${item.kind}`)}</span>
                <Badge variant="outline">{t(`actions.requirementStates.${item.state}`)}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function AdminClientActions(context: Context) {
  const { identity, userId, profileId, blocked, portalContainer } = context;
  const { t, i18n } = useTranslation("dossier");
  const { t: users } = useTranslation("users");
  const [cursor, setCursor] = useState<string | undefined>();
  const [historyCursor, setHistoryCursor] = useState<string | undefined>();
  const [selected, setSelected] = useState<string | null>(null);
  const [historyEntry, setHistoryEntry] = useState<ActionCenterHistoryItem | null>(null);
  const key = [
    "private",
    identity.user.id,
    identity.session.id,
    "admin-user",
    userId,
    "client-actions",
    profileId,
  ];
  const options = {
    enabled: !blocked,
    staleTime: 0,
    gcTime: 0,
    retry: false as const,
    refetchOnWindowFocus: true,
  };
  const query = useQuery({
    ...options,
    queryKey: [...key, cursor],
    queryFn: ({ signal }) =>
      api.adminClientActions(userId, profileId, cursor ? { cursor } : {}, { signal }),
  });
  const history = useQuery({
    ...options,
    queryKey: [...key, "history", historyCursor],
    queryFn: ({ signal }) =>
      api.adminClientActionHistory(
        userId,
        profileId,
        historyCursor ? { cursor: historyCursor } : {},
        { signal },
      ),
  });
  const field = (key: string) =>
    users(`fields.${key.replace(/^authorization:/, "")}`, {
      defaultValue: t(`actions.topics.${key.replace(/^authorization:/, "")}`, {
        defaultValue: t("actions.topics.profile_information"),
      }),
    });
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" });
  return (
    <>
      <section className="space-y-4">
        <h2 className="text-lg font-medium">{t("actions.heading")}</h2>
        {query.isError ? (
          <AdminFailure error={query.error} onRetry={() => void query.refetch()} />
        ) : !query.data ? (
          <LoadingState label={t("loading")} />
        ) : (
          <>
            {!query.data.actions.length ? (
              <EmptyState title={t("actions.empty")} description={t("actions.emptyDescription")} />
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {query.data.actions.map((action) => (
                  <li key={action.id}>
                    <button
                      type="button"
                      disabled={blocked}
                      onClick={() => setSelected(action.id)}
                      className="flex h-full w-full items-center justify-between gap-3 rounded-xl border bg-card p-4 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="space-y-2">
                        <span className="block font-medium">{field(action.topic)}</span>
                        <span className="block text-sm text-muted-foreground">
                          {t(`actions.kinds.${action.kind}`)}
                        </span>
                        <Badge variant="secondary">{t(`actions.states.${action.state}`)}</Badge>
                      </span>
                      <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {(cursor || query.data.nextCursor) && (
              <nav className="flex justify-end gap-3" aria-label={t("pagination")}>
                <Button variant="outline" disabled={!cursor} onClick={() => setCursor(undefined)}>
                  {t("firstPage")}
                </Button>
                <Button
                  variant="outline"
                  disabled={!query.data.nextCursor}
                  onClick={() => setCursor(query.data?.nextCursor ?? undefined)}
                >
                  {t("nextPage")}
                </Button>
              </nav>
            )}
          </>
        )}
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-medium">{t("actions.history")}</h2>
        {history.isError ? (
          <AdminFailure error={history.error} onRetry={() => void history.refetch()} />
        ) : !history.data ? (
          <LoadingState label={t("loading")} />
        ) : (
          <>
            {!history.data.entries.length ? (
              <p className="text-sm text-muted-foreground">{t("actions.noHistory")}</p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {history.data.entries.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      disabled={blocked}
                      onClick={() => setHistoryEntry(entry)}
                      className="w-full space-y-2 rounded-xl border p-4 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="block font-medium">{field(entry.topic)}</span>
                      <span className="block text-sm text-muted-foreground">
                        {t("actions.recorded", { date: date.format(new Date(entry.createdAt)) })}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {(historyCursor || history.data.nextCursor) && (
              <nav className="flex justify-end gap-3" aria-label={t("pagination")}>
                <Button
                  variant="outline"
                  disabled={!historyCursor}
                  onClick={() => setHistoryCursor(undefined)}
                >
                  {t("firstPage")}
                </Button>
                <Button
                  variant="outline"
                  disabled={!history.data.nextCursor}
                  onClick={() => setHistoryCursor(history.data?.nextCursor ?? undefined)}
                >
                  {t("nextPage")}
                </Button>
              </nav>
            )}
          </>
        )}
      </section>
      <Dialog
        open={Boolean((selected || historyEntry) && !blocked)}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setHistoryEntry(null);
          }
        }}
      >
        <DialogContent
          portalContainer={portalContainer}
          className="max-h-[90dvh] overflow-y-auto p-6 sm:max-w-xl"
        >
          <DialogHeader>
            <DialogTitle>{t("actions.details")}</DialogTitle>
            <DialogDescription>{t("actions.readOnly")}</DialogDescription>
          </DialogHeader>
          {selected && !blocked ? (
            <ActionDetails {...context} id={selected} />
          ) : historyEntry && !blocked ? (
            <div className="space-y-4">
              <p className="font-medium">{field(historyEntry.topic)}</p>
              <p className="text-sm text-muted-foreground">
                {t("actions.recorded", { date: date.format(new Date(historyEntry.createdAt)) })}
              </p>
              {historyEntry.response && (
                <p className="whitespace-pre-wrap break-words">{historyEntry.response}</p>
              )}
              <dl className="space-y-2">
                {Object.entries(historyEntry.afterValues).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-sm text-muted-foreground">{field(key)}</dt>
                    <dd className="break-words">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelected(null);
                setHistoryEntry(null);
              }}
            >
              {t("close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
