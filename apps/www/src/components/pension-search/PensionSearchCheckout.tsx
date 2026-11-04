import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { SuccessCheck } from "@coverview/ui";
import {
  createPensionSearchClient,
  PensionSearchApiError,
  pensionSearchDetailsSchema,
  type PensionSearchDetailsInput,
  type PensionSearchEmployer,
  type PensionSearchSituation,
} from "@coverview/api-client/pension-searches";
import { pensionCheckout as copy } from "../../content/fr/pension-search";
import { HealthDialog } from "../health-insurance/HealthDialog";
import { HealthGradient } from "../health-insurance/HealthGradient";
import { HealthSelect } from "../health-insurance/HealthSelect";
import { HealthBirthDate } from "../health-insurance/HealthBirthDate";

type Browser = Awaited<ReturnType<ReturnType<typeof createPensionSearchClient>["browser"]>>;
type Employer = { key: string; name: string; city: string; fromYear: string; toYear: string };
type Details = Omit<PensionSearchDetailsInput, "employers" | "sex"> & {
  sex: "" | "female" | "male";
};
const identityFields = [
  "firstName",
  "lastName",
  "previousNames",
  "birthDate",
  "sex",
  "nationality",
  "avsNumber",
  "street",
  "postalCode",
  "city",
  "country",
  "phone",
] as const;
const situations = Object.keys(copy.situations) as PensionSearchSituation[];
const empty: Details = {
  firstName: "",
  lastName: "",
  previousNames: "",
  birthDate: "",
  sex: "",
  nationality: "Suisse",
  avsNumber: "",
  street: "",
  postalCode: "",
  city: "",
  country: "Suisse",
  phone: "",
  situation: "job_change",
};
// Digits grouped as on the AVS card while typing: 756.1234.5678.97.
const avsGroups = (value: string) => {
  const digits = value.replace(/\D/gu, "").slice(0, 13);
  return [digits.slice(0, 3), digits.slice(3, 7), digits.slice(7, 11), digits.slice(11)]
    .filter(Boolean)
    .join(".");
};
const year = (value: string) => (/^\d{4}$/u.test(value) ? Number(value) : null);

/**
 * The LPP search order (4 November 2026): the health comparator's checkout — same side sheet,
 * numbered steps, Wallet access and buttons — for one person. Nothing is kept in browser storage:
 * the form, AVS number included, lives in this tab's memory until it is sent.
 */
