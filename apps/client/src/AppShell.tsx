import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, FileText, Menu, Settings2, UserRound, X, ListChecks, Files } from "lucide-react";
import {
  Button,
  Container,
  TextLink,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@coverview/ui";
import logoIcon from "../../../assets/icon-coverview.svg";
import { LogoutFeedback } from "./features/identity/LogoutFeedback";
import { WalletProfileSwitcher } from "./features/profile/WalletProfileSwitcher";
import { useWalletProfileScope } from "./features/profile/use-wallet-profile-scope";
import { useActionCount } from "./features/actions/use-action-count";
import { usePassiveIdentity } from "./features/identity/session-state";
import { ConsentBanner, identifyAnalytics, openConsentSettings } from "@coverview/ui/consent";

const destinations = [
  { to: "/profile", key: "profile", icon: UserRound },
  { to: "/documents", key: "documents", icon: FileText },
  { to: "/offers", key: "offers", icon: Files },
  { to: "/actions", key: "actions", icon: ListChecks },
  { to: "/insurance-requests", key: "insuranceRequests", icon: FileText },
  { to: "/account", key: "account", icon: Settings2 },
] as const;

function isEditingControl(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement) return !target.readOnly && !target.disabled;
  if (target instanceof HTMLSelectElement) return !target.disabled;
  if (!(target instanceof HTMLInputElement)) return false;
  return (
    !target.readOnly &&
    !target.disabled &&
    ![
      "button",
      "checkbox",
      "color",
      "file",
      "hidden",
      "radio",
      "range",
      "reset",
      "submit",
    ].includes(target.type)
  );
}

