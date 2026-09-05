import { Link, Outlet } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, House, PanelsTopLeft, Users } from "lucide-react";
import logo from "../../../assets/logo-coverview.svg";

export function AppShell() {
  const { t } = useTranslation();
  const websiteUrl = import.meta.env.DEV ? "http://127.0.0.1:4103" : "https://coverview.ch";
  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary p-3 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {t("skip")}
      </a>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link to="/" className="flex items-center gap-4">
            <img src={logo} alt={t("brand")} className="h-6 w-auto" width="444" height="73" />
            <span className="border-l border-border pl-4 text-sm font-medium text-muted-foreground">
              {t("app")}
            </span>
          </Link>
          <a
            href={websiteUrl}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary"
          >
            {t("website")}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl md:grid-cols-[14rem_1fr]">
        <aside className="border-b border-border px-5 py-5 md:min-h-[calc(100vh-5rem)] md:border-r md:border-b-0 sm:px-8">
          <nav aria-label={t("navigation")} className="flex flex-wrap gap-2 md:flex-col">
            <Link
              to="/"
              activeOptions={{ exact: true }}
              className="inline-flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
              activeProps={{ className: "bg-accent text-primary", "aria-current": "page" }}
            >
              <House className="size-4" aria-hidden="true" />
              {t("home")}
            </Link>
            {import.meta.env.DEV && (
              <>
                <Link
                  to="/preview"
                  className="inline-flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
                  activeProps={{ className: "bg-accent text-primary", "aria-current": "page" }}
                >
                  <Users className="size-4" aria-hidden="true" />
                  {t("preview")}
                </Link>
                <Link
                  to="/states"
                  className="inline-flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
                  activeProps={{ className: "bg-accent text-primary", "aria-current": "page" }}
                >
                  <PanelsTopLeft className="size-4" aria-hidden="true" />
                  {t("states")}
                </Link>
              </>
            )}
          </nav>
        </aside>
        <div className="min-w-0">
          <main id="main" tabIndex={-1} className="space-y-8 px-5 py-8 sm:px-10 sm:py-10">
            <p className="inline-flex rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              {t(import.meta.env.DEV ? "local" : "production")}
            </p>
            <Outlet />
          </main>
          <footer className="px-5 pb-8 text-xs text-muted-foreground sm:px-10">
            {t("footer")}
          </footer>
        </div>
      </div>
    </div>
  );
}
