import { useEffect, useRef, useState } from "react";
import { hyperionCopy } from "../../content/fr/hyperion";
import { HealthGradient } from "../health-insurance/HealthGradient";
import { HYPERION, formatFrancs } from "./hyperion-model";
import type { HyperionConfig } from "./hyperion-store";

const copy = hyperionCopy.order;
const buy = hyperionCopy.buy;
type Fields = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  website: string;
};
type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; reference: string; firstName: string; phone: string }
  | { kind: "error"; message: string };
const empty: Fields = { firstName: "", lastName: "", email: "", phone: "", website: "" };
// Same bounds as the public contract (@coverview/contracts/partner-intake).
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const phonePattern = /^\+?[\d\s()./-]{6,40}$/u;
const interpolate = (template: string, values: Record<string, string>) =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    template,
  );

function uuid() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * The order (4 November 2026): the page's parameters and the visitor's contact details go to the
 * API's public order route, the one horizon3.finance uses, with the source "coverview". One request
 * id per content: a retry after a network error resends the same order, which the API keeps once.
 */
export function HyperionOrderDialog({
  open,
  onClose,
  config,
  apiUrl,
}: {
  open: boolean;
  onClose: () => void;
  config: HyperionConfig;
  apiUrl: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const firstField = useRef<HTMLInputElement>(null);
  const request = useRef<{ key: string; id: string } | null>(null);
  const [fields, setFields] = useState<Fields>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const node = dialog.current;
    node?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstField.current?.focus();
    return () => {
      node?.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement) previous.focus({ preventScroll: true });
    };
  }, [open]);

  const set = (key: keyof Fields) => (event: { target: { value: string } }) => {
    setFields((value) => ({ ...value, [key]: event.target.value }));
    setErrors((value) => ({ ...value, [key]: undefined }));
  };
  const validate = () => {
    const next: Partial<Record<keyof Fields, string>> = {};
    if (!fields.firstName.trim()) next.firstName = copy.required;
    if (!fields.lastName.trim()) next.lastName = copy.required;
    if (!fields.email.trim()) next.email = copy.required;
    else if (!emailPattern.test(fields.email.trim()) || fields.email.trim().length > 254)
      next.email = copy.invalidEmail;
    if (!fields.phone.trim()) next.phone = copy.required;
    else if (!phonePattern.test(fields.phone.trim())) next.phone = copy.invalidPhone;
    setErrors(next);
    return !Object.keys(next).length;
  };

  const submit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (status.kind === "submitting" || !validate()) return;
    const body = {
      source: "coverview",
      firstName: fields.firstName.trim(),
      lastName: fields.lastName.trim(),
      email: fields.email.trim(),
      phone: fields.phone.trim(),
      birthYear: config.birthYear,
      investment: config.investment,
      frequency: config.frequency,
      initialCapital: config.initialCapital > 0 ? config.initialCapital : null,
      productId: HYPERION.productId,
      productName: HYPERION.name,
      strategyId: HYPERION.strategyId,
      company: HYPERION.company,
    };
    const key = JSON.stringify(body);
    if (request.current?.key !== key) request.current = { key, id: uuid() };
    const reference = request.current.id;
    const done = () =>
      setStatus({ kind: "success", reference, firstName: body.firstName, phone: body.phone });
    // MKT-08: a filled honeypot is a robot; nothing is sent.
    if (fields.website) {
      done();
      return;
    }
    setStatus({ kind: "submitting" });
    try {
      const response = await fetch(`${apiUrl}/api/public/h3/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, requestId: reference }),
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) done();
      else if (response.status === 429)
        setStatus({ kind: "error", message: copy.errors.rateLimited });
      else if ([400, 413, 422].includes(response.status))
        setStatus({ kind: "error", message: copy.errors.invalid });
      else setStatus({ kind: "error", message: copy.errors.unavailable });
    } catch {
      setStatus({ kind: "error", message: copy.errors.network });
    }
  };

  const field = (
    key: Exclude<keyof Fields, "website">,
    label: string,
    type = "text",
    hint?: string,
  ) => (
    <div className="hp-form-field">
      <label htmlFor={`hp-order-${key}`}>{label}</label>
      <input
        ref={key === "firstName" ? firstField : undefined}
        id={`hp-order-${key}`}
        name={key}
        type={type}
        inputMode={type === "tel" ? "tel" : type === "email" ? "email" : undefined}
        autoComplete={
          key === "firstName"
            ? "given-name"
            : key === "lastName"
              ? "family-name"
              : key === "email"
                ? "email"
                : "tel"
        }
        value={fields[key]}
        onChange={set(key)}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={
          errors[key] ? `hp-order-${key}-error` : hint ? `hp-order-${key}-hint` : undefined
        }
        required
      />
      {hint && !errors[key] && (
        <small id={`hp-order-${key}-hint`} className="hp-form-hint">
          {hint}
        </small>
      )}
      {errors[key] && (
        <small id={`hp-order-${key}-error`} className="hp-form-error" role="alert">
          {errors[key]}
        </small>
      )}
    </div>
  );
  const unit = config.frequency === "annual" ? buy.perYear : buy.perMonth;

  return (
    <dialog
      ref={dialog}
      className="lp-dialog hp-order"
      aria-labelledby="hp-order-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="hp-order-inner">
        <div className="dialog-top">
          <p className="lp-eyebrow">{hyperionCopy.hero.eyebrow}</p>
          <button type="button" className="dialog-close" onClick={onClose} aria-label={copy.close}>
            ×
          </button>
        </div>
        {status.kind === "success" ? (
          <div className="hp-order-success" role="status">
            <span className="hp-success-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
                <path
                  d="m5 12.5 4.5 4.5L19 7"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <h2 id="hp-order-title">{copy.success.title}</h2>
            <p>
              {interpolate(copy.success.text, { firstName: status.firstName, phone: status.phone })}
            </p>
            <p className="hp-order-reference">
              {interpolate(copy.success.reference, { reference: status.reference })}
            </p>
            <button type="button" className="lp-button" onClick={onClose}>
              {copy.success.close}
            </button>
          </div>
        ) : (
          <form className="hp-order-form" onSubmit={(event) => void submit(event)} noValidate>
            <h2 id="hp-order-title">{copy.title}</h2>
            <p className="hp-order-intro">{copy.intro}</p>
            <dl className="hp-order-summary" aria-label={copy.summary.title}>
              <div>
                <dt>{copy.summary.investment}</dt>
                <dd>{`${formatFrancs(config.investment)} ${unit}`}</dd>
              </div>
              <div>
                <dt>{copy.summary.frequency}</dt>
                <dd>{config.frequency === "annual" ? buy.annual : buy.monthly}</dd>
              </div>
              <div>
                <dt>{copy.summary.birthYear}</dt>
                <dd>{config.birthYear}</dd>
              </div>
              <div>
                <dt>{copy.summary.initialCapital}</dt>
                <dd>
                  {config.initialCapital > 0
                    ? `${formatFrancs(config.initialCapital)} ${buy.currency}`
                    : copy.summary.none}
                </dd>
              </div>
            </dl>
            <div className="hp-form-grid">
              {field("firstName", copy.firstName)}
              {field("lastName", copy.lastName)}
              {field("email", copy.email, "email")}
              {field("phone", copy.phone, "tel", copy.phoneHint)}
            </div>
            <div className="hp-honeypot" aria-hidden="true">
              <label htmlFor="hp-order-website">Site web</label>
              <input
                id="hp-order-website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={fields.website}
                onChange={set("website")}
              />
            </div>
            {status.kind === "error" && (
              <p className="hp-form-error hp-form-status" role="alert">
                {status.message}
              </p>
            )}
            <div className="hp-order-actions">
              <button
                type="submit"
                className="lp-button hp-cta"
                disabled={status.kind === "submitting"}
                aria-busy={status.kind === "submitting"}
              >
                <HealthGradient />
                {status.kind === "submitting"
                  ? copy.submitting
                  : status.kind === "error"
                    ? copy.retry
                    : copy.submit}
              </button>
              <a href="/informations-demande-assurance" className="hp-order-legal">
                {copy.legal}
              </a>
            </div>
            <p className="hp-order-privacy">{copy.privacy}</p>
          </form>
        )}
      </div>
    </dialog>
  );
}
