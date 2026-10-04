import {
  adminOverviewQuerySchema,
  adminOverviewSchema,
  type AdminOverviewQuery,
} from "@coverview/contracts/partner-overview";
import type { PartnerRequest } from "./partner-transport.js";
export function createOverviewClient(request: PartnerRequest) {
  const search = (value: Record<string, string | undefined>) =>
    new URLSearchParams(
      Object.entries(value).filter((entry): entry is [string, string] => entry[1] !== undefined),
    ).toString();
  return {
    adminOverview: (query: AdminOverviewQuery, signal?: AbortSignal) =>
      request(
        `/admin/partner/overview?${search(adminOverviewQuerySchema.parse(query))}`,
        adminOverviewSchema,
        signal,
      ),
  };
}
