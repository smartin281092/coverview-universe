import type { AnalyticsConfig } from "@coverview/ui/consent";

/** PostHog in Partner (9 October 2026): after consent only, sessions recorded fully masked. */
export const analytics: AnalyticsConfig = {
  key: import.meta.env.VITE_POSTHOG_KEY,
  host: import.meta.env.VITE_POSTHOG_HOST,
  replay: true,
  singlePage: true,
};
