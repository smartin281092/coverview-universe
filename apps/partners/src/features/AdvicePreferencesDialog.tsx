import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { AdvicePreferences } from "@coverview/contracts/partner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  LoadingState,
  ErrorState,
  swissCantonNamesFr,
} from "@coverview/ui";
import { usePartner } from "./PartnerSession";
import { partnerApi } from "../api";
import { formatDate } from "./Field";

function Values({ value }: { value: NonNullable<AdvicePreferences["current"]> }) {
  const { t, i18n } = useTranslation();
  const names = new Intl.DisplayNames([i18n.language], { type: "language" });
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-3">
      <div>
        <dt className="text-muted-foreground">{t("advice.language")}</dt>
        <dd>{value.languageCode ? names.of(value.languageCode) : t("advice.unknown")}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t("advice.mode")}</dt>
        <dd>{value.mode ? t(`advice.modes.${value.mode}`) : t("advice.unknown")}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t("advice.canton")}</dt>
        <dd>
          {value.canton
            ? swissCantonNamesFr[value.canton]
            : t(
                value.mode === "phone" || value.mode === "video"
                  ? "advice.remote"
                  : "advice.unknown",
              )}
        </dd>
      </div>
    </dl>
  );
}
export function AdvicePreferencesDialog({
  leadId,
  onClose,
}: {
  leadId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation(),
    session = usePartner();
  const [before, setBefore] = useState<number>(),
    [history, setHistory] = useState(false),
    [revision, setRevision] = useState<number>();
  const query = useQuery({
    queryKey: [...session.queryKey, "advice", leadId, before],
    queryFn: ({ signal }) => partnerApi.advicePreferences(leadId, before, signal),
    gcTime: 0,
    retry: false,
    refetchInterval: (query) => (query.state.status === "error" ? false : 10000),
  });
  const selected = query.data?.history.find((item) => item.revision === revision);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl" closeLabel={t("close")}>
        <DialogHeader>
          <DialogTitle>{t("advice.title")}</DialogTitle>
          <DialogDescription>{t("advice.description")}</DialogDescription>
        </DialogHeader>
        {query.isPending ? (
          <LoadingState label={t("loading")} />
        ) : query.isError ? (
          <ErrorState
            title={t("error")}
            description={t("advice.error")}
            retryLabel={t("retry")}
            pendingLabel={t("loading")}
            onRetry={() => void query.refetch()}
          />
        ) : selected ? (
          <div className="space-y-4">
            <p className="text-sm">
              {t("advice.record", {
                revision: selected.revision,
                date: formatDate(selected.confirmedAt),
              })}
            </p>
            <p className="font-medium">{selected.scope.title}</p>
            <p className="text-sm">{selected.scope.object}</p>
            <p className="text-sm">
              {t("advice.category", { category: t(`category.${selected.scope.category}`) })}
            </p>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {selected.scope.context}
            </p>
            <p className="text-sm text-muted-foreground">
              {t(selected.currentOwnerConfirmation ? "advice.ownerCurrent" : "advice.ownerChanged")}
            </p>
            <Values value={selected} />
            <Button variant="outline" onClick={() => setRevision(undefined)}>
              {t("advice.back")}
            </Button>
          </div>
        ) : history ? (
          <div className="space-y-4">
            <h3 className="font-medium">{t("advice.history")}</h3>
            {query.data.history.map((item) => (
              <Button
                key={item.revision}
                variant="outline"
                className="w-full justify-start text-left whitespace-normal"
                onClick={() => setRevision(item.revision)}
              >
                {t("advice.record", {
                  revision: item.revision,
                  date: formatDate(item.confirmedAt),
                })}
              </Button>
            ))}
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setHistory(false);
                  setBefore(undefined);
                }}
              >
                {t("advice.back")}
              </Button>
              {before && (
                <Button variant="outline" onClick={() => setBefore(undefined)}>
                  {t("advice.latest")}
                </Button>
              )}
              {query.data.nextBeforeRevision && (
                <Button
                  variant="outline"
                  onClick={() => setBefore(query.data.nextBeforeRevision ?? undefined)}
                >
                  {t("advice.older")}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="font-medium">
              {t("advice.forNeed", { name: query.data.profileName, title: query.data.scope.title })}
            </p>
            <p className="text-sm">{t(`advice.status.${query.data.status}`)}</p>
            {query.data.status === "confirmed" && query.data.current && (
              <>
                <Values value={query.data.current} />
                <p className="text-xs text-muted-foreground">
                  {t("advice.record", {
                    revision: query.data.current.revision,
                    date: formatDate(query.data.current.confirmedAt),
                  })}
                </p>
              </>
            )}
            <p className="text-sm text-muted-foreground">{t("advice.limits")}</p>
            {query.data.history.length > 0 && (
              <Button variant="outline" onClick={() => setHistory(true)}>
                {t("advice.history")}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
