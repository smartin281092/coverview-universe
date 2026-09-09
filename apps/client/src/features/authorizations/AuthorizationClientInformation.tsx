import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import type { AuthorizationDocument } from "@coverview/contracts";
import { Button } from "@coverview/ui";
import { api } from "../../api";
import {
  AuthorizationProfileEditor,
  authorizationFieldGroups,
  type AuthorizationFieldGroup,
} from "./AuthorizationProfileEditor";
import { CompanyPicker } from "./CompanyPicker";

// Recipient selection remains available in code for a possible later reactivation.
const recipientSelectionEnabled = false;
export function AuthorizationClientInformation({
  identity,
  document,
  signed,
  onChanged,
}: {
  identity: IdentityMe;
  document: AuthorizationDocument;
  signed: boolean;
  onChanged: () => void;
}) {
  const { t, i18n } = useTranslation("authorizations");
  const { t: fields } = useTranslation("documents");
  const [editing, setEditing] = useState<AuthorizationFieldGroup | null>(null);
  const [companiesOpen, setCompaniesOpen] = useState(false);
  const profile = useQuery({
    queryKey: ["private", identity.user.id, identity.session.id, "profile"],
    queryFn: ({ signal }) => api.profile({ signal }),
    enabled: document.profileId === "self" && !signed,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const onSaved = () => {
    setEditing(null);
    setCompaniesOpen(false);
    onChanged();
  };
  const entries = signed
    ? Object.entries(document.values)
    : Object.entries(
        Object.fromEntries(
          (document.profileKind === "legal_entity"
            ? [
                "companyName",
                "registrationNumber",
                "street",
                "postalCode",
                "city",
                "country",
                "contactEmail",
                "phone",
              ]
            : [
                "firstName",
                "lastName",
                "birthDate",
                "street",
                "postalCode",
                "city",
                "country",
                "contactEmail",
                "phone",
              ]
          ).map((field) => [field, document.values[field] ?? ""]),
        ),
      );
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium">{document.profileName || t("client")}</h2>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        {entries.map(([field, value]) => {
          const group = Object.entries(authorizationFieldGroups).find(([, members]) =>
            (members as readonly string[]).includes(field),
          )?.[0] as AuthorizationFieldGroup | undefined;
          const displayed = value
            ? field === "birthDate"
              ? new Intl.DateTimeFormat(i18n.language, {
                  dateStyle: "long",
                  timeZone: "UTC",
                }).format(new Date(value))
              : value
            : t("missing");
          return (
            <div key={field}>
              <dt className="text-muted-foreground">{fields(`field.${field}`)}</dt>
              <dd className="mt-1 break-words font-medium">
                {!signed && document.profileId === "self" && group ? (
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left hover:bg-muted"
                    disabled={!profile.data}
                    onClick={() => setEditing(group)}
                  >
                    {displayed}
                  </button>
                ) : (
                  displayed
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      {!signed && document.profileId !== "self" && (
        <Button asChild variant="secondary">
          <Link to="/profile" search={{ person: document.profileId, tab: "general" }}>
            {t("signing.editProfile")}
          </Link>
        </Button>
      )}
      {editing && profile.data && (
        <AuthorizationProfileEditor
          identity={identity}
          profile={profile.data}
          group={editing}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
          onRefresh={async () => {
            const latest = await profile.refetch({ throwOnError: true });
            if (!latest.data) throw new Error("Profile unavailable");
            return latest.data;
          }}
        />
      )}
      {recipientSelectionEnabled && profile.data && (
        <>
          <Button variant="secondary" onClick={() => setCompaniesOpen(true)}>
            {t("companies.edit")}
          </Button>
          {companiesOpen && (
            <CompanyPicker
              identity={identity}
              profile={profile.data}
              selected={profile.data.insuranceCompanies ?? []}
              referenced={[]}
              onClose={() => setCompaniesOpen(false)}
              onSaved={onSaved}
              onRefresh={async () => {
                const latest = await profile.refetch({ throwOnError: true });
                if (!latest.data) throw new Error("Profile unavailable");
                return latest.data;
              }}
            />
          )}
        </>
      )}
    </section>
  );
}
