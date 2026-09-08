import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiError } from "@coverview/api-client";
import { AccessDeniedState, Button, ErrorState, NotFoundState } from "@coverview/ui";
import { IdentityFailure } from "../identity/IdentityFailure";

export function AdminFailure({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation("users");
  const { t: common } = useTranslation();
  const client = useQueryClient();
  const code = error instanceof ApiError ? error.code : null;
  useEffect(() => {
    if (code === "IDENTITY_MFA_REQUIRED" || code === "IDENTITY_ACCESS_DENIED")
      void client.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === "private" &&
          query.queryKey.at(-1) === "admin" &&
          query.state.status === "success",
      });
  }, [client, code]);
  if (error instanceof ApiError) {
    if (error.code === "IDENTITY_MFA_REQUIRED")
      return (
        <AccessDeniedState
          title={common("identity.mfaTitle")}
          description={common("identity.mfaDescription")}
          action={
            <Button asChild>
              <Link to="/mfa">{common("identity.mfaAction")}</Link>
            </Button>
          }
        />
      );
    if (error.status === 404)
      return <NotFoundState title={t("missing.title")} description={t("missing.description")} />;
    if (error.code.startsWith("IDENTITY_"))
      return <IdentityFailure error={error} onRetry={onRetry} />;
  }
  return (
    <ErrorState
      title={t("error.title")}
      description={t("error.description")}
      onRetry={onRetry}
      retryLabel={t("retry")}
      pendingLabel={t("pending")}
    />
  );
}
