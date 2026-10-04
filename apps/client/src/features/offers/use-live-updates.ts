import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { IdentityMe } from "@coverview/api-client";
import { liveEvents, liveLeadChangedSchema } from "@coverview/contracts/partner-live";
import { partnerApiBaseUrl } from "../../partner-api";

// Wallet side of the live invalidation (RT-14, RT-16), opened only on pages showing requests: the
// owner's requests and notices are re-read through the API when a professional changes them, and
// everything is refreshed after a reconnection. Periodic refetching remains the safety net.
export function useWalletLiveUpdates(identity: IdentityMe) {
  const cache = useQueryClient(),
    userId = identity.user.id,
    sessionId = identity.session.id;
  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const root = ["private", userId, sessionId];
    const under = (key: readonly unknown[], name: string) =>
      root.every((part, index) => key[index] === part) && key[root.length] === name;
    const refresh = (name: string) =>
      void cache.invalidateQueries({ predicate: ({ queryKey }) => under(queryKey, name) });
    const source = new EventSource(new URL("/wallet/live", partnerApiBaseUrl), {
      withCredentials: true,
    });
    let opened = false;
    source.onopen = () => {
      if (opened) {
        refresh("wallet-leads");
        refresh("lead-notifications");
      }
      opened = true;
    };
    source.addEventListener(liveEvents.leadChanged, (message) => {
      let data: unknown;
      try {
        data = JSON.parse(String(message.data));
      } catch {
        return;
      }
      if (liveLeadChangedSchema.safeParse(data).success) refresh("wallet-leads");
    });
    source.addEventListener(liveEvents.notificationsChanged, () => refresh("lead-notifications"));
    return () => source.close();
  }, [cache, userId, sessionId]);
}
