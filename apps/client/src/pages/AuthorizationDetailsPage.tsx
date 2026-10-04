import { AccountAuthorizations } from "../features/identity/AccountAuthorizations";
import { useWalletProfileScope } from "../features/profile/use-wallet-profile-scope";
import { useState } from "react";
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, CircleCheck } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import { Button, LoadingState } from "@coverview/ui";
import { IdentityBoundary } from "../features/identity/IdentityBoundary";
import { DocumentFailure } from "../features/documents/DocumentFailure";
import { MissingPage } from "./StatesPage";
import { AuthorizationNoticePage } from "./AuthorizationNoticePage";
import { AuthorizationSignatureForm } from "../features/authorizations/AuthorizationSignatureForm";
import { AuthorizationClientInformation } from "../features/authorizations/AuthorizationClientInformation";
import { IdentityAttachment } from "../features/authorizations/IdentityAttachment";
import { api } from "../api";

function Authorization({
  identity,
  kind,
}: {
  identity: IdentityMe;
  kind: "procuration" | "mandate";
}) {
  const { t, i18n } = useTranslation("authorizations");
  const { t: fields } = useTranslation("documents");
  const search = useSearch({ from: "/authorizations/$kind" });
  const { scope: profileId } = useWalletProfileScope();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [downloadError, setDownloadError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const root = ["private", identity.user.id, identity.session.id];
  const query = useQuery({
    queryKey: [...root, "authorization", kind, profileId],
    queryFn: ({ signal }) => api.authorization(kind, profileId, { signal }),
    retry: false,
    gcTime: 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const receipt = useQuery({
    queryKey: [...root, "authorization-receipt", query.data?.signatureId],
    queryFn: ({ signal }) => api.signedAuthorization(query.data!.signatureId!, { signal }),
    enabled: !!query.data?.signatureId,
    retry: false,
    gcTime: 0,
    staleTime: 0,
  });
  if (query.isPending) return <LoadingState label={t("loading")} />;
  if (query.isError)
    return <DocumentFailure error={query.error} onRetry={() => void query.refetch()} />;
  // After signing, show the exact archive, even if the profile has since changed.
  const document = receipt.data?.document ?? query.data;
  const signed = !!query.data.signedAt;
  return (
    <div className="space-y-8">
      {search.returnAction ? (
        <Link
          to="/actions/$actionId"
          params={{ actionId: search.returnAction }}
          className="wallet-back-link inline-flex min-h-11 items-center gap-2 text-sm font-medium text-indigo-600"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("signing.backAction")}
        </Link>
      ) : (
        <Link
          to="/account"
          search={{ tab: "authorizations" }}
          className="wallet-back-link inline-flex min-h-11 items-center gap-2 text-sm font-medium text-indigo-600"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("back")}
        </Link>
      )}
      <header className="space-y-3">
        <h1 className="cv-app-heading">{t(`${kind}.title`)}</h1>
        <p className="max-w-2xl text-muted-foreground">{t(`${kind}.description`)}</p>
      </header>
      {signed && receipt.isPending ? (
        <LoadingState label={t("loading")} />
      ) : signed && receipt.isError ? (
        <DocumentFailure error={receipt.error} onRetry={() => void receipt.refetch()} />
      ) : (
        <>
          <article
            className="mx-auto max-w-3xl space-y-8 rounded-2xl border border-border bg-background p-5 sm:p-8"
            aria-label={t(signed ? "signing.signedDocument" : "document")}
          >
            <div className="space-y-2 border-b border-border pb-5">
              <p className="text-sm text-muted-foreground">{document.organization}</p>
              <p className="text-xs text-muted-foreground">{document.version}</p>
            </div>
            {!signed && (
              <IdentityAttachment
                identity={identity}
                profileId={profileId}
                company={document.profileKind === "legal_entity"}
              />
            )}
            <AuthorizationClientInformation
              key={`${profileId}:${signed}`}
              identity={identity}
              document={document}
              signed={signed}
              onChanged={() => void query.refetch()}
            />
            {document.sections.map((section) => (
              <section key={section.title} className="space-y-3">
                <h2 className="font-medium">{section.title}</h2>
                <p className="whitespace-pre-line text-sm leading-7">{section.text}</p>
              </section>
            ))}
            <section className="space-y-4 border-t border-border pt-6">
              <h2 className="text-lg font-medium">{t("signature")}</h2>
              {receipt.data ? (
                <>
                  <p className="flex items-center gap-2 text-sm text-emerald-700">
                    <CircleCheck className="size-4" aria-hidden="true" />
                    {t("signing.signedAt", {
                      date: new Intl.DateTimeFormat(i18n.language, {
                        dateStyle: "long",
                        timeStyle: "short",
                      }).format(new Date(receipt.data.signedAt)),
                    })}
                  </p>
                  <p className="text-sm">
                    {t("signing.signerPlace", {
                      name: receipt.data.signerName,
                      place: receipt.data.place,
                    })}
                  </p>
                  <svg
                    viewBox="0 0 600 200"
                    role="img"
                    aria-label={t("signing.drawLabel")}
                    className="max-w-md text-foreground"
                  >
                    {receipt.data.drawing.map((stroke, index) => (
                      <polyline
                        key={index}
                        points={stroke.map(([x, y]) => `${x * 600},${y * 200}`).join(" ")}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ))}
                  </svg>
                  <Button
                    variant="secondary"
                    disabled={downloading}
                    onClick={() => {
                      setDownloading(true);
                      setDownloadError(false);
                      void import("../features/authorizations/download-authorization")
                        .then(({ downloadAuthorization }) =>
                          downloadAuthorization(receipt.data, {
                            signed: t("signing.signedDocument"),
                            signer: t("signing.signer"),
                            place: t("place"),
                            accepted: t("signing.accept"),
                            integrity: t("signing.integrity"),
                            fields: Object.fromEntries(
                              Object.keys(document.values).map((key) => [
                                key,
                                fields(`field.${key}`),
                              ]),
                            ),
                          }),
                        )
                        .catch(() => setDownloadError(true))
                        .finally(() => setDownloading(false));
                    }}
                  >
                    {t("signing.download")}
                  </Button>
                  {downloadError && (
                    <p role="alert" className="text-sm text-destructive">
                      {t("signing.downloadFailed")}
                    </p>
                  )}
                </>
              ) : (
                <>
                  {!document.canSign && (
                    <p className="text-sm text-destructive">{t("signing.completeIdentity")}</p>
                  )}
                  <AuthorizationSignatureForm
                    key={document.contentHash}
                    identity={identity}
                    document={document}
                    onSigned={async () => {
                      await client.invalidateQueries({ queryKey: root });
                      if (search.returnAction)
                        await navigate({
                          to: "/actions/$actionId",
                          params: { actionId: search.returnAction },
                        });
                    }}
                  />
                </>
              )}
            </section>
          </article>
        </>
      )}
    </div>
  );
}
export function AuthorizationDetailsPage() {
  const { scope } = useWalletProfileScope();
  const { kind } = useParams({ from: "/authorizations/$kind" });
  if (kind === "lsa45")
    return (
      <IdentityBoundary>
        {(identity) => <AuthorizationNoticePage key={identity.session.id} identity={identity} />}
      </IdentityBoundary>
    );
  if (kind !== "mandate" && kind !== "procuration") return <MissingPage />;
  return (
    <IdentityBoundary>
      {(identity) =>
        scope === "all" ? (
          <AccountAuthorizations identity={identity} />
        ) : (
          <Authorization key={`${kind}:${scope}`} identity={identity} kind={kind} />
        )
      }
    </IdentityBoundary>
  );
}
