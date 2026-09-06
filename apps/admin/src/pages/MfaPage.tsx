import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { identityMfaVerifyInputSchema } from "@coverview/contracts";
import type { z } from "zod";
import { ApiError, type IdentityMe } from "@coverview/api-client";
import { AccessDeniedState, Button, Input, Label } from "@coverview/ui";
import { api } from "../api";
import { IdentityBoundary } from "../features/identity/IdentityBoundary";
import { IdentityFailure } from "../features/identity/IdentityFailure";
import { clearPrivateState, identityKey } from "../features/identity/session-state";

type MfaInput = z.infer<typeof identityMfaVerifyInputSchema>;

function Verification({ identity }: { identity: IdentityMe }) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const navigate = useNavigate();
  const challengeKey = useRef<string | null>(null);
  const verificationKey = useRef<{ code: string; key: string } | null>(null);
  const form = useForm<MfaInput>({
    resolver: zodResolver(identityMfaVerifyInputSchema),
    defaultValues: { code: "" },
  });
  const challenge = useMutation({
    mutationFn: () =>
      api.challengeMfa({
        csrfToken: identity.csrfToken,
        idempotencyKey: (challengeKey.current ??= crypto.randomUUID()),
      }),
    retry: false,
  });
  const verification = useMutation({
    mutationFn: (input: MfaInput) => {
      if (verificationKey.current?.code !== input.code)
        verificationKey.current = { code: input.code, key: crypto.randomUUID() };
      return api.verifyMfa(input, {
        csrfToken: identity.csrfToken,
        idempotencyKey: verificationKey.current.key,
      });
    },
    onSuccess: async () => {
      form.reset();
      verificationKey.current = null;
      await clearPrivateState(client);
      await client.invalidateQueries({ queryKey: identityKey });
      await navigate({ to: "/account" });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "IDENTITY_MFA_INVALID") {
        challenge.reset();
        challengeKey.current = null;
        verificationKey.current = null;
        form.reset();
      }
    },
    retry: false,
  });
  const startChallenge = () => {
    if (challenge.isSuccess) challengeKey.current = null;
    verification.reset();
    verificationKey.current = null;
    form.reset();
    challenge.mutate();
  };
  const error = verification.error ?? challenge.error;
  const code = error instanceof ApiError ? error.code : null;
  if (code === "IDENTITY_MFA_NOT_ENROLLED") {
    return (
      <AccessDeniedState
        title={t("identity.mfaUnavailableTitle")}
        description={t("identity.mfaNotEnrolled")}
        action={
          <Button asChild variant="outline">
            <Link to="/authenticator">{t("authenticator.accountAction")}</Link>
          </Button>
        }
      />
    );
  }
  const pending = challenge.isPending || verification.isPending;
  return (
    <section className="max-w-xl space-y-8 py-4">
      <p className="text-muted-foreground">{t("identity.mfaInstructions")}</p>
      {code === "IDENTITY_MFA_INVALID" && !challenge.data && (
        <p role="alert" className="text-destructive">
          {t("identity.mfaRestartRequired")}
        </p>
      )}
      {error && code !== "IDENTITY_MFA_INVALID" && (
        <IdentityFailure
          error={error}
          onRetry={() => {
            if (verification.isError) verification.mutate(verification.variables);
            else startChallenge();
          }}
        />
      )}
      {challenge.data && !challenge.isPending ? (
        <form
          onSubmit={(event) => {
            void form.handleSubmit((input) => {
              verification.mutate(input);
            })(event);
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="mfa-code" className="text-sm">
              {t("identity.mfaCode")}
            </Label>
            <Input
              id="mfa-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              className="h-11 px-3 py-2 text-base md:text-base"
              aria-invalid={Boolean(form.formState.errors.code) || code === "IDENTITY_MFA_INVALID"}
              aria-describedby={
                form.formState.errors.code || code === "IDENTITY_MFA_INVALID"
                  ? "mfa-code-error"
                  : "mfa-code-help"
              }
              disabled={pending}
              {...form.register("code")}
            />
            <p id="mfa-code-help" className="text-sm text-muted-foreground">
              {t("identity.mfaExpires", {
                date: new Intl.DateTimeFormat(i18n.language, { timeStyle: "short" }).format(
                  new Date(challenge.data.expiresAt),
                ),
              })}
            </p>
            {(form.formState.errors.code || code === "IDENTITY_MFA_INVALID") && (
              <p id="mfa-code-error" role="alert" className="text-sm text-destructive">
                {t(form.formState.errors.code ? "identity.mfaCodeFormat" : "identity.mfaInvalid")}
              </p>
            )}
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? t("identity.pending") : t("identity.mfaVerify")}
          </Button>
        </form>
      ) : null}
      <Button
        variant={challenge.data ? "outline" : "default"}
        disabled={pending}
        onClick={startChallenge}
      >
        {challenge.isPending
          ? t("identity.pending")
          : t(challenge.data ? "identity.mfaRestart" : "identity.mfaStart")}
      </Button>
    </section>
  );
}

export function MfaPage() {
  const { t } = useTranslation();
  return (
    <>
      <div className="space-y-3">
        <h1 className="cv-app-heading">{t("identity.mfaTitle")}</h1>
        <Link to="/account" className="text-sm font-medium text-primary">
          {t("identity.backAccount")}
        </Link>
      </div>
      <IdentityBoundary>{(identity) => <Verification identity={identity} />}</IdentityBoundary>
    </>
  );
}
