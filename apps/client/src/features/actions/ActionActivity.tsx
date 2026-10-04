import { useWalletProfileScope } from "../profile/use-wallet-profile-scope";
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import type { ActionCenterHistoryItem } from "@coverview/contracts";
import {
  Button,
  EmptyState,
  LoadingState,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@coverview/ui";
import { api } from "../../api";
import { ActionFailure } from "./ActionFailure";
import { useActionLabel } from "./use-action-label";

export function ActionActivity({
  identity,
  cursor,
}: {
  identity: IdentityMe;
  cursor: string | undefined;
}) {
  const { t, i18n } = useTranslation("actions");
  const label = useActionLabel();
  const { scope, filter } = useWalletProfileScope();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<ActionCenterHistoryItem | null>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const query = useQuery({
    queryKey: [
      "private",
      identity.user.id,
      identity.session.id,
      "action-center",
      "history",
      scope,
      cursor,
    ],
    queryFn: ({ signal }) =>
      api.actionCenterHistory({ ...(cursor ? { cursor } : {}), ...filter }, { signal }),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: (current) => (selected || current.state.status === "error" ? false : 30_000),
  });
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" });
  if (query.isPending) return <LoadingState label={t("loading")} />;
  if (query.isError)
    return <ActionFailure error={query.error} onRetry={() => void query.refetch()} />;
  return (
    <div ref={setPortalContainer} className="space-y-6">
      {query.data.entries.length === 0 ? (
        <EmptyState title={t("activity.emptyTitle")} description={t("activity.emptyDescription")} />
      ) : (
        <ul className="divide-y divide-border">
          {query.data.entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
              <div className="space-y-2">
                <h2 className="font-medium">{label(entry)}</h2>
                <p className="text-sm">{t("profile", { name: entry.profileName })}</p>
                <p className="text-sm text-muted-foreground">
                  {t(`activity.choices.${entry.choice}`)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {date.format(new Date(entry.createdAt))}
                </p>
              </div>
              <Button variant="outline" onClick={() => setSelected(entry)}>
                {t("details")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {query.data.incomplete && (
        <p className="text-sm text-muted-foreground">{t("activity.incomplete")}</p>
      )}
      {(cursor || query.data.nextCursor) && (
        <nav className="flex gap-3" aria-label={t("pagination")}>
          <Button
            variant="outline"
            disabled={!cursor || query.isFetching}
            onClick={() => void navigate({ to: "/actions", search: { tab: "activity" } })}
          >
            {t("firstPage")}
          </Button>
          <Button
            variant="outline"
            disabled={!query.data.nextCursor || query.isFetching}
            onClick={() => {
              if (query.data.nextCursor)
                void navigate({
                  to: "/actions",
                  search: { tab: "activity", cursor: query.data.nextCursor },
                });
            }}
          >
            {t("next")}
          </Button>
        </nav>
      )}
      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
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
                <SheetTitle>{label(selected)}</SheetTitle>
                <SheetDescription>{t("profile", { name: selected.profileName })}</SheetDescription>
              </SheetHeader>
              <p className="text-sm">{t(`activity.choices.${selected.choice}`)}</p>
              <p className="text-xs text-muted-foreground">
                {t("activity.recorded", {
                  date: date.format(new Date(selected.createdAt)),
                  actor: t(`activity.actors.${selected.actor}`),
                })}
              </p>
              {selected.authorizationEvidence && (
                <div className="space-y-2 text-sm">
                  <p>
                    {t("activity.authorizationVersion", {
                      version: selected.authorizationEvidence.version,
                    })}
                  </p>
                  {selected.authorizationEvidence.revokedAt && (
                    <p className="rounded-lg bg-amber-50 p-3 text-amber-900">
                      {t("activity.authorizationRevoked", {
                        date: date.format(new Date(selected.authorizationEvidence.revokedAt)),
                      })}
                    </p>
                  )}
                </div>
              )}
              {(Object.keys(selected.beforeValues).length > 0 ||
                Object.keys(selected.afterValues).length > 0) && (
                <dl className="grid gap-5 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">{t("activity.before")}</dt>
                    <dd className="mt-2 whitespace-pre-line break-words">
                      {Object.values(selected.beforeValues).join("\n") || t("noValue")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t("activity.after")}</dt>
                    <dd className="mt-2 whitespace-pre-line break-words">
                      {Object.values(selected.afterValues).join("\n") || t("noValue")}
                    </dd>
                  </div>
                </dl>
              )}
              {selected.response && (
                <p className="whitespace-pre-wrap break-words text-sm">{selected.response}</p>
              )}
              <Button asChild variant="outline">
                <Link to="/actions/$actionId" params={{ actionId: selected.actionId }}>
                  {t("activity.openAction")}
                </Link>
              </Button>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
