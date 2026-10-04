import { AvailabilityDialog } from "../features/AvailabilityDialog";
import { AppointmentAssessmentDialog } from "../features/AppointmentAssessmentDialog";
import { useState } from "react";
import { usePartner } from "../features/PartnerSession";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CalendarDays } from "lucide-react";
import { Button, Badge, EmptyState, ErrorState, LoadingState } from "@coverview/ui";
import { useWork } from "../features/use-work";
import { formatDate } from "../features/Field";
export function AgendaPage() {
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [assessment, setAssessment] = useState<{ leadId: string; appointmentId: string }>();
  const { identity, context } = usePartner();
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
      {assessment && (
        <AppointmentAssessmentDialog {...assessment} onClose={() => setAssessment(undefined)} />
      )}
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("agenda.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("agenda.subtitle")}</p>
        <p className="mt-2 text-xs text-muted-foreground">{t("appointment.timezone")}</p>
        {context.application && (
          <Button className="mt-4" variant="outline" onClick={() => setAvailabilityOpen(true)}>
            {t("availability.title")}
          </Button>
        )}
      </header>
      {availabilityOpen && (
        <AvailabilityDialog userId={identity.user.id} onClose={() => setAvailabilityOpen(false)} />
      )}
      <div className="space-y-4">
        {query.data.appointments.map((appt) => (
          <article
            key={appt.id}
            className="flex flex-wrap items-center gap-5 rounded-xl border border-border p-6"
          >
            <CalendarDays className="size-7 text-muted-foreground" />
            <div className="flex-1">
              <Link
                to="/leads/$leadId"
                params={{ leadId: appt.leadId }}
                search={{ tab: "appointments" }}
                className="font-semibold hover:underline"
              >
                {formatDate(appt.startsAt)}
              </Link>
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
            {appt.advisorId === identity.user.id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAssessment({ leadId: appt.leadId, appointmentId: appt.id })}
              >
                {t("appointmentAssessment.open")}
              </Button>
            )}
          </article>
        ))}
      </div>
      {!query.data.appointments.length && (
        <EmptyState title={t("detail.emptyTab")} description={t("agenda.subtitle")} />
      )}
      {query.data.truncated && <p className="text-sm text-muted-foreground">{t("workLimited")}</p>}
    </>
  );
}
