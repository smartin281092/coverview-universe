// Consent and audience measurement (9 October 2026), imported only by the site, Wallet and
// Partner: Admin never loads PostHog.
export {
  consentOpenEvent,
  identifyAnalytics,
  openConsentSettings,
  readConsent,
  sanitizeEvent,
  saveConsent,
  startAnalytics,
  stopAnalytics,
  withoutQuery,
  type AnalyticsConfig,
} from "./analytics";
export { ConsentBanner, type ConsentTexts } from "./ConsentBanner";
