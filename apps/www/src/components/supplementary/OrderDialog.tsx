import { useId, useRef, useState } from "react";
import {
  SupplementaryApiError,
  type SupplementaryPrice,
  type SupplementaryProduct,
} from "@coverview/api-client/supplementary-insurance";
import { supplementaryCopy as copy } from "../../content/fr/supplementary";
import { HealthGradient } from "../health-insurance/HealthGradient";
import { ProfilePills } from "./ProfilePills";
import { ScDialog } from "./ScDialog";
import { ScInsurerLogo } from "./ScIdentity";
import {
  effectiveProfile,
  interpolate,
  rowAmount,
  rowKey,
  rowLabel,
  type CatalogIndex,
  type Profile,
} from "./supplementary-model";
import type { SupplementaryApi } from "./use-supplementary";

const text = copy.order;
type Fields = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  message: string;
  website: string;
};
type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; reference: string; firstName: string; phone: string }
  | { kind: "error"; message: string };
const empty: Fields = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  message: "",
  website: "",
};
// Same bounds as the public contract (supplementaryOrderInputSchema).
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const phonePattern = /^\+?[\d\s()./-]{6,40}$/u;

function uuid() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * The order of a product (user request, 19 November 2026), modelled on Hyperion's order dialog:
 * the product and the price profile on top, the contact details, then the API notifies CoverView
 * by email. One request id per content: a retry of the same order resends the same id, which
 * the server keeps once.
 */
