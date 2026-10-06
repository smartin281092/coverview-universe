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
import { pilotageQuerySchema, type PilotageQuery } from "@coverview/contracts/partner-pilotage";
import { defaultPilotageQuery } from "./features/pilotage-display";
const root = createRootRoute({ component: AppShell });
const statistics = createRoute({
  getParentRoute: () => root,
  path: "/statistics",
  validateSearch: (search: Record<string, unknown>): PilotageQuery =>
    pilotageQuerySchema.parse({ ...defaultPilotageQuery(), ...search }),
  component: lazyRouteComponent(() => import("./pages/StatisticsPage"), "StatisticsPage"),
});
const goals = createRoute({
  getParentRoute: () => root,
  path: "/goals",
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    goalId?: string | undefined;
    cursor?: string | undefined;
    state: "active" | "archived" | "all";
  } => ({
    ...(typeof search.goalId === "string" ? { goalId: search.goalId } : {}),
    ...(typeof search.cursor === "string" ? { cursor: search.cursor } : {}),
    state: search.state === "all" || search.state === "archived" ? search.state : "active",
  }),
  component: lazyRouteComponent(() => import("./pages/GoalsPage"), "GoalsPage"),
});
const communications = createRoute({
  getParentRoute: () => root,
  path: "/leads/$leadId/communications",
  component: lazyRouteComponent(() => import("./pages/CommunicationsPage"), "CommunicationsPage"),
});
const quality = createRoute({
  getParentRoute: () => root,
  path: "/quality",
  validateSearch: (
    s: Record<string, unknown>,
  ): {
    leadId?: string | undefined;
    caseId?: string | undefined;
    cursor?: string | undefined;
    state: "open" | "closed" | "all";
    reason?: "undeclared_contract" | undefined;
  } => ({
    ...(typeof s.leadId === "string" ? { leadId: s.leadId } : {}),
    ...(typeof s.caseId === "string" ? { caseId: s.caseId } : {}),
    ...(typeof s.cursor === "string" ? { cursor: s.cursor } : {}),
    state: s.state === "closed" || s.state === "all" ? s.state : "open",
    ...(s.reason === "undeclared_contract" ? { reason: s.reason } : {}),
  }),
  component: lazyRouteComponent(() => import("./pages/QualityPage"), "QualityPage"),
});
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
    // Default view and order stay out of the URL.
    const { view: defaultView, sort: defaultSort, ...rest } = result;
    void defaultView;
    void defaultSort;
    return {
      ...rest,
      ...(search.view === undefined ? {} : { view: result.view }),
      ...(search.sort === undefined ? {} : { sort: result.sort }),
    };
  },
  component: lazyRouteComponent(() => import("./pages/LeadsPage"), "LeadsPage"),
});
const lead = createRoute({
  getParentRoute: () => root,
  path: "/leads/$leadId",
  validateSearch: (s: Record<string, unknown>): { tab?: string; section?: "conclusion" } => ({
    tab: typeof s.tab === "string" ? s.tab : "overview",
    ...(s.section === "conclusion" ? { section: "conclusion" as const } : {}),
  }),
  component: lazyRouteComponent(() => import("./pages/LeadPage"), "LeadPage"),
});
const profile = createRoute({
  getParentRoute: () => root,
  path: "/profile",
  component: lazyRouteComponent(() => import("./pages/ApplicationPage"), "ApplicationPage"),
});
const publicProfile = createRoute({
  getParentRoute: () => root,
  path: "/profile/public",
  component: lazyRouteComponent(() => import("./pages/PublicProfilePage"), "PublicProfilePage"),
});
const data = createRoute({
  getParentRoute: () => root,
  path: "/data",
  component: lazyRouteComponent(() => import("./pages/DataPage"), "DataPage"),
});
const team = createRoute({
  getParentRoute: () => root,
  path: "/team",
  component: lazyRouteComponent(() => import("./pages/TeamPage"), "TeamPage"),
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
    quality,
    communications,
    statistics,
    goals,
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
    publicProfile,
    data,
    applications,
    team,
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
