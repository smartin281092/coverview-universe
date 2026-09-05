import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { AppShell } from "./AppShell";
import { HomePage } from "./pages/HomePage";
import { PreviewPage } from "./pages/PreviewPage";
import { MissingPage, StatesPage } from "./pages/StatesPage";
import { AccountPage } from "./pages/AccountPage";
import { MfaPage } from "./pages/MfaPage";

const rootRoute = createRootRoute({ component: AppShell, notFoundComponent: MissingPage });
const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: HomePage });
const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/account",
  component: AccountPage,
});
const mfaRoute = createRoute({ getParentRoute: () => rootRoute, path: "/mfa", component: MfaPage });
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
export const router = createRouter({
  routeTree: rootRoute.addChildren([homeRoute, previewRoute, statesRoute, accountRoute, mfaRoute]),
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
