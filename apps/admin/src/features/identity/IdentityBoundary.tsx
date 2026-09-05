import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button, EmptyState, LoadingState, SessionExpiredState } from "@coverview/ui";
import type { IdentityMe } from "@coverview/api-client";
import { api } from "../../api";
import { identityOptions } from "./session-state";
import { IdentityFailure } from "./IdentityFailure";

export function IdentityBoundary({ children }: { children: (identity: IdentityMe) => ReactNode }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const config = useQuery({
    queryKey: ["identity", "config"],
    queryFn: ({ signal }) => api.identityConfig({ signal }),
    staleTime: 0,
    retry: false,
  });
  const identity = useQuery({ ...identityOptions(client), enabled: config.data?.enabled === true });
  const validating = config.isFetching || identity.isFetching;
  if (
    config.isPending ||
    (config.data?.enabled && !identity.data && (identity.isPending || validating))
  ) {
    return <LoadingState label={t("identity.loading")} />;
  }
  if (config.isError || identity.isError) {
    return (
      <IdentityFailure
        error={config.error ?? identity.error}
        onRetry={() => {
          void config.refetch();
          if (config.data?.enabled) void identity.refetch();
        }}
      />
    );
  }
  if (!config.data?.enabled) {
    return (
      <EmptyState
        title={t("identity.unavailableTitle")}
        description={t("identity.unavailableDescription")}
      />
    );
  }
  if (!identity.data) {
    return (
      <SessionExpiredState
        title={t("identity.signedOutTitle")}
        description={t("identity.signedOutDescription")}
        action={
          <Button asChild>
            <a href={api.loginUrl("admin")}>{t("identity.login")}</a>
          </Button>
        }
      />
    );
  }
  return (
    <>
      {validating && <LoadingState label={t("identity.loading")} />}
      <div
        key={`${identity.data.user.id}:${identity.data.session.id}`}
        hidden={validating}
        inert={validating}
        className="space-y-6"
      >
        {children(identity.data)}
      </div>
    </>
  );
}
