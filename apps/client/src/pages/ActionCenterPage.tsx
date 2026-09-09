import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import {
  Button,
  EmptyState,
  LoadingState,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@coverview/ui";
import { api } from "../api";
import { IdentityBoundary } from "../features/identity/IdentityBoundary";
import { ActionFailure } from "../features/actions/ActionFailure";
import { ActionProgress } from "../features/actions/ActionProgress";
import { ActionActivity } from "../features/actions/ActionActivity";
import { useActionLabel } from "../features/actions/use-action-label";

function ActionCenter({ identity }: { identity: IdentityMe }) {
  const { t } = useTranslation("actions");
  const label = useActionLabel();
  const search = useSearch({ from: "/actions" });
  const navigate = useNavigate();
  const activity = search.tab === "activity";
  const inProgress = search.tab === "in_progress";
  const listState = inProgress ? "in_progress" : "pending";
  const root = ["private", identity.user.id, identity.session.id, "action-center"];
  const summary = useQuery({
    queryKey: [...root, "summary"],
    queryFn: ({ signal }) => api.actionCenterSummary({ signal }),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: (query) => (query.state.status === "error" ? false : 30_000),
  });
  const query = useQuery({
    queryKey: [...root, "list", listState, search.cursor],
    queryFn: ({ signal }) =>
      api.actionCenter({ state: listState, cursor: search.cursor }, { signal }),
    enabled: !activity,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: (query) => (query.state.status === "error" ? false : 30_000),
  });
  return (
    <div className="cv-tabbed-page">
      <header className="space-y-3">
        <p className="cv-meta text-muted-foreground">{t("eyebrow")}</p>
        <h1 className="cv-app-heading">{t("title")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("description")}</p>
      </header>
      {summary.data ? (
        <ActionProgress summary={summary.data} />
      ) : summary.isError ? (
        <ActionFailure error={summary.error} onRetry={() => void summary.refetch()} />
      ) : (
        <LoadingState label={t("loading")} />
      )}
      <Tabs
        value={search.tab ?? "todo"}
        onValueChange={(tab) =>
          void navigate({
            to: "/actions",
            search: tab === "activity" || tab === "in_progress" ? { tab } : {},
          })
        }
      >
        <TabsList>
          <TabsTrigger value="todo">{t("tabs.todo")}</TabsTrigger>
          <TabsTrigger value="in_progress">{t("tabs.inProgress")}</TabsTrigger>
          <TabsTrigger value="activity">{t("tabs.activity")}</TabsTrigger>
        </TabsList>
        <TabsContent value={inProgress ? "in_progress" : "todo"} className="space-y-6">
          {query.isPending ? (
            <LoadingState label={t("loading")} />
          ) : query.isError ? (
            <ActionFailure error={query.error} onRetry={() => void query.refetch()} />
          ) : query.data.actions.length === 0 ? (
            <EmptyState
              title={t(inProgress ? "inProgressEmptyTitle" : "emptyTitle")}
              description={t(inProgress ? "inProgressEmptyDescription" : "emptyDescription")}
              action={
                !inProgress && (
                  <Button asChild variant="outline">
                    <Link to="/documents">{t("openDocuments")}</Link>
                  </Button>
                )
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {query.data.actions.map((action) => (
                <li
                  key={action.id}
                  className="flex flex-wrap items-center justify-between gap-5 py-6"
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <h2 className="font-medium">{label(action)}</h2>
                    <p className="text-sm text-muted-foreground">
                      {t("profile", { name: action.profileName })}
                    </p>
                    <p className="text-sm text-muted-foreground">{t(`kinds.${action.kind}`)}</p>
                    {action.state === "in_progress" && (
                      <p className="text-sm text-muted-foreground">{t("states.in_progress")}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {action.variants[0]?.sources[0] && (
                      <Button asChild variant="outline" className="min-h-11">
                        <Link
                          to="/documents/$documentId"
                          params={{ documentId: action.variants[0].sources[0].documentId }}
                        >
                          {t("viewSource")}
                        </Link>
                      </Button>
                    )}
                    <Button asChild className="min-h-11">
                      <Link to="/actions/$actionId" params={{ actionId: action.id }}>
                        {t(inProgress ? "details" : "verify")}
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {(search.cursor || query.data?.nextCursor) && (
            <nav className="flex gap-3" aria-label={t("pagination")}>
              <Button
                variant="outline"
                disabled={!search.cursor || query.isFetching}
                onClick={() =>
                  void navigate({
                    to: "/actions",
                    search: inProgress ? { tab: "in_progress" } : {},
                  })
                }
              >
                {t("firstPage")}
              </Button>
              <Button
                variant="outline"
                disabled={!query.data?.nextCursor || query.isFetching}
                onClick={() => {
                  if (query.data?.nextCursor)
                    void navigate({
                      to: "/actions",
                      search: {
                        ...(inProgress ? { tab: "in_progress" as const } : {}),
                        cursor: query.data.nextCursor,
                      },
                    });
                }}
              >
                {t("next")}
              </Button>
            </nav>
          )}
        </TabsContent>
        <TabsContent value="activity">
          {activity && <ActionActivity identity={identity} cursor={search.cursor} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
export function ActionCenterPage() {
  return <IdentityBoundary>{(identity) => <ActionCenter identity={identity} />}</IdentityBoundary>;
}
