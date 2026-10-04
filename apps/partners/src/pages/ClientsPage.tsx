import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { EmptyState, LoadingState, ErrorState, Badge } from "@coverview/ui";
import { useLeads } from "../features/use-leads";
export function ClientsPage() {
  const { t } = useTranslation(),
    query = useLeads({ view: "all" });
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
  const groups = new Map<string, typeof query.data.items>();
  for (const lead of query.data.items) {
    const key = lead.clientUserId
      ? `${lead.clientUserId}:${lead.clientProfileId ?? "self"}`
      : lead.id;
    groups.set(key, [...(groups.get(key) ?? []), lead]);
  }
  return (
    <>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("clients.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("clients.subtitle")}</p>
      </header>
      <div className="grid gap-5 md:grid-cols-2">
        {[...groups].map(([key, leads]) => (
          <section key={key} className="rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold">{leads[0]?.clientName}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("clients.leads", { count: leads.length })}
            </p>
            <div className="mt-5 divide-y divide-border">
              {leads.map((lead) => (
                <Link
                  key={lead.id}
                  to="/leads/$leadId"
                  params={{ leadId: lead.id }}
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                >
                  <span>{lead.title}</span>
                  <Badge variant="outline">{t(`stage.${lead.stage}`)}</Badge>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
      {!groups.size && <EmptyState title={t("empty")} description={t("clients.subtitle")} />}
      <p className="text-xs text-muted-foreground">{t("leads.limited")}</p>
    </>
  );
}
