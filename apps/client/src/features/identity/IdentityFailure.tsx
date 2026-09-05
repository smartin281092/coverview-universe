import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@coverview/api-client";
import {
  AccessDeniedState,
  Button,
  ErrorState,
  NotFoundState,
  SessionExpiredState,
} from "@coverview/ui";
import { api } from "../../api";
import { forgetIdentity } from "./session-state";

export function IdentityFailure({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation();
  const code = error instanceof ApiError ? error.code : "PLATFORM_REQUEST_FAILED";
  const client = useQueryClient();
  useEffect(() => {
    if (code === "IDENTITY_UNAUTHENTICATED" || code === "IDENTITY_CSRF_INVALID")
      void forgetIdentity(client);
  }, [client, code]);
  if (code === "IDENTITY_UNAUTHENTICATED" || code === "IDENTITY_CSRF_INVALID") {
    return (
      <SessionExpiredState
        title={t("identity.signedOutTitle")}
        description={t("identity.signedOutDescription")}
        action={
          <Button asChild>
            <a href={api.loginUrl("wallet")}>{t("identity.login")}</a>
          </Button>
        }
      />
    );
  }
  if (code === "IDENTITY_ACCESS_DENIED") {
    return (
      <AccessDeniedState
        title={t("identity.deniedTitle")}
        description={t("identity.deniedDescription")}
      />
    );
  }
  if (code === "IDENTITY_NOT_FOUND") {
    return (
      <NotFoundState
        title={t("identity.missingTitle")}
        description={t("identity.missingDescription")}
      />
    );
  }
  return (
    <ErrorState
      title={t("identity.errorTitle")}
      description={t(
        code === "IDENTITY_RATE_LIMITED" ? "identity.rateLimited" : "identity.errorDescription",
      )}
      retryLabel={t("identity.retry")}
      pendingLabel={t("identity.pending")}
      onRetry={onRetry}
    />
  );
}
