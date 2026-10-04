import { createPartnerClient } from "@coverview/api-client/partner";
export const partnerApi = createPartnerClient(
  import.meta.env.VITE_API_URL ??
    (import.meta.env.DEV ? "http://127.0.0.1:4100" : window.location.origin),
);
