import { z } from "zod";

const instant = z.iso.datetime({ offset: true });

// Live invalidation events (RT-09, RT-16): minimal and versioned. They only say that something
// changed; clients read the current state through the API with their own rights.
export const liveLeadChangedSchema = z.object({ leadId: z.string().min(1).max(100), at: instant });
export const liveNotificationsChangedSchema = z.object({ at: instant });
export const liveEvents = {
  leadChanged: "lead.changed.v1",
  notificationsChanged: "notifications.changed.v1",
} as const;
