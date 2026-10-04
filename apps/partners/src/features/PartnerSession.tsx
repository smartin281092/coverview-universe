import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiError, type IdentityMe } from "@coverview/api-client";
import { PartnerApiError, type PartnerContext } from "@coverview/api-client/partner";
import {
  Button,
  LoadingState,
  ErrorState,
  SessionExpiredState,
  AccessDeniedState,
} from "@coverview/ui";
import { api, partnerApi, adminUrl } from "../api";
import type { LeadNavigationSearch } from "./lead-navigation-state";
type Session = {
  identity: IdentityMe;
  context: PartnerContext;
  queryKey: string[];
  leadReturnSearch: LeadNavigationSearch | null;
  rememberLeadSearch: (value: LeadNavigationSearch) => void;
};
const Context = createContext<Session | null>(null);
export function usePartner() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing Partner session");
  return value;
}
export function PartnerSession({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [navigation, setNavigation] = useState<{
    scope: string;
    search: LeadNavigationSearch;
  } | null>(null);
  const me = useQuery({
    queryKey: ["identity", "partner"],
    queryFn: ({ signal }) => api.me({ signal }),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 60000,
  });
  const ctx = useQuery({
    queryKey: ["private", me.data?.user.id, me.data?.session.id, "partner-context"],
    queryFn: ({ signal }) => partnerApi.context(signal),
    enabled: !!me.data && !me.isError,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 30000,
  });
  const navigationScope =
    me.data && !me.isError && !ctx.isError ? `${me.data.user.id}:${me.data.session.id}` : null;
  useEffect(() => {
    setNavigation((current) => (current?.scope === navigationScope ? current : null));
  }, [navigationScope]);
  const error = me.error ?? ctx.error;
  if (me.isPending || (!error && me.data && ctx.isPending))
    return <LoadingState label={t("loading")} />;
  if (error || !me.data || !ctx.data) {
    if (
      (error instanceof ApiError || error instanceof PartnerApiError) &&
      error.code === "IDENTITY_UNAUTHENTICATED"
    )
      return (
        <SessionExpiredState
          title={t("loginTitle")}
          description={t("loginDescription")}
          action={
            <Button asChild>
              <a href={api.loginUrl("partners")}>{t("login")}</a>
            </Button>
          }
        />
      );
    const mfa =
      (error instanceof PartnerApiError || error instanceof ApiError) &&
      error.code === "IDENTITY_MFA_REQUIRED";
    if (mfa)
      return (
        <AccessDeniedState
          title={t("mfa")}
          description={t("mfaDescription")}
          action={
            <Button asChild>
              <a href={`${adminUrl}/mfa`}>{t("mfa")}</a>
            </Button>
          }
        />
      );
    return (
      <ErrorState
        title={t("error")}
        description={t("error")}
        retryLabel={t("retry")}
        pendingLabel={t("loading")}
        onRetry={() => {
          void me.refetch();
          void ctx.refetch();
        }}
      />
    );
  }
  const identity = me.data,
    context = ctx.data;
  return (
    <Context.Provider
      value={{
        identity,
        context,
        queryKey: ["private", identity.user.id, identity.session.id, "partner"],
        leadReturnSearch:
          navigation?.scope === `${identity.user.id}:${identity.session.id}`
            ? navigation.search
            : null,
        rememberLeadSearch: (search) =>
          setNavigation({ scope: `${identity.user.id}:${identity.session.id}`, search }),
      }}
    >
      <div
        key={`${identity.user.id}:${identity.session.id}:${context.operational}`}
        hidden={me.isFetching || ctx.isFetching}
        inert={me.isFetching || ctx.isFetching}
      >
        {children}
      </div>
    </Context.Provider>
  );
}
