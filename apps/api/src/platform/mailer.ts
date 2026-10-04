import type { Environment } from "./config.js";

// Single sending interface (MAIL-02): callers never know which adapter is behind it.
export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  // Template version, for filtering and measurement; never personal data.
  tag: string;
  // Stable per logical message, so a resend can be recognized.
  reference: string;
};
export type Mailer = { send(message: MailMessage): Promise<void> };

// Local adapter: the Mailpit HTTP API. The configuration only allows it on loopback, in a local,
// non-production runtime. Errors carry the HTTP status only, never the recipient or the content.
export function createMailpitMailer(baseUrl: string, timeoutMs: number): Mailer {
  const endpoint = new URL("/api/v1/send", baseUrl);
  return {
    async send(message) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          From: { Email: "no-reply@coverview.local", Name: "CoverView" },
          To: [{ Email: message.to }],
          Subject: message.subject,
          Text: message.text,
          HTML: message.html,
          Tags: [message.tag],
          Headers: { "X-CoverView-Reference": message.reference },
        }),
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
      });
      await response.body?.cancel();
      if (!response.ok) throw new Error(`MAIL_REJECTED_${response.status}`);
    },
  };
}

// No production provider is configured yet: without an adapter nothing is sent or shown as sent.
export function createMailer(
  config: Pick<Environment, "EXTERNAL_ADAPTER_MODE" | "MAILPIT_URL" | "DEPENDENCY_TIMEOUT_MS">,
): Mailer | null {
  return config.EXTERNAL_ADAPTER_MODE === "local"
    ? createMailpitMailer(config.MAILPIT_URL, config.DEPENDENCY_TIMEOUT_MS)
    : null;
}
