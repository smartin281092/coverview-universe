import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ProfessionalAvailabilityDossier } from "@coverview/contracts/partner";
import {
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  LoadingState,
  ErrorState,
} from "@coverview/ui";
import { usePartner } from "./PartnerSession";
import { partnerApi } from "../api";
import { formatDate } from "./Field";
import { AvailabilityForm } from "./AvailabilityForm";

function Declaration({
  value,
}: {
  value: NonNullable<ProfessionalAvailabilityDossier["current"]>;
}) {
  const { t, i18n } = useTranslation();
  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <p className="text-sm font-medium">{t(`availability.scope.${value.professionalScope}`)}</p>
      <p className="text-xs text-muted-foreground">
        {t("availability.subject", {
          name: value.declaredName,
          organization: value.declaredOrganization,
        })}
      </p>
      <p className="text-xs text-muted-foreground">
        {t("availability.record", { revision: value.revision, date: formatDate(value.declaredAt) })}
      </p>
      <dl className="space-y-2 text-sm">
        <dt className="text-muted-foreground">{t("availability.modes")}</dt>
        <dd>
          {value.modes.length
            ? new Intl.ListFormat(i18n.language).format(
                value.modes.map((mode) => t(`appointment.${mode}`)),
              )
            : t("availability.unspecified")}
        </dd>
      </dl>
      <p className="text-xs text-muted-foreground">{t("availability.timezone")}</p>
      {!value.periods.length ? (
        <p className="text-sm">{t("availability.noPeriods")}</p>
      ) : (
        <ul
          className="max-h-80 space-y-3 overflow-y-auto"
          aria-label={t("availability.periods")}
          tabIndex={0}
        >
          {value.periods.map((period, index) => (
            <li key={index} className="space-y-1 border-t border-border pt-3 text-sm">
              <Badge variant="outline">{t(`availability.${period.kind}`)}</Badge>
              <p>
                {t("availability.range", {
                  start: formatDate(period.startsAt),
                  end: formatDate(period.endsAt),
                })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
export function AvailabilityDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { t } = useTranslation(),
    session = usePartner(),
    client = useQueryClient();
  const [before, setBefore] = useState<number>(),
    [history, setHistory] = useState(false),
    [selectedRevision, setSelectedRevision] = useState<number>(),
    [editing, setEditing] = useState<ProfessionalAvailabilityDossier | null>(null),
    [busy, setBusy] = useState(false);
  const key = [...session.queryKey, "availability", userId];
  const query = useQuery({
    queryKey: [...key, before],
    queryFn: ({ signal }) => partnerApi.availability(userId, before, signal),
    gcTime: 0,
    refetchInterval: 10000,
  });
  const selected = query.data?.history.find((item) => item.revision === selectedRevision);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl" closeLabel={t("close")}>
        <DialogHeader>
          <DialogTitle>{t("availability.title")}</DialogTitle>
          <DialogDescription>{t("availability.description")}</DialogDescription>
        </DialogHeader>
        {query.isPending ? (
          <LoadingState label={t("loading")} />
        ) : query.isError ? (
          <ErrorState
            title={t("error")}
            description={t("error")}
            retryLabel={t("retry")}
            pendingLabel={t("loading")}
            onRetry={() => void query.refetch()}
          />
        ) : editing ? (
          <AvailabilityForm
            initial={editing}
            current={query.data}
            onBusy={setBusy}
            onBack={() => {
              setEditing(null);
              void query.refetch();
            }}
            onSaved={(result) => {
              client.setQueryData([...key, undefined], result);
              setEditing(null);
              setBefore(undefined);
              void client.invalidateQueries({ queryKey: session.queryKey });
            }}
          />
        ) : history ? (
          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={() => {
                if (selectedRevision) setSelectedRevision(undefined);
                else {
                  setHistory(false);
                  setBefore(undefined);
                }
              }}
            >
              {t("availability.back")}
            </Button>
            {selected ? (
              <Declaration value={selected} />
            ) : (
              <>
                <h3 className="font-medium">{t("availability.history")}</h3>
                {query.data.history.map((item) => (
                  <Button
                    key={item.revision}
                    variant="outline"
                    className="h-auto w-full justify-start whitespace-normal text-left"
                    onClick={() => setSelectedRevision(item.revision)}
                  >
                    {t("availability.record", {
                      revision: item.revision,
                      date: formatDate(item.declaredAt),
                    })}
                  </Button>
                ))}
                <div className="flex gap-3">
                  {before && (
                    <Button variant="outline" onClick={() => setBefore(undefined)}>
                      {t("availability.latest")}
                    </Button>
                  )}
                  {query.data.nextBeforeRevision && (
                    <Button
                      variant="outline"
                      onClick={() => setBefore(query.data.nextBeforeRevision!)}
                    >
                      {t("availability.older")}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm">
              {t("availability.subject", {
                name: query.data.name,
                organization: query.data.organization,
              })}
            </p>
            {query.data.current ? (
              <Declaration value={query.data.current} />
            ) : (
              <p className="text-sm text-muted-foreground">{t("availability.unset")}</p>
            )}
            <p className="text-sm text-muted-foreground">{t("availability.noBooking")}</p>
            <div className="flex flex-wrap gap-3">
              {query.data.canDeclare && (
                <Button onClick={() => setEditing(query.data)}>{t("availability.edit")}</Button>
              )}
              {query.data.history.length > 0 && (
                <Button variant="outline" onClick={() => setHistory(true)}>
                  {t("availability.history")}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
