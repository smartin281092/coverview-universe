import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Badge,
} from "@coverview/ui";
import { usePartner } from "./PartnerSession";
import { partnerApi } from "../api";

export function SharedAppointmentsDialog({
  leadId,
  onClose,
}: {
  leadId: string;
  onClose: () => void;
}) {
  const session = usePartner(),
    { t, i18n } = useTranslation();
  const [history, setHistory] = useState(false);
  const query = useQuery({
    queryKey: [...session.queryKey, "shared-appointments", leadId],
    queryFn: ({ signal }) => partnerApi.sharedAppointments(leadId, signal),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 10000,
  });
  const date = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Zurich",
    }).format(new Date(value));
  const items = history ? query.data?.history : query.data?.items;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent closeLabel={t("close")} className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("appointmentLinks.shared")}</DialogTitle>
          <DialogDescription>{t("appointmentLinks.sharedDescription")}</DialogDescription>
        </DialogHeader>
        {query.isPending ? (
          <p role="status">{t("loading")}</p>
        ) : query.isError ? (
          <div className="space-y-3">
            <p role="alert">{t("appointmentLinks.failed")}</p>
            <Button onClick={() => void query.refetch()}>{t("retry")}</Button>
          </div>
        ) : (
          <>
            <Button variant="outline" onClick={() => setHistory(!history)}>
              {t(history ? "appointmentLinks.current" : "appointmentLinks.history")}
            </Button>
            {!items?.length && <p>{t("appointmentLinks.empty")}</p>}
            <ul className="space-y-4">
              {items?.map((item) => (
                <li key={item.id} className="space-y-3 rounded-lg border border-border p-4">
                  <Badge variant="outline">{t(`appointmentLinks.status.${item.status}`)}</Badge>
                  <p className="font-medium">{date(item.appointment.startsAt)}</p>
                  <p className="break-words text-sm">
                    {t("appointmentLinks.place", {
                      mode: t(`appointmentLinks.mode.${item.appointment.mode}`),
                      location: item.appointment.location,
                    })}
                  </p>
                  <p className="text-sm">
                    {t("appointmentLinks.duration", { count: item.appointment.durationMinutes })}
                  </p>
                  {item.outcome && <p>{t(`appointmentLinks.outcome.${item.outcome}`)}</p>}
                  {item.status === "review_required" && (
                    <p className="text-sm text-muted-foreground">
                      {t("appointmentLinks.reviewRequired")}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t("appointmentLinks.recorded", {
                      date: date(item.recordedAt),
                      revision: item.revision,
                    })}
                  </p>
                </li>
              ))}
            </ul>
            {(history ? query.data?.historyTruncated : query.data?.itemsTruncated) && (
              <p className="text-sm">
                {t(
                  history ? "appointmentLinks.historyTruncated" : "appointmentLinks.itemsTruncated",
                )}
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
