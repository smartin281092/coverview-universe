import { createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router";
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

const rootRoute = createRootRoute({ component: AppShell, notFoundComponent: MissingPage });
const documentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/documents",
  component: DocumentsPage,
});
const documentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/documents/$documentId",
  component: DocumentDetailsPage,
});
const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: HomePage });
const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/account",
  validateSearch: (
    search: Record<string, unknown>,
  ): { tab?: "devices"; authError?: "callback" } => ({
    ...(search.tab === "devices" ? { tab: "devices" as const } : {}),
    ...(search.authError === "callback" ? { authError: "callback" as const } : {}),
  }),
  component: AccountPage,
});
const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspace/$userId",
  component: WorkspacePage,
});
const devicesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/devices",
  beforeLoad: () => {
    return redirect({ to: "/account", search: { tab: "devices" }, replace: true });
  },
});
const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile",
  validateSearch: (
    search: Record<string, unknown>,
  ): { view?: "choices"; continue?: "1"; authError?: "callback" } => ({
    ...(search.view === "choices" ? { view: "choices" as const } : {}),
    ...(search.continue === "1" ? { continue: "1" as const } : {}),
    ...(search.authError === "callback" ? { authError: "callback" as const } : {}),
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
    homeRoute,
    diagnosticsRoute,
    previewRoute,
    statesRoute,
    accountRoute,
    workspaceRoute,
    devicesRoute,
    profileRoute,
    documentsRoute,
    documentRoute,
  ]),
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
