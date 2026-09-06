import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button, EmptyState, LoadingState } from "@coverview/ui";
import type { IdentityMe } from "@coverview/api-client";
import { api } from "../api";
import { IdentityBoundary } from "../features/identity/IdentityBoundary";
import { IdentityFailure } from "../features/identity/IdentityFailure";

function Workspace({ identity, userId }: { identity: IdentityMe; userId: string }) {
  const { t } = useTranslation();
  const workspace = useQuery({
    queryKey: ["private", identity.user.id, identity.session.id, "workspace", userId],
    queryFn: ({ signal }) => api.workspace(userId, { signal }),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  if (workspace.isPending) return <LoadingState label={t("identity.workspaceLoading")} />;
  if (workspace.isError)
    return (
      <IdentityFailure
        error={workspace.error}
        onRetry={() => {
          void workspace.refetch();
        }}
      />
    );
  return (
    <section className="space-y-6">
      <p className="break-words text-muted-foreground">
        {t("identity.workspaceOwner", { email: workspace.data.email })}
      </p>
      <EmptyState
        title={t("identity.workspaceEmpty")}
        description={t("identity.workspaceEmptyDescription")}
        action={
          <Button asChild variant="outline">
            <Link to="/profile">{t("nav", { ns: "profile" })}</Link>
          </Button>
        }
      />
    </section>
  );
}

export function WorkspacePage() {
  const { t } = useTranslation();
  const { userId } = useParams({ from: "/workspace/$userId" });
  return (
    <>
      <h1 className="cv-app-heading">{t("identity.workspaceTitle")}</h1>
      <IdentityBoundary>
        {(identity) => <Workspace identity={identity} userId={userId} />}
      </IdentityBoundary>
    </>
  );
}
