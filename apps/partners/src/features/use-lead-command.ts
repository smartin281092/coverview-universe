import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePartner } from "./PartnerSession";
import { partnerApi } from "../api";
import type { LeadCommand } from "@coverview/contracts/partner";
export function useLeadCommand(id: string) {
  const session = usePartner(),
    client = useQueryClient(),
    attempt = useRef<{ payload: string; key: string } | null>(null);
  return useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: (command: LeadCommand) => {
      const payload = JSON.stringify(command);
      if (attempt.current?.payload !== payload)
        attempt.current = { payload, key: crypto.randomUUID() };
      return partnerApi.command(id, command, {
        csrfToken: session.identity.csrfToken,
        idempotencyKey: attempt.current.key,
      });
    },
    onSuccess: async (lead) => {
      attempt.current = null;
      client.setQueryData([...session.queryKey, "lead", id], lead);
      await client.invalidateQueries({ queryKey: session.queryKey });
    },
  });
}
