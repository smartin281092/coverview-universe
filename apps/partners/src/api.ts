import { createApiClient } from "@coverview/api-client";
import { createPartnerClient } from "@coverview/api-client/partner";
import { createRecommendationClient } from "@coverview/api-client/health-recommendation";
export const baseUrl =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? "http://127.0.0.1:4100" : window.location.origin);
export const api = createApiClient({ baseUrl });
export const partnerApi = createPartnerClient(baseUrl);
// The comparator's public catalogue, for the model a health offer is for.
export const recommendationApi = createRecommendationClient(baseUrl);
export const adminUrl =
  import.meta.env.VITE_ADMIN_URL ??
  (import.meta.env.DEV ? "http://127.0.0.1:4102" : "https://admin.coverview.ch");
export const walletUrl =
  import.meta.env.VITE_WALLET_URL ??
  (import.meta.env.DEV ? "http://127.0.0.1:4101" : "https://wallet.coverview.ch");
