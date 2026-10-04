import { useQuery } from "@tanstack/react-query";
import { usePartner } from "./PartnerSession";
import { partnerApi } from "../api";
export function useWork() {
  const { queryKey } = usePartner();
  return useQuery({
    queryKey: [...queryKey, "work"],
    queryFn: ({ signal }) => partnerApi.work(signal),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 15000,
  });
}
