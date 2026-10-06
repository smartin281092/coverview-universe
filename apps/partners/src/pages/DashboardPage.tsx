import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Plus, ArrowUpRight } from "lucide-react";
import { Button, EmptyState, LoadingState, ErrorState } from "@coverview/ui";
import { usePartner } from "../features/PartnerSession";
import { useLeads } from "../features/use-leads";
import { LeadCard } from "../features/LeadCard";
import { CreateLeadDialog } from "../features/CreateLeadDialog";
import { partnerApi } from "../api";
import { GoalSummary } from "../features/GoalSummary";
import { AccessNotice } from "../features/AccessDialogs";
export function DashboardPage() {
  const { t } = useTranslation(),
    session = usePartner(),
    leads = useLeads({
      view: session.context.administrator ? "all" : session.context.canAdvise ? "mine" : "referred",
    }),
    [create, setCreate] = useState(false);
  const stats = useQuery({
    queryKey: [...session.queryKey, "dashboard"],
    queryFn: ({ signal }) => partnerApi.dashboard(signal),
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 15000,
  });
  if (leads.isPending || stats.isPending) return <LoadingState label={t("loading")} />;
  if (leads.isError || stats.isError)
    return (
      <ErrorState
        title={t("error")}
        description={t("error")}
        retryLabel={t("retry")}
        pendingLabel={t("loading")}
        onRetry={() => {
          void leads.refetch();
          void stats.refetch();
        }}
      />
    );
  const priorities = leads.data.items.filter((lead) => lead.alerts.length > 0).slice(0, 6);
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="cv-meta">
            {new Intl.DateTimeFormat("fr-CH", {
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(new Date())}
          </p>
          <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("dashboard.title")}
          </h1>
          <p className="mt-3 text-muted-foreground">{t("dashboard.subtitle")}</p>
        </div>
        {session.context.canCreate && (
          <Button onClick={() => setCreate(true)}>
            <Plus className="mr-2 size-4" />
            {t("leads.new")}
          </Button>
        )}
      </header>
      {session.context.application && <AccessNotice application={session.context.application} />}
      <GoalSummary />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {(["active", "overdue", "unassigned", "openTasks", "resolved"] as const).map((key) => (
          <div key={key} className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{t(`dashboard.${key}`)}</p>
            <p className="mt-4 text-3xl font-medium tabular-nums">{stats.data[key]}</p>
          </div>
        ))}
      </div>
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{t("dashboard.priorities")}</h2>
          <Link
            to="/leads"
            search={{ view: "overdue" }}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            {t("nav.leads")}
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
        {priorities.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {priorities.map((lead) => (
              <LeadCard key={lead.id} lead={lead} />
            ))}
          </div>
        ) : (
          <EmptyState
            title={t("dashboard.nothing")}
            description={t("dashboard.nothingDescription")}
          />
        )}
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{t("dashboard.pipeline")}</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {stats.data.stages.map((stage) => (
            <Link
              key={stage.stage}
              to="/leads"
              search={{ stage: stage.stage, view: "all" }}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-4 text-sm hover:bg-muted"
            >
              <span>{t(`stage.${stage.stage}`)}</span>
              <strong>{stage.count}</strong>
            </Link>
          ))}
        </div>
      </section>
      <p className="text-xs text-muted-foreground">{t("dashboard.scope")}</p>
      <CreateLeadDialog open={create} onOpenChange={setCreate} />
    </>
  );
}
