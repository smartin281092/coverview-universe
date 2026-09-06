import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import { AccessDeniedState, Button, LoadingState } from "@coverview/ui";
import { IdentityBoundary } from "../features/identity/IdentityBoundary";
import { IdentityFailure } from "../features/identity/IdentityFailure";
import { useAuthenticatorEnrollment } from "../features/identity/use-authenticator-enrollment";

function Cancellation({ identity }: { identity: IdentityMe }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { enrollment, pending, error, refresh, cancel } = useAuthenticatorEnrollment(identity);
  const busy = pending !== null || enrollment.isFetching;
  if (enrollment.isPending) return <LoadingState label={t("authenticator.loading")} />;
  if (error || enrollment.error) {
    return (
      <IdentityFailure
        error={error ?? enrollment.error}
        onRetry={() => {
          void refresh();
        }}
      />
    );
  }
  if (!enrollment.data?.canCancel) {
    return (
      <AccessDeniedState
        title={t("authenticator.cancelUnavailableTitle")}
        description={t("authenticator.cancelUnavailableDescription")}
        action={
          <Button asChild variant="outline">
            <Link to="/authenticator">{t("authenticator.back")}</Link>
          </Button>
        }
      />
    );
  }
  return (
    <section className="max-w-xl space-y-6">
      <p className="break-words text-muted-foreground">
        {t("authenticator.account", { email: identity.user.email })}
      </p>
      <p className="text-muted-foreground">{t("authenticator.cancelDescription")}</p>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="destructive"
          disabled={busy}
          onClick={() => {
            void cancel().then((cancelled) => {
              if (cancelled) return navigate({ to: "/authenticator" });
            });
          }}
        >
          {t(busy ? "identity.pending" : "authenticator.cancelConfirm")}
        </Button>
        <Button asChild variant="outline" disabled={busy}>
          <Link
            to="/authenticator"
            aria-disabled={busy}
            onClick={(event) => {
              if (busy) event.preventDefault();
            }}
          >
            {t("authenticator.keep")}
          </Link>
        </Button>
      </div>
    </section>
  );
}

export function CancelAuthenticatorPage() {
  const { t } = useTranslation();
  return (
    <>
      <div className="space-y-3">
        <h1 className="cv-app-heading">{t("authenticator.cancelTitle")}</h1>
        <Link to="/authenticator" className="text-sm font-medium text-primary">
          {t("authenticator.back")}
        </Link>
      </div>
      <IdentityBoundary>{(identity) => <Cancellation identity={identity} />}</IdentityBoundary>
    </>
  );
}
