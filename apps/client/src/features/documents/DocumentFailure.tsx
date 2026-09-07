import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiError } from "@coverview/api-client";
import { ErrorState, NotFoundState } from "@coverview/ui";
import { IdentityFailure } from "../identity/IdentityFailure";
import { forgetIdentity } from "../identity/session-state";

export function DocumentFailure({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation("documents");
  const client = useQueryClient();
  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) void forgetIdentity(client);
  }, [error, client]);
  if (error instanceof ApiError && (error.status === 401 || error.code.startsWith("IDENTITY_")))
    return <IdentityFailure error={error} onRetry={onRetry} />;
  if (error instanceof ApiError && error.code === "DOCUMENT_NOT_FOUND")
    return <NotFoundState title={t("notFound")} description={t("notFoundHelp")} />;
  const code = error instanceof ApiError ? error.code : "unknown";
  return (
    <ErrorState
      title={t("errorTitle")}
      description={t(`errors.${code}`, { defaultValue: t("errorHelp") })}
      retryLabel={t("tryAgain")}
      pendingLabel={t("loading")}
      onRetry={onRetry}
    />
  );
}
