import { useState } from "react";
import { useWalletProfileScope } from "../profile/use-wallet-profile-scope";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CircleDashed, CircleCheck, ArrowUpRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button, LoadingState, NotFoundState } from "@coverview/ui";
import type { IdentityMe } from "@coverview/api-client";
import { NoticeSummary } from "../authorizations/NoticeSummary";
import { api } from "../../api";
import { DocumentFailure } from "../documents/DocumentFailure";

function ProfileAuthorizations({
  identity,
  profileId,
  profileName,
}: {
  identity: IdentityMe;
  profileId: string;
  profileName: string;
}) {
  const { t, i18n } = useTranslation("authorizations");
  const query = useQuery({
    queryKey: ["private", identity.user.id, identity.session.id, "authorization-status", profileId],
    queryFn: ({ signal }) => api.authorizationStatus(profileId, { signal }),
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
  if (query.isPending) return <LoadingState label={t("loading")} />;
  if (query.isError)
    return <DocumentFailure error={query.error} onRetry={() => void query.refetch()} />;
  return (
    <section className="space-y-3 rounded-xl border border-border p-5">
      <h2 className="font-medium">{profileName}</h2>
      <ul className="divide-y divide-border">
        {(["procuration", "mandate"] as const).map((kind) => (
          <li key={kind} className="flex flex-wrap items-center justify-between gap-4 py-5">
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="font-medium">{t(`${kind}.title`)}</h2>
              <p className="max-w-xl text-sm text-muted-foreground">{t(`${kind}.description`)}</p>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                {query.data?.[kind].signedAt ? (
                  <>
                    <CircleCheck className="size-4 shrink-0 text-emerald-700" aria-hidden="true" />
                    {t("signing.signedAt", {
                      date: new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(
                        new Date(query.data[kind].signedAt),
                      ),
                    })}
                  </>
                ) : (
                  <>
                    <CircleDashed className="size-4 shrink-0" aria-hidden="true" />
                    {t(query.isPending ? "loading" : "notRecorded")}
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
        ))}
      </ul>
    </section>
  );
}

export function AccountAuthorizations({ identity }: { identity: IdentityMe }) {
  const { t } = useTranslation("authorizations");
  const { t: tp } = useTranslation("profile");
  const { t: td } = useTranslation("documents");
  const { profileId } = useWalletProfileScope();
  const [page, setPage] = useState(0);
  const profiles = useQuery({
    queryKey: ["private", identity.user.id, identity.session.id, "managed-profiles"],
    queryFn: ({ signal }) => api.profiles({ signal }),
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
  if (profiles.isPending) return <LoadingState label={t("loading")} />;
  if (profiles.isError)
    return <DocumentFailure error={profiles.error} onRetry={() => void profiles.refetch()} />;
  const selected = profiles.data.profiles.filter(
    (profile) => !profileId || profile.id === profileId,
  );
  if (!selected.length)
    return <NotFoundState title={tp("workspace.notFound")} description={tp("scope.overview")} />;
  const pageSize = 6;
  const currentPage = Math.min(page, Math.max(0, Math.ceil(selected.length / pageSize) - 1));
  return (
    <div className="space-y-5">
      <p className="max-w-2xl text-sm text-muted-foreground">{t("intro")}</p>
      <ul>
        <NoticeSummary identity={identity} />
      </ul>
      {selected.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((profile) => (
        <ProfileAuthorizations
          key={profile.id}
          identity={identity}
          profileId={profile.id}
          profileName={profile.displayName}
        />
      ))}
      {selected.length > pageSize && (
        <nav className="flex gap-3" aria-label={td("pagination")}>
          <Button
            variant="outline"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            {td("previous")}
          </Button>
          <Button
            variant="outline"
            disabled={(currentPage + 1) * pageSize >= selected.length}
            onClick={() => setPage(currentPage + 1)}
          >
            {td("next")}
          </Button>
        </nav>
      )}
    </div>
  );
}
