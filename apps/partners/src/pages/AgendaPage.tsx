import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CalendarDays } from "lucide-react";
import { Badge, EmptyState, ErrorState, LoadingState } from "@coverview/ui";
import { useWork } from "../features/use-work";
import { formatDate } from "../features/Field";
export function AgendaPage() {
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
        <h1 className="text-3xl font-semibold tracking-tight">{t("agenda.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("agenda.subtitle")}</p>
        <p className="mt-2 text-xs text-muted-foreground">{t("appointment.timezone")}</p>
      </header>
      <div className="space-y-4">
        {query.data.appointments.map((appt) => (
          <Link
            key={appt.id}
            to="/leads/$leadId"
            params={{ leadId: appt.leadId }}
            search={{ tab: "appointments" }}
            className="flex flex-wrap items-center gap-5 rounded-xl border border-border p-6 hover:bg-muted"
          >
            <CalendarDays className="size-7 text-muted-foreground" />
            <div className="flex-1">
              <p className="font-semibold">{formatDate(appt.startsAt)}</p>
              <p className="mt-2 text-sm">
                {appt.clientName}
                {" · "}
                {appt.leadTitle}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{appt.location}</p>
            </div>
            <Badge variant="outline">{t(`appointment.${appt.mode}`)}</Badge>
            <span className="text-sm text-muted-foreground">
              {new Intl.NumberFormat("fr-CH", { style: "unit", unit: "minute" }).format(
                appt.durationMinutes,
              )}
            </span>
          </Link>
        ))}
      </div>
      {!query.data.appointments.length && (
        <EmptyState title={t("detail.emptyTab")} description={t("agenda.subtitle")} />
      )}
      {query.data.truncated && <p className="text-sm text-muted-foreground">{t("workLimited")}</p>}
    </>
  );
}