export default function PensionSearchCheckout({
  apiUrl,
  enabled,
}: {
  apiUrl: string;
  enabled: boolean;
}) {
  const api = useMemo(() => createPensionSearchClient(apiUrl), [apiUrl]);
  const [open, setOpen] = useState(false);
  const [browser, setBrowser] = useState<Browser | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [otherEmail, setOtherEmail] = useState(false);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<boolean | null>(null);
  const [verified, setVerified] = useState(false);
  const [details, setDetails] = useState<Details>(empty);
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [mandate, setMandate] = useState(false);
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [mandateMissing, setMandateMissing] = useState(false);
  const mandateBox = useRef<HTMLInputElement>(null);
  const keys = useRef(new Map<string, string>());
  const abort = useRef(new AbortController());
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const active = new AbortController();
    abort.current = active;
    return () => active.abort();
  }, []);
  // Every "Retrouver mes avoirs" button of the page opens the order; #commande opens it on arrival.
  const show = useCallback(() => {
    setOpen(true);
    setError("");
  }, []);
  useEffect(() => {
    const click = (event: MouseEvent) => {
      const target =
        event.target instanceof Element ? event.target.closest("[data-lpp-order]") : null;
      if (!target) return;
      event.preventDefault();
      show();
    };
    document.addEventListener("click", click);
    if (window.location.hash === "#commande") show();
    return () => document.removeEventListener("click", click);
  }, [show]);
  useEffect(() => {
    if (!open || !enabled || browser) return;
    void api
      .browser(abort.current.signal)
      .then((value) => {
        setBrowser(value);
        setError("");
      })
      .catch(() => setError(copy.unavailable));
  }, [api, open, enabled, browser, loadAttempt]);
  useEffect(() => {
    if (open) heading.current?.focus();
  }, [step, open, done]);
  // The first field to correct takes the focus, scrolled into view with its message.
  const panel = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    if (!invalid.size) return;
    panel.current
      ?.querySelector<HTMLElement>('.is-invalid input, .is-invalid button, [aria-invalid="true"]')
      ?.focus();
  }, [invalid]);
  function options(operation: string) {
    if (!browser) throw new Error("Browser unavailable");
    const key = keys.current.get(operation) ?? crypto.randomUUID();
    keys.current.set(operation, key);
    return { csrfToken: browser.csrfToken, idempotencyKey: key, signal: abort.current.signal };
  }
  function showError(cause: unknown) {
    setError(
      cause instanceof PensionSearchApiError && cause.code === "IDENTITY_INVALID_CALLBACK"
        ? copy.invalidCode
        : cause instanceof PensionSearchApiError && cause.status === 429
          ? copy.rateLimited
          : copy.error,
    );
  }
  async function requestCode(address: string, force = false) {
    if (!browser || busy) return;
    setBusy(true);
    setError("");
    const operation = `email:${address}`;
    if (force) keys.current.delete(operation);
    try {
      const value = await api.email(address, options(operation));
      setVerified(value.verified);
      setSent(
        value.codeStatus === "sent" ? true : value.codeStatus === "unavailable" ? false : null,
      );
      setCode("");
      if (value.verified) setStep(1);
    } catch (cause) {
      showError(cause);
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    if (!browser || busy) return;
    setBusy(true);
    setError("");
    try {
      await api.verify(code, options(`verify:${email}:${code}`));
      setVerified(true);
      setStep(1);
    } catch (cause) {
      showError(cause);
    } finally {
      setBusy(false);
    }
  }
  const patch = (value: Partial<Details>) => {
    setDetails((current) => ({ ...current, ...value }));
    setInvalid((current) => {
      const next = new Set(current);
      for (const key of Object.keys(value)) next.delete(key);
      return next;
    });
  };
  // The shared contract validates; the form only shows which fields to correct.
  function payload() {
    return {
      ...details,
      sex: details.sex || undefined,
      employers: employers.map((item): Partial<PensionSearchEmployer> => ({
        name: item.name,
        city: item.city,
        fromYear: year(item.fromYear),
        toYear: year(item.toYear),
      })),
    };
  }
  function check(fields: readonly string[]) {
    const result = pensionSearchDetailsSchema.safeParse(payload());
    if (result.success) return true;
    const wrong = new Set(
      result.error.issues
        .map((issue) =>
          issue.path.length === 0 && issue.message === "invalid_birth_date"
            ? "birthDate"
            : issue.path.length === 0
              ? ""
              : issue.path[0] === "employers"
                ? `employers.${String(issue.path[1])}`
                : String(issue.path[0]),
        )
        .filter((field) => fields.some((name) => field === name || field.startsWith(`${name}.`))),
    );
    if (!wrong.size) return true;
    setInvalid(wrong);
    // AVS number and birth date say what is wrong under the field itself.
    const precise = [...wrong].every((name) => fieldError(name));
    setError(
      precise
        ? ""
        : [...wrong].some((name) => name.startsWith("employers."))
          ? copy.invalidPeriod
          : copy.required,
    );
    return false;
  }
  async function submit() {
    if (!browser || busy) return;
    if (!mandate) {
      setMandateMissing(true);
      mandateBox.current?.focus();
      return;
    }
    const parsed = pensionSearchDetailsSchema.safeParse(payload());
    if (!parsed.success) {
      setError(copy.required);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const value = await api.submit(
        { details: parsed.data, mandate: true },
        options(`submit:${JSON.stringify(parsed.data)}`),
      );
      setDone(true);
      window.setTimeout(
        () => window.location.assign(`${browser.walletUrl}/pension-searches/${value.id}`),
        1800,
      );
    } catch (cause) {
      setBusy(false);
      if (
        cause instanceof PensionSearchApiError &&
        (cause.code === "IDENTITY_UNAUTHENTICATED" || cause.status === 401)
      ) {
        setVerified(false);
        setSent(null);
        setStep(0);
        setError(copy.sessionLost);
        return;
      }
      showError(cause);
    }
  }
  // A precise message under the field when one exists; the others share "required" above.
  const fieldError = (name: string) =>
    name === "avsNumber" && details.avsNumber.replace(/\D/gu, "").length > 0
      ? copy.avsInvalid
      : name === "birthDate" && details.birthDate
        ? copy.invalidBirthDate
        : "";
  const field = (
    name: (typeof identityFields)[number],
    label: string,
    input: ReactNode,
    hint?: string,
  ) => (
    <label className={`hi-field ${invalid.has(name) ? "is-invalid" : ""}`}>
      {label}
      {input}
      {invalid.has(name) && fieldError(name) ? (
        <span className="hi-field-help lpp-field-error" role="alert">
          {fieldError(name)}
        </span>
      ) : (
        hint && <span className="hi-field-help">{hint}</span>
      )}
    </label>
  );
  const text = (
    name: Exclude<(typeof identityFields)[number], "sex" | "birthDate">,
    extra: InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <input
      value={details[name] ?? ""}
      maxLength={160}
      aria-invalid={invalid.has(name) || undefined}
      onChange={(event) =>
        patch({ [name]: name === "avsNumber" ? avsGroups(event.target.value) : event.target.value })
      }
      {...extra}
    />
  );
  const summaryCount =
    employers.length === 1
      ? copy.employerCount.one
      : copy.employerCount.other.replace("{{count}}", String(employers.length));
  const close = () => {
    if (busy && !done) return;
    setOpen(false);
    if (window.location.hash === "#commande")
      history.replaceState(null, "", window.location.pathname + window.location.search);
  };
  return (
    <HealthDialog open={open} onClose={close} title={copy.title} sheet>
      <div className="hi-checkout lpp-checkout">
        {!enabled ? (
          <p className="hi-checkout-error" role="status">
            {copy.unavailable}
          </p>
        ) : done ? (
          <div className="lpp-checkout-done" role="status">
            <SuccessCheck className="lpp-checkout-check" />
            <h3 tabIndex={-1} ref={heading}>
              {copy.success}
            </h3>
            <p className="hi-small">{copy.successHint}</p>
          </div>
        ) : (
          <>
            <p className="hi-small">{copy.subtitle}</p>
            <ol className="hi-checkout-steps" aria-label={copy.title}>
              {copy.steps.map((label, index) => (
                <li
                  key={label}
                  className={index === step ? "is-current" : index < step ? "is-done" : ""}
                  aria-current={index === step ? "step" : undefined}
                >
                  <span>{index < step ? "✓" : index + 1}</span>
                  <small>{label}</small>
                </li>
              ))}
            </ol>
            <h3 tabIndex={-1} ref={heading}>
              {step === 0 ? copy.accessTitle : copy.steps[step]}
            </h3>
            {error && (
              <p className="hi-checkout-error" role="alert">
                {error}
              </p>
            )}
            {busy && (
              <p className="hi-small" role="status">
                {copy.working}
              </p>
            )}
            {!browser && error === copy.unavailable && (
              <button className="hi-secondary" onClick={() => setLoadAttempt((value) => value + 1)}>
                {copy.refresh}
              </button>
            )}
            <fieldset ref={panel} disabled={!browser} className="hi-checkout-fields">
              {step === 0 && (
                <>
                  <p className="hi-small">{copy.accessHint}</p>
                  {browser?.accountEmail && !otherEmail && !verified ? (
                    <>
                      <div className="hi-account-options">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            const address = browser.accountEmail ?? "";
                            setEmail(address);
                            void requestCode(address);
                          }}
                        >
                          <span className="hi-access-arrow" aria-hidden="true">
                            →
                          </span>
                          <strong>{copy.walletConnected}</strong>
                          <small>{browser.accountEmail}</small>
                        </button>
                      </div>
                      <button
                        type="button"
                        className="hi-text-link hi-access-back"
                        onClick={() => setOtherEmail(true)}
                      >
                        {copy.otherEmail}
                      </button>
                    </>
                  ) : (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (verified) setStep(1);
                        else if (sent) void verify();
                        else void requestCode(email);
                      }}
                    >
                      <label className="hi-field">
                        {copy.email}
                        <input
                          autoComplete="email"
                          type="email"
                          required
                          maxLength={240}
                          value={email}
                          disabled={busy || verified}
                          onChange={(event) => {
                            setEmail(event.target.value.trim().toLowerCase());
                            setSent(null);
                          }}
                        />
                      </label>
                      <p className="hi-small">{copy.emailHint}</p>
                      {sent !== null && !verified && (
                        <div className="hi-checkout-otp">
                          <p className="hi-small" role="status">
                            {sent ? copy.codeSent : copy.codeUnavailable}
                          </p>
                          {sent && (
                            <label className="hi-field">
                              {copy.code}
                              <input
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                pattern="[0-9]{6}"
                                required
                                disabled={busy}
                                maxLength={6}
                                value={code}
                                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                              />
                            </label>
                          )}
                          <button
                            type="button"
                            className="hi-text-link"
                            onClick={() => void requestCode(email, true)}
                            disabled={busy}
                          >
                            {copy.resend}
                          </button>
                        </div>
                      )}
                      {verified && (
                        <p className="hi-verified" role="status">
                          ✓ {copy.verified}
                        </p>
                      )}
                      <button
                        className="hi-primary hi-full"
                        disabled={
                          busy || !browser || (sent === true && !verified && code.length !== 6)
                        }
                      >
                        <HealthGradient />
                        {verified ? copy.continue : sent ? copy.verify : copy.sendCode} →
                      </button>
                    </form>
                  )}
                </>
              )}
              {step === 1 && (
                <form
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (check(identityFields)) {
                      setError("");
                      setStep(2);
                    }
                  }}
                >
                  <p className="hi-small">{copy.identityHint}</p>
                  <div className="hi-form-grid">
                    {field(
                      "firstName",
                      copy.firstName,
                      text("firstName", { autoComplete: "given-name", required: true }),
                    )}
                    {field(
                      "lastName",
                      copy.lastName,
                      text("lastName", { autoComplete: "family-name", required: true }),
                    )}
                  </div>
                  {field(
                    "previousNames",
                    copy.previousNames,
                    text("previousNames"),
                    copy.previousNamesHint,
                  )}
                  <div className="hi-form-grid">
                    <label className={`hi-field ${invalid.has("birthDate") ? "is-invalid" : ""}`}>
                      {copy.birthDate}
                      <HealthBirthDate
                        value={details.birthDate}
                        onChange={(birthDate) => patch({ birthDate })}
                      />
                    </label>
                    <div className={`hi-field ${invalid.has("sex") ? "is-invalid" : ""}`}>
                      {copy.sex}
                      <HealthSelect
                        label={copy.sex}
                        value={details.sex}
                        placeholder={copy.choose}
                        onChange={(value) => patch({ sex: value as Details["sex"] })}
                        options={[
                          { value: "female", label: copy.female },
                          { value: "male", label: copy.male },
                        ]}
                      />
                    </div>
                  </div>
                  <div className="hi-form-grid">
                    {field(
                      "nationality",
                      copy.nationality,
                      text("nationality", { autoComplete: "country-name", required: true }),
                    )}
                    {field(
                      "avsNumber",
                      copy.avsNumber,
                      text("avsNumber", {
                        inputMode: "numeric",
                        autoComplete: "off",
                        placeholder: "756.0000.0000.00",
                        required: true,
                        maxLength: 16,
                      }),
                    )}
                  </div>
                  <p className="hi-small lpp-avs-hint">{copy.avsHint}</p>
                  {field(
                    "street",
                    copy.street,
                    text("street", { autoComplete: "street-address", required: true }),
                  )}
                  <div className="hi-form-grid lpp-locality-grid">
                    {field(
                      "postalCode",
                      copy.postalCode,
                      text("postalCode", {
                        autoComplete: "postal-code",
                        inputMode: "numeric",
                        required: true,
                        maxLength: 16,
                      }),
                    )}
                    {field(
                      "city",
                      copy.city,
                      text("city", { autoComplete: "address-level2", required: true }),
                    )}
                  </div>
                  <div className="hi-form-grid">
                    {field(
                      "country",
                      copy.country,
                      text("country", { autoComplete: "country-name", required: true }),
                    )}
                    {field(
                      "phone",
                      copy.phone,
                      text("phone", { autoComplete: "tel", type: "tel", maxLength: 40 }),
                      copy.phoneHint,
                    )}
                  </div>
                  <div className="hi-checkout-actions">
                    <button
                      type="button"
                      className="hi-secondary"
                      disabled={busy}
                      onClick={() => setStep(0)}
                    >
                      {copy.back}
                    </button>
                    <button className="hi-primary">
                      <HealthGradient />
                      {copy.continue} →
                    </button>
                  </div>
                </form>
              )}
              {step === 2 && (
                <form
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (check(["situation", "employers"])) {
                      setError("");
                      setStep(3);
                    }
                  }}
                >
                  <p className="hi-small">{copy.pathHint}</p>
                  <div className="hi-field">
                    {copy.situation}
                    <HealthSelect
                      label={copy.situation}
                      value={details.situation}
                      onChange={(value) => patch({ situation: value as PensionSearchSituation })}
                      options={situations.map((value) => ({
                        value,
                        label: copy.situations[value],
                      }))}
                    />
                  </div>
                  <fieldset className="hi-fieldset lpp-employers">
                    <legend>
                      {copy.employers} <span>{copy.employersHint}</span>
                    </legend>
                    {employers.length === 0 && <p className="hi-small">{copy.noEmployer}</p>}
                    <ol>
                      {employers.map((item, index) => {
                        const update = (value: Partial<Employer>) => {
                          setEmployers((current) =>
                            current.map((entry) =>
                              entry.key === item.key ? { ...entry, ...value } : entry,
                            ),
                          );
                          setInvalid(new Set());
                        };
                        const wrong = invalid.has(`employers.${index}`);
                        return (
                          <li key={item.key} className={wrong ? "is-invalid" : ""}>
                            <div className="hi-form-grid">
                              <label className="hi-field">
                                {copy.employerName}
                                <input
                                  required
                                  maxLength={160}
                                  value={item.name}
                                  aria-invalid={wrong || undefined}
                                  onChange={(event) => update({ name: event.target.value })}
                                />
                              </label>
                              <label className="hi-field">
                                {copy.employerCity}
                                <input
                                  maxLength={120}
                                  value={item.city}
                                  onChange={(event) => update({ city: event.target.value })}
                                />
                              </label>
                            </div>
                            <div className="lpp-employer-years">
                              <label className="hi-field">
                                {copy.fromYear}
                                <input
                                  inputMode="numeric"
                                  maxLength={4}
                                  placeholder="2010"
                                  value={item.fromYear}
                                  onChange={(event) =>
                                    update({
                                      fromYear: event.target.value.replace(/\D/gu, "").slice(0, 4),
                                    })
                                  }
                                />
                              </label>
                              <label className="hi-field">
                                {copy.toYear}
                                <input
                                  inputMode="numeric"
                                  maxLength={4}
                                  placeholder="2015"
                                  value={item.toYear}
                                  onChange={(event) =>
                                    update({
                                      toYear: event.target.value.replace(/\D/gu, "").slice(0, 4),
                                    })
                                  }
                                />
                              </label>
                              <button
                                type="button"
                                className="hi-text-link"
                                onClick={() =>
                                  setEmployers((current) =>
                                    current.filter((entry) => entry.key !== item.key),
                                  )
                                }
                              >
                                {copy.removeEmployer}
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                    <button
                      type="button"
                      className="hi-add-person"
                      disabled={employers.length >= 10}
                      onClick={() =>
                        setEmployers((current) => [
                          ...current,
                          {
                            key: crypto.randomUUID(),
                            name: "",
                            city: "",
                            fromYear: "",
                            toYear: "",
                          },
                        ])
                      }
                    >
                      + {copy.addEmployer}
                    </button>
                  </fieldset>
                  <div className="hi-checkout-actions">
                    <button type="button" className="hi-secondary" onClick={() => setStep(1)}>
                      {copy.back}
                    </button>
                    <button className="hi-primary">
                      <HealthGradient />
                      {copy.continue} →
                    </button>
                  </div>
                </form>
              )}
              {step === 3 && (
                <>
                  <dl className="lpp-summary">
                    <div>
                      <dt>
                        {copy.summaryIdentity}
                        <button type="button" className="hi-text-link" onClick={() => setStep(1)}>
                          {copy.edit}
                        </button>
                      </dt>
                      <dd>
                        <strong>
                          {details.firstName} {details.lastName}
                        </strong>
                        {details.previousNames && <span>{details.previousNames}</span>}
                        <span>
                          {details.birthDate.split("-").reverse().join(".")} · {details.nationality}
                        </span>
                        <span>{details.avsNumber}</span>
                      </dd>
                    </div>
                    <div>
                      <dt>{copy.summaryAddress}</dt>
                      <dd>
                        <span>{details.street}</span>
                        <span>
                          {details.postalCode} {details.city} · {details.country}
                        </span>
                        <span>{email || browser?.accountEmail}</span>
                        {details.phone && <span>{details.phone}</span>}
                      </dd>
                    </div>
                    <div>
                      <dt>
                        {copy.summaryPath}
                        <button type="button" className="hi-text-link" onClick={() => setStep(2)}>
                          {copy.edit}
                        </button>
                      </dt>
                      <dd>
                        <span>{copy.situations[details.situation ?? "other"]}</span>
                        <span>{employers.length ? summaryCount : copy.noEmployer}</span>
                      </dd>
                    </div>
                  </dl>
                  <label className={`hi-check lpp-mandate ${mandateMissing ? "is-invalid" : ""}`}>
                    <input
                      ref={mandateBox}
                      type="checkbox"
                      checked={mandate}
                      aria-invalid={mandateMissing || undefined}
                      aria-describedby={mandateMissing ? "lpp-mandate-error" : undefined}
                      onChange={(event) => {
                        setMandate(event.target.checked);
                        if (event.target.checked) setMandateMissing(false);
                      }}
                    />
                    <span>{copy.mandate}</span>
                  </label>
                  {mandateMissing && (
                    <p
                      id="lpp-mandate-error"
                      className="hi-field-help lpp-field-error"
                      role="alert"
                    >
                      {copy.mandateRequired}
                    </p>
                  )}
                  <div className="hi-legal-ack">
                    <p>
                      {copy.legal}{" "}
                      <a
                        href="https://www.finma.ch/fr/autorisation/intermediation-dassurance/registersuche/#query=F01536662"
                        target="_blank"
                        rel="noreferrer"
                      >
                        F01536662
                      </a>
                      .
                    </p>
                    <div>
                      <a
                        href="/informations-demande-assurance#protection-des-donnees"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {copy.privacy}
                      </a>
                    </div>
                  </div>
                  <p className="hi-small hi-cart-note">{copy.free}</p>
                  <div className="hi-checkout-actions">
                    <button
                      type="button"
                      className="hi-secondary"
                      disabled={busy}
                      onClick={() => setStep(2)}
                    >
                      {copy.back}
                    </button>
                    <button
                      type="button"
                      className="hi-primary"
                      disabled={busy}
                      onClick={() => void submit()}
                    >
                      <HealthGradient />
                      {busy ? copy.sending : copy.submit}
                    </button>
                  </div>
                </>
              )}
            </fieldset>
          </>
        )}
      </div>
    </HealthDialog>
  );
}
