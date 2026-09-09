import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import type { CompanyAction } from "@coverview/contracts";
import { LoadingState, NotFoundState } from "@coverview/ui";
import { api } from "../../api";
import { DocumentReview } from "../documents/DocumentReview";
import { DocumentFailure } from "../documents/DocumentFailure";

export function ActionSourceReview({
  identity,
  documentId,
  action,
  onDone,
  onPendingChange,
}: {
  identity: IdentityMe;
  documentId: string;
  action: CompanyAction;
  onDone: () => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const { t } = useTranslation("actions");
  const query = useQuery({
    queryKey: ["private", identity.user.id, identity.session.id, "document", documentId],
    queryFn: ({ signal }) => api.document(documentId, { signal }),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  if (query.isPending) return <LoadingState label={t("loading")} />;
  if (query.isError)
    return <DocumentFailure error={query.error} onRetry={() => void query.refetch()} />;
  const group = query.data.reviewGroups?.find((item) => item.id === action.group);
  if (!group || query.data.profileId !== action.profileId)
    return <NotFoundState title={t("sourceTitle")} description={t("sourceUnavailable")} />;
  return (
    <DocumentReview
      key={`${query.data.id}:${group.id}`}
      identity={identity}
      document={query.data}
      group={group}
      onDone={onDone}
      onPendingChange={onPendingChange}
    />
  );
}
