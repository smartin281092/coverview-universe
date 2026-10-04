import { createApiClient } from "@coverview/api-client";

export const api = createApiClient({
  baseUrl:
    import.meta.env.VITE_API_URL ??
    (import.meta.env.DEV ? "http://127.0.0.1:4100" : window.location.origin),
});

