import { createHash } from "node:crypto";
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

// Production adapter (16 October 2026): the Resend HTTP API, its key in the server environment
// only. The idempotency key is the message reference and its content: a retry of the same message
// is sent once, a renewed message (a new invitation link) is a new send. Errors carry the HTTP
// status only, never the recipient or the content.
export function createResendMailer(
  apiKey: string,
  from: string,
  endpoint = "https://api.resend.com/emails",
  timeoutMs = 10000,
): Mailer {
  return {
    async send(message) {
      const body = JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
        headers: { "X-CoverView-Reference": message.reference },
        tags: [{ name: "template", value: message.tag }],
      });
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          "idempotency-key": `${message.reference}:${createHash("sha256").update(body).digest("hex")}`,
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
      });
      await response.body?.cancel();
      if (!response.ok) throw new Error(`MAIL_REJECTED_${response.status}`);
    },
  };
}

// Mailpit in a local runtime, Resend once its key is configured, otherwise nothing: without an
// adapter nothing is sent or shown as sent.
export function createMailer(
  config: Pick<
    Environment,
    | "EXTERNAL_ADAPTER_MODE"
    | "MAILPIT_URL"
    | "DEPENDENCY_TIMEOUT_MS"
    | "RESEND_API_KEY"
    | "MAIL_FROM"
  >,
): Mailer | null {
  if (config.EXTERNAL_ADAPTER_MODE === "local")
    return createMailpitMailer(config.MAILPIT_URL, config.DEPENDENCY_TIMEOUT_MS);
  return config.RESEND_API_KEY ? createResendMailer(config.RESEND_API_KEY, config.MAIL_FROM) : null;
}
