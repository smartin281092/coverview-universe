import { HealthGradient } from "./HealthGradient";
import { useEffect, useMemo, useState } from "react";
import { RequestProgress } from "@coverview/ui";
import {
  createInsuranceClient,
  type InsuranceRequest,
} from "@coverview/api-client/insurance-requests";
import { offerCopy as copy } from "../../content/fr/insurance-requests";
import { money } from "./health-format";
import { HealthRequestRecovery } from "./HealthRequestRecovery";
const stages = ["submitted", "reviewing", "insurer_contacted", "offer_ready", "completed"] as const;
export default function HealthRequestTracking({ apiUrl }: { apiUrl: string }) {
  const api = useMemo(() => createInsuranceClient(apiUrl), [apiUrl]);
  const [request, setRequest] = useState<InsuranceRequest | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [walletUrl, setWalletUrl] = useState("");
  const [requestId, setRequestId] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    const id = new URLSearchParams(window.location.search).get("id") ?? "";
    setRequestId(id);
    let timer: ReturnType<typeof setTimeout>;
    const read = async () => {
      try {
        const browser = await api.browser(abort.signal);
        setWalletUrl(browser.walletUrl);
        const result = await api.get(id, abort.signal);
        if (!abort.signal.aborted) {
          setRequest(result);
          setError(false);
          timer = setTimeout(() => {
            if (document.visibilityState === "visible") void read();
          }, 15000);
        }
      } catch {
        if (!abort.signal.aborted) {
          setError(true);
          setRequest(null);
        }
      }
    };
    const visibility = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        void read();
      }
    };
    setError(false);
    void read();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      abort.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [api, retry]);
  const current = request
    ? Math.max(
        0,
        ...request.history.map((event) => stages.indexOf(event.state as (typeof stages)[number])),
      )
    : 0;
  return (
    <div className="health-comparator">
      <main className="hi-tracking">
        <header>
          <a href="/comparateur-assurance-maladie-2027" className="hi-text-link">
            ← CoverView
          </a>
          <h1>{copy.tracking}</h1>
          <p className="hi-lead">{copy.trackingHint}</p>
        </header>
        {error ? (
          <div role="alert">
            <p>{copy.unavailable}</p>
            <button className="hi-secondary" onClick={() => setRetry((x) => x + 1)}>
              {copy.refresh}
            </button>
          </div>
        ) : !request ? (
          <p role="status">{copy.loading}</p>
        ) : (
          <>
            <p className="hi-tracking-id">
              {copy.identifier} : {request.id}
            </p>
            {request.state === "cancelled" && <p role="status">{copy.states.cancelled}</p>}
            <RequestProgress
              current={Math.max(0, current)}
              cancelled={request.state === "cancelled"}
              complete={request.state === "completed"}
              steps={stages.map((state) => ({
                label: copy.states[state],
                description: copy.descriptions[state],
                at: request.history.find((event) => event.state === state)?.at,
              }))}
            />
            <ul className="hi-cart-items">
              {request.items.map((item) => (
                <li key={item.id}>
                  <div className="hi-cart-person">
                    <span>
                      {item.firstName[0]}
                      {item.lastName[0]}
                    </span>
                    <div>
                      <strong>
                        {item.firstName} {item.lastName}
                      </strong>
                      <small>
                        {item.offer.insurerBrand ?? item.offer.insurerName} · {item.offer.name}
                      </small>
                    </div>
                    <b>
                      {money(item.offer.monthlyPremiumMinor)}
                      <small>{copy.month}</small>
                    </b>
                  </div>
                  <p className="hi-small">
                    {item.birthYear} · {item.locality.postalCode} {item.locality.locality} ·{" "}
                    {copy.deductible} : {item.deductible} CHF · {copy.accident} :{" "}
                    {item.accident ? copy.yes : copy.no}
                  </p>
                </li>
              ))}
            </ul>
            <div className="hi-cart-total">
              <span>{copy.total}</span>
              <strong>
                {money(request.totalMonthlyMinor)} <small>CHF</small>
              </strong>
            </div>
            <p className="hi-small">{copy.noPayment}</p>
            {request.saveInWallet ? (
              <a className="hi-primary" href={`${walletUrl}/insurance-requests/${request.id}`}>
                <HealthGradient />
                {copy.openWallet}
              </a>
            ) : (
              <p className="hi-small">{copy.trackingGuest}</p>
            )}
            <button className="hi-secondary" onClick={() => setRetry((x) => x + 1)}>
              {copy.refresh}
            </button>
          </>
        )}
        {requestId && (error || (request && !request.saveInWallet)) && (
          <HealthRequestRecovery api={api} requestId={requestId} />
        )}
      </main>
    </div>
  );
}
