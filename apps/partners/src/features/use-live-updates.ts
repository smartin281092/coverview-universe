import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { liveEvents, liveLeadChangedSchema } from "@coverview/contracts/partner-live";
import { baseUrl } from "../api";

const lists = ["leads", "work", "dashboard", "dashboard-goals"];

// Live invalidation (RT-14, RT-16): an event only says what changed; queries re-read through the
// API with the reader's own rights. After a reconnection everything under the session is
// refreshed, since events may have been missed. Periodic refetching remains the safety net.
export function useLiveUpdates(queryKey: string[], enabled: boolean) {
  const cache = useQueryClient(),
    scope = queryKey.join("\u0000");
  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;
    const root = scope.split("\u0000");
    const within = (key: readonly unknown[]) => root.every((part, index) => key[index] === part);
    const source = new EventSource(new URL("/partner/live", baseUrl), { withCredentials: true });
    let opened = false;
    source.onopen = () => {
      if (opened) void cache.invalidateQueries({ queryKey: root });
      opened = true;
    };
    source.addEventListener(liveEvents.leadChanged, (message) => {
      let data: unknown;
      try {
        data = JSON.parse(String(message.data));
      } catch {
        return;
      }
      const parsed = liveLeadChangedSchema.safeParse(data);
      if (!parsed.success) return;
      void cache.invalidateQueries({
        predicate: ({ queryKey: key }) =>
          within(key) &&
          (key.includes(parsed.data.leadId) || lists.some((name) => key.includes(name))),
      });
    });
    source.addEventListener(liveEvents.notificationsChanged, () => {
      void cache.invalidateQueries({ queryKey: [...root, "notifications"] });
    });
    return () => source.close();
  }, [cache, enabled, scope]);
}