export function AppShell() {
  const { t } = useTranslation();
  const actionCount = useActionCount();
  // Menus only for a signed-in person; before that the shell is a plain sign-in page.
  const passive = usePassiveIdentity().data;
  const signedIn = !!passive;
  const { t: tc } = useTranslation("consent");
  // PostHog after consent only (9 October 2026): the person by their opaque identifier, never more.
  useEffect(() => identifyAnalytics(passive?.user.id ?? null), [passive?.user.id]);
  const { scope } = useWalletProfileScope();
  const { pathname, searchStr } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const main = useRef<HTMLElement>(null);
  const websiteUrl =
    import.meta.env.VITE_WEBSITE_URL ??
    (import.meta.env.DEV ? "http://127.0.0.1:4103" : "https://coverview.ch");
  const publicLinks = [
    { path: "/overview", key: "journeys" },
    { path: "/methode", key: "method" },
    { path: "/articles/questions-frequentes", key: "questions" },
  ] as const;
  const isCurrent = (destination: (typeof destinations)[number]["to"]) => {
    if (destination === "/actions" && pathname === "/requests") return true;
    if (destination === "/documents" && pathname.startsWith("/insurance-companies/")) return true;
    if (destination === "/account")
      return (
        pathname === "/" ||
        pathname === "/account" ||
        pathname.startsWith("/workspace/") ||
        pathname.startsWith("/authorizations/")
      );
    return pathname === destination || pathname.startsWith(destination + "/");
  };

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname, searchStr]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 48rem)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMenuOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <div
      className="wallet-shell flex min-h-svh flex-col"
      data-navigation={signedIn ? "visible" : "hidden"}
      onFocusCapture={(event) => setEditing(isEditingControl(event.target))}
      onBlurCapture={() => {
        queueMicrotask(() => setEditing(isEditingControl(document.activeElement)));
      }}
    >
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary p-3 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {t("skip")}
      </a>
      <header className="wallet-header sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-xl">
        <Container className="flex min-h-16 items-center justify-between gap-2 sm:gap-4 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <Link
            to="/"
            className="flex min-h-11 shrink-0 items-center gap-2 sm:gap-3 md:justify-self-start"
          >
            <img
              src={logoIcon}
              alt={`${t("brand")} ${t("app")}`}
              className="h-5 w-auto md:h-6"
              width="80"
              height="73"
            />
          </Link>
          {signedIn && (
            <nav
              aria-label={t("navigation")}
              className="hidden items-center gap-x-4 md:flex lg:gap-x-6"
            >
              {destinations.map((destination) => (
                <Link
                  key={destination.to}
                  to={destination.to}
                  search={{}}
                  aria-current={isCurrent(destination.to) ? "page" : undefined}
                  className="cv-app-nav-link"
                >
                  {t("mobileNav." + destination.key)}
                  {destination.key === "actions" && actionCount !== undefined && actionCount > 0 && (
                    <span
                      className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-chart-3 px-1.5 py-0.5 text-xs text-white"
                      aria-label={t("actions:badge", { count: actionCount })}
                    >
                      {actionCount}
                    </span>
                  )}
                </Link>
              ))}
            </nav>
          )}
          {signedIn && (
            <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3 md:ml-0 md:max-w-full md:justify-self-end">
              <WalletProfileSwitcher />
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    ref={menuTrigger}
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 shrink-0 md:hidden"
                    aria-label={t("mobileNav.openMenu")}
                  >
                    <Menu className="size-5" strokeWidth={1.5} aria-hidden="true" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  showCloseButton={false}
                  className="wallet-mobile-menu gap-8 overflow-y-auto overscroll-contain border-0 bg-background shadow-none"
                  onCloseAutoFocus={(event) => {
                    if (!menuTrigger.current?.getClientRects().length) {
                      event.preventDefault();
                      main.current?.focus({ preventScroll: true });
                    }
                  }}
                >
                  <SheetHeader className="gap-4 p-0 text-left">
                    <div className="flex items-center justify-between gap-4">
                      <SheetTitle className="text-xl font-medium">
                        {t("mobileNav.menuTitle")}
                      </SheetTitle>
                      <SheetClose asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-11 shrink-0"
                          aria-label={t("mobileNav.closeMenu")}
                        >
                          <X className="size-5" strokeWidth={1.5} aria-hidden="true" />
                        </Button>
                      </SheetClose>
                    </div>
                    <SheetDescription className="text-sm leading-relaxed">
                      {t("mobileNav.menuDescription")}
                    </SheetDescription>
                  </SheetHeader>
                  <nav aria-label={t("navigation")} className="grid gap-2">
                    {destinations.map(({to,key,icon:Icon}) => <SheetClose asChild key={to}><Link to={to} search={{}} className="flex min-h-11 items-center gap-3 rounded-md px-3 hover:bg-muted" aria-current={isCurrent(to)?"page":undefined}><Icon className="size-5" />{t("mobileNav."+key)}</Link></SheetClose>)}
                  </nav>
                  <nav aria-label={t("mobileNav.secondaryNavigation")}>
                    <ul className="divide-y divide-border">
                      {publicLinks.map((link) => (
                        <li key={link.path}>
                          <SheetClose asChild>
                            <a
                              href={new URL(link.path, websiteUrl).href}
                              className="flex min-h-14 items-center justify-between gap-4 py-4 text-base font-medium"
                            >
                              <span>{t("mobileNav." + link.key)}</span>
                              <ArrowUpRight
                                className="size-5 shrink-0 text-muted-foreground"
                                strokeWidth={1.5}
                                aria-hidden="true"
                              />
                            </a>
                          </SheetClose>
                        </li>
                      ))}
                    </ul>
                  </nav>
                  <div className="mt-auto border-t border-border pt-6">
                    <SheetClose asChild>
                      <Button variant="outline" className="min-h-11 w-full text-sm">
                        {t("mobileNav.backToWallet")}
                      </Button>
                    </SheetClose>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          )}
        </Container>
      </header>
      <Container className="flex-1">
        <main
          ref={main}
          id="main"
          tabIndex={-1}
          className="app-content cv-section cv-section--compact space-y-10"
        >
          <LogoutFeedback>
            <Outlet key={scope} />
          </LogoutFeedback>
        </main>
      </Container>
      <footer className="border-t border-border">
        <Container className="flex flex-wrap items-center justify-between gap-2 py-6 text-xs text-muted-foreground">
          <p>{t("footer")}</p>
          <TextLink
            href={websiteUrl}
            arrow="up"
            className="inline-flex min-h-11 items-center text-xs"
          >
            {t("website")}
          </TextLink>
          {import.meta.env.DEV && <p className="cv-meta">{t("identity.local")}</p>}
          <button
            type="button"
            className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
            onClick={openConsentSettings}
          >
            {tc("settings")}
          </button>
        </Container>
      </footer>
      <ConsentBanner
        config={{
          key: import.meta.env.VITE_POSTHOG_KEY,
          host: import.meta.env.VITE_POSTHOG_HOST,
          replay: true,
          singlePage: true,
        }}
        texts={{
          title: tc("title"),
          message: tc("message"),
          accept: tc("accept"),
          refuse: tc("refuse"),
        }}
      />
      {signedIn && !editing && !menuOpen && (
        <nav
          aria-label={t("navigation")}
          className="wallet-bottom-nav fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-xl md:hidden"
        >
          <ul className="grid grid-cols-4">
            {destinations.filter(({key})=>key!=="account"&&key!=="insuranceRequests").map(({ to, key, icon: Icon }) => {
              const current = isCurrent(to);
              return (
                <li key={to}>
                  <Link
                    to={to}
                    search={{}}
                    aria-current={current ? "page" : undefined}
                    className={
                      "wallet-bottom-nav__link flex min-w-0 flex-col items-center justify-center gap-1 rounded-md px-2 text-xs " +
                      (current ? "font-medium text-foreground" : "text-muted-foreground")
                    }
                  >
                    <span
                      className={
                        "flex items-center justify-center rounded-xl px-4 py-1 " +
                        (current ? "bg-muted" : "")
                      }
                    >
                      <Icon className="size-5" strokeWidth={current ? 2 : 1.5} aria-hidden="true" />
                    </span>
                    <span className="flex items-center gap-1">
                      {t("mobileNav." + key)}
                      {key === "actions" && actionCount !== undefined && actionCount > 0 && (
                        <span
                          className="inline-flex min-w-4 items-center justify-center rounded-full bg-chart-3 px-1 text-xs text-white"
                          aria-label={t("actions:badge", { count: actionCount })}
                        >
                          {actionCount}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
