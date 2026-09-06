import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
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
