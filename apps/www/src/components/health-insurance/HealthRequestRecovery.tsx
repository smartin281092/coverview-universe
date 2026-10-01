import { useRef, useState } from "react";
import type { createInsuranceClient } from "@coverview/api-client/insurance-requests";
import { offerCopy as copy } from "../../content/fr/insurance-requests";
import { HealthDialog } from "./HealthDialog";
export function HealthRequestRecovery({
  api,
  requestId,
}: {
  api: ReturnType<typeof createInsuranceClient>;
  requestId: string;
}) {
  const [open, setOpen] = useState(false),
    [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [pending, setPending] = useState(false),
    [sent, setSent] = useState(false),
    [verified, setVerified] = useState(false),
    [error, setError] = useState("");
  const draft = useRef<string | null>(null);
  const options = useRef<{ csrfToken: string; idempotencyKey: string } | null>(null);
  async function send() {
    setPending(true);
    setError("");
    try {
      const browser = await api.browser();
      options.current = { csrfToken: browser.csrfToken, idempotencyKey: crypto.randomUUID() };
      const value = await api.email(email, options.current);
      draft.current = value.id;
      if (value.verified) {
        await api.claim(requestId, { ...options.current, idempotencyKey: crypto.randomUUID() });
        window.location.assign(`${browser.walletUrl}/insurance-requests/${requestId}`);
        return;
      }
      setSent(value.codeStatus === "sent");
      if (value.codeStatus !== "sent") setError(copy.codeUnavailable);
    } catch {
      setError(copy.error);
    } finally {
      setPending(false);
    }
  }
  async function verify() {
    if (!draft.current || !options.current) return;
    setPending(true);
    setError("");
    let proof = verified;
    try {
      // A lost response may already have established the session. Claim first avoids consuming an OTP twice.
      try {
        await api.claim(requestId, { ...options.current, idempotencyKey: crypto.randomUUID() });
        proof = true;
      } catch {
        if (!proof) {
          await api.verify(draft.current, code, {
            ...options.current,
            idempotencyKey: crypto.randomUUID(),
          });
          proof = true;
          setVerified(true);
        }
        await api.claim(requestId, { ...options.current, idempotencyKey: crypto.randomUUID() });
      }
      const browser = await api.browser();
      window.location.assign(`${browser.walletUrl}/insurance-requests/${requestId}`);
    } catch {
      setError(proof ? copy.error : copy.invalidCode);
      setPending(false);
    }
  }
  return (
    <div className="hi-checkout-otp">
      <button className="hi-secondary" onClick={() => setOpen(true)}>
        {copy.recover}
      </button>
      <HealthDialog
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        title={copy.recover}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void (sent ? verify() : send());
          }}
        >
          <p className="hi-small">{copy.recoverHint}</p>
          <label className="hi-field">
            {copy.email}
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              disabled={sent || pending}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          {sent && (
            <label className="hi-field">
              {copy.code}
              <input
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                pattern="[0-9]{6}"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              />
            </label>
          )}
          {error && (
            <p role="alert" className="hi-checkout-error">
              {error}
            </p>
          )}
          <button className="hi-primary" disabled={pending}>
            {pending ? copy.working : sent ? copy.verify : copy.continue}
          </button>
          {sent && !verified && (
            <>
              <button
                type="button"
                className="hi-text-link"
                disabled={pending}
                onClick={() => void send()}
              >
                {copy.resend}
              </button>
              <button
                type="button"
                className="hi-text-link"
                disabled={pending}
                onClick={() => {
                  setSent(false);
                  setCode("");
                  setError("");
                }}
              >
                {copy.changeEmail}
              </button>
            </>
          )}
        </form>
      </HealthDialog>
    </div>
  );
}
