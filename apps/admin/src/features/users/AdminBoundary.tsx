import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import { LoadingState } from "@coverview/ui";
import { api } from "../../api";
import { IdentityBoundary } from "../identity/IdentityBoundary";
import { AdminFailure } from "./AdminFailure";

type Children = (identity: IdentityMe, blocked: boolean) => ReactNode;

function Access({
  identity,
  validating,
  children,
}: {
  identity: IdentityMe;
  validating: boolean;
  children: Children;
}) {
  const { t } = useTranslation();
  const access = useQuery({
    queryKey: ["private", identity.user.id, identity.session.id, "admin"],
    queryFn: ({ signal }) => api.admin({ signal }),
    enabled: !validating,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  if (access.isError)
    return <AdminFailure error={access.error} onRetry={() => void access.refetch()} />;
  if (!access.data) return <LoadingState label={t("identity.accessLoading")} />;
  const blocked = validating || access.isFetching;
  return (
    <>
      {blocked && <LoadingState label={t("identity.accessLoading")} />}
      <div hidden={blocked} inert={blocked} className="space-y-6">
        {children(identity, blocked)}
      </div>
    </>
  );
}

export function AdminBoundary({ children }: { children: Children }) {
  return (
    <IdentityBoundary>
      {(identity, validating) => (
        <Access identity={identity} validating={validating}>
          {children}
        </Access>
      )}
    </IdentityBoundary>
  );
}
