import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { VersionHistoryDialog } from "@coverview/ui";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
export function LeadReopeningsDialog({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const session = usePartner(),
    { t, i18n } = useTranslation("lifecycle"),
    [pages, setPages] = useState<(string | undefined)[]>([undefined]);
  const query = useQuery({
    queryKey: [...session.queryKey, "lead-reopenings", leadId, pages.at(-1)],
    queryFn: ({ signal }) => partnerApi.leadReopenings(leadId, false, pages.at(-1), signal),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 10000,
  });
  const data = query.isError ? undefined : query.data;
  const date = (s: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Zurich",
    }).format(new Date(s));
  return (
    <VersionHistoryDialog
      title={t("title")}
      description={t("description")}
      labels={{
        close: t("close"),
        loading: t("loading"),
        error: t("error"),
        retry: t("retry"),
        empty: t("empty"),
        next: t("next"),
        previous: t("previous"),
        details: t("details"),
      }}
      loading={query.isPending}
      error={query.isError}
      hasNext={!!data?.nextCursor}
      hasPrevious={pages.length > 1}
      onNext={() => {
        if (data?.nextCursor) setPages([...pages, data.nextCursor]);
      }}
      onPrevious={() => setPages(pages.slice(0, -1))}
      onRetry={() => void query.refetch()}
      onClose={onClose}
      items={(data?.items ?? []).map((item) => ({
        id: item.id,
        title: t("reopened", { date: date(item.reopenedAt) }),
        caption: t("closed", {
          date: date(item.closedAt),
          result: t(`result.${item.closedResult}`),
          reason: t(`reason.${item.closedReason}`),
        }),
        body: (
          <div className="space-y-3 text-sm">
            <p className="whitespace-pre-wrap">{item.reason}</p>
            <p>{t("nextAction", { action: item.nextAction, date: date(item.dueAt) })}</p>
          </div>
        ),
      }))}
    />
  );
}
