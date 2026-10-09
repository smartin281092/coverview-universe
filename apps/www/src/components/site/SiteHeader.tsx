import { useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from "react";
import {
  BookOpen,
  Briefcase,
  Calculator,
  ChartColumn,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderOpen,
  GitCompareArrows,
  HeartPulse,
  Menu,
  PenLine,
  Route,
  Scale,
  Search,
  SearchCheck,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  X,
  type LucideIcon,
} from "lucide-react";
import logo from "../../../../../assets/logo-coverview.svg?url";
import {
  navigation,
  type NavigationIcon,
  type NavigationLink,
  type NavigationMenu,
} from "../../content/fr/navigation";

const icons: Record<NavigationIcon, LucideIcon> = {
  "heart-pulse": HeartPulse,
  chart: ChartColumn,
  scale: Scale,
  compare: GitCompareArrows,
  book: BookOpen,
  calculator: Calculator,
  sliders: SlidersHorizontal,
  "search-check": SearchCheck,
  file: FileText,
  shield: ShieldCheck,
  folder: FolderOpen,
  briefcase: Briefcase,
  route: Route,
  signature: PenLine,
};
const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export type SiteHeaderProps = {
  pathname: string;
  requestsEnabled: boolean;
  loginUrl: string;
  accountUrl: string;
  // The comparator passes its cart; elsewhere "Mon panier" leads to the comparator's checkout.
  cart?: { count: number; onOpen: () => void } | undefined;
  // Controls of one page, such as the home page's pause of its animations.
  children?: ReactNode;
};

/**
 * The site's header on every public page (9 October 2026), modelled on the comparator's: the
 * logo, a Comparator and an Audit menu, then the cart and the account. The menus' links are in
 * the HTML even closed; small screens get the same links in a side sheet.
 */
export function SiteHeader({
  pathname,
  requestsEnabled,
  loginUrl,
  accountUrl,
  cart,
  children,
}: SiteHeaderProps) {
  const id = useId();
  const [open, setOpen] = useState<NavigationMenu["id"] | null>(null);
  const [sheet, setSheet] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const header = useRef<HTMLElement>(null);
  const sheetRef = useRef<HTMLDialogElement>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const leaving = useRef<number | undefined>(undefined);
  const current = navigation.menus.find((menu) =>
    [...menu.highlights, ...menu.links].some((link) => link.href === pathname),
  )?.id;

  // Escape closes the open menu and gives the focus back to its button; a press elsewhere too.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      triggers.current.get(open)?.focus();
      setOpen(null);
    };
    const onPress = (event: globalThis.PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPress);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPress);
    };
  }, [open]);
  // The sheet is a modal dialog: the browser keeps the focus inside and gives it back on close.
  useEffect(() => {
    const dialog = sheetRef.current;
    if (!dialog) return;
    if (sheet && !dialog.open) dialog.showModal();
    if (!sheet && dialog.open) dialog.close();
  }, [sheet]);
  useEffect(() => () => window.clearTimeout(leaving.current), []);

  // A mouse opens a menu by hovering it; touch and keyboard use the button.
  const enter = (menu: NavigationMenu["id"]) => (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    window.clearTimeout(leaving.current);
    setOpen(menu);
  };
  const leave = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    leaving.current = window.setTimeout(() => setOpen(null), 160);
  };
  const here = (link: NavigationLink) => (link.href === pathname ? ("page" as const) : undefined);
  const glyph = (name: NavigationIcon, className: string) => {
    const Icon = icons[name];
    return <Icon className={className} aria-hidden="true" />;
  };

  return (
    <header ref={header} className="cv-site-header">
      <div className="cv-site-header-inner">
        <a href="/" className="cv-site-logo" aria-label={navigation.home}>
          <img src={logo} width="118" height="20" alt="" />
        </a>
        <span className="cv-site-divider" aria-hidden="true" />
        <nav aria-label={navigation.label} className="cv-site-nav">
          {navigation.menus.map((menu) => {
            const query = fold(filters[menu.id] ?? "");
            const links = menu.links.filter((link) => fold(link.label).includes(query));
            return (
              <div
                key={menu.id}
                className="cv-site-menu"
                onPointerEnter={enter(menu.id)}
                onPointerLeave={leave}
              >
                <button
                  ref={(node) => {
                    if (node) triggers.current.set(menu.id, node);
                  }}
                  type="button"
                  className="cv-site-trigger"
                  aria-expanded={open === menu.id}
                  aria-controls={`${id}-${menu.id}`}
                  data-current={current === menu.id ? "" : undefined}
                  onClick={() => setOpen(open === menu.id ? null : menu.id)}
                >
                  {menu.label}
                  <ChevronDown className="cv-site-chevron" aria-hidden="true" />
                </button>
                <div id={`${id}-${menu.id}`} className="cv-mega" hidden={open !== menu.id}>
                  <div className="cv-mega-highlights">
                    <p className="cv-mega-eyebrow">{menu.highlightsTitle}</p>
                    <ul>
                      {menu.highlights.map((item) => (
                        <li key={item.href}>
                          <a
                            href={item.href}
                            className="cv-mega-highlight"
                            aria-current={here(item)}
                          >
                            <span className="cv-mega-tile">{glyph(item.icon, "size-5")}</span>
                            <span>
                              <strong>{item.label}</strong>
                              <span>{item.description}</span>
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="cv-mega-list">
                    <p className="cv-mega-eyebrow">{menu.listTitle}</p>
                    <label className="cv-mega-filter">
                      <Search className="size-4" aria-hidden="true" />
                      <span className="sr-only">{navigation.filterLabel}</span>
                      <input
                        type="search"
                        placeholder={navigation.filter}
                        value={filters[menu.id] ?? ""}
                        onChange={(event) =>
                          setFilters((value) => ({ ...value, [menu.id]: event.target.value }))
                        }
                      />
                    </label>
                    <ul>
                      {links.map((link) => (
                        <li key={link.href}>
                          <a href={link.href} className="cv-mega-link" aria-current={here(link)}>
                            {glyph(link.icon, "size-5")}
                            <span>{link.label}</span>
                            <ChevronRight className="size-3.5" aria-hidden="true" />
                          </a>
                        </li>
                      ))}
                    </ul>
                    {!links.length && (
                      <p className="cv-mega-empty" role="status">
                        {navigation.empty}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
        <div className="cv-site-actions">
          {children}
          {requestsEnabled &&
            (cart ? (
              <button
                type="button"
                className="cv-site-cart"
                aria-label={`${navigation.cart} (${cart.count})`}
                onClick={cart.onOpen}
              >
                <ShoppingBag className="size-[19px]" aria-hidden="true" />
                <span className="cv-site-cart-label">{navigation.cart}</span>
                <span className="cv-site-cart-count">{cart.count}</span>
              </button>
            ) : (
              <a href="/comparateur-assurance-maladie-2027?panier=1" className="cv-site-cart">
                <ShoppingBag className="size-[19px]" aria-hidden="true" />
                <span className="cv-site-cart-label">{navigation.cart}</span>
              </a>
            ))}
          {requestsEnabled && (
            <>
              <a href={loginUrl} className="cv-site-sign-in">
                {navigation.signIn}
              </a>
              <a href={accountUrl} className="cv-site-account">
                {navigation.createAccount}
              </a>
            </>
          )}
          <button
            type="button"
            className="cv-site-menu-button"
            aria-label={navigation.open}
            aria-expanded={sheet}
            aria-controls={`${id}-sheet`}
            onClick={() => setSheet(true)}
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <dialog
        ref={sheetRef}
        id={`${id}-sheet`}
        className="cv-site-sheet"
        aria-label={navigation.menuTitle}
        onClose={() => setSheet(false)}
      >
        <div className="cv-site-sheet-head">
          <p>{navigation.menuTitle}</p>
          <button type="button" aria-label={navigation.close} onClick={() => setSheet(false)}>
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        {navigation.menus.map((menu) => (
          <section key={menu.id} aria-labelledby={`${id}-sheet-${menu.id}`}>
            <h2 id={`${id}-sheet-${menu.id}`} className="cv-mega-eyebrow">
              {menu.label}
            </h2>
            <ul>
              {[
                ...menu.highlights,
                ...menu.links.filter(
                  (link) => !menu.highlights.some((item) => item.href === link.href),
                ),
              ].map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="cv-mega-link" aria-current={here(link)}>
                    {glyph(link.icon, "size-5")}
                    <span>{link.label}</span>
                    <ChevronRight className="size-3.5" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {requestsEnabled && (
          <div className="cv-site-sheet-actions">
            <a href={loginUrl} className="cv-site-sign-in">
              {navigation.signIn}
            </a>
            <a href={accountUrl} className="cv-site-account">
              {navigation.createAccount}
            </a>
          </div>
        )}
      </dialog>
    </header>
  );
}
