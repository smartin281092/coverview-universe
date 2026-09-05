import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ApiError, type IdentityMe } from "@coverview/api-client";
import { AccessDeniedState, Button, EmptyState, LoadingState } from "@coverview/ui";
import { api } from "../api";
import { IdentityBoundary } from "../features/identity/IdentityBoundary";
import { IdentityFailure } from "../features/identity/IdentityFailure";
import { LogoutActions } from "../features/identity/LogoutActions";

function TeamAccess({ identity }: { identity: IdentityMe }) {
  const { t } = useTranslation();
  const access = useQuery({
    queryKey: ["private", identity.user.id, identity.session.id, "admin"],
    queryFn: ({ signal }) => api.admin({ signal }),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  if (access.isPending) return <LoadingState label={t("identity.accessLoading")} />;
  return (
    <div className="space-y-6">
      {access.error instanceof ApiError && access.error.code === "IDENTITY_MFA_REQUIRED" ? (
        <AccessDeniedState
          title={t("identity.mfaTitle")}
          description={t("identity.mfaDescription")}
          action={
            <Button asChild>
              <Link to="/mfa">{t("identity.mfaAction")}</Link>
            </Button>
          }
        />
      ) : access.isError ? (
        <IdentityFailure
          error={access.error}
          onRetry={() => {
            void access.refetch();
          }}
        />
      ) : (
        <section className="space-y-5">
          <p className="break-words text-muted-foreground">
            {t("identity.teamConnected", { email: identity.user.email })}
          </p>
          <EmptyState title={t("identity.teamReady")} description={t("identity.teamEmpty")} />
        </section>
      )}
      <LogoutActions identity={identity} />
    </div>
  );
}

export function AccountPage() {
  const { t } = useTranslation();
  const params = new URLSearchParams(window.location.search);
  return (
    <>
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">{t("identity.accountTitle")}</h1>
        <p className="max-w-xl text-muted-foreground">{t("identity.accountDescription")}</p>
      </div>
      {params.get("authError") === "callback" && (
        <p role="alert" className="text-destructive">
          {t("identity.callbackError")}
        </p>
      )}
      <IdentityBoundary>{(identity) => <TeamAccess identity={identity} />}</IdentityBoundary>
    </>
  );
}
