import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from "@tanstack/react-router";
import {
  leadListQuerySchema,
  partnerNotificationQuerySchema,
  type LeadListQuery,
} from "@coverview/contracts/partner";
import { AppShell } from "./AppShell";
const root = createRootRoute({ component: AppShell });
const marketplace = createRoute({
  getParentRoute: () => root,
  path: "/marketplace",
  component: lazyRouteComponent(() => import("./pages/MarketplacePage"), "MarketplacePage"),
});
const marketDetail = createRoute({
  getParentRoute: () => root,
  path: "/marketplace/$marketId",
  component: lazyRouteComponent(() => import("./pages/MarketDetailPage"), "MarketDetailPage"),
});
const commercial = createRoute({
  getParentRoute: () => root,
  path: "/commercial-conditions",
  component: lazyRouteComponent(
    () => import("./pages/CommercialConditionsPage"),
    "CommercialConditionsPage",
  ),
});
const remunerations = createRoute({
  getParentRoute: () => root,
  path: "/remunerations",
  component: lazyRouteComponent(() => import("./pages/RemunerationsPage"), "RemunerationsPage"),
});
const economyCase = createRoute({
  getParentRoute: () => root,
  path: "/remunerations/$caseId",
  component: lazyRouteComponent(() => import("./pages/EconomyCasePage"), "EconomyCasePage"),
});
const collaborations = createRoute({
  getParentRoute: () => root,
  path: "/collaborations",
  component: lazyRouteComponent(() => import("./pages/CollaborationsPage"), "CollaborationsPage"),
});
const notifications = createRoute({
  getParentRoute: () => root,
  path: "/notifications",
  validateSearch: (search: Record<string, unknown>) => partnerNotificationQuerySchema.parse(search),
  component: lazyRouteComponent(() => import("./pages/NotificationsPage"), "NotificationsPage"),
});
const home = createRoute({
  getParentRoute: () => root,
  path: "/",
  component: lazyRouteComponent(() => import("./pages/DashboardPage"), "DashboardPage"),
});
const account = createRoute({
  getParentRoute: () => root,
  path: "/account",
  component: lazyRouteComponent(() => import("./pages/DashboardPage"), "DashboardPage"),
});
const leads = createRoute({
  getParentRoute: () => root,
  path: "/leads",
  validateSearch: (
    search: Record<string, unknown>,
  ): Partial<LeadListQuery> & { layout?: "list" | "kanban" } => {
    const { layout, ...filters } = search;
    const parsed = leadListQuerySchema.safeParse(filters);
    const result = {
      ...(parsed.success ? parsed.data : leadListQuerySchema.parse({})),
      layout: layout === "list" ? ("list" as const) : ("kanban" as const),
    };
    if (search.view === undefined) {
      const { view: defaultView, ...rest } = result;
      void defaultView;
      return rest;
    }
    return result;
  },
  component: lazyRouteComponent(() => import("./pages/LeadsPage"), "LeadsPage"),
});
const lead = createRoute({
  getParentRoute: () => root,
  path: "/leads/$leadId",
  validateSearch: (s: Record<string, unknown>): { tab?: string } => ({
    tab: typeof s.tab === "string" ? s.tab : "overview",
  }),
  component: lazyRouteComponent(() => import("./pages/LeadPage"), "LeadPage"),
});
const profile = createRoute({
  getParentRoute: () => root,
  path: "/profile",
  component: lazyRouteComponent(() => import("./pages/ApplicationPage"), "ApplicationPage"),
});
const applications = createRoute({
  getParentRoute: () => root,
  path: "/applications",
  component: lazyRouteComponent(() => import("./pages/ApplicationsPage"), "ApplicationsPage"),
});
const clients = createRoute({
  getParentRoute: () => root,
  path: "/clients",
  component: lazyRouteComponent(() => import("./pages/ClientsPage"), "ClientsPage"),
});
const tasks = createRoute({
  getParentRoute: () => root,
  path: "/tasks",
  component: lazyRouteComponent(() => import("./pages/TasksPage"), "TasksPage"),
});
const agenda = createRoute({
  getParentRoute: () => root,
  path: "/agenda",
  component: lazyRouteComponent(() => import("./pages/AgendaPage"), "AgendaPage"),
});
export const router = createRouter({
  routeTree: root.addChildren([
    home,
    marketplace,
    marketDetail,
    commercial,
    remunerations,
    economyCase,
    notifications,
    collaborations,
    account,
    leads,
    lead,
    profile,
    applications,
    clients,
    tasks,
    agenda,
  ]),
  defaultPreload: "intent",
  scrollRestoration: true,
});
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
