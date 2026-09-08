import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from "@tanstack/react-router";
import { AppShell } from "./AppShell";
import { HomePage } from "./pages/HomePage";
import { DiagnosticsPage } from "./pages/DiagnosticsPage";
import { PreviewPage } from "./pages/PreviewPage";
import { MissingPage, StatesPage } from "./pages/StatesPage";
import { AccountPage } from "./pages/AccountPage";
import { MfaPage } from "./pages/MfaPage";
import { AuthenticatorPage } from "./pages/AuthenticatorPage";
import { CancelAuthenticatorPage } from "./pages/CancelAuthenticatorPage";

const rootRoute = createRootRoute({ component: AppShell, notFoundComponent: MissingPage });
const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: HomePage });
const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/users",
  component: lazyRouteComponent(() => import("./pages/UsersPage"), "UsersPage"),
  validateSearch: (
    search: Record<string, unknown>,
  ): { q?: string | undefined; cursor?: string | undefined } => ({
    ...(typeof search.q === "string" && search.q.length <= 120 ? { q: search.q } : {}),
    ...(typeof search.cursor === "string" && search.cursor.length <= 500
      ? { cursor: search.cursor }
      : {}),
  }),
});
const userRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/users/$userId",
  component: lazyRouteComponent(() => import("./pages/UserPage"), "UserPage"),
  validateSearch: (search: Record<string, unknown>): { profile?: string; tab?: string } => ({
    ...(typeof search.profile === "string" && search.profile.length <= 100
      ? { profile: search.profile }
      : {}),
    ...(typeof search.tab === "string" && search.tab.length <= 20 ? { tab: search.tab } : {}),
  }),
});
const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/account",
  component: AccountPage,
});
const mfaRoute = createRoute({ getParentRoute: () => rootRoute, path: "/mfa", component: MfaPage });
const authenticatorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/authenticator",
  component: AuthenticatorPage,
});
const cancelAuthenticatorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/authenticator/cancel",
  component: CancelAuthenticatorPage,
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
    usersRoute,
    userRoute,
    diagnosticsRoute,
    previewRoute,
    statesRoute,
    accountRoute,
    mfaRoute,
    authenticatorRoute,
    cancelAuthenticatorRoute,
  ]),
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
