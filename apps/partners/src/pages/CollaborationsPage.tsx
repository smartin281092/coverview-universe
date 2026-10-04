import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { LoadingState, ErrorState } from "@coverview/ui";
import { usePartner } from "../features/PartnerSession";
import { partnerApi } from "../api";
import { CollaborationList } from "../features/CollaborationList";
export function CollaborationsPage() {
  const session = usePartner(),
    { t } = useTranslation();
  const query = useQuery({
    queryKey: [...session.queryKey, "collaborations"],
    queryFn: ({ signal }) => partnerApi.collaborations(signal),
    refetchInterval: 15000,
    gcTime: 0,
    retry: false,
  });
  return (
    <>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("collaboration.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("collaboration.intro")}</p>
      </header>
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
      ) : (
        <CollaborationList items={query.data.items} />
      )}
    </>
  );
}
