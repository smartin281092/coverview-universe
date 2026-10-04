import { useQuery } from "@tanstack/react-query";
import type { LeadListQuery } from "@coverview/contracts/partner";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
export function useLeads(filters: Partial<LeadListQuery> = { view: "all" }) {
  const session = usePartner();
  return useQuery({
    queryKey: [...session.queryKey, "leads", filters],
    queryFn: ({ signal }) => partnerApi.list(filters, signal),
    enabled: session.context.operational,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });
}