export function OrderDialog({
  api,
  index,
  product,
  row,
  rows,
  profile,
  onProfile,
  onClose,
}: {
  api: SupplementaryApi;
  index: CatalogIndex;
  product: SupplementaryProduct;
  // The formula chosen in the panel; the current quote's same formula gives its price.
  row: SupplementaryPrice | null;
  rows: SupplementaryPrice[];
  profile: Profile;
  onProfile: (profile: Profile) => void;
  onClose: () => void;
}) {
  const id = useId();
  const request = useRef<{ key: string; id: string } | null>(null);
  const [fields, setFields] = useState<Fields>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const insurer = index.insurers.get(product.insurer);
  const current = row ? rows.find((item) => rowKey(item) === rowKey(row)) : undefined;

  const set = (key: keyof Fields) => (event: { target: { value: string } }) => {
    setFields((value) => ({ ...value, [key]: event.target.value }));
    setErrors((value) => ({ ...value, [key]: undefined }));
  };
  const validate = () => {
    const next: Partial<Record<keyof Fields, string>> = {};
    if (!fields.firstName.trim()) next.firstName = text.required;
    if (!fields.lastName.trim()) next.lastName = text.required;
    if (!fields.email.trim()) next.email = text.required;
    else if (!emailPattern.test(fields.email.trim()) || fields.email.trim().length > 254)
      next.email = text.invalidEmail;
    if (!fields.phone.trim()) next.phone = text.required;
    else if (!phonePattern.test(fields.phone.trim())) next.phone = text.invalidPhone;
    setErrors(next);
    return !Object.keys(next).length;
  };
  const submit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (status.kind === "submitting" || !validate()) return;
    const used = effectiveProfile(profile);
    const body = {
      productKey: product.key,
      variant: row?.variant ?? "",
      option: row?.option ?? "",
      firstName: fields.firstName.trim(),
      lastName: fields.lastName.trim(),
      email: fields.email.trim(),
      phone: fields.phone.trim(),
      birthYear: used.birthYear,
      sex: used.sex,
      canton: used.canton,
      message: fields.message.trim().slice(0, 1000) || null,
      website: "",
    };
    const key = JSON.stringify(body);
    if (request.current?.key !== key) request.current = { key, id: uuid() };
    const requestId = request.current.id;
    // MKT-08: a filled honeypot is a robot; nothing is sent.
    if (fields.website) {
      setStatus({
        kind: "success",
        reference: requestId.slice(0, 8),
        firstName: body.firstName,
        phone: body.phone,
      });
      return;
    }
    setStatus({ kind: "submitting" });
    try {
      const receipt = await api.order({ ...body, requestId });
      setStatus({
        kind: "success",
        reference: receipt.reference,
        firstName: body.firstName,
        phone: body.phone,
      });
    } catch (error) {
      const code = error instanceof SupplementaryApiError ? error.status : null;
      setStatus({
        kind: "error",
        message:
          code === 429
            ? text.errors.rateLimited
            : code !== null && [400, 409, 413, 422].includes(code)
              ? text.errors.invalid
              : error instanceof Error && error.name === "ZodError"
                ? text.errors.invalid
                : code !== null
                  ? text.errors.unavailable
                  : text.errors.network,
      });
    }
  };

  const field = (
    key: "firstName" | "lastName" | "email" | "phone",
    label: string,
    type: "text" | "email" | "tel",
    autoComplete: string,
    hint?: string,
  ) => (
    <div className="sc-form-field">
      <label htmlFor={`${id}-${key}`}>{label}</label>
      <input
        id={`${id}-${key}`}
        name={key}
        type={type}
        inputMode={type === "tel" ? "tel" : type === "email" ? "email" : undefined}
        autoComplete={autoComplete}
        value={fields[key]}
        onChange={set(key)}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={
          errors[key] ? `${id}-${key}-error` : hint ? `${id}-${key}-hint` : undefined
        }
        required
      />
      {hint && !errors[key] && (
        <small id={`${id}-${key}-hint`} className="sc-form-hint">
          {hint}
        </small>
      )}
      {errors[key] && (
        <small id={`${id}-${key}-error`} className="sc-form-error" role="alert">
          {errors[key]}
        </small>
      )}
    </div>
  );

  return (
    <ScDialog open onClose={onClose} title={text.title} className="sc-order">
      {status.kind === "success" ? (
        <div className="sc-order-success" role="status">
          <span className="sc-success-mark" aria-hidden="true">
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
          <h3>{text.success.title}</h3>
          <p>
            {interpolate(text.success.text, {
              firstName: status.firstName,
              phone: status.phone,
              product: product.name,
            })}
          </p>
          <p className="sc-order-reference">
            {interpolate(text.success.reference, { reference: status.reference })}
          </p>
          <button type="button" className="hi-secondary" onClick={onClose}>
            {text.success.close}
          </button>
        </div>
      ) : (
        <form className="sc-order-form" onSubmit={(event) => void submit(event)} noValidate>
          <p className="hi-detail-intro">{text.intro}</p>
          <section className="sc-order-product" aria-label={text.product}>
            <ScInsurerLogo insurer={insurer} labelled />
            <div>
              <p className="sc-order-insurer">{insurer?.name}</p>
              <p className="sc-order-name">{product.name}</p>
              {row && <p className="sc-order-variant">{rowLabel(row)}</p>}
            </div>
            <p className="sc-order-price">
              {current ? (
                <>
                  <strong>{rowAmount(current)}</strong>
                  <span>
                    {copy.currency} {copy.perMonth}
                  </span>
                </>
              ) : (
                <strong>{copy.price.onRequest}</strong>
              )}
            </p>
          </section>
          <fieldset className="sc-order-profile">
            <legend>{text.profile}</legend>
            <ProfilePills
              prefix={`${id}-profile`}
              profile={profile}
              onChange={onProfile}
              localities={index.catalog.localities}
              tone="light"
              title={false}
              layout="rows"
            />
            <small className="sc-form-hint">{text.profileHint}</small>
          </fieldset>
          <div className="sc-form-grid">
            {field("firstName", text.firstName, "text", "given-name")}
            {field("lastName", text.lastName, "text", "family-name")}
            {field("email", text.email, "email", "email")}
            {field("phone", text.phone, "tel", "tel", text.phoneHint)}
          </div>
          <div className="sc-form-field">
            <label htmlFor={`${id}-message`}>{text.message}</label>
            <textarea
              id={`${id}-message`}
              name="message"
              rows={3}
              maxLength={1000}
              placeholder={text.messageHint}
              value={fields.message}
              onChange={set("message")}
            />
          </div>
          <div className="sc-honeypot" aria-hidden="true">
            <label htmlFor={`${id}-website`}>{text.honeypot}</label>
            <input
              id={`${id}-website`}
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={fields.website}
              onChange={set("website")}
            />
          </div>
          {status.kind === "error" && (
            <p className="sc-form-error sc-form-status" role="alert">
              {status.message}
            </p>
          )}
          <button
            type="submit"
            className="hi-primary hi-full hi-request-cta"
            disabled={status.kind === "submitting"}
            aria-busy={status.kind === "submitting"}
          >
            <HealthGradient />
            {status.kind === "submitting"
              ? text.submitting
              : status.kind === "error"
                ? text.retry
                : text.submit}
          </button>
          <a href="/informations-demande-assurance" className="sc-order-legal">
            {text.legal}
          </a>
          <p className="sc-order-privacy">{text.privacy}</p>
        </form>
      )}
    </ScDialog>
  );
}
