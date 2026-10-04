import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@coverview/ui";
import type { PilotageQuery, PilotageMeasure } from "@coverview/contracts/partner-pilotage";
import { usePartner } from "./PartnerSession";
import { partnerApi } from "../api";
import { formatMeasure } from "./pilotage-display";
import { formatDate } from "./Field";
export function PilotageSourcesDialog({
  query,
  measure,
  onClose,
}: {
  query: PilotageQuery;
  measure: PilotageMeasure;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation("pilotage"),
    session = usePartner(),
    [cursor, setCursor] = useState<string>();
  const sources = useQuery({
    queryKey: [...session.queryKey, "pilotage-sources", query, measure.metric, cursor],
    queryFn: ({ signal }) =>
      partnerApi.pilotageSources(
        { ...query, metric: measure.metric, ...(cursor ? { cursor } : {}) },
        signal,
      ),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 15000,
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl" closeLabel={t("close")}>
        <DialogHeader>
          <DialogTitle>{t(`metrics.${measure.metric}`)}</DialogTitle>
          <DialogDescription>{t(`definitions.${measure.metric}`)}</DialogDescription>
        </DialogHeader>
        <p>{t("sourceDescription")}</p>
        {sources.isPending ? (
          <p>{t("loading")}</p>
        ) : sources.isError ? (
          <div role="alert">
            <p>{t("changed")}</p>
            <Button onClick={() => void sources.refetch()}>{t("reload")}</Button>
          </div>
        ) : (
          <>
            {!sources.data.items.length && <p>{t("noSources")}</p>}
            {sources.data.items.map((s) => (
              <article key={s.sourceId} className="space-y-3 border-t border-border py-4">
                <h3 className="font-semibold">{s.title}</h3>
                {s.at && <p>{formatDate(s.at)}</p>}
                <p>
                  {t("sourceValue", {
                    value: formatMeasure(
                      s.value,
                      measure.unit === "percent" ? "count" : measure.unit,
                      i18n.language,
                    ),
                    denominator: s.denominator ?? t("notApplicable"),
                  })}
                </p>
                <Button variant="outline" asChild>
                  <Link to="/leads/$leadId" params={{ leadId: s.leadId }}>
                    {t("openLead")}
                  </Link>
                </Button>
              </article>
            ))}
            <div className="flex gap-3">
              {cursor && (
                <Button variant="outline" onClick={() => setCursor(undefined)}>
                  {t("first")}
                </Button>
              )}
              {sources.data.nextCursor && (
                <Button variant="outline" onClick={() => setCursor(sources.data.nextCursor!)}>
                  {t("older")}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
