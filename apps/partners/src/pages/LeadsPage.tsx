import { useEffect, useState } from "react";
import { useSearch, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, LayoutGrid, List } from "lucide-react";
import {
  Button,
  Input,
  EmptyState,
  LoadingState,
  ErrorState,
  Badge,
  parseZurichDateTime,
  formatZurichDateTime,
} from "@coverview/ui";
import {
  leadCategorySchema,
  leadStageSchema,
  leadResultSchema,
  type LeadStage,
} from "@coverview/contracts/partner";
import { usePartner } from "../features/PartnerSession";
import { useLeads } from "../features/use-leads";
import { LeadCard } from "../features/LeadCard";
import { CreateLeadDialog } from "../features/CreateLeadDialog";
import { LeadActionDialog } from "../features/LeadActionDialog";
import { SelectOptions, formatDate } from "../features/Field";
import { partnerApi } from "../api";
import { SavedLeadViews } from "../features/SavedLeadViews";
import { publicLeadSearch } from "../features/lead-navigation-state";
const groups: { key: string; stages: LeadStage[]; target: LeadStage }[] = [
  {
    key: "intake",
    stages: ["draft", "new", "qualifying", "ready_to_assign"],
    target: "qualifying",
  },
  {
    key: "contact",
    stages: ["to_contact", "contacted", "appointment_needed"],
    target: "to_contact",
  },
  {
    key: "meeting",
    stages: ["appointment_scheduled", "appointment_completed"],
    target: "appointment_scheduled",
  },
  {
    key: "analysis",
    stages: ["analysis", "offer_requested", "offer_received"],
    target: "analysis",
  },
  {
    key: "decision",
    stages: ["offer_presented", "client_decision", "signing"],
    target: "client_decision",
  },
  { key: "followup", stages: ["signed", "awaiting_insurer", "contract_issued"], target: "signed" },
  { key: "closed", stages: ["completed"], target: "completed" },
];
export function LeadsPage() {
  const { t } = useTranslation(),
    session = usePartner(),
    search = useSearch({ from: "/leads" }),
    navigate = useNavigate({ from: "/leads" }),
    [create, setCreate] = useState(false),
    [moving, setMoving] = useState<{ id: string; stage: LeadStage } | null>(null);
  const [queryText, setQueryText] = useState(search.q ?? session.leadReturnSearch?.q ?? "");
  const [dateError, setDateError] = useState(false);
  useEffect(() => {
    if (search.q !== undefined) void navigate({ search: publicLeadSearch(search), replace: true });
  }, [navigate, search]);
  const { layout = "kanban", ...filters } = search,
    view =
      filters.view ??
      (session.context.administrator ? "all" : session.context.canAdvise ? "mine" : "referred"),
    leads = useLeads({ ...filters, q: queryText, view });
  const remember = () => session.rememberLeadSearch({ ...search, q: queryText, view, layout });
  const localDate = (value: string | undefined) => (value ? formatZurichDateTime(value) : "");
  const directory = useQuery({
    queryKey: [...session.queryKey, "directory"],
    queryFn: ({ signal }) => partnerApi.directory(signal),
    enabled: session.context.operational,
    gcTime: 0,
  });
  const organizations = [
    ...new Map(
      (directory.data?.items ?? [])
        .filter((item) => item.organizationId)
        .map((item) => [item.organizationId!, item.organization]),
    ),
  ].sort((a, b) => a[1].localeCompare(b[1]));
  const [sourceText, setSourceText] = useState(search.source ?? "");
  // A team view exists for managers and CoverView only.
  const views = [
    "mine",
    "all",
    "referred",
    "received",
    ...(session.context.canManage || session.context.administrator ? ["team"] : []),
    "marketplace",
    "urgent",
    "overdue",
    "no_action",
    "waiting",
    "appointments_week",
    "signed",
    "lost",
    "closed",
  ];
  const stageCount = (stages: LeadStage[]) =>
    leads.data?.counts
      ? leads.data.counts.stages
          .filter((item) => stages.includes(item.stage))
          .reduce((sum, item) => sum + item.count, 0)
      : (leads.data?.items.filter((lead) => stages.includes(lead.stage)).length ?? 0);
  const selected = useQuery({
    queryKey: [...session.queryKey, "lead", moving?.id],
    queryFn: ({ signal }) => partnerApi.lead(moving!.id, signal),
    enabled: !!moving,
    gcTime: 0,
  });
  const change = (next: Partial<typeof search>) => {
    void navigate({ search: publicLeadSearch({ ...search, ...next, cursor: undefined }) });
  };
  const changeDate = (field: "createdFrom" | "createdTo" | "dueFrom" | "dueTo", value: string) => {
    try {
      const instant = value ? parseZurichDateTime(value) : undefined;
      setDateError(false);
      change({ [field]: instant });
    } catch {
      setDateError(true);
    }
  };
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t("leads.title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("leads.subtitle")}</p>
        </div>
        {session.context.canCreate && (
          <Button onClick={() => setCreate(true)}>
            <Plus className="mr-2 size-4" />
            {t("leads.new")}
          </Button>
        )}
      </header>
      <SavedLeadViews
        filters={{ ...filters, q: queryText, view, layout }}
        onApply={(value) => {
          setQueryText(value.q ?? "");
          session.rememberLeadSearch(value);
          void navigate({ search: publicLeadSearch(value) });
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="max-w-xs"
          aria-label={t("search")}
          placeholder={t("search")}
          value={queryText}
          maxLength={120}
          onChange={(event) => {
            setQueryText(event.target.value);
            change({});
          }}
        />
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          aria-label={t("nav.leads")}
          value={view}
          onChange={(event) =>
            change({ view: event.target.value as NonNullable<typeof search.view> })
          }
        >
          <SelectOptions values={views} prefix="views" />
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          aria-label={t("navigation:sort")}
          value={search.sort ?? "created"}
          onChange={(event) =>
            change({ sort: event.target.value as NonNullable<typeof search.sort> })
          }
        >
          {(["created", "due", "stage_age"] as const).map((value) => (
            <option key={value} value={value}>
              {t(`navigation:sorts.${value}`)}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          aria-label={t("field.category")}
          value={search.category ?? ""}
          onChange={(event) => {
            void navigate({
              search: {
                ...search,
                category: event.target.value || undefined,
                cursor: undefined,
              } as typeof search,
            });
          }}
        >
          <option value="">{t("leads.allCategories")}</option>
          <SelectOptions values={leadCategorySchema.options} prefix="category" />
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          aria-label={t("detail.changeStage")}
          value={search.stage ?? ""}
          onChange={(event) => {
            void navigate({
              search: {
                ...search,
                stage: event.target.value || undefined,
                cursor: undefined,
              } as typeof search,
            });
          }}
        >
          <option value="">{t("leads.allStages")}</option>
          <SelectOptions values={leadStageSchema.options} prefix="stage" />
        </select>
        <div className="ml-auto flex rounded-md border border-border p-1">
          <Button
            variant={layout === "kanban" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => change({ layout: "kanban" })}
            aria-label={t("leads.kanban")}
          >
            <LayoutGrid className="size-4" />
          </Button>
          <Button
            variant={layout === "list" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => change({ layout: "list" })}
            aria-label={t("leads.list")}
          >
            <List className="size-4" />
          </Button>
        </div>
      </div>
      <details className="rounded-lg border border-border p-4">
        <summary className="cursor-pointer text-sm font-medium">{t("navigation:filters")}</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-2 text-sm">
            <span>{t("field.priority")}</span>
            <select
              className="w-full rounded-md border border-input bg-background p-3"
              value={search.priority ?? ""}
              onChange={(event) =>
                change({
                  priority: event.target.value
                    ? (event.target.value as typeof search.priority)
                    : undefined,
                })
              }
            >
              <option value="">{t("navigation:all")}</option>
              <SelectOptions values={["normal", "high", "urgent"]} prefix="priority" />
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span>{t("navigation:assignment")}</span>
            <select
              className="w-full rounded-md border border-input bg-background p-3"
              value={search.assignment ?? ""}
              onChange={(event) =>
                change({
                  assignment: event.target.value
                    ? (event.target.value as typeof search.assignment)
                    : undefined,
                })
              }
            >
              <option value="">{t("navigation:all")}</option>
              <SelectOptions
                values={[
                  "unassigned",
                  "proposed",
                  "accepted",
                  "marketplace",
                  "reassign",
                  "coverview",
                ]}
                prefix="assignment"
              />
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span>{t("field.result")}</span>
            <select
              className="w-full rounded-md border border-input bg-background p-3"
              value={search.result ?? ""}
              onChange={(event) =>
                change({
                  result: event.target.value
                    ? (event.target.value as typeof search.result)
                    : undefined,
                })
              }
            >
              <option value="">{t("navigation:all")}</option>
              <SelectOptions values={leadResultSchema.options} prefix="result" />
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span>{t("navigation:waiting")}</span>
            <select
              className="w-full rounded-md border border-input bg-background p-3"
              value={search.waiting ?? ""}
              onChange={(event) =>
                change({
                  waiting: event.target.value
                    ? (event.target.value as typeof search.waiting)
                    : undefined,
                })
              }
            >
              <option value="">{t("navigation:all")}</option>
              {["active", "due", "none"].map((v) => (
                <option key={v} value={v}>
                  {t(`navigation:wait.${v}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span>{t("navigation:advisor")}</span>
            <select
              className="w-full rounded-md border border-input bg-background p-3"
              value={search.responsibleId ?? ""}
              onChange={(event) => change({ responsibleId: event.target.value || undefined })}
            >
              <option value="">{t("navigation:all")}</option>
              {(directory.data?.items ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {t("navigation:person", { name: item.name, organization: item.organization })}
                </option>
              ))}
            </select>
          </label>
          {session.context.administrator && (
            <label className="space-y-2 text-sm">
              <span>{t("navigation:organization")}</span>
              <select
                className="w-full rounded-md border border-input bg-background p-3"
                value={search.organizationId ?? ""}
                onChange={(event) => change({ organizationId: event.target.value || undefined })}
              >
                <option value="">{t("navigation:all")}</option>
                {organizations.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="space-y-2 text-sm">
            <span>{t("navigation:alert")}</span>
            <select
              className="w-full rounded-md border border-input bg-background p-3"
              value={search.alert ?? ""}
              onChange={(event) =>
                change({
                  alert: event.target.value
                    ? (event.target.value as typeof search.alert)
                    : undefined,
                })
              }
            >
              <option value="">{t("navigation:all")}</option>
              {(["any", "overdue", "no_next_action", "unassigned", "task_overdue"] as const).map(
                (value) => (
                  <option key={value} value={value}>
                    {t(`navigation:alerts.${value}`)}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span>{t("navigation:source")}</span>
            <Input
              value={sourceText}
              maxLength={160}
              onChange={(event) => setSourceText(event.target.value)}
              onBlur={() => change({ source: sourceText.trim() || undefined })}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span>{t("navigation:dueFrom")}</span>
            <Input
              type="datetime-local"
              value={localDate(search.dueFrom)}
              onChange={(event) => changeDate("dueFrom", event.target.value)}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span>{t("navigation:dueTo")}</span>
            <Input
              type="datetime-local"
              value={localDate(search.dueTo)}
              onChange={(event) => changeDate("dueTo", event.target.value)}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span>{t("navigation:createdFrom")}</span>
            <Input
              type="datetime-local"
              value={localDate(search.createdFrom)}
              onChange={(event) => changeDate("createdFrom", event.target.value)}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span>{t("navigation:createdTo")}</span>
            <Input
              type="datetime-local"
              value={localDate(search.createdTo)}
              onChange={(event) => changeDate("createdTo", event.target.value)}
            />
          </label>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{t("navigation:localTime")}</p>
        {dateError && <p role="alert">{t("navigation:invalidDate")}</p>}
        <Button
          className="mt-3"
          variant="outline"
          onClick={() => {
            setQueryText("");
            setSourceText("");
            session.rememberLeadSearch({ layout });
            void navigate({ search: { layout } });
          }}
        >
          {t("navigation:reset")}
        </Button>
      </details>
      {leads.isPending ? (
        <LoadingState label={t("loading")} />
      ) : leads.isError ? (
        <ErrorState
          title={t("error")}
          description={t("error")}
          retryLabel={t("retry")}
          pendingLabel={t("loading")}
          onRetry={() => void leads.refetch()}
        />
      ) : !leads.data.items.length ? (
        <EmptyState title={t("empty")} description={t("emptyDescription")} />
      ) : layout === "kanban" ? (
        <div className="flex gap-4 overflow-x-auto pb-5">
          {groups.map((group) => (
            <section
              key={group.key}
              className="w-72 shrink-0 rounded-xl bg-muted/50 p-3"
              onDragOver={(event) => {
                if (group.key !== "followup") event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                const id = event.dataTransfer.getData("text/lead-id");
                if (
                  group.key !== "followup" &&
                  (session.context.canAdvise || session.context.canManage) &&
                  leads.data.items.some(
                    (lead) =>
                      lead.id === id &&
                      (lead.allowedActions?.includes("transition") ?? lead.canEdit) &&
                      lead.stage !== "draft" &&
                      lead.stage !== "completed",
                  )
                )
                  setMoving({ id, stage: group.target });
              }}
            >
              <header className="mb-4 flex items-center justify-between px-1 text-sm font-semibold">
                <h2>{t(`groups.${group.key}`)}</h2>
                <span className="rounded-md bg-background px-2 py-1 text-xs text-muted-foreground">
                  {stageCount(group.stages)}
                </span>
              </header>
              <div className="space-y-3">
                {leads.data.items
                  .filter((lead) => group.stages.includes(lead.stage))
                  .map((lead) => (
                    <LeadCard key={lead.id} lead={lead} onOpen={remember} />
                  ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted">
              <tr>
                {["title", "clientName", "responsible", "nextAction", "dueAt"].map((key) => (
                  <th key={key} className="p-4 font-medium">
                    {t(`field.${key}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.data.items.map((lead) => (
                <tr key={lead.id} className="border-t border-border">
                  <td className="p-4">
                    <Link
                      to="/leads/$leadId"
                      params={{ leadId: lead.id }}
                      onClick={remember}
                      className="font-medium hover:underline"
                    >
                      {lead.title}
                    </Link>
                    <div className="mt-1">
                      <Badge variant="outline">{t(`stage.${lead.stage}`)}</Badge>
                    </div>
                  </td>
                  <td className="p-4">{lead.clientName}</td>
                  <td className="p-4">{lead.responsibleName ?? t("detail.noResponsible")}</td>
                  <td className="p-4">{lead.nextAction || "—"}</td>
                  <td className="whitespace-nowrap p-4">{formatDate(lead.dueAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{t("leads.limited")}</p>
        <div className="flex gap-2">
          {search.cursor && (
            <Button variant="outline" onClick={() => change({})}>
              {t("leads.first")}
            </Button>
          )}
          {leads.data?.nextCursor && (
            <Button
              variant="outline"
              onClick={() => {
                void navigate({ search: { ...search, cursor: leads.data.nextCursor! } });
              }}
            >
              {t("leads.more")}
            </Button>
          )}
        </div>
      </div>
      <CreateLeadDialog open={create} onOpenChange={setCreate} />
      {selected.data && moving && (
        <LeadActionDialog
          key={`${moving.id}:${moving.stage}`}
          lead={selected.data}
          action={
            moving.stage === "completed"
              ? "close"
              : moving.stage === "appointment_scheduled"
                ? "appointment"
                : "transition"
          }
          stage={moving.stage}
          onClose={() => setMoving(null)}
        />
      )}
    </>
  );
}
