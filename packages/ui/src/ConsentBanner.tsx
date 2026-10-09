import { useEffect, useId, useState } from "react";
import { Button } from "./Button";
import {
  consentOpenEvent,
  readConsent,
  saveConsent,
  startAnalytics,
  stopAnalytics,
  type AnalyticsConfig,
} from "./analytics";

export type ConsentTexts = { title: string; message: string; accept: string; refuse: string };

/**
 * Asks once per surface whether PostHog may measure the visit (9 October 2026, MKT-09): nothing
 * is loaded before a yes, refusing is as easy as accepting, and "Cookies" asks again.
 */
export function ConsentBanner({ config, texts }: { config: AnalyticsConfig; texts: ConsentTexts }) {
  const title = useId();
  const [open, setOpen] = useState(false);
  const { key, host, replay, singlePage } = config;
  useEffect(() => {
    if (!key) return;
    const choice = readConsent();
    if (choice) void startAnalytics({ key, host, replay, singlePage });
    setOpen(choice === null);
    const reopen = () => setOpen(true);
    window.addEventListener(consentOpenEvent, reopen);
    return () => window.removeEventListener(consentOpenEvent, reopen);
  }, [key, host, replay, singlePage]);
  if (!open) return null;
  const decide = (analytics: boolean) => {
    saveConsent(analytics);
    if (analytics) void startAnalytics({ key, host, replay, singlePage });
    else stopAnalytics();
    setOpen(false);
  };
  return (
    <section
      aria-labelledby={title}
      className="fixed inset-x-4 bottom-[var(--cv-consent-offset,1rem)] z-50 mx-auto max-w-md space-y-3 rounded-2xl border border-border bg-background p-5 text-sm shadow-xl sm:right-auto sm:left-6 sm:mx-0"
    >
      <h2 id={title} className="font-medium">
        {texts.title}
      </h2>
      <p className="text-muted-foreground">{texts.message}</p>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" className="flex-1" onClick={() => decide(false)}>
          {texts.refuse}
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => decide(true)}>
          {texts.accept}
        </Button>
      </div>
    </section>
  );
}
