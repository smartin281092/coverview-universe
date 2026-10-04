import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, FileCheck2 } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import { Badge, Button, EmptyState, LoadingState } from "@coverview/ui";
import { api } from "../api";
import { AdminBoundary } from "../features/users/AdminBoundary";
import { AdminFailure } from "../features/users/AdminFailure";

function Notifications({ identity, blocked }: { identity: IdentityMe; blocked: boolean }) {
  const { t, i18n } = useTranslation("notifications");
  const [cursor, setCursor] = useState<string>();
  const query = useQuery({
    queryKey: ["private", identity.user.id, identity.session.id, "admin-notifications", cursor],
    queryFn: ({ signal }) => api.adminNotifications(cursor, { signal }),
    enabled: !blocked,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: (current) => (current.state.error ? false : 15000),
  });
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" });
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="cv-app-heading">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </header>
      {query.isError ? (
        <AdminFailure error={query.error} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <LoadingState label={t("loading")} />
      ) : !query.data.notifications.length ? (
        <EmptyState title={t("empty")} description={t("emptyDescription")} />
      ) : (
        <ul className="divide-y divide-border" aria-label={t("title")}>
          {query.data.notifications.map((notification) => (
            <li key={notification.id}>
              <Link
                to="/users/$userId"
                params={{ userId: notification.userId }}
                search={{ profile: notification.profileId, tab: "activities" }}
                className="flex items-start gap-4 rounded-lg px-3 py-5 hover:bg-muted/50"
              >
                <FileCheck2 className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0 flex-1 space-y-2">
                  <span className="block font-medium">{t(notification.kind)}</span>
                  <span className="block break-words text-sm">{notification.profileName}</span>
                  <span className="block break-words text-sm text-muted-foreground">
                    {t("account", { email: notification.accountEmail })}
                  </span>
                  <time
                    className="block text-xs text-muted-foreground"
                    dateTime={notification.signedAt}
                  >
                    {date.format(new Date(notification.signedAt))}
                  </time>
                  {notification.revokedAt && <Badge variant="secondary">{t("revoked")}</Badge>}
                </span>
                <span className="sr-only">{t("open")}</span>
                <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {(cursor || query.data?.nextCursor) && (
        <nav className="flex gap-3" aria-label={t("pagination")}>
          {cursor && (
            <Button variant="outline" onClick={() => setCursor(undefined)}>
              {t("latest")}
            </Button>
          )}
          {query.data?.nextCursor && (
            <Button
              variant="outline"
              onClick={() => setCursor(query.data?.nextCursor ?? undefined)}
            >
              {t("older")}
            </Button>
          )}
        </nav>
      )}
    </div>
  );
}

export function NotificationsPage() {
  return (
    <AdminBoundary>
      {(identity, blocked) => <Notifications identity={identity} blocked={blocked} />}
    </AdminBoundary>
  );
}
