import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import "./i18n";
import "./styles.css";
import { router } from "./router";

focusManager.setEventListener((onFocus) => {
  const refresh = () => {
    onFocus();
  };
  window.addEventListener("focus", refresh);
  window.addEventListener("visibilitychange", refresh);
  window.addEventListener("pageshow", refresh);
  return () => {
    window.removeEventListener("focus", refresh);
    window.removeEventListener("visibilitychange", refresh);
    window.removeEventListener("pageshow", refresh);
  };
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, gcTime: 60_000, retry: false, refetchOnWindowFocus: true },
  },
});
const container = document.getElementById("root");
if (!container) throw new Error("Missing application root");
createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
