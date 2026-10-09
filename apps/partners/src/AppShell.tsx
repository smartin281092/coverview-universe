import { defaultPilotageQuery } from "./features/pilotage-display";
import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  PanelsTopLeft,
  Users,
  CalendarDays,
  CheckSquare,
  UserRound,
  ShieldCheck,
  ArrowUpRight,
  Menu,
  Bell,
  FileDown,
} from "lucide-react";
import { Button, Sheet, SheetContent, SheetHeader, SheetTitle } from "@coverview/ui";
import { useEffect, useState } from "react";
import { ConsentBanner, identifyAnalytics, openConsentSettings } from "@coverview/ui/consent";
import logo from "../../../assets/logo-coverview.svg";
import { PartnerSession, usePartner } from "./features/PartnerSession";
import { analytics } from "./features/analytics";
import { ApplicationPage } from "./pages/ApplicationPage";
import { adminUrl, walletUrl } from "./api";
const links = [
  { to: "/", label: "dashboard", icon: LayoutDashboard },
  { to: "/leads", label: "leads", icon: PanelsTopLeft },
  { to: "/clients", label: "clients", icon: Users },
  { to: "/tasks", label: "tasks", icon: CheckSquare },
  { to: "/notifications", label: "notifications", icon: Bell },
  { to: "/collaborations", label: "collaborations", icon: Users },
  { to: "/marketplace", label: "marketplace", icon: PanelsTopLeft },
  { to: "/commercial-conditions", label: "commercial", icon: ShieldCheck },
  { to: "/remunerations", label: "remunerations", icon: CheckSquare },
  { to: "/agenda", label: "agenda", icon: CalendarDays },
  { to: "/profile", label: "profile", icon: UserRound },
  { to: "/profile/public", label: "publicProfile", icon: UserRound },
  { to: "/data", label: "data", icon: FileDown },
] as const;
function Workspace() {
  const { t } = useTranslation(),
    { pathname } = useLocation(),
    { identity, context } = usePartner();
  const { t: tc } = useTranslation("consent");
  const [open, setOpen] = useState(false);
  // PostHog after consent only (9 October 2026): the person by their opaque identifier, never more.
  useEffect(() => {
    identifyAnalytics(identity.user.id);
    return () => identifyAnalytics(null);
  }, [identity.user.id]);
  const navigation = (
    <>
      <div className="mb-8 px-3">
        <img src={logo} alt={t("brand")} className="h-5 w-auto" />
        <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t("app")}
        </p>
      </div>
      <nav aria-label={t("navigation")} className="space-y-1">
        {links
          .filter(
            // The right of access does not depend on being operational (C7).
            (link) =>
              context.operational ||
              link.label === "profile" ||
              link.label === "remunerations" ||
              link.label === "data",
          )
          .map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm ${pathname === to || (to === "/leads" && pathname.startsWith("/leads/")) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              <Icon className="size-4" />
              {t(`nav.${label}`)}
            </Link>
          ))}
        {context.operational && (
          <>
            <Link
              to="/statistics"
              search={{
                ...defaultPilotageQuery(),
                scope: context.administrator ? "network" : "self",
              }}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-muted-foreground hover:bg-muted"
            >
              <PanelsTopLeft className="size-4" />
              {t("pilotage:title")}
            </Link>
            <Link
              to="/goals"
              search={{ state: "active" }}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-muted-foreground hover:bg-muted"
            >
              <CheckSquare className="size-4" />
              {t("pilotage:goalsTitle")}
            </Link>
          </>
        )}
        {context.operational && context.application?.grantedRoles.includes("manager") && (
          <Link
            to="/team"
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm ${pathname === "/team" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            <Users className="size-4" />
            {t("nav.team")}
          </Link>
        )}
        {context.administrator && (
          <Link
            to="/quality"
            search={{ state: "open" }}
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-muted-foreground hover:bg-muted"
          >
            <ShieldCheck className="size-4" />
            {t("quality:title")}
          </Link>
        )}
        {context.administrator && (
          <Link
            to="/applications"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-muted-foreground hover:bg-muted"
          >
            <ShieldCheck className="size-4" />
            {t("nav.applications")}
          </Link>
        )}
      </nav>
      <div className="mt-auto space-y-3 border-t border-border px-3 pt-5 text-xs text-muted-foreground">
        <a href={walletUrl} className="flex items-center justify-between">
          {t("nav.wallet")}
          <ArrowUpRight className="size-3.5" />
        </a>
        {context.administrator && (
          <a href={adminUrl} className="flex items-center justify-between">
            {t("nav.admin")}
            <ArrowUpRight className="size-3.5" />
          </a>
        )}
        {analytics.key && (
          <button
            type="button"
            className="flex min-h-8 items-center hover:text-foreground"
            onClick={openConsentSettings}
          >
            {tc("settings")}
          </button>
        )}
        <p className="truncate pt-3">{identity.user.email}</p>
      </div>
    </>
  );
  return (
    <div className="min-h-svh bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-background focus:p-4"
      >
        {t("skip")}
      </a>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-border bg-card p-5 lg:flex">
        {navigation}
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/95 px-5 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(true)}
              className="lg:hidden"
              aria-label={t("navigation")}
            >
              <Menu className="size-5" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {context.administrator ? t("network") : t("workspace")}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4" />
            {t("private")}
          </div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto max-w-screen-2xl space-y-8 p-5 sm:p-8">
          {context.operational ||
          pathname === "/remunerations" ||
          pathname.startsWith("/remunerations/") ? (
            <Outlet />
          ) : (
            <ApplicationPage />
          )}
        </main>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="flex w-72 flex-col p-5"
          showCloseButton
          closeLabel={t("close")}
        >
          <SheetHeader>
            <SheetTitle className="sr-only">{t("navigation")}</SheetTitle>
          </SheetHeader>
          {navigation}
        </SheetContent>
      </Sheet>
    </div>
  );
}
// The consent banner stands beside the session, so signed-out pages ask it too.
function Consent() {
  const { t } = useTranslation("consent");
  return (
    <ConsentBanner
      config={analytics}
      texts={{ title: t("title"), message: t("message"), accept: t("accept"), refuse: t("refuse") }}
    />
  );
}
export function AppShell() {
  return (
    <>
      <PartnerSession>
        <Workspace />
      </PartnerSession>
      <Consent />
    </>
  );
}
