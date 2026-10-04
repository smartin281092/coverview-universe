import { createRecommendationClient } from "@coverview/api-client/health-recommendation";
export const recommendationApi = createRecommendationClient(
  import.meta.env.VITE_API_URL ??
    (import.meta.env.DEV ? "http://127.0.0.1:4100" : window.location.origin),
);
