import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CircleDashed, CircleCheck, ArrowUpRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button, LoadingState } from "@coverview/ui";
import type { IdentityMe } from "@coverview/api-client";
import { NoticeSummary } from "./NoticeSummary";
import { api } from "../../api";
import { DocumentFailure } from "../documents/DocumentFailure";

/**
 * The authorizations of one person, in their profile (8 October 2026, formerly a tab of the
 * account): the information notice, then the procuration and the mandate with their status.
 */
export function ProfileAuthorizations({
  identity,
  profileId,
}: {
  identity: IdentityMe;
  profileId: string;
}) {
  const { t, i18n } = useTranslation("authorizations");
  const query = useQuery({
    queryKey: ["private", identity.user.id, identity.session.id, "authorization-status", profileId],
    queryFn: ({ signal }) => api.authorizationStatus(profileId, { signal }),
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
  return (
    <div className="space-y-5">
      <p className="max-w-2xl text-sm text-muted-foreground">{t("intro")}</p>
      <ul className="divide-y divide-border rounded-xl border border-border px-5">
        <NoticeSummary identity={identity} />
        {query.isPending ? (
          <li className="py-5">
            <LoadingState label={t("loading")} />
          </li>
        ) : query.isError ? (
          <li className="py-5">
            <DocumentFailure error={query.error} onRetry={() => void query.refetch()} />
          </li>
        ) : (
          (["procuration", "mandate"] as const).map((kind) => (
            <li key={kind} className="flex flex-wrap items-center justify-between gap-4 py-5">
              <div className="min-w-0 flex-1 space-y-1">
                <h2 className="font-medium">{t(`${kind}.title`)}</h2>
                <p className="max-w-xl text-sm text-muted-foreground">{t(`${kind}.description`)}</p>
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  {query.data[kind].signedAt ? (
                    <>
                      <CircleCheck
                        className="size-4 shrink-0 text-emerald-700"
                        aria-hidden="true"
                      />
                      {t("signing.signedAt", {
                        date: new Intl.DateTimeFormat(i18n.language, {
                          dateStyle: "medium",
                        }).format(new Date(query.data[kind].signedAt)),
                      })}
                    </>
                  ) : (
                    <>
                      <CircleDashed className="size-4 shrink-0" aria-hidden="true" />
                      {t("notRecorded")}
                    </>
                  )}
                </p>
              </div>
              <Button asChild variant="outline">
                <Link
                  to="/authorizations/$kind"
                  params={{ kind }}
                  search={{ profile: profileId, person: profileId }}
                >
                  {t("view")}
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
