import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiError, type IdentityMe } from "@coverview/api-client";
import { PartnerApiError, type PartnerContext } from "@coverview/api-client/partner";
import {
  Button,
  Container,
  LoadingState,
  ErrorState,
  SessionExpiredState,
  AccessDeniedState,
} from "@coverview/ui";
import { api, partnerApi, adminUrl } from "../api";
import type { LeadNavigationSearch } from "./lead-navigation-state";
import { useLiveUpdates } from "./use-live-updates";
import logo from "../../../../assets/logo-coverview.svg";
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
// Before a session exists, a plain page: the logo and the state, never the menus.
function Frame({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b border-border">
        <Container className="flex min-h-16 items-center">
          <img src={logo} alt={t("brand")} className="h-5 w-auto" />
        </Container>
      </header>
      <Container className="flex-1 py-12">{children}</Container>
    </div>
  );
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
  useLiveUpdates(
    me.data ? ["private", me.data.user.id, me.data.session.id, "partner"] : [],
    !!navigationScope && !!ctx.data,
  );
  useEffect(() => {
    setNavigation((current) => (current?.scope === navigationScope ? current : null));
  }, [navigationScope]);
  const error = me.error ?? ctx.error;
  if (me.isPending || (!error && me.data && ctx.isPending))
    return (
      <Frame>
        <LoadingState label={t("loading")} />
      </Frame>
    );
  if (error || !me.data || !ctx.data) {
    if (
      (error instanceof ApiError || error instanceof PartnerApiError) &&
      error.code === "IDENTITY_UNAUTHENTICATED"
    )
      return (
        <Frame>
          <SessionExpiredState
            title={t("loginTitle")}
            description={t("loginDescription")}
            action={
              <Button asChild>
                <a href={api.loginUrl("partners")}>{t("login")}</a>
              </Button>
            }
          />
        </Frame>
      );
    const mfa =
      (error instanceof PartnerApiError || error instanceof ApiError) &&
      error.code === "IDENTITY_MFA_REQUIRED";
    if (mfa)
      return (
        <Frame>
          <AccessDeniedState
            title={t("mfa")}
            description={t("mfaDescription")}
            action={
              <Button asChild>
                <a href={`${adminUrl}/mfa`}>{t("mfa")}</a>
              </Button>
            }
          />
        </Frame>
      );
    return (
      <Frame>
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
      </Frame>
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
