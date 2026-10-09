import { createApiClient } from "@coverview/api-client";
import { createRecommendationClient } from "@coverview/api-client/health-recommendation";

const baseUrl =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? "http://127.0.0.1:4100" : window.location.origin);
export const api = createApiClient({ baseUrl });
// The comparator's public catalogue (9 October 2026): the facts of the model an offer names.
export const recommendationApi = createRecommendationClient(baseUrl);
