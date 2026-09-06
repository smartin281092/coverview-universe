import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ApiError, type IdentityMe } from "@coverview/api-client";
import { AccessDeniedState, Button, Input, Label, LoadingState } from "@coverview/ui";
import { IdentityBoundary } from "../features/identity/IdentityBoundary";
import { IdentityFailure } from "../features/identity/IdentityFailure";
import { useAuthenticatorEnrollment } from "../features/identity/use-authenticator-enrollment";

function Enrollment({ identity }: { identity: IdentityMe }) {
  const { t, i18n } = useTranslation();
  const { enrollment, form, qr, pending, error, expired, refresh, start, challenge, confirm } =
    useAuthenticatorEnrollment(identity);
  const failure = error ?? enrollment.error;
  const errorCode = failure instanceof ApiError ? failure.code : null;
  const busy = pending !== null || enrollment.isFetching;
  const retry = () => {
    void refresh();
  };
  if (enrollment.isPending) return <LoadingState label={t("authenticator.loading")} />;
  if (failure && errorCode !== "IDENTITY_MFA_INVALID") {
    return <IdentityFailure error={failure} onRetry={retry} />;
  }
  const status = enrollment.data;
  if (!status) return <LoadingState label={t("authenticator.loading")} />;
  if (status.state === "confirmed") {
    return (
      <section className="max-w-xl space-y-5" aria-labelledby="authenticator-confirmed">
        <h2 id="authenticator-confirmed" className="cv-app-subheading">
          {t("authenticator.confirmedTitle")}
        </h2>
        <p role="status" className="text-muted-foreground">
          {t("authenticator.confirmedDescription")}
        </p>
        <Button asChild>
          <Link to="/account">{t("identity.backAccount")}</Link>
        </Button>
      </section>
    );
  }
  if (status.state === "recovery" && !status.canRestart) {
    return (
      <AccessDeniedState
        title={t("authenticator.recoveryTitle")}
        description={t(
          status.reason === "existing_factor"
            ? "authenticator.existingFactor"
            : status.reason === "operation_pending"
              ? "authenticator.operationPending"
              : "authenticator.recoveryDescription",
        )}
        action={
          status.reason === "existing_factor" ? (
            <Button asChild>
              <Link to="/mfa">{t("identity.mfaAction")}</Link>
            </Button>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Button onClick={retry} disabled={busy}>
                {t(busy ? "identity.pending" : "authenticator.refresh")}
              </Button>
              {status.canCancel && (
                <Button asChild variant="outline" disabled={busy}>
                  <Link
                    to="/authenticator/cancel"
                    aria-disabled={busy}
                    onClick={(event) => {
                      if (busy) event.preventDefault();
                    }}
                  >
                    {t("authenticator.cancelAction")}
                  </Link>
                </Button>
              )}
            </div>
          )
        }
      />
    );
  }
  return (
    <section className="max-w-xl space-y-7" aria-label={t("authenticator.title")}>
      <p className="break-words text-muted-foreground">
        {t("authenticator.account", { email: identity.user.email })}
      </p>
      {status.state === "available" ? (
        <>
          <p className="text-muted-foreground">{t("authenticator.instructions")}</p>
          <Button
            disabled={busy}
            onClick={() => {
              void start();
            }}
          >
            {t(busy ? "identity.pending" : "authenticator.start")}
          </Button>
        </>
      ) : (
        <>
          {qr && !expired ? (
            <figure className="space-y-3">
              <img
                src={qr.qrCode}
                alt={t("authenticator.qrAlt")}
                className="h-auto w-64 max-w-full"
                draggable={false}
                referrerPolicy="no-referrer"
              />
              <figcaption className="text-sm text-muted-foreground">
                {t("authenticator.scan")}
              </figcaption>
            </figure>
          ) : (
            <p className="text-muted-foreground">
              {t(
                status.state === "recovery"
                  ? "authenticator.confirmationUncertain"
                  : "authenticator.resumeDescription",
              )}
            </p>
          )}
          {errorCode === "IDENTITY_MFA_INVALID" && (
            <p role="alert" className="text-destructive">
              {t("identity.mfaRestartRequired")}
            </p>
          )}
          {expired && (
            <p role="status" className="text-muted-foreground">
              {t("authenticator.expired")}
            </p>
          )}
          {status.canConfirm && !expired && (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                void form.handleSubmit(async (input) => {
                  await confirm(input);
                })(event);
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="authenticator-code">{t("identity.mfaCode")}</Label>
                <Input
                  id="authenticator-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  autoFocus
                  disabled={busy}
                  className="h-11 px-3 py-2 text-base md:text-base"
                  aria-invalid={Boolean(form.formState.errors.code)}
                  aria-describedby={
                    form.formState.errors.code
                      ? "authenticator-code-error"
                      : "authenticator-code-help"
                  }
                  {...form.register("code")}
                />
                <p id="authenticator-code-help" className="text-sm text-muted-foreground">
                  {status.expiresAt &&
                    t("identity.mfaExpires", {
                      date: new Intl.DateTimeFormat(i18n.language, { timeStyle: "short" }).format(
                        new Date(status.expiresAt),
                      ),
                    })}
                </p>
                {form.formState.errors.code && (
                  <p
                    id="authenticator-code-error"
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {t("identity.mfaCodeFormat")}
                  </p>
                )}
              </div>
              <Button type="submit" disabled={busy}>
                {t(pending === "confirm" ? "identity.pending" : "authenticator.confirm")}
              </Button>
            </form>
          )}
          <div className="flex flex-wrap gap-3">
            {status.canRestart && (
              <Button
                variant={status.canConfirm && !expired ? "outline" : "default"}
                disabled={busy}
                onClick={() => {
                  void challenge();
                }}
              >
                {t(pending === "challenge" ? "identity.pending" : "authenticator.restart")}
              </Button>
            )}
            {status.canCancel && (
              <Button asChild variant="outline" disabled={busy}>
                <Link
                  to="/authenticator/cancel"
                  aria-disabled={busy}
                  onClick={(event) => {
                    if (busy) event.preventDefault();
                  }}
                >
                  {t("authenticator.cancelAction")}
                </Link>
              </Button>
            )}
            {status.reason === "operation_pending" && (
              <Button onClick={retry} disabled={busy}>
                {t(busy ? "identity.pending" : "authenticator.refresh")}
              </Button>
            )}
          </div>
          {status.reason === "operation_pending" && (
            <p role="status" className="text-sm text-muted-foreground">
              {t("authenticator.operationPending")}
            </p>
          )}
        </>
      )}
    </section>
  );
}

export function AuthenticatorPage() {
  const { t } = useTranslation();
  return (
    <>
      <div className="space-y-3">
        <h1 className="cv-app-heading">{t("authenticator.title")}</h1>
        <Link to="/account" className="text-sm font-medium text-primary">
          {t("identity.backAccount")}
        </Link>
      </div>
      <IdentityBoundary>{(identity) => <Enrollment identity={identity} />}</IdentityBoundary>
    </>
  );
}
