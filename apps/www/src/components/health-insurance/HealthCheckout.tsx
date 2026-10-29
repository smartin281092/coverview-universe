import { HealthGradient } from "./HealthGradient";
import { insurancePersonSchema } from "@coverview/api-client/insurance-requests";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createInsuranceClient,
  InsuranceApiError,
  type InsurancePerson,
  type InsuranceRequest,
} from "@coverview/api-client/insurance-requests";
import type {
  createHealthClient,
  HealthOffer,
  HealthLocality,
  HealthStatus,
  HealthCompareInput,
  HealthCurrentSelection,
} from "@coverview/api-client/health-insurance";
import { offerCopy as copy } from "../../content/fr/insurance-requests";
import { healthCopy } from "../../content/fr/health-insurance";
import { HealthDialog } from "./HealthDialog";
import { HealthSelect } from "./HealthSelect";
import { HealthProductImage } from "./HealthProductImage";
import { HealthPremiumDifference } from "./HealthPremiumDifference";
import { LocalitySearch } from "./LocalitySearch";
import { interpolate, money } from "./health-format";
import { useCartSavings } from "./use-cart-savings";
export type CheckoutCandidate = {
  key: string;
  offer: HealthOffer;
  profile: HealthCompareInput;
  locality: HealthLocality | null;
  birth: string;
  sex?: "female" | "male" | "other";
  // The person's current model given in the comparator, for the cart's savings, and its company.
  current?: HealthCurrentSelection | null;
  currentInsurerId?: number | null;
};
type Browser = Awaited<ReturnType<ReturnType<typeof createInsuranceClient>["browser"]>>;
// Each person's current model, kept for the browser tab only and never sent with the request
// (29 October 2026): the cart measures their savings with it, as the list does.
const currentsKey = "cv-cart-current-models";
function readCurrents(): Record<string, HealthCurrentSelection> {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(currentsKey) ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, HealthCurrentSelection>)
      : {};
  } catch {
    return {};
  }
}

