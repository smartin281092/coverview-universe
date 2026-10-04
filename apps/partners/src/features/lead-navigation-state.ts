import type { LeadListQuery } from "@coverview/contracts/partner";
export type LeadNavigationSearch = Partial<LeadListQuery> & { layout?: "list" | "kanban" };
export function publicLeadSearch(value: LeadNavigationSearch): LeadNavigationSearch {
  const { q, ...rest } = value;
  void q;
  return rest;
}
