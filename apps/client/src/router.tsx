import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
} from "@tanstack/react-router";
import {
  parseWalletProfileScope,
  retainWalletProfileScope,
} from "./features/profile/wallet-profile-scope";
import { AppShell } from "./AppShell";
import { HomePage } from "./pages/HomePage";
import { DiagnosticsPage } from "./pages/DiagnosticsPage";
import { PreviewPage } from "./pages/PreviewPage";
import { MissingPage, StatesPage } from "./pages/StatesPage";
import { AccountPage } from "./pages/AccountPage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { ProfilePage } from "./pages/ProfilePage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { DocumentDetailsPage } from "./pages/DocumentDetailsPage";
import { AuthorizationDetailsPage } from "./pages/AuthorizationDetailsPage";
import { RequestsPage } from "./pages/RequestsPage";
import { InsuranceCompanyPage } from "./pages/InsuranceCompanyPage";

const rootRoute = createRootRoute({
  component: AppShell,
  notFoundComponent: MissingPage,
  validateSearch: (search: Record<string, unknown>): { profile?: string } => {
    const profile = parseWalletProfileScope(search.profile);
    return profile ? { profile } : {};
  },
  search: { middlewares: [({ search, next }) => retainWalletProfileScope(search, next(search))] },
});
const documentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/documents",
  component: DocumentsPage,
});
const requestsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/requests",
  component: RequestsPage,
});
const leadNotificationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/offers/notifications",
  validateSearch: (
    search: Record<string, unknown>,
  ): { status: "open" | "all"; cursor?: string; clientProfileId?: string } => ({
    status: search.status === "open" ? "open" : "all",
    ...(typeof search.cursor === "string" ? { cursor: search.cursor } : {}),
    ...(typeof search.clientProfileId === "string"
      ? { clientProfileId: search.clientProfileId }
      : {}),
  }),
  component: lazyRouteComponent(
    () => import("./pages/LeadNotificationsPage"),
    "LeadNotificationsPage",
  ),
});
// An open request and one of its sections, shared by the offers and requests pages.
const leadSearch = (
  search: Record<string, unknown>,
): { lead?: string; section?: "quality" | "communications" | "conclusion" | "complement" } =>
  typeof search.lead === "string" && /^lead_[0-9a-f-]{36}$/.test(search.lead)
    ? {
        lead: search.lead,
        ...(search.section === "quality" ||
        search.section === "communications" ||
        search.section === "conclusion" ||
        search.section === "complement"
          ? { section: search.section }
          : {}),
      }
    : {};
const offersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/offers",
  validateSearch: leadSearch,
  component: lazyRouteComponent(() => import("./pages/OffersPage"), "OffersPage"),
});
const insuranceRequestsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/insurance-requests",
  validateSearch: leadSearch,
  component: lazyRouteComponent(
    () => import("./pages/InsuranceRequestsPage"),
    "InsuranceRequestsPage",
  ),
});
const insuranceRequestRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/insurance-requests/$requestId",
  component: lazyRouteComponent(
    () => import("./pages/InsuranceRequestsPage"),
    "InsuranceRequestsPage",
  ),
});
const actionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/actions",
  component: lazyRouteComponent(() => import("./pages/ActionCenterPage"), "ActionCenterPage"),
  validateSearch: (
    search: Record<string, unknown>,
  ): { cursor?: string; tab?: "activity" | "in_progress" } => ({
    ...(search.tab === "activity" || search.tab === "in_progress" ? { tab: search.tab } : {}),
    ...(typeof search.cursor === "string" && search.cursor.length <= 500
      ? { cursor: search.cursor }
      : {}),
  }),
});
const actionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/actions/$actionId",
  component: lazyRouteComponent(() => import("./pages/ActionDetailsPage"), "ActionDetailsPage"),
});
const documentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/documents/$documentId",
  component: DocumentDetailsPage,
});
const insuranceCompanyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/insurance-companies/$companyId",
  validateSearch: (
    search: Record<string, unknown>,
  ): { tab?: "contracts" | "expired" | "documents"; page?: number } => ({
    ...(search.tab === "contracts" || search.tab === "expired" || search.tab === "documents"
      ? { tab: search.tab }
      : {}),
    ...(typeof search.page === "number" &&
    Number.isInteger(search.page) &&
    search.page >= 1 &&
    search.page <= 20
      ? { page: search.page }
      : {}),
  }),
  component: InsuranceCompanyPage,
});
const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: HomePage });
const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/account",
  validateSearch: (
    search: Record<string, unknown>,
  ): { tab?: "devices" | "authorizations" | "data"; authError?: "callback" } => ({
    ...(search.tab === "devices" || search.tab === "authorizations" || search.tab === "data"
      ? { tab: search.tab }
      : {}),
    ...(search.authError === "callback" ? { authError: "callback" as const } : {}),
  }),
  // Authorizations moved to the profile on 8 October 2026; earlier links still arrive.
  beforeLoad: ({ search }) =>
    search.tab === "authorizations"
      ? redirect({
          to: "/profile",
          search: { person: "self", tab: "authorizations" },
          replace: true,
        })
      : undefined,
  component: AccountPage,
});
const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspace/$userId",
  component: WorkspacePage,
});
const authorizationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/authorizations/$kind",
  validateSearch: (
    search: Record<string, unknown>,
  ): { person?: string; returnAction?: string } => ({
    ...(typeof search.person === "string" && /^(self|prf_[0-9a-f-]{36})$/.test(search.person)
      ? { person: search.person }
      : {}),
    ...(typeof search.returnAction === "string" && /^act_[0-9a-f]{32}$/.test(search.returnAction)
      ? { returnAction: search.returnAction }
      : {}),
  }),
  component: AuthorizationDetailsPage,
});
const devicesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/devices",
  beforeLoad: () => {
    return redirect({ to: "/account", search: { tab: "devices" }, replace: true });
  },
});
const activationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/activation",
  component: lazyRouteComponent(() => import("./pages/ActivationPage"), "ActivationPage"),
});
const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile",
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    view?: "choices";
    continue?: "1";
    authError?: "callback";
    person?: string;
    tab?: "general" | "finances" | "health" | "authorizations";
    step?: "information" | "contact" | "details" | "review";
  } => ({
    ...(search.view === "choices" ? { view: "choices" as const } : {}),
    ...(search.continue === "1" ? { continue: "1" as const } : {}),
    ...(search.authError === "callback" ? { authError: "callback" as const } : {}),
    ...(typeof search.person === "string" &&
    (search.person === "self" || /^prf_[0-9a-f-]{36}$/.test(search.person))
      ? { person: search.person }
      : {}),
    ...(search.tab === "general" ||
    search.tab === "finances" ||
    search.tab === "health" ||
    search.tab === "authorizations"
      ? { tab: search.tab }
      : {}),
    ...(search.step === "information" ||
    search.step === "contact" ||
    search.step === "details" ||
    search.step === "review"
      ? { step: search.step }
      : {}),
  }),
  component: ProfilePage,
});
const previewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/preview",
  component: PreviewPage,
});
const statesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/states",
  component: StatesPage,
});
const diagnosticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/diagnostics",
  component: DiagnosticsPage,
});
export const router = createRouter({
  routeTree: rootRoute.addChildren([
    activationRoute,
    homeRoute,
    insuranceRequestsRoute,
    insuranceRequestRoute,
    diagnosticsRoute,
    previewRoute,
    statesRoute,
    accountRoute,
    authorizationRoute,
    workspaceRoute,
    devicesRoute,
    profileRoute,
    documentsRoute,
    requestsRoute,
    offersRoute,
    leadNotificationsRoute,
    actionsRoute,
    actionRoute,
    documentRoute,
    insuranceCompanyRoute,
  ]),
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
