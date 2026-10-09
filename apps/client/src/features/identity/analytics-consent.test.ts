import { afterEach, expect, it, vi } from "vitest";
import {
  readConsent,
  sanitizeEvent,
  saveConsent,
  startAnalytics,
  withoutQuery,
} from "@coverview/ui/analytics";

// A browser-like storage for the consent record (the tests run without a DOM).
function useStorage() {
  const values = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  return values;
}
afterEach(() => {
  vi.unstubAllGlobals();
});

it("remembers the visitor's choice, and asks again for an unknown or older record", () => {
  const values = useStorage();
  expect(readConsent()).toBeNull();
  saveConsent(false);
  expect(readConsent()).toBe(false);
  saveConsent(true);
  expect(readConsent()).toBe(true);
  values.set("cv-analytics-consent", JSON.stringify({ version: 0, analytics: true }));
  expect(readConsent()).toBeNull();
  values.set("cv-analytics-consent", "not json");
  expect(readConsent()).toBeNull();
});

it("keeps only the path of the addresses sent with an event", () => {
  expect(withoutQuery("https://coverview.ch/comparateur?annee=1980#resultats")).toBe(
    "https://coverview.ch/comparateur",
  );
  expect(withoutQuery("/offers")).toBe("/offers");
  expect(
    sanitizeEvent({
      event: "$pageview",
      properties: {
        $current_url: "http://127.0.0.1:4101/offers?profile=prf_1&lead=lead_2",
        $referrer: "https://example.org/search?q=assurance",
        $pathname: "/offers",
      },
    }),
  ).toEqual({
    event: "$pageview",
    properties: {
      $current_url: "http://127.0.0.1:4101/offers",
      $referrer: "https://example.org/search",
      $pathname: "/offers",
    },
  });
  expect(sanitizeEvent(null)).toBeNull();
});

it("loads nothing without a project key", async () => {
  await expect(
    startAnalytics({ key: undefined, replay: true, singlePage: true }),
  ).resolves.toBeNull();
});
