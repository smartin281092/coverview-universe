import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import { Button, EmptyState, ErrorState, LoadingState, NotificationList } from "@coverview/ui";
import { IdentityBoundary } from "../features/identity/IdentityBoundary";
import { partnerApi } from "../partner-api";

function Notifications({ identity }: { identity: IdentityMe }) {
  const { t, i18n } = useTranslation("leadNotifications"),
    cache = useQueryClient();
  const search = useSearch({ from: "/offers/notifications" }),
    navigate = useNavigate({ from: "/offers/notifications" });
  const root = ["private", identity.user.id, identity.session.id, "lead-notifications"];
  const firstPage = {
    status: search.status,
    ...(search.clientProfileId ? { clientProfileId: search.clientProfileId } : {}),
    ...(search.profile ? { profile: search.profile } : {}),
  };
  const profile = search.profile ?? search.clientProfileId;
  const query = useQuery({
    queryKey: [...root, search],
    queryFn: ({ signal }) =>
      partnerApi.notifications(
        {
          status: search.status,
          ...(search.cursor ? { cursor: search.cursor } : {}),
          ...(profile && profile !== "all" ? { clientProfileId: profile } : {}),
        },
        signal,
        true,
      ),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 15000,
  });
  const read = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: (id: string) =>
      partnerApi.readNotification(
        id,
        { csrfToken: identity.csrfToken, idempotencyKey: crypto.randomUUID() },
        true,
      ),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: root });
    },
  });
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Zurich",
    }).format(new Date(value));
  return (
    <>
      <header>
        <Link to="/offers" className="text-sm text-muted-foreground">
          {t("back")}
        </Link>
        <h1 className="cv-app-heading mt-4">{t("title")}</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">{t("description")}</p>
      </header>
      <div className="flex flex-wrap gap-3">
        {(["open", "all"] as const).map((status) => (
          <Button
            key={status}
            variant={search.status === status ? "default" : "outline"}
            onClick={() => void navigate({ search: { ...firstPage, status } })}
          >
            {t(status)}
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
          description={t("errorDescription")}
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
                title: n.offer ? t("offerTitle", { title: n.title, ...n.offer }) : n.title,
                kind: t(`kind.${n.kind}`, { defaultValue: t("update") }),
                date: formatDate(n.createdAt),
                due: n.dueAt ? t("due", { date: formatDate(n.dueAt) }) : null,
                responsible: n.responsibleName,
                priority: t(`priority.${n.priority}`),
                unread: !n.readAt,
                status: t(
                  n.action === null ? "information" : n.resolvedAt ? "resolved" : "unresolved",
                ),
                href: `/offers?lead=${encodeURIComponent(n.leadId)}${n.kind.startsWith("quality.") ? "&section=quality" : n.action === "communication" ? "&section=communications" : ""}`,
                openLabel: t(
                  n.kind === "quality.survey"
                    ? "respondSurvey"
                    : n.kind.startsWith("quality.")
                      ? "reviewQuality"
                      : n.action === "communication"
                        ? "reviewCommunication"
                        : n.resolvedAt || !n.action
                          ? "inspect"
                          : "reviewOffer",
                ),
                readLabel: t("read"),
              }))}
            />
          ) : (
            <EmptyState title={t("empty")} description={t("emptyDescription")} />
          )}
          <div className="flex gap-3">
            {search.cursor && (
              <Button variant="outline" onClick={() => void navigate({ search: firstPage })}>
                {t("first")}
              </Button>
            )}
            {query.data.nextCursor && (
              <Button
                variant="outline"
                onClick={() =>
                  void navigate({ search: { ...search, cursor: query.data.nextCursor! } })
                }
              >
                {t("next")}
              </Button>
            )}
          </div>
        </>
      )}
    </>
  );
}
export function LeadNotificationsPage() {
  return <IdentityBoundary>{(identity) => <Notifications identity={identity} />}</IdentityBoundary>;
}