export function HealthCheckout({
  apiUrl,
  healthApi,
  status,
  candidate,
  open,
  onClose,
  onAddPerson,
  onCount,
}: {
  apiUrl: string;
  healthApi: ReturnType<typeof createHealthClient>;
  status: HealthStatus | null;
  candidate: CheckoutCandidate | null;
  open: boolean;
  onClose: () => void;
  onAddPerson: () => void;
  onCount: (count: number) => void;
}) {
  const api = useMemo(() => createInsuranceClient(apiUrl), [apiUrl]);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [browser, setBrowser] = useState<Browser | null>(null);
  const [step, setStep] = useState(0);
  const [access, setAccess] = useState<"guest" | "wallet" | null>(null);
  const [registeredAccess, setRegisteredAccess] = useState<"guest" | "wallet" | null>(null);
  const [email, setEmail] = useState("");
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [id, setId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<boolean | null>(null);
  const [verified, setVerified] = useState(false);
  const [wallet, setWallet] = useState(false);
  const [items, setItems] = useState<InsurancePerson[]>([]);
  const [sexChosen, setSexChosen] = useState(false);
  const [person, setPerson] = useState<InsurancePerson | null>(null);
  const [locality, setLocality] = useState<HealthLocality | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<HealthOffer | null>(null);
  const [priced, setPriced] = useState<InsuranceRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [currents, setCurrents] = useState(readCurrents);
  useEffect(() => {
    try {
      sessionStorage.setItem(currentsKey, JSON.stringify(currents));
    } catch {
      // Without storage, the savings stay shown until the page is left.
    }
  }, [currents]);
  const cartItems = (priced?.items ?? []).filter((item) =>
    items.some((person) => person.id === item.id),
  );
  const savings = useCartSavings(healthApi, cartItems, currents);
  const emailFlight = useRef<Promise<boolean> | null>(null);
  const keys = useRef(new Map<string, string>());
  const abort = useRef(new AbortController());
  const heading = useRef<HTMLHeadingElement>(null);
  const latestCandidate = useRef(candidate);
  latestCandidate.current = candidate;
  useEffect(() => {
    const active = new AbortController();
    abort.current = active;
    return () => active.abort();
  }, []);
  useEffect(() => {
    if (browser) return;
    void api
      .browser(abort.current.signal)
      .then(async (value) => {
        const saved = await api.draft(abort.current.signal);
        if (saved) {
          setId(saved.id);
          setEmail(saved.email ?? "");
          setRegisteredEmail(saved.email ?? "");
          setVerified(saved.emailVerified);
          setWallet(saved.saveInWallet && saved.emailVerified);
          setPriced(saved);
          setItems(saved.items.map((item) => insurancePersonSchema.strip().parse(item)));
          if (!latestCandidate.current && saved.items.length) setStep(2);
        }
        setBrowser(value);
        setError("");
      })
      .catch(() => setError(copy.error));
  }, [api, open, browser, loadAttempt]);
  useEffect(() => {
    if (!candidate) return;
    const personId = crypto.randomUUID();
    const current = candidate.current;
    if (current) setCurrents((value) => ({ ...value, [personId]: current }));
    setPerson({
      id: personId,
      firstName: "",
      lastName: "",
      sex: candidate.sex ?? "female",
      birthYear: candidate.profile.birthYear,
      ...(candidate.birth ? { birthDate: candidate.birth } : {}),
      // The company of the current model given in the comparator, still editable here.
      currentInsurerId: candidate.currentInsurerId ?? null,
      modelId: candidate.offer.modelId,
      localityId: candidate.locality?.id ?? "",
      accident: candidate.offer.accident,
      deductible: candidate.offer.deductible,
    });
    setSexChosen(Boolean(candidate.sex));
    setLocality(candidate.locality);
    setSelectedOffer(candidate.offer);
    setStep(id && access && (access === "guest" || verified) ? 1 : 0);
    setError("");
  }, [candidate]);
  useEffect(() => {
    if (open && !candidate && items.length > 0) {
      setStep(2);
      setError("");
    }
  }, [open, candidate, items.length]);
  useEffect(() => onCount(items.length), [items, onCount]);
  useEffect(() => {
    if (open) heading.current?.focus();
  }, [step, open, access]);
  function options(operation: string) {
    if (!browser) throw new Error("Browser unavailable");
    const key = keys.current.get(operation) ?? crypto.randomUUID();
    keys.current.set(operation, key);
    return { csrfToken: browser.csrfToken, idempotencyKey: key, signal: abort.current.signal };
  }
  function showError(cause: unknown) {
    setError(
      cause instanceof InsuranceApiError && cause.status === 409
        ? copy.conflict
        : cause instanceof InsuranceApiError && cause.code === "IDENTITY_INVALID_CALLBACK"
          ? copy.invalidCode
          : copy.error,
    );
  }
  async function registerEmail(force = false) {
    if (emailFlight.current) return emailFlight.current;
    if (!browser || !access || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
    if (
      !force &&
      registeredEmail === email &&
      registeredAccess === access &&
      id &&
      (access === "guest" || verified)
    )
      return true;
    setBusy(true);
    setError("");
    const operation = `email:${access}:${email}`;
    if (force) keys.current.delete(operation);
    const run = (async () => {
      try {
        const value = await api.email(email, options(operation), access);
        setId(value.id);
        setRegisteredEmail(email);
        setRegisteredAccess(access);
        setSent(value.codeStatus === "sent");
        setVerified(value.verified);
        setCode("");
        return access === "guest" || value.verified;
      } catch (cause) {
        showError(cause);
        return false;
      } finally {
        setBusy(false);
        emailFlight.current = null;
      }
    })();
    emailFlight.current = run;
    return run;
  }
  async function verify() {
    if (!id) return;
    setBusy(true);
    setError("");
    try {
      const value = await api.verify(id, code, options(`verify:${code}`));
      setVerified(value.emailVerified);
      setWallet(true);
      setPriced(value);
      setStep(person ? 1 : 2);
    } catch (cause) {
      showError(cause);
    } finally {
      setBusy(false);
    }
  }
  async function price(nextItems: InsurancePerson[], nextStep: number) {
    if (!id) {
      setError(copy.error);
      return false;
    }
    setBusy(true);
    setError("");
    try {
      const value = await api.cart(
        id,
        { items: nextItems, saveInWallet: wallet, revision: priced?.revision ?? 0 },
        options(`cart:${priced?.revision ?? 0}:${JSON.stringify(nextItems)}:${wallet}`),
      );
      setPriced(value);
      setItems(value.items.map((item) => insurancePersonSchema.strip().parse(item)));
      setStep(nextStep);
      return true;
    } catch (cause) {
      showError(cause);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!id || !priced || busy) return;
    setBusy(true);
    setSending(true);
    setError("");
    try {
      const value = await api.submit(
        id,
        { items, saveInWallet: wallet, revision: priced.revision },
        options(`submit:${JSON.stringify(items)}:${wallet}`),
      );
      window.location.assign(
        wallet && browser
          ? `${browser.walletUrl}/insurance-requests/${value.id}`
          : `/suivi-demande-assurance?id=${encodeURIComponent(value.id)}`,
      );
    } catch (cause) {
      setBusy(false);
      setSending(false);
      // Premiums changed since the cart was priced: nothing is sent, the cart shows the new
      // amounts to review first, as the separate recap step did before 29 October 2026.
      if (cause instanceof InsuranceApiError && cause.code === "INSURANCE_REQUEST_PRICE_CHANGED") {
        if (await price(items, 2)) setError(copy.repriced);
        return;
      }
      showError(cause);
    }
  }
  const patch = (value: Partial<InsurancePerson>) =>
    setPerson((current) => (current ? { ...current, ...value } : null));
  const child = person ? 2027 - person.birthYear <= 18 : false;
  const foreign = Boolean(selectedOffer?.residenceCountry);
  useEffect(() => {
    if (foreign)
      setPerson((current) => (current ? { ...current, deductible: child ? 0 : 300 } : null));
  }, [foreign, child]);
  return (
    <HealthDialog open={open} onClose={busy ? () => undefined : onClose} title={copy.title} sheet>
      <div className="hi-checkout">
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
          {step === 0
            ? access === null
              ? copy.accessTitle
              : access === "guest"
                ? copy.guest
                : copy.walletAccess
            : copy.steps[step]}
        </h3>
        {error && (
          <p className="hi-checkout-error" role="alert">
            {error}
          </p>
        )}
        {error === copy.conflict && (
          <button
            className="hi-secondary"
            disabled={busy}
            onClick={() => {
              setStep(2);
              setBrowser(null);
              setLoadAttempt((value) => value + 1);
            }}
          >
            {copy.resume}
          </button>
        )}
        {busy && (
          <p className="hi-small" role="status">
            {copy.working}
          </p>
        )}
        {!browser && error && (
          <button className="hi-secondary" onClick={() => setLoadAttempt((value) => value + 1)}>
            {copy.refresh}
          </button>
        )}
        <fieldset disabled={!browser} className="hi-checkout-fields">
          {step < 2 && selectedOffer && (
            <div className="hi-checkout-product">
              <HealthProductImage offer={selectedOffer} thumbnail />
              <div>
                <span>{selectedOffer.insurerBrand ?? selectedOffer.insurerName}</span>
                <strong>{selectedOffer.name}</strong>
                <small>{copy.year}</small>
              </div>
            </div>
          )}
          {step === 0 && access === null && (
            <>
              <p className="hi-small">{copy.accessHint}</p>
              <div className="hi-account-options">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setAccess("guest");
                    setWallet(false);
                    setError("");
                  }}
                >
                  <span className="hi-access-arrow" aria-hidden="true">
                    →
                  </span>
                  <strong>{copy.guest}</strong>
                  <small>{copy.guestHint}</small>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setAccess("wallet");
                    setWallet(true);
                    if (browser?.accountEmail && !verified) setEmail(browser.accountEmail);
                    setError("");
                  }}
                >
                  <span className="hi-access-arrow" aria-hidden="true">
                    →
                  </span>
                  <strong>
                    {browser?.accountEmail ? copy.walletConnected : copy.walletAccess}
                  </strong>
                  <small>{copy.walletAccessHint}</small>
                </button>
              </div>
            </>
          )}
          {step === 0 && access !== null && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (access === "wallet" && sent && !verified) {
                  void verify();
                  return;
                }
                void registerEmail().then((ok) => {
                  if (ok) setStep(person ? 1 : 2);
                });
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
                    setEmail(event.target.value.trim());
                    setSent(null);
                  }}
                />
              </label>
              <p className="hi-small">
                {access === "guest" ? copy.guestEmailHint : copy.emailHint}
              </p>
              {access === "wallet" && sent !== null && !verified && (
                <div className="hi-checkout-otp">
                  <p className="hi-small" role="status">
                    {sent ? copy.codeSent : copy.codeUnavailable}
                  </p>
                  {sent && (
                    <>
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
                    </>
                  )}
                  <button
                    type="button"
                    className="hi-text-link"
                    onClick={() => void registerEmail(true)}
                    disabled={busy}
                  >
                    {copy.resend}
                  </button>
                </div>
              )}
              {access === "wallet" && verified && (
                <p className="hi-verified" role="status">
                  ✓ {copy.verified}
                </p>
              )}
              <button
                className="hi-primary hi-full"
                disabled={
                  busy ||
                  !browser ||
                  (access === "wallet" && sent === true && !verified && code.length !== 6)
                }
              >
                <HealthGradient />
                {access === "guest" || verified || browser?.accountEmail === email
                  ? copy.continue
                  : sent
                    ? copy.verify
                    : copy.sendCode}{" "}
                →
              </button>
              <button
                type="button"
                className="hi-text-link hi-access-back"
                disabled={busy}
                onClick={() => {
                  setAccess(null);
                  setSent(null);
                  setCode("");
                  setError("");
                }}
              >
                {copy.changeAccess}
              </button>
            </form>
          )}
          {step === 1 && person && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!sexChosen) {
                  setError(copy.required);
                  return;
                }
                if (!locality) {
                  setError(copy.chooseLocality);
                  return;
                }
                const updated = { ...person, localityId: locality.id };
                const existing = items.some((item) => item.id === person.id);
                if (!existing && items.length >= 12) {
                  setError(copy.full);
                  return;
                }
                void price(
                  existing
                    ? items.map((item) => (item.id === person.id ? updated : item))
                    : [...items, updated],
                  2,
                );
              }}
            >
              <div className="hi-form-grid">
                <label className="hi-field">
                  {copy.firstName}
                  <input
                    required
                    autoComplete="given-name"
                    maxLength={80}
                    value={person.firstName}
                    onChange={(event) => patch({ firstName: event.target.value })}
                  />
                </label>
                <label className="hi-field">
                  {copy.lastName}
                  <input
                    required
                    autoComplete="family-name"
                    maxLength={80}
                    value={person.lastName}
                    onChange={(event) => patch({ lastName: event.target.value })}
                  />
                </label>
                <div className="hi-field">
                  {copy.sex}
                  <HealthSelect
                    label={copy.sex}
                    value={sexChosen ? person.sex : ""}
                    placeholder={copy.choose}
                    onChange={(value) => {
                      setSexChosen(value !== "choose");
                      if (value !== "choose") patch({ sex: value as InsurancePerson["sex"] });
                    }}
                    options={[
                      { value: "male", label: copy.male },
                      { value: "female", label: copy.female },
                    ]}
                  />
                </div>
                <label className="hi-field">
                  {copy.birthYear}
                  <input
                    required
                    inputMode="numeric"
                    type="number"
                    min={1900}
                    max={2026}
                    value={person.birthYear}
                    onChange={(event) => {
                      const year = Number(event.target.value);
                      patch({
                        birthYear: year,
                        birthDate: undefined,
                        deductible: 2027 - year <= 18 ? 0 : 2500,
                      });
                    }}
                  />
                </label>
              </div>
              <div className="hi-field">
                {copy.currentInsurer}
                <HealthSelect
                  label={copy.currentInsurer}
                  value={String(person.currentInsurerId ?? "none")}
                  onChange={(value) =>
                    patch({ currentInsurerId: value === "none" ? null : Number(value) })
                  }
                  options={[
                    { value: "none", label: copy.noInsurer },
                    ...(status?.insurers ?? []).map((item) => ({
                      value: String(item.id),
                      label: item.brand ?? item.name,
                    })),
                  ]}
                />
              </div>
              <div className="hi-field">
                {foreign ? healthCopy.country : copy.locality}
                {foreign ? (
                  <>
                    <HealthSelect
                      label={healthCopy.country}
                      value={locality?.country ?? selectedOffer?.residenceCountry ?? "FR"}
                      onChange={(value) =>
                        setLocality(
                          status?.foreign?.countries.find((country) => country.code === value)
                            ?.locality ?? null,
                        )
                      }
                      options={(status?.foreign?.countries ?? []).map((country) => ({
                        value: country.code,
                        label: country.name,
                      }))}
                    />
                    <p className="hi-small">{healthCopy.foreignConditions}</p>
                  </>
                ) : (
                  <LocalitySearch api={healthApi} selected={locality} onSelect={setLocality} />
                )}
              </div>
              <div className="hi-form-grid">
                <div className="hi-field">
                  {copy.accident}
                  <HealthSelect
                    label={copy.accident}
                    value={String(person.accident)}
                    onChange={(value) => patch({ accident: value === "true" })}
                    options={[
                      { value: "true", label: copy.yes },
                      { value: "false", label: copy.no },
                    ]}
                  />
                </div>
                <div className="hi-field">
                  {copy.deductible}
                  <HealthSelect
                    label={copy.deductible}
                    value={String(person.deductible)}
                    onChange={(value) => patch({ deductible: Number(value) })}
                    options={(foreign
                      ? [child ? 0 : 300]
                      : child
                        ? [0, 100, 200, 300, 400, 500, 600]
                        : [300, 500, 1000, 1500, 2000, 2500]
                    ).map((value) => ({ value: String(value), label: `${value} CHF` }))}
                  />
                </div>
              </div>
              <div className="hi-checkout-actions">
                <button
                  type="button"
                  className="hi-secondary"
                  onClick={() => setStep(0)}
                  disabled={busy}
                >
                  {copy.back}
                </button>
                <button className="hi-primary" disabled={busy}>
                  <HealthGradient />
                  {items.some((item) => item.id === person.id) ? copy.save : copy.add}
                </button>
              </div>
            </form>
          )}
          {/* The cart is also the last step (user request, 29 October 2026): the separate recap
              repeated it, its conditions and sending now close the cart. */}
          {step === 2 && (
            <>
              {cartItems.length ? (
                <ul className="hi-cart-items">
                  {cartItems.map((item) => (
                    <li key={item.id}>
                      <div className="hi-cart-person">
                        <span>
                          {item.firstName.slice(0, 1)}
                          {item.lastName.slice(0, 1)}
                        </span>
                        <div>
                          <strong>
                            {item.firstName} {item.lastName}
                          </strong>
                          <small>
                            {item.birthYear} · {item.locality.postalCode} {item.locality.locality}
                          </small>
                        </div>
                        <b>
                          {money(item.offer.monthlyPremiumMinor)}
                          <small>{copy.month}</small>
                        </b>
                      </div>
                      <div className="hi-cart-product">
                        <HealthProductImage offer={item.offer} thumbnail />
                        <p>
                          {item.offer.insurerBrand ?? item.offer.insurerName} · {item.offer.name}
                        </p>
                      </div>
                      <HealthPremiumDifference value={savings.byPerson.get(item.id)} />
                      <p className="hi-small">
                        {copy.deductible} : {item.deductible} CHF · {copy.accident} :{" "}
                        {item.accident ? copy.yes : copy.no}
                      </p>
                      <p className="hi-small">
                        {copy.currentInsurer} :{" "}
                        {status?.insurers.find((x) => x.id === item.currentInsurerId)?.brand ??
                          item.currentInsurerBrand ??
                          item.currentInsurerName ??
                          copy.noInsurer}
                      </p>
                      <div className="hi-cart-actions">
                        <button
                          disabled={busy}
                          onClick={() => {
                            const original = items.find((x) => x.id === item.id);
                            if (original) {
                              setPerson(original);
                              setSexChosen(true);
                              setLocality(item.locality);
                              setSelectedOffer(item.offer);
                              setStep(1);
                            }
                          }}
                        >
                          {copy.edit}
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => {
                            const remaining = items.filter((x) => x.id !== item.id);
                            void price(remaining, 2);
                          }}
                        >
                          {copy.remove}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="hi-small">{copy.empty}</p>
              )}
              <button
                className="hi-add-person"
                disabled={busy || items.length >= 12}
                onClick={() => {
                  setPerson(null);
                  setSexChosen(false);
                  setLocality(null);
                  setSelectedOffer(null);
                  setError("");
                  onAddPerson();
                }}
              >
                + {copy.addPerson}
              </button>
              {priced && (
                <div className="hi-cart-total">
                  <span>{copy.total}</span>
                  <strong>
                    {money(priced.totalMonthlyMinor)} <small>CHF</small>
                  </strong>
                  <span>{copy.annual}</span>
                  <span>{money(priced.totalMonthlyMinor * 12)} CHF</span>
                  {/* All the people's savings under the total (29 October 2026). */}
                  {savings.total && (
                    <div className="hi-cart-savings">
                      <HealthPremiumDifference value={savings.total} />
                      <small>
                        {savings.known < cartItems.length
                          ? interpolate(
                              savings.known === 1 ? copy.savingsSomeOne : copy.savingsSome,
                              { known: savings.known, count: cartItems.length },
                            )
                          : cartItems.length === 1
                            ? copy.savingsOne
                            : interpolate(copy.savingsAll, { count: cartItems.length })}
                      </small>
                    </div>
                  )}
                </div>
              )}
              {cartItems.length > 0 && (
                <>
                  <p className="hi-small">
                    {registeredEmail} · {wallet ? copy.wallet : copy.guest}
                  </p>
                  <div className="hi-legal-ack">
                    <p>
                      {copy.legalIntro}{" "}
                      <a
                        href="https://www.finma.ch/fr/autorisation/intermediation-dassurance/registersuche/#query=F01536662"
                        target="_blank"
                        rel="noreferrer"
                      >
                        F01536662
                      </a>
                      .
                    </p>
                    <p>{copy.legalContinue}</p>
                    <div>
                      <a
                        href="/informations-demande-assurance#lsa45"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {copy.lsa45}
                      </a>
                      <a
                        href="/informations-demande-assurance#protection-des-donnees"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {copy.privacy}
                      </a>
                      <a
                        href="/informations-demande-assurance#cgv"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {copy.terms}
                      </a>
                    </div>
                  </div>
                </>
              )}
              <p className="hi-small">{copy.noPayment}</p>
              <div className="hi-checkout-actions">
                <button className="hi-secondary" disabled={busy} onClick={() => setStep(0)}>
                  {copy.back}
                </button>
                <button
                  className="hi-primary"
                  disabled={busy || !items.length}
                  onClick={() => void submit()}
                >
                  <HealthGradient />
                  {sending ? copy.sending : copy.submit}
                </button>
              </div>
            </>
          )}
        </fieldset>
      </div>
    </HealthDialog>
  );
}
