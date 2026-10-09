import { createApiClient } from "@coverview/api-client";

// The header's account links (9 October 2026), from the same environment as the comparator's.
export function siteLinks(origin: string) {
  const apiUrl =
    import.meta.env.PUBLIC_API_URL ?? (import.meta.env.DEV ? "http://127.0.0.1:4100" : origin);
  const walletUrl =
    import.meta.env.PUBLIC_WALLET_URL ??
    (import.meta.env.DEV ? "http://127.0.0.1:4101" : undefined);
  return {
    requestsEnabled: import.meta.env.PUBLIC_REQUESTS_ENABLED !== "false",
    loginUrl: createApiClient({ baseUrl: apiUrl }).loginUrl("wallet"),
    accountUrl: walletUrl ? `${walletUrl}/profile` : "/account",
  };
}
