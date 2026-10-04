import { useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button, Badge, EmptyState, ErrorState, LoadingState } from "@coverview/ui";
import { usePartner } from "../features/PartnerSession";
import { QualityEditor } from "../features/QualityEditor";
import { partnerApi } from "../api";
import { formatDate } from "../features/Field";
import type { QualityCase } from "@coverview/contracts/partner-quality";
export function QualityPage() {
  const { t } = useTranslation("quality"),
    session = usePartner(),
    search = useSearch({ from: "/quality" }),
    navigate = useNavigate({ from: "/quality" });
  const [editor, setEditor] = useState<{ item?: QualityCase; settingsRevision?: number } | null>(
      null,
    ),
    [before, setBefore] = useState<number>();
  const policy = { gcTime: 0, staleTime: 0, retry: false, refetchInterval: 10000 };
  const list = useQuery({
    queryKey: [...session.queryKey, "quality", search],
    queryFn: ({ signal }) =>
      partnerApi.qualityQueue(
        { state: search.state, ...(search.cursor ? { cursor: search.cursor } : {}) },
        search.leadId,
        false,
        signal,
      ),
    enabled: !search.caseId && (!!search.leadId || session.context.administrator),
    ...policy,
  });
  const detail = useQuery({
    queryKey: [...session.queryKey, "quality-case", search.caseId, before],
    queryFn: ({ signal }) => partnerApi.qualityCase(search.caseId!, false, before, signal),
    enabled: !!search.caseId,
    ...policy,
  });
  const settings = useQuery({
    queryKey: [...session.queryKey, "quality-settings"],
    queryFn: ({ signal }) => partnerApi.qualitySettings(signal),
    enabled: session.context.administrator,
    ...policy,
  });
  const data = detail.isError ? undefined : detail.data;
  const reload = () => {
    void list.refetch();
    if (search.caseId) void detail.refetch();
    if (session.context.administrator) void settings.refetch();
  };
  return (
    <>
      <header className="space-y-3">
        <h1 className="cv-app-heading">{t("title")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("partnerDescription")}</p>
      </header>
      {editor && (
        <QualityEditor
          {...editor}
          {...(search.leadId ? { leadId: search.leadId } : {})}
          enabled={
            editor.item
              ? !!data && data.revision === editor.item.revision
              : editor.settingsRevision !== undefined
                ? !settings.isError && settings.data?.revision === editor.settingsRevision
                : !list.isError
          }
          onClose={() => setEditor(null)}
          onSaved={reload}
        />
      )}
      <div className="flex flex-wrap gap-3">
        {search.leadId && (
          <Button variant="outline" asChild>
            <Link to="/leads/$leadId" params={{ leadId: search.leadId }}>
              {t("lead")}
            </Link>
          </Button>
        )}
        {search.caseId ? (
          <Button
            variant="outline"
            onClick={() => {
              setBefore(undefined);
              void navigate({ search: { ...search, caseId: undefined } });
            }}
          >
            {t("back")}
          </Button>
        ) : (
          search.leadId && <Button onClick={() => setEditor({})}>{t("create")}</Button>
        )}
        {session.context.administrator && settings.data && !settings.isError && (
          <Button
            variant="outline"
            onClick={() => setEditor({ settingsRevision: settings.data.revision })}
          >
            {t("googleSettings")}
          </Button>
        )}
      </div>
      {search.caseId ? (
        detail.isPending ? (
          <LoadingState label={t("loading")} />
        ) : !data ? (
          <ErrorState
            title={t("changed")}
            description={t("reloadDescription")}
            retryLabel={t("reload")}
            pendingLabel={t("loading")}
            onRetry={() => void detail.refetch()}
          />
        ) : (
          <>
            <section className="space-y-4">
              <Badge>{t(`states.${data.state}`)}</Badge>
              <h2 className="text-xl font-semibold">{data.title}</h2>
              <p>{t(`kinds.${data.kind}`)}</p>
              <p className="whitespace-pre-wrap">{data.summary}</p>
              <p>{t("ownedBy", { name: data.assignedTo ?? t("coverviewQueue") })}</p>
              <p>{t(`priorities.${data.priority}`)}</p>
              {data.dueAt && (
                <p className={data.overdue ? "text-destructive" : ""}>
                  {t("due", { date: formatDate(data.dueAt) })}
                </p>
              )}
              {data.nextAction && <p>{data.nextAction}</p>}
              {(data.canManage || data.canReply) && (
                <Button onClick={() => setEditor({ item: data })}>
                  {t(data.canManage ? "process" : "reply")}
                </Button>
              )}
            </section>
            {data.survey && (
              <section className="space-y-3">
                <h3 className="font-semibold">{t("surveyResponse")}</h3>
                <p>{t("stars", { count: data.survey.rating })}</p>
                <p>{t(`experienceTypes.${data.survey.experience}`)}</p>
                <p>{data.survey.improvements.map((v) => t(`improvement.${v}`)).join(", ")}</p>
                <p className="whitespace-pre-wrap">{data.survey.comment}</p>
                {data.survey.callbackRequested && <p>{t("callbackSaved")}</p>}
              </section>
            )}
            <section>
              <h3 className="mb-4 font-semibold">{t("history")}</h3>
              {data.history.map((h) => (
                <article key={h.revision} className="space-y-2 border-t border-border py-4">
                  <p className="text-sm text-muted-foreground">
                    {formatDate(h.createdAt)}
                    {t("separator")}
                    {h.actorName}
                  </p>
                  <p className="font-medium">{t(`actions.${h.action}`)}</p>
                  <p className="whitespace-pre-wrap">{h.note}</p>
                  {h.nextAction && <p>{h.nextAction}</p>}
                  {h.dueAt && <p>{t("due", { date: formatDate(h.dueAt) })}</p>}
                  <Badge variant="outline">
                    {t(
                      h.sharedWithClient
                        ? "clientShared"
                        : h.sharedWithAuthor
                          ? "authorShared"
                          : "internal",
                    )}
                  </Badge>
                </article>
              ))}
              <div className="flex gap-3">
                {before && (
                  <Button variant="outline" onClick={() => setBefore(undefined)}>
                    {t("first")}
                  </Button>
                )}
                {data.nextHistoryRevision && (
                  <Button variant="outline" onClick={() => setBefore(data.nextHistoryRevision!)}>
                    {t("older")}
                  </Button>
                )}
              </div>
            </section>
          </>
        )
      ) : !search.leadId && !session.context.administrator ? (
        <p>{t("openFromLead")}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            {(["open", "closed", "all"] as const).map((state) => (
              <Button
                key={state}
                variant={search.state === state ? "default" : "outline"}
                onClick={() => void navigate({ search: { ...search, state, cursor: undefined } })}
              >
                {t(`filter.${state}`)}
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
            <div className="space-y-3">
              {list.data.items.map((item) => (
                <article
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-4"
                >
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p>
                      {t(`kinds.${item.kind}`)}
                      {t("separator")}
                      {t(`states.${item.state}`)}
                    </p>
                    <p className={item.overdue ? "text-destructive" : "text-muted-foreground"}>
                      {item.dueAt ? t("due", { date: formatDate(item.dueAt) }) : t("closed")}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => void navigate({ search: { ...search, caseId: item.id } })}
                  >
                    {t("open")}
                  </Button>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title={t("empty")} description={t("emptyDescription")} />
          )}
          <div className="flex gap-3">
            {search.cursor && (
              <Button
                variant="outline"
                onClick={() => void navigate({ search: { ...search, cursor: undefined } })}
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
