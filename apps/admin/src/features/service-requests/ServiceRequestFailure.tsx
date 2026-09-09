import { ApiError } from "@coverview/api-client";
import { ErrorState } from "@coverview/ui";
import { useTranslation } from "react-i18next";
import { AdminFailure } from "../users/AdminFailure";

export function ServiceRequestFailure({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation("serviceRequests");
  if (
    error instanceof ApiError &&
    (error.status === 401 || error.status === 403 || error.code.startsWith("IDENTITY_"))
  )
    return <AdminFailure error={error} onRetry={onRetry} />;
  return (
    <ErrorState
      title={t("errorTitle")}
      description={t(
        error instanceof ApiError && error.status === 409 ? "conflict" : "errorDescription",
      )}
      onRetry={onRetry}
      retryLabel={t("retry")}
      pendingLabel={t("loading")}
    />
  );
}
