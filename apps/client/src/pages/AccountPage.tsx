import { useLocation, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button, Tabs, TabsList, TabsTrigger, TabsContent } from "@coverview/ui";
import { IdentityBoundary } from "../features/identity/IdentityBoundary";
import { AccountLayout } from "../features/identity/AccountLayout";
import { AccountDevices } from "../features/identity/AccountDevices";
import { LogoutActions } from "../features/identity/LogoutActions";
import { api } from "../api";

export function AccountPage() {
  const { t } = useTranslation();
  const { searchStr } = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(searchStr);
  const tab = params.get("tab") === "devices" ? "devices" : "preferences";
  const authenticatorUrl = import.meta.env.DEV
    ? "http://127.0.0.1:4102/authenticator"
    : api.loginUrl("admin");
  return (
    <AccountLayout>
      {params.get("authError") === "callback" && (
        <p role="alert" className="text-destructive">
          {t("identity.callbackError")}
        </p>
      )}
      <IdentityBoundary>
        {(identity) => (
          <Tabs
            value={tab}
            onValueChange={(value) => {
              void navigate({
                to: "/account",
                search: value === "devices" ? { tab: "devices" } : {},
                resetScroll: false,
              });
            }}
            className="gap-6"
          >
            <TabsList aria-label={t("accountTabs.label")} className="min-h-12">
              <TabsTrigger value="preferences" className="min-h-11 px-4 text-sm">
                {t("accountTabs.preferences")}
              </TabsTrigger>
              <TabsTrigger value="devices" className="min-h-11 px-4 text-sm">
                {t("accountTabs.devices")}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="preferences" className="space-y-7 text-base">
              <section className="max-w-2xl space-y-7" aria-label={t("identity.profile")}>
                <dl className="space-y-2">
                  <dt className="text-sm text-muted-foreground">{t("identity.email")}</dt>
                  <dd className="break-words font-medium">{identity.user.email}</dd>
                </dl>
              </section>
              <div className="flex flex-wrap items-center gap-3">
                <Button asChild variant="outline">
                  <a href={authenticatorUrl}>{t("identity.authenticator")}</a>
                </Button>
                <LogoutActions identity={identity} scope="current" />
              </div>
            </TabsContent>
            <TabsContent value="devices" className="space-y-4 text-base">
              <p className="max-w-xl text-muted-foreground">{t("identity.devicesDescription")}</p>
              <AccountDevices key={identity.session.id} identity={identity} />
              <LogoutActions identity={identity} scope="all" />
            </TabsContent>
          </Tabs>
        )}
      </IdentityBoundary>
    </AccountLayout>
  );
}
