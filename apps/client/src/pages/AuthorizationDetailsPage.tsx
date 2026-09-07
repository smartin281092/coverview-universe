import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, FileSignature } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import { Button, Input, Label, LoadingState } from "@coverview/ui";
import { IdentityBoundary } from "../features/identity/IdentityBoundary";
import { DocumentFailure } from "../features/documents/DocumentFailure";
import { MissingPage } from "./StatesPage";
import { api } from "../api";
import texts from "../locales/fr/authorization-texts.json";

function Authorization({
  identity,
  kind,
}: {
  identity: IdentityMe;
  kind: "procuration" | "mandate";
}) {
  const { t, i18n } = useTranslation("authorizations");
  const [accepted, setAccepted] = useState(false);
  const profile = useQuery({
    queryKey: ["private", identity.user.id, identity.session.id, "profile"],
    queryFn: ({ signal }) => api.profile({ signal }),
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
  if (profile.isPending) return <LoadingState label={t("loading")} />;
  if (profile.isError)
    return <DocumentFailure error={profile.error} onRetry={() => void profile.refetch()} />;
  const fields = profile.data.fields;
  const rows = [
    {
      label: "clientName",
      value: [fields.firstName?.value, fields.lastName?.value].filter(Boolean).join(" "),
    },
    {
      label: "birthDate",
      value: fields.birthDate?.value
        ? new Intl.DateTimeFormat(i18n.language, { timeZone: "UTC", dateStyle: "long" }).format(
            new Date(fields.birthDate.value),
          )
        : "",
    },
    { label: "address", value: fields.street?.value },
    {
      label: "locality",
      value: [fields.postalCode?.value, fields.city?.value, fields.country?.value]
        .filter(Boolean)
        .join(" "),
    },
    { label: "email", value: identity.user.email },
  ];
  return (
    <div className="authorization-page space-y-8">
      <Link
        to="/account"
        search={{ tab: "authorizations" }}
        className="wallet-back-link inline-flex min-h-11 items-center gap-2 text-sm font-medium text-indigo-600"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("back")}
      </Link>
      <header className="space-y-3">
        <h1 className="cv-app-heading">{t(`${kind}.title`)}</h1>
        <p className="max-w-2xl text-muted-foreground">{t(`${kind}.description`)}</p>
      </header>
      <article
        className="mx-auto max-w-3xl space-y-8 rounded-2xl border border-border bg-background p-5 sm:p-8"
        aria-label={t("document")}
      >
        <div className="space-y-2 border-b border-border pb-5">
          <p className="font-medium">{t("legalEntity")}</p>
          <p className="text-sm text-muted-foreground">{t("legalAddress")}</p>
          <p className="text-sm text-muted-foreground">{t("advisor")}</p>
        </div>
        <section className="space-y-4">
          <h2 className="text-lg font-medium">{t("client")}</h2>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            {rows.map((row) => (
              <div key={row.label}>
                <dt className="text-muted-foreground">{t(row.label)}</dt>
                <dd className="mt-1 break-words font-medium">{row.value || t("missing")}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-muted-foreground">{t("prefillHelp")}</p>
          <Button asChild variant="outline">
            <Link to="/profile" search={{}}>
              {t("editProfile")}
            </Link>
          </Button>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="authorization-phone">{t("phone")}</Label>
              <Input
                id="authorization-phone"
                type="tel"
                autoComplete="tel"
                maxLength={40}
                className="min-h-11"
              />
            </div>
            {kind === "procuration" && (
              <div className="space-y-2">
                <Label htmlFor="authorization-insurer">{t("insurer")}</Label>
                <Input id="authorization-insurer" maxLength={160} className="min-h-11" />
              </div>
            )}
          </div>
        </section>
        {texts[kind].map((section) => (
          <section key={section.title} className="space-y-3">
            <h2 className="font-medium">{section.title}</h2>
            <p className="text-sm leading-7">{section.text}</p>
          </section>
        ))}
        <section className="space-y-4 border-t border-border pt-6">
          <h2 className="text-lg font-medium">{t("signature")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="authorization-place">{t("place")}</Label>
              <Input
                id="authorization-place"
                defaultValue={kind === "mandate" ? "Genève" : (fields.city?.value ?? "")}
                maxLength={160}
                className="min-h-11"
                readOnly={kind === "mandate"}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("date")}</p>
              <p className="text-sm text-muted-foreground">{t("dateAtSignature")}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {t(kind === "mandate" ? "countersignature" : "clientSignature")}
          </p>
          {kind === "procuration" && (
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" className="size-4 accent-primary" />
              {t("identityAttachment")}
            </label>
          )}
        </section>
        <section
          className="space-y-6 border-t border-border pt-6"
          aria-labelledby="legal-information"
        >
          <div className="space-y-2">
            <h2 id="legal-information" className="text-lg font-medium">
              {t("informationTitle")}
            </h2>
            <p className="text-xs text-muted-foreground">{t("informationEdition")}</p>
          </div>
          {texts.information.map((section) => (
            <section key={section.title} className="space-y-2">
              <h3 className="text-sm font-medium">{section.title}</h3>
              <p className="text-sm leading-7">{section.text}</p>
            </section>
          ))}
          <p className="text-sm text-muted-foreground">
            {t("informationSignature", { name: rows[0]?.value || t("missing") })}
          </p>
        </section>
        <p className="border-t border-border pt-5 text-xs leading-6 text-muted-foreground">
          {t("legalContact")}
        </p>
      </article>
      <div
        className="authorization-actions fixed inset-x-0 z-20 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-xl"
        role="region"
        aria-label={t("signatureActions")}
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="size-4 shrink-0 accent-primary"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
              />
              {t("accept")}
            </label>
            <p id="signature-status" className="text-xs text-muted-foreground">
              {t("unavailableDescription")}
            </p>
          </div>
          <Button
            className="min-h-11 w-full sm:w-auto"
            disabled
            aria-describedby="signature-status"
          >
            <FileSignature className="size-4" aria-hidden="true" />
            {t("sign")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AuthorizationDetailsPage() {
  const { kind } = useParams({ from: "/authorizations/$kind" });
  if (kind !== "mandate" && kind !== "procuration") return <MissingPage />;
  return (
    <IdentityBoundary>
      {(identity) => <Authorization key={kind} identity={identity} kind={kind} />}
    </IdentityBoundary>
  );
}
