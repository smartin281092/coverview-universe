import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button, EmptyState, ErrorState, LoadingState, NotificationList } from "@coverview/ui";
import { usePartner } from "../features/PartnerSession";
import { partnerApi } from "../api";
import { formatDate } from "../features/Field";

export function NotificationsPage() {
  const { t } = useTranslation(),
    session = usePartner(),
    cache = useQueryClient();
  const search = useSearch({ from: "/notifications" }),
    navigate = useNavigate({ from: "/notifications" });
  const query = useQuery({
    queryKey: [...session.queryKey, "notifications", search],
    queryFn: ({ signal }) => partnerApi.notifications(search, signal),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 15000,
  });
  const read = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: (id: string) =>
      partnerApi.readNotification(id, {
        csrfToken: session.identity.csrfToken,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: [...session.queryKey, "notifications"] });
    },
  });
  return (
    <>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("notifications.title")}</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">{t("notifications.description")}</p>
      </header>
      <div className="flex flex-wrap gap-3">
        {(["open", "all"] as const).map((status) => (
          <Button
            key={status}
            variant={search.status === status ? "default" : "outline"}
            onClick={() => void navigate({ search: { status } })}
          >
            {t(`notifications.${status}`)}
          </Button>
        ))}
      </div>
      {read.isError && (
        <p role="alert" className="text-sm text-destructive">
          {t("error")}
        </p>
      )}
      {query.isPending ? (
        <LoadingState label={t("loading")} />
      ) : query.isError ? (
        <ErrorState
          title={t("error")}
          description={t("error")}
          retryLabel={t("retry")}
          pendingLabel={t("loading")}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <>
          {query.data.items.length ? (
            <NotificationList
              pending={read.isPending}
              onRead={(id) => read.mutate(id)}
              items={query.data.items.map((n) => ({
                id: n.id,
                title: n.collaborationId
                  ? t("collaboration.title")
                  : n.offer
                    ? t("decision.notificationTitle", { title: n.title, ...n.offer })
                    : n.title,
                kind: t(
                  n.kind === "client_response" && n.eventKind
                    ? `event.${n.eventKind}`
                    : `notifications.kind.${n.kind}`,
                  {
                    defaultValue: t("notifications.update"),
                  },
                ),
                date: formatDate(n.createdAt),
                due: n.dueAt ? t("notifications.due", { date: formatDate(n.dueAt) }) : null,
                responsible: n.responsibleName,
                priority: t(`priority.${n.priority}`),
                unread: !n.readAt,
                status: t(
                  !n.action
                    ? "notifications.information"
                    : n.resolvedAt
                      ? "notifications.resolved"
                      : "notifications.unresolved",
                ),
                href: n.collaborationId
                  ? "/collaborations"
                  : `/leads/${encodeURIComponent(n.leadId)}${n.kind === "client_response" ? "?tab=activity" : n.kind === "policy_review" ? "?tab=offers" : ""}`,
                openLabel: t(
                  `notifications.action.${n.resolvedAt ? "open" : (n.action ?? "open")}`,
                ),
                readLabel: t("notifications.read"),
              }))}
            />
          ) : (
            <EmptyState
              title={t("notifications.empty")}
              description={t("notifications.emptyDescription")}
            />
          )}
          <div className="flex gap-3">
            {search.cursor && (
              <Button
                variant="outline"
                onClick={() => void navigate({ search: { status: search.status } })}
              >
                {t("notifications.first")}
              </Button>
            )}
            {query.data.nextCursor && (
              <Button
                variant="outline"
                onClick={() =>
                  void navigate({ search: { ...search, cursor: query.data.nextCursor! } })
                }
              >
                {t("notifications.next")}
              </Button>
            )}
          </div>
        </>
      )}
    </>
  );
}
