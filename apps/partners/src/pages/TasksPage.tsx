import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Badge, EmptyState, ErrorState, LoadingState } from "@coverview/ui";
import { useWork } from "../features/use-work";
import { formatDate } from "../features/Field";
export function TasksPage() {
  const { t } = useTranslation(),
    query = useWork();
  if (query.isPending) return <LoadingState label={t("loading")} />;
  if (query.isError)
    return (
      <ErrorState
        title={t("error")}
        description={t("error")}
        retryLabel={t("retry")}
        pendingLabel={t("loading")}
        onRetry={() => void query.refetch()}
      />
    );
  return (
    <>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("tasks.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("tasks.subtitle")}</p>
      </header>
      <div className="space-y-3">
        {query.data.tasks.map((task) => (
          <Link
            key={task.id}
            to="/leads/$leadId"
            params={{ leadId: task.leadId }}
            search={{ tab: "tasks" }}
            className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-5 hover:bg-muted"
          >
            <div>
              <h2 className="font-medium">{task.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {task.clientName}
                {" · "}
                {task.leadTitle}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline">{t(`priority.${task.priority}`)}</Badge>
              <span
                className={`text-sm ${new Date(task.dueAt).getTime() < Date.now() ? "text-destructive" : "text-muted-foreground"}`}
              >
                {formatDate(task.dueAt)}
              </span>
            </div>
          </Link>
        ))}
      </div>
      {!query.data.tasks.length && (
        <EmptyState title={t("task.empty")} description={t("tasks.subtitle")} />
      )}
      {query.data.truncated && <p className="text-sm text-muted-foreground">{t("workLimited")}</p>}
    </>
  );
}
