import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppointmentAssessment } from "@coverview/contracts/partner";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  LoadingState,
  ErrorState,
} from "@coverview/ui";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
import { formatDate } from "./Field";
import { AppointmentTimeForm } from "./AppointmentTimeForm";

export function AppointmentAssessmentDialog({
  leadId,
  appointmentId,
  onClose,
}: {
  leadId: string;
  appointmentId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation(),
    session = usePartner(),
    client = useQueryClient();
  const [editing, setEditing] = useState<AppointmentAssessment | null>(null),
    [history, setHistory] = useState(false),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  const key = [...session.queryKey, "appointment-assessment", leadId, appointmentId];
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => partnerApi.appointmentAssessment(leadId, appointmentId, signal),
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 10000,
    retry: false,
  });
  const value = query.data;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl" closeLabel={t("close")}>
        <DialogHeader>
          <DialogTitle>{t("appointmentAssessment.title")}</DialogTitle>
          <DialogDescription>{t("appointmentAssessment.description")}</DialogDescription>
        </DialogHeader>
        {query.isPending ? (
          <LoadingState label={t("loading")} />
        ) : query.isError ? (
          <ErrorState
            title={t("error")}
            description={t("appointmentAssessment.error")}
            retryLabel={t("retry")}
            pendingLabel={t("loading")}
            onRetry={() => void query.refetch()}
          />
        ) : editing && value ? (
          <AppointmentTimeForm
            initial={editing}
            current={value}
            onBusy={setBusy}
            onBack={() => {
              setEditing(null);
              void query.refetch();
            }}
            onSaved={(result) => {
              client.setQueryData(key, result);
              setEditing(null);
              setSaved(true);
              void client.invalidateQueries({ queryKey: session.queryKey });
            }}
          />
        ) : history && value?.timeProtection ? (
          <section className="space-y-4">
            <h3 className="font-medium">{t("appointmentTime.history")}</h3>
            <p className="text-xs text-muted-foreground">{t("appointmentTime.historyHelp")}</p>
            <Button variant="outline" onClick={() => setHistory(false)}>
              {t("appointmentTime.back")}
            </Button>
            <ul className="space-y-4">
              {value.timeProtection.history.map((record) => (
                <li
                  key={record.revision}
                  className="space-y-2 rounded-lg border border-border p-3 text-sm"
                >
                  <p>
                    {t("appointmentTime.record", {
                      revision: record.revision,
                      date: formatDate(record.recordedAt),
                    })}
                  </p>
                  <p>
                    {t("appointmentTime.range", {
                      start: formatDate(record.startsAt),
                      end: formatDate(record.endsAt),
                    })}
                  </p>
                  <p>
                    {t("appointmentTime.minutes", {
                      preparation: record.preparationMinutes,
                      before: record.travelBeforeMinutes,
                      after: record.travelAfterMinutes,
                    })}
                  </p>
                  {record.rescheduling &&
                    (["previous", "next"] as const).map((side) => (
                      <div key={side} className="space-y-1">
                        <p className="font-medium">{t(`personalRescheduling.${side}`)}</p>
                        <p>
                          {t("personalRescheduling.terms", {
                            date: formatDate(record.rescheduling![side].startsAt),
                            duration: record.rescheduling![side].durationMinutes,
                            mode: t(`appointment.${record.rescheduling![side].mode}`),
                          })}
                        </p>
                        <p>{record.rescheduling![side].location}</p>
                      </div>
                    ))}
                </li>
              ))}
            </ul>
          </section>
        ) : (
          value && (
            <div className="space-y-5">
              {saved && (
                <p role="status" className="text-sm">
                  {t("appointmentTime.saved")}
                </p>
              )}
              <section className="space-y-2" aria-live="polite">
                <Badge variant="outline">{t(`appointmentAssessment.status.${value.status}`)}</Badge>
                <p className="text-sm">
                  {t("appointmentAssessment.range", {
                    start: formatDate(value.startsAt),
                    end: formatDate(value.endsAt),
                    mode: t(`appointment.${value.mode}`),
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("appointmentAssessment.checked", {
                    date: formatDate(value.checkedAt),
                    timezone: value.timezone,
                  })}
                </p>
              </section>
              {value.timeProtection && (
                <section className="space-y-2 rounded-lg border border-border p-3 text-sm">
                  <h3 className="font-medium">{t("appointmentTime.title")}</h3>
                  <p>
                    {t(
                      value.timeProtection.current
                        ? "appointmentTime.range"
                        : "appointmentTime.missing",
                      {
                        start: formatDate(value.timeProtection.startsAt),
                        end: formatDate(value.timeProtection.endsAt),
                      },
                    )}
                  </p>
                  <p className="text-muted-foreground">{t("appointmentTime.coverage")}</p>
                  <div className="flex flex-wrap gap-2">
                    {value.timeProtection.canConfirm && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSaved(false);
                          setEditing(value);
                        }}
                      >
                        {t("appointmentTime.edit")}
                      </Button>
                    )}
                    {!!value.timeProtection.history.length && (
                      <Button variant="outline" onClick={() => setHistory(true)}>
                        {t("appointmentTime.history")}
                      </Button>
                    )}
                  </div>
                </section>
              )}
              <dl className="grid gap-3 text-sm">
                <div>
                  <dt className="font-medium">{t("appointmentAssessment.declaration")}</dt>
                  <dd className="mt-1 text-muted-foreground">
                    {t(`appointmentAssessment.scope.${value.declaration.scope}`)}
                  </dd>
                  {value.declaration.revision && (
                    <dd className="mt-1 text-xs text-muted-foreground">
                      {t("appointmentAssessment.revision", {
                        revision: value.declaration.revision,
                        professionalRevision: value.declaration.professionalRevision,
                      })}
                    </dd>
                  )}
                </div>
                <div>
                  <dt className="font-medium">{t("availability.modes")}</dt>
                  <dd className="mt-1 text-muted-foreground">
                    {t(`appointmentAssessment.mode.${value.declaration.mode}`)}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium">{t("appointmentAssessment.period")}</dt>
                  <dd className="mt-1 text-muted-foreground">
                    {t(`appointmentAssessment.coverage.${value.declaration.period}`)}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium">{t("appointmentAssessment.commitments")}</dt>
                  <dd className="mt-1 text-muted-foreground">
                    {t(
                      value.overlappingCommitment
                        ? "appointmentAssessment.overlap"
                        : "appointmentAssessment.noOverlap",
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium">{t("advice.mode")}</dt>
                  <dd className="mt-1 text-muted-foreground">
                    {t(`appointmentAssessment.preference.${value.client.mode}`)}
                  </dd>
                  {value.client.requestedMode && (
                    <dd className="mt-1 text-xs text-muted-foreground">
                      {t("appointmentAssessment.wish", {
                        mode: t(`appointment.${value.client.requestedMode}`),
                        revision: value.client.preferenceRevision,
                      })}
                    </dd>
                  )}
                </div>
                <div>
                  <dt className="font-medium">{t("appointmentAssessment.responsibility")}</dt>
                  <dd className="mt-1 text-muted-foreground">
                    {t(`appointmentAssessment.authority.${value.responsibility}`)}
                  </dd>
                </div>
              </dl>
              {value.client.changeRequested && (
                <p
                  role="status"
                  className="rounded-lg border border-border p-3 text-sm font-medium"
                >
                  {t("appointmentAssessment.changeRequested")}
                </p>
              )}
              <section className="rounded-lg bg-muted p-4 text-sm">
                <h3 className="font-medium">{t("appointmentAssessment.unverified")}</h3>
                <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
                  {value.unverifiedChecks.map((check) => (
                    <li key={check}>{t(`appointmentAssessment.checks.${check}`)}</li>
                  ))}
                </ul>
              </section>
              <p className="text-sm text-muted-foreground">{t("appointmentAssessment.limits")}</p>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  disabled={query.isFetching}
                  onClick={() => void query.refetch()}
                >
                  {t(query.isFetching ? "loading" : "appointmentAssessment.refresh")}
                </Button>
                <Button asChild>
                  <Link
                    to="/leads/$leadId"
                    params={{ leadId }}
                    search={{ tab: "appointments" }}
                    onClick={onClose}
                  >
                    {t("appointmentAssessment.openLead")}
                  </Link>
                </Button>
              </div>
            </div>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
