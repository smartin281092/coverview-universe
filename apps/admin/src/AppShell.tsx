import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Container, TextLink } from "@coverview/ui";
import logo from "../../../assets/logo-coverview.svg";
import { LogoutFeedback } from "./features/identity/LogoutFeedback";

export function AppShell() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const accountPage =
    pathname === "/" ||
    pathname === "/account" ||
    pathname === "/mfa" ||
    pathname === "/authenticator" ||
    pathname === "/authenticator/cancel";
  const websiteUrl =
    import.meta.env.VITE_WEBSITE_URL ??
    (import.meta.env.DEV ? "http://127.0.0.1:4103" : "https://coverview.ch");
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary p-3 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {t("skip")}
      </a>
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-xl">
        <Container className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 py-2.5">
          <Link to="/" className="flex items-center gap-4">
            <img
              src={logo}
              alt={t("brand")}
              className="h-5 w-auto sm:h-6"
              width="444"
              height="73"
            />
            <span className="text-xs text-muted-foreground sm:text-sm">{t("app")}</span>
          </Link>
          <nav
            aria-label={t("navigation")}
            className="order-3 flex basis-full flex-wrap gap-x-7 sm:order-none sm:basis-auto"
          >
            <Link
              to="/account"
              aria-current={accountPage ? "page" : undefined}
              className="cv-app-nav-link"
            >
              {t("identity.accountTitle")}
            </Link>
          </nav>
          <TextLink href={websiteUrl} arrow="up" className="text-sm">
            {t("website")}
          </TextLink>
        </Container>
      </header>
      <Container className="flex-1">
        <main
          id="main"
          tabIndex={-1}
          className="app-content cv-section cv-section--compact space-y-10"
        >
          <LogoutFeedback>
            <Outlet />
          </LogoutFeedback>
        </main>
      </Container>
      <footer className="border-t border-border">
        <Container className="flex flex-wrap justify-between gap-2 py-6 text-xs text-muted-foreground">
          <p>{t("footer")}</p>
          {import.meta.env.DEV && <p className="cv-meta">{t("identity.local")}</p>}
        </Container>
      </footer>
    </div>
  );
}
