import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@coverview/ui";
import { IdentityBoundary } from "../features/identity/IdentityBoundary";
import { AccountLayout } from "../features/identity/AccountLayout";
import { LogoutActions } from "../features/identity/LogoutActions";

export function AccountPage() {
  const { t } = useTranslation();
  const params = new URLSearchParams(window.location.search);
  const websiteUrl =
    import.meta.env.VITE_WEBSITE_URL ??
    (import.meta.env.DEV ? "http://127.0.0.1:4103" : "https://coverview.ch");
  return (
    <AccountLayout>
      {params.get("authError") === "callback" && (
        <p role="alert" className="text-destructive">
          {t("identity.callbackError")}
        </p>
      )}
      <IdentityBoundary>
        {(identity) => (
          <>
            <section className="max-w-2xl space-y-7" aria-label={t("identity.profile")}>
              <h2 className="cv-app-subheading">{t("identity.connectedTitle")}</h2>
              <dl className="space-y-2">
                <dt className="text-sm text-muted-foreground">{t("identity.email")}</dt>
                <dd className="break-words font-medium">{identity.user.email}</dd>
              </dl>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link to="/workspace/$userId" params={{ userId: identity.user.id }}>
                    {t("identity.openWorkspace")}
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/devices">{t("identity.devices")}</Link>
                </Button>
                <Button asChild variant="outline">
                  <a href={new URL("/account", websiteUrl).href}>{t("identity.websiteAccount")}</a>
                </Button>
              </div>
            </section>
            <LogoutActions identity={identity} />
          </>
        )}
      </IdentityBoundary>
    </AccountLayout>
  );
}
