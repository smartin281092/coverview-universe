import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, MonitorSmartphone, UserRound } from "lucide-react";
import logo from "../../../assets/logo-coverview.svg";
import { LogoutFeedback } from "./features/identity/LogoutFeedback";

export function AppShell() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const accountPage = pathname === "/" || pathname === "/account";
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
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-5 gap-y-4 px-5 py-5 sm:px-8">
          <Link to="/" className="flex items-center gap-3 sm:gap-5">
            <img
              src={logo}
              alt={t("brand")}
              className="h-5 w-auto sm:h-6"
              width="444"
              height="73"
            />
            <span className="border-l border-border pl-3 text-xs font-medium text-muted-foreground sm:pl-5 sm:text-sm">
              {t("app")}
            </span>
          </Link>
          <a
            href={websiteUrl}
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
          >
            {t("website")}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 px-5 sm:px-8">
        <nav
          aria-label={t("navigation")}
          className="flex flex-wrap gap-2 border-b border-border py-4 sm:py-5"
        >
          <Link
            to="/account"
            aria-current={accountPage ? "page" : undefined}
            className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium ${accountPage ? "bg-accent text-primary" : "text-muted-foreground hover:bg-muted"}`}
          >
            <UserRound className="size-4" aria-hidden="true" />
            {t("identity.accountTitle")}
          </Link>
          <Link
            to="/devices"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium text-muted-foreground hover:bg-muted"
            activeProps={{ className: "bg-accent text-primary", "aria-current": "page" }}
          >
            <MonitorSmartphone className="size-4" aria-hidden="true" />
            {t("identity.devices")}
          </Link>
        </nav>
        <main id="main" tabIndex={-1} className="app-content space-y-8 py-8 sm:py-12 lg:py-16">
          <LogoutFeedback>
            <Outlet />
          </LogoutFeedback>
        </main>
      </div>
      <footer className="mx-auto flex w-full max-w-6xl flex-wrap justify-between gap-2 border-t border-border px-5 py-6 text-xs text-muted-foreground sm:px-8">
        <p>{t("footer")}</p>
        {import.meta.env.DEV && <p>{t("identity.local")}</p>}
      </footer>
    </div>
  );
}
