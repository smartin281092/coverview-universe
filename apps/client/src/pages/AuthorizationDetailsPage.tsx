import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, FileSignature, CircleCheck, TriangleAlert, Pencil, Plus } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import { Button, Input, Label, LoadingState } from "@coverview/ui";
import { IdentityBoundary } from "../features/identity/IdentityBoundary";
import { DocumentFailure } from "../features/documents/DocumentFailure";
import { MissingPage } from "./StatesPage";
import { api } from "../api";
import texts from "../locales/fr/authorization-texts.json";
import {
  AuthorizationProfileEditor,
  authorizationFieldGroups,
  type AuthorizationFieldGroup,
} from "../features/authorizations/AuthorizationProfileEditor";
import { CompanyPicker } from "../features/authorizations/CompanyPicker";
import { IdentityAttachment } from "../features/authorizations/IdentityAttachment";

// Procuration universelle depuis le 08.09.2026 : sélection conservée pour réactivation.
// Réviser aussi le texte de portée avant de rétablir une liste limitative de destinataires.
const recipientSelectionEnabled = false;

function Authorization({
  identity,
  kind,
}: {
  identity: IdentityMe;
  kind: "procuration" | "mandate";
}) {
  const { t, i18n } = useTranslation("authorizations");
  const [accepted, setAccepted] = useState(false);
  const [editing, setEditing] = useState<AuthorizationFieldGroup | null>(null);
  const [companiesOpen, setCompaniesOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const profile = useQuery({
    queryKey: ["private", identity.user.id, identity.session.id, "profile"],
    queryFn: ({ signal }) => api.profile({ signal }),
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
  const references = useQuery({
    queryKey: ["private", identity.user.id, identity.session.id, "document-companies"],
    queryFn: ({ signal }) => api.documentCompanies({ signal }),
    enabled: recipientSelectionEnabled && kind === "procuration",
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
  if (profile.isPending) return <LoadingState label={t("loading")} />;
  if (profile.isError)
    return <DocumentFailure error={profile.error} onRetry={() => void profile.refetch()} />;
  const fields = profile.data.fields;
  const refreshProfile = async () => {
    const latest = await profile.refetch({ throwOnError: true });
    if (!latest.data) throw new Error("Profile unavailable");
    return latest.data;
  };
  const selectedCompanies = profile.data.insuranceCompanies ?? references.data?.companyIds ?? [];
  const onSaved = () => {
    setEditing(null);
    setCompaniesOpen(false);
    setAccepted(false);
    setSaved(true);
  };
  const rows: { label: AuthorizationFieldGroup; value: string | undefined }[] = [
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
    { label: "email", value: fields.contactEmail?.value ?? identity.user.email },
    { label: "phone", value: fields.phone?.value },
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
        {kind === "procuration" && (
          <IdentityAttachment identity={identity} onChanged={() => setAccepted(false)} />
        )}
        <section className="space-y-4">
          <h2 className="text-lg font-medium">{t("client")}</h2>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            {rows.map((row) => {
              const complete = authorizationFieldGroups[row.label].every((field) =>
                Boolean(fields[field]?.value || (field === "contactEmail" && identity.user.email)),
              );
              return (
                <div key={row.label}>
                  <dt className="text-muted-foreground">{t(row.label)}</dt>
                  <dd className="mt-1">
                    <button
                      type="button"
                      className="group flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                      aria-label={t("editField", { field: t(row.label) })}
                      onClick={() => {
                        setSaved(false);
                        setEditing(row.label);
                      }}
                    >
                      {complete ? (
                        <CircleCheck
                          className="size-4 shrink-0 text-green-700"
                          aria-hidden="true"
                        />
                      ) : (
                        <TriangleAlert
                          className="size-4 shrink-0 text-red-600"
                          aria-hidden="true"
                        />
                      )}
                      <span className="min-w-0 flex-1 break-words">
                        {row.value && <span className="block">{row.value}</span>}
                        {!complete ? (
                          <span className="block text-red-600">{t("missing")}</span>
                        ) : (
                          <span className="sr-only">{t("complete")}</span>
                        )}
                      </span>
                      <Pencil
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </button>
                  </dd>
                </div>
              );
            })}
          </dl>
          <p className="text-sm text-muted-foreground">{t("prefillHelp")}</p>
          {saved && (
            <p role="status" className="text-sm text-green-700">
              {t("saved")}
            </p>
          )}
        </section>
        {recipientSelectionEnabled && kind === "procuration" && (
          <section className="space-y-3" aria-labelledby="authorization-companies">
            <h2 id="authorization-companies" className="font-medium">
              {t("companies.recipients")}
            </h2>
            {selectedCompanies.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {selectedCompanies.map((id) => (
                  <li key={id} className="flex items-center gap-2">
                    <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-green-700" />
                    {t(`companies.names.${id}`)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-red-600">
                <TriangleAlert aria-hidden="true" className="size-4" />
                {t("missing")}
              </p>
            )}
            {profile.data.insuranceCompanies == null && references.isPending && (
              <p role="status" className="text-sm text-muted-foreground">
                {t("companies.loading")}
              </p>
            )}
            {profile.data.insuranceCompanies == null && selectedCompanies.length > 0 && (
              <p className="text-sm text-muted-foreground">{t("companies.suggestedHelp")}</p>
            )}
            {references.isError && (
              <p className="text-sm text-muted-foreground">
                {t("companies.referencesUnavailable")}
              </p>
            )}
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => {
                setSaved(false);
                setCompaniesOpen(true);
              }}
            >
              {selectedCompanies.length ? (
                <Pencil aria-hidden="true" className="size-4" />
              ) : (
                <Plus aria-hidden="true" className="size-4" />
              )}
              {t(selectedCompanies.length ? "companies.edit" : "companies.add")}
            </Button>
          </section>
        )}
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
      {editing && (
        <AuthorizationProfileEditor
          identity={identity}
          profile={profile.data}
          group={editing}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
          onRefresh={refreshProfile}
        />
      )}
      {recipientSelectionEnabled && kind === "procuration" && companiesOpen && (
        <CompanyPicker
          identity={identity}
          profile={profile.data}
          selected={selectedCompanies}
          referenced={references.data?.companyIds ?? []}
          onClose={() => setCompaniesOpen(false)}
          onSaved={onSaved}
          onRefresh={refreshProfile}
        />
      )}
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
