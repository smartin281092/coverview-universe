import type { PostHog } from "posthog-js";

/** What a surface asks of PostHog (9 October 2026). Admin never uses it. */
export type AnalyticsConfig = {
  /** PostHog project key: without it, neither the banner nor the SDK appears. */
  key: string | undefined;
  /** Ingestion host; PostHog EU by default. */
  host?: string | undefined;
  /** Session recording, with every text and every input masked (Wallet and Partner). */
  replay: boolean;
  /** A single-page app records a page view on each history change. */
  singlePage: boolean;
};

const storageKey = "cv-analytics-consent";
// Raising the version asks everyone again, e.g. when what is measured changes.
const consentVersion = 1;
export const consentOpenEvent = "cv:consent-open";

/** The visitor's choice on this surface: true, false, or null when not asked yet. */
export function readConsent(): boolean | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const choice = JSON.parse(raw) as { version?: unknown; analytics?: unknown };
    return choice.version === consentVersion && typeof choice.analytics === "boolean"
      ? choice.analytics
      : null;
  } catch {
    return null;
  }
}

export function saveConsent(analytics: boolean) {
  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ version: consentVersion, analytics, at: new Date().toISOString() }),
    );
  } catch {
    // Without storage the choice lasts for this page only.
  }
}

/** Opens the choice again, from a "Cookies" link. */
export function openConsentSettings() {
  window.dispatchEvent(new Event(consentOpenEvent));
}

// Query strings and fragments can carry what a visitor typed: events keep the path only.
const addresses = ["$current_url", "$referrer", "$initial_referrer", "$prev_pageview_pathname"];
export function withoutQuery(value: unknown) {
  if (typeof value !== "string") return value;
  const cut = value.search(/[?#]/u);
  return cut < 0 ? value : value.slice(0, cut);
}
export function sanitizeEvent<T extends { properties?: Record<string, unknown> }>(event: T | null) {
  if (!event?.properties) return event;
  const properties = { ...event.properties };
  for (const name of addresses)
    if (name in properties) properties[name] = withoutQuery(properties[name]);
  return { ...event, properties };
}

let client: PostHog | null = null;
let loading: Promise<PostHog | null> | null = null;
// The visitor's answer on this page, the signed-in person, and the person PostHog follows.
let consented = false;
let person: string | null = null;
let followed: string | null = null;

/**
 * Loads and starts PostHog after an explicit yes. Nothing of PostHog is fetched before: the SDK
 * is imported here, at the moment of consent.
 */
export function startAnalytics(config: AnalyticsConfig): Promise<PostHog | null> {
  const { key } = config;
  if (!key) return Promise.resolve(null);
  consented = true;
  if (client) {
    follow(client);
    if (config.replay) client.startSessionRecording();
    return Promise.resolve(client);
  }
  loading ??= import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: config.host || "https://eu.i.posthog.com",
        ui_host: "https://eu.posthog.com",
        // Off until the yes, and off again after a reset; a no also empties PostHog's cookies
        // and storage.
        opt_out_capturing_by_default: true,
        opt_out_persistence_by_default: true,
        person_profiles: "identified_only",
        capture_pageview: config.singlePage ? "history_change" : true,
        capture_pageleave: true,
        // Clicks are kept without what the elements say or carry (LAUNCH-04: no personal data).
        autocapture: true,
        mask_all_text: true,
        mask_all_element_attributes: true,
        disable_session_recording: !config.replay,
        session_recording: { maskAllInputs: true, maskTextSelector: "*" },
        disable_surveys: true,
        before_send: sanitizeEvent,
      });
      client = posthog;
      if (consented) follow(posthog);
      return posthog;
    })
    .catch(() => {
      loading = null;
      return null;
    });
  return loading;
}

/** A refusal or a withdrawal: capture and recording stop, PostHog's cookies and storage are emptied. */
export function stopAnalytics() {
  consented = false;
  if (!client) return;
  client.stopSessionRecording();
  client.opt_out_capturing();
}

/** The signed-in person, by their opaque identifier only; null on sign-out. */
export function identifyAnalytics(id: string | null) {
  person = id;
  if (client && consented) follow(client);
}

// Brings PostHog in line with the yes and the signed-in person, by an opaque id only.
function follow(posthog: PostHog) {
  // Another person, or none: the previous person's identifiers go first.
  if (followed && person !== followed) posthog.reset();
  // reset() also forgets PostHog's own consent: the yes is applied after it, never before.
  if (posthog.has_opted_out_capturing()) posthog.opt_in_capturing({ captureEventName: false });
  if (person && person !== followed) posthog.identify(person);
  followed = person;
}
