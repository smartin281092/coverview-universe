import { ApiError, createApiClient } from "@coverview/api-client";
import { content } from "./content/fr/interface";

const api = createApiClient({
  baseUrl:
    import.meta.env.PUBLIC_API_URL ??
    (import.meta.env.DEV ? "http://127.0.0.1:4100" : window.location.origin),
});
const panel = document.querySelector<HTMLElement>("#account-status");
const message = document.querySelector<HTMLElement>("#account-message");
const errorMessage = document.querySelector<HTMLElement>("#account-error");
const login = document.querySelector<HTMLAnchorElement>("#account-login");
const retry = document.querySelector<HTMLButtonElement>("#account-retry");

if (panel && message && errorMessage && login && retry) {
  let activeRequest: AbortController | null = null;
  login.href = api.loginUrl("www");
  const clear = () => {
    activeRequest?.abort();
    panel.setAttribute("aria-busy", "true");
    message.textContent = content.account.loading;
    errorMessage.hidden = true;
    login.hidden = true;
    retry.hidden = true;
  };
  const refresh = async () => {
    clear();
    const request = new AbortController();
    activeRequest = request;
    try {
      const config = await api.identityConfig({ signal: request.signal });
      if (request.signal.aborted) return;
      if (!config.enabled) {
        message.textContent = content.account.unavailable;
        return;
      }
      try {
        await api.me({ signal: request.signal });
        if (request.signal.aborted) return;
        message.textContent = content.account.connected;
      } catch (error) {
        if (request.signal.aborted) return;
        if (!(error instanceof ApiError) || error.code !== "IDENTITY_UNAUTHENTICATED") throw error;
        message.textContent = content.account.disconnected;
        login.hidden = false;
        if (new URLSearchParams(window.location.search).get("authError") === "callback") {
          errorMessage.textContent = content.account.callbackError;
          errorMessage.hidden = false;
        }
      }
    } catch {
      if (request.signal.aborted) return;
      message.textContent = content.account.failed;
      retry.hidden = false;
    } finally {
      if (!request.signal.aborted) panel.setAttribute("aria-busy", "false");
    }
  };
  retry.addEventListener("click", () => {
    void refresh();
  });
  window.addEventListener("focus", () => {
    void refresh();
  });
  window.addEventListener("pageshow", () => {
    void refresh();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") clear();
    else void refresh();
  });
  window.addEventListener("pagehide", clear);
  void refresh();
}
