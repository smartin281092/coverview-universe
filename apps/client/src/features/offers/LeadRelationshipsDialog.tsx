import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import { Button, VersionHistoryDialog } from "@coverview/ui";
import { partnerApi } from "../../partner-api";
export function LeadRelationshipsDialog({
  identity,
  leadId,
  onClose,
}: {
  identity: IdentityMe;
  leadId: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation("relationships"),
    [pages, setPages] = useState<(string | undefined)[]>([undefined]);
  const query = useQuery({
    queryKey: [
      "private",
      identity.user.id,
      identity.session.id,
      "lead-relationships",
      leadId,
      pages.at(-1),
    ],
    queryFn: ({ signal }) => partnerApi.leadRelationships(leadId, true, pages.at(-1), signal),
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
        title: t(`kinds.${item.kind}`),
        caption: t("entry", {
          kind: t(`kinds.${item.kind}`),
          date: date(item.createdAt),
          state: t(item.active ? "active" : "withdrawn"),
        }),
        body: (
          <div className="space-y-3 text-sm">
            <p className="whitespace-pre-wrap">{item.reason}</p>
            {item.withdrawalReason && (
              <p className="whitespace-pre-wrap">
                {t("withdrawalReason", { reason: item.withdrawalReason })}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link to="/offers" search={{ lead: item.source.id }} onClick={onClose}>
                  {t("source", { title: item.source.title })}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/offers" search={{ lead: item.target.id }} onClick={onClose}>
                  {t("main", { title: item.target.title })}
                </Link>
              </Button>
            </div>
          </div>
        ),
      }))}
    />
  );
}
