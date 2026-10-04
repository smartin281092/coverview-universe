import { createInsuranceClient } from "@coverview/api-client/insurance-requests";
export const insuranceApi = createInsuranceClient(import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://127.0.0.1:4100" : window.location.origin));
