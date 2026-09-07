import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, FileText, Menu, Settings2, UserRound, X, Clock3 } from "lucide-react";
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
import logo from "../../../assets/logo-coverview.svg";
import { LogoutFeedback } from "./features/identity/LogoutFeedback";

const destinations = [
  { to: "/profile", key: "profile", icon: UserRound },
  { to: "/documents", key: "documents", icon: FileText },
  { to: "/requests", key: "requests", icon: Clock3 },
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
        <Container className="flex min-h-16 items-center justify-between gap-4">
          <Link to="/" className="flex min-h-11 items-center gap-3">
            <img
              src={logo}
              alt={t("brand")}
              className="h-5 w-auto md:h-6"
              width="444"
              height="73"
            />
            <span className="text-xs text-muted-foreground md:text-sm">{t("app")}</span>
          </Link>
          <nav aria-label={t("navigation")} className="hidden items-center gap-x-6 md:flex">
            {destinations.map((destination) => (
              <Link
                key={destination.to}
                to={destination.to}
                search={{}}
                aria-current={isCurrent(destination.to) ? "page" : undefined}
                className="cv-app-nav-link"
              >
                {t("mobileNav." + destination.key)}
              </Link>
            ))}
          </nav>
          <div className="hidden md:block">
            <TextLink href={websiteUrl} arrow="up" className="text-sm">
              {t("website")}
            </TextLink>
          </div>
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                ref={menuTrigger}
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 md:hidden"
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
      {!editing && !menuOpen && (
        <nav
          aria-label={t("navigation")}
          className="wallet-bottom-nav fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-xl md:hidden"
        >
          <ul className="grid grid-cols-4">
            {destinations.map(({ to, key, icon: Icon }) => {
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
                    <span>{t("mobileNav." + key)}</span>
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
