import { useState } from "react";
import { useSearch, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Button, Badge, LoadingState, ErrorState, EmptyState } from "@coverview/ui";
import {
  goalSchema,
  pilotageMetricUnit,
  type PilotageQuery,
} from "@coverview/contracts/partner-pilotage";
import { usePartner } from "../features/PartnerSession";
import { GoalEditor } from "../features/GoalEditor";
import { PilotageSourcesDialog } from "../features/PilotageSourcesDialog";
import { formatMeasure, defaultPilotageQuery } from "../features/pilotage-display";
import { formatDate } from "../features/Field";
import { partnerApi } from "../api";
export function GoalsPage() {
  const { t, i18n } = useTranslation("pilotage"),
    session = usePartner(),
    search = useSearch({ from: "/goals" }),
    navigate = useNavigate({ from: "/goals" });
  const [editor, setEditor] = useState<z.infer<typeof goalSchema> | "new" | null>(null),
    [before, setBefore] = useState<number>(),
    [history, setHistory] = useState(false),
    [sources, setSources] = useState(false);
  const policy = { gcTime: 0, staleTime: 0, retry: false, refetchInterval: 30000 };
  const list = useQuery({
    queryKey: [...session.queryKey, "goals", search.state, search.cursor],
    queryFn: ({ signal }) =>
      partnerApi.goals(
        { state: search.state, ...(search.cursor ? { cursor: search.cursor } : {}) },
        signal,
      ),
    enabled: !search.goalId,
    ...policy,
  });
  const detail = useQuery({
    queryKey: [...session.queryKey, "goal", search.goalId, before],
    queryFn: ({ signal }) => partnerApi.goal(search.goalId!, before, signal),
    enabled: !!search.goalId,
    ...policy,
  });
  const options = useQuery({
    queryKey: [...session.queryKey, "pilotage-options"],
    queryFn: ({ signal }) => partnerApi.pilotageOptions(signal),
    ...policy,
  });
  const goal = detail.isError ? undefined : detail.data,
    input = goal?.current.input;
  const query: PilotageQuery = input
    ? {
        from: input.from,
        to: input.to,
        scope: input.scope.kind,
        ...(input.scope.organizationId ? { organizationId: input.scope.organizationId } : {}),
        ...(input.scope.userIds.length ? { members: input.scope.userIds.join(",") } : {}),
        ...input.filters,
      }
    : defaultPilotageQuery();
  const reload = () => {
    void list.refetch();
    if (search.goalId) void detail.refetch();
  };
  return (
    <>
      <header className="space-y-3">
        <h1 className="cv-app-heading">{t("goalsTitle")}</h1>
        <p className="max-w-3xl text-muted-foreground">{t("goalsDescription")}</p>
      </header>
      {editor && options.data && !options.isError && (
        <GoalEditor
          {...(editor === "new" ? {} : { goal: editor })}
          options={options.data}
          enabled={
            editor === "new"
              ? !list.isError
              : !!goal && goal.canEdit && goal.current.revision === editor.current.revision
          }
          onClose={() => setEditor(null)}
          onSaved={reload}
        />
      )}
      {sources && goal && (
        <PilotageSourcesDialog
          query={query}
          measure={goal.actual}
          onClose={() => setSources(false)}
        />
      )}
      <div className="flex flex-wrap gap-3">
        {search.goalId ? (
          <Button
            variant="outline"
            onClick={() => {
              setBefore(undefined);
              setHistory(false);
              void navigate({ search: { state: search.state } });
            }}
          >
            {t("back")}
          </Button>
        ) : (
          <Button
            disabled={!options.data || options.isError || list.isError}
            onClick={() => setEditor("new")}
          >
            {t("createGoal")}
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link to="/statistics" search={query}>
            {t("title")}
          </Link>
        </Button>
      </div>
      {search.goalId ? (
        detail.isPending ? (
          <LoadingState label={t("loading")} />
        ) : !goal ? (
          <ErrorState
            title={t("changed")}
            description={t("reloadDescription")}
            retryLabel={t("reload")}
            pendingLabel={t("loading")}
            onRetry={() => void detail.refetch()}
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-3">
              <Button variant={history ? "outline" : "default"} onClick={() => setHistory(false)}>
                {t("progress")}
              </Button>
              <Button variant={history ? "default" : "outline"} onClick={() => setHistory(true)}>
                {t("history")}
              </Button>
              {goal.canEdit && (
                <Button variant="outline" onClick={() => setEditor(goal)}>
                  {t("editGoal")}
                </Button>
              )}
            </div>
            {history ? (
              <section className="space-y-5">
                {goal.history.map((v) => (
                  <article key={v.revision} className="space-y-2 border-t border-border py-4">
                    <h2 className="font-semibold">
                      {t("version", { revision: v.revision })}
                      {t("separator")}
                      {v.input.title}
                    </h2>
                    <p>
                      {v.authorName}
                      {t("separator")}
                      {formatDate(v.createdAt)}
                    </p>
                    <p>
                      {t(`metrics.${v.input.metric}`)}
                      {t("separator")}
                      {t(`directions.${v.input.direction}`)}
                      {t("separator")}
                      {formatMeasure(
                        v.input.target,
                        pilotageMetricUnit(v.input.metric),
                        i18n.language,
                      )}
                    </p>
                    <p>
                      {t("period", { from: formatDate(v.input.from), to: formatDate(v.input.to) })}
                    </p>
                    <p className="whitespace-pre-wrap">{v.input.reason}</p>
                    <Badge variant="outline">{t(`goalStates.${v.input.state}`)}</Badge>
                  </article>
                ))}
                <div className="flex gap-3">
                  {before && (
                    <Button variant="outline" onClick={() => setBefore(undefined)}>
                      {t("first")}
                    </Button>
                  )}
                  {goal.nextRevision && (
                    <Button variant="outline" onClick={() => setBefore(goal.nextRevision!)}>
                      {t("older")}
                    </Button>
                  )}
                </div>
              </section>
            ) : (
              <section className="space-y-5">
                <div>
                  <Badge>{t(`goalStates.${goal.current.input.state}`)}</Badge>
                  <h2 className="mt-3 text-2xl font-semibold">{goal.current.input.title}</h2>
                </div>
                <p>{t(`metrics.${goal.actual.metric}`)}</p>
                <p className="max-w-3xl text-muted-foreground">
                  {t(`definitions.${goal.actual.metric}`)}
                </p>
                <p>
                  {t("period", {
                    from: formatDate(goal.current.input.from),
                    to: formatDate(goal.current.input.to),
                  })}
                </p>
                <p>
                  {t("population")}
                  {t("separator")}
                  {t(`scopes.${goal.current.input.scope.kind}`)}
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    { label: "target", value: goal.current.input.target },
                    { label: "actual", value: goal.actual.value },
                    { label: "gap", value: goal.gap },
                  ].map(({ label, value }) => (
                    <article key={label} className="rounded-xl border border-border p-5">
                      <p>{t(label)}</p>
                      <p className="mt-3 text-2xl tabular-nums">
                        {formatMeasure(value, goal.actual.unit, i18n.language)}
                      </p>
                    </article>
                  ))}
                </div>
                <p>{t(`directions.${goal.current.input.direction}`)}</p>
                <p>
                  {goal.attained === null
                    ? t("achievementUnavailable")
                    : t(goal.attained ? "attained" : "notAttained")}
                </p>
                {goal.progressPercent !== null && (
                  <div
                    role="progressbar"
                    aria-label={t("progress")}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.min(100, goal.progressPercent)}
                    className="h-3 overflow-hidden rounded-full bg-muted"
                  >
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${Math.min(100, goal.progressPercent)}%` }}
                    />
                  </div>
                )}
                <p>
                  {t("progressValue", {
                    value: formatMeasure(goal.progressPercent, "percent", i18n.language),
                  })}
                </p>
                {goal.actual.reason && <p>{t(`reasons.${goal.actual.reason}`)}</p>}
                <p className="text-sm text-muted-foreground">{t("goalLiveDescription")}</p>
                {goal.actual.canInspect && (
                  <Button variant="outline" onClick={() => setSources(true)}>
                    {t("inspect")}
                  </Button>
                )}
              </section>
            )}
          </>
        )
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            {(["active", "archived", "all"] as const).map((state) => (
              <Button
                key={state}
                variant={search.state === state ? "default" : "outline"}
                onClick={() => void navigate({ search: { state } })}
              >
                {t(`goalStates.${state}`)}
              </Button>
            ))}
          </div>
          {list.isPending ? (
            <LoadingState label={t("loading")} />
          ) : list.isError ? (
            <ErrorState
              title={t("changed")}
              description={t("reloadDescription")}
              retryLabel={t("reload")}
              pendingLabel={t("loading")}
              onRetry={() => void list.refetch()}
            />
          ) : list.data.items.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {list.data.items.map((item) => (
                <article key={item.id} className="space-y-4 rounded-xl border border-border p-5">
                  <h2 className="text-lg font-semibold">{item.current.input.title}</h2>
                  <p>{t(`metrics.${item.actual.metric}`)}</p>
                  <p>
                    {t("goalNumbers", {
                      actual: formatMeasure(item.actual.value, item.actual.unit, i18n.language),
                      target: formatMeasure(
                        item.current.input.target,
                        item.actual.unit,
                        i18n.language,
                      ),
                    })}
                  </p>
                  <p>
                    {t(`scopes.${item.current.input.scope.kind}`)}
                    {t("separator")}
                    {t(`goalStates.${item.current.input.state}`)}
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setHistory(false);
                      setBefore(undefined);
                      void navigate({ search: { ...search, goalId: item.id } });
                    }}
                  >
                    {t("open")}
                  </Button>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title={t("noGoals")} description={t("noGoalsDescription")} />
          )}
          <div className="flex gap-3">
            {search.cursor && (
              <Button
                variant="outline"
                onClick={() => void navigate({ search: { state: search.state } })}
              >
                {t("first")}
              </Button>
            )}
            {!list.isError && list.data?.nextCursor && (
              <Button
                variant="outline"
                onClick={() =>
                  void navigate({ search: { ...search, cursor: list.data.nextCursor! } })
                }
              >
                {t("older")}
              </Button>
            )}
          </div>
        </>
      )}
    </>
  );
}
