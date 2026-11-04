import { createPensionSearchClient } from "@coverview/api-client/pension-searches";
export const pensionApi = createPensionSearchClient(
  import.meta.env.VITE_API_URL ??
    (import.meta.env.DEV ? "http://127.0.0.1:4100" : window.location.origin),
);
