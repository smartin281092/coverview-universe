import { useState } from "react";
import { useSearch, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, LayoutGrid, List } from "lucide-react";
import { Button, Input, EmptyState, LoadingState, ErrorState, Badge } from "@coverview/ui";
import { leadCategorySchema, leadStageSchema, type LeadStage } from "@coverview/contracts/partner";
import { usePartner } from "../features/PartnerSession";
import { useLeads } from "../features/use-leads";
import { LeadCard } from "../features/LeadCard";
import { CreateLeadDialog } from "../features/CreateLeadDialog";
import { LeadActionDialog } from "../features/LeadActionDialog";
import { SelectOptions, formatDate } from "../features/Field";
import { partnerApi } from "../api";
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
  const { layout = "kanban", ...filters } = search,
    view =
      filters.view ??
      (session.context.administrator ? "all" : session.context.canAdvise ? "mine" : "referred"),
    leads = useLeads({ ...filters, view });
  const selected = useQuery({
    queryKey: [...session.queryKey, "lead", moving?.id],
    queryFn: ({ signal }) => partnerApi.lead(moving!.id, signal),
    enabled: !!moving,
    gcTime: 0,
  });
  const change = (next: Partial<typeof search>) => {
    void navigate({ search: { ...search, ...next, cursor: undefined } as typeof search });
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
      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="max-w-xs"
          aria-label={t("search")}
          placeholder={t("search")}
          value={search.q ?? ""}
          onChange={(event) => change({ q: event.target.value })}
        />
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          aria-label={t("nav.leads")}
          value={view}
          onChange={(event) =>
            change({ view: event.target.value as NonNullable<typeof search.view> })
          }
        >
          <SelectOptions
            values={["mine", "all", "referred", "urgent", "overdue", "no_action", "closed"]}
            prefix="views"
          />
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
                      lead.canEdit &&
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
                  {leads.data.items.filter((lead) => group.stages.includes(lead.stage)).length}
                </span>
              </header>
              <div className="space-y-3">
                {leads.data.items
                  .filter((lead) => group.stages.includes(lead.stage))
                  .map((lead) => (
                    <LeadCard key={lead.id} lead={lead} />
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
