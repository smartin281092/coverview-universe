import { ApiError } from "@coverview/api-client";
import { ErrorState, NotFoundState } from "@coverview/ui";
import { useTranslation } from "react-i18next";
import { DocumentFailure } from "../documents/DocumentFailure";

export function ActionFailure({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation("actions");
  if (error instanceof ApiError && (error.status === 401 || error.code.startsWith("IDENTITY_")))
    return <DocumentFailure error={error} onRetry={onRetry} />;
  if (error instanceof ApiError && error.status === 404)
    return <NotFoundState title={t("missingTitle")} description={t("missingDescription")} />;
  return (
    <ErrorState
      title={t("errorTitle")}
      description={t(
        error instanceof ApiError && error.code === "DOCUMENT_MANDATE_REQUIRED"
          ? "mandateRequired"
          : error instanceof ApiError && error.status === 409
            ? "conflict"
            : error instanceof ApiError && (error.status === 400 || error.status === 422)
              ? "question.invalid"
              : "errorDescription",
      )}
      onRetry={onRetry}
      retryLabel={t("retry")}
      pendingLabel={t("loading")}
    />
  );
}
