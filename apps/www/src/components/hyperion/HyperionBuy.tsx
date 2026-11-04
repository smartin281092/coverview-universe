import { useEffect, useState } from "react";
import { hyperionCopy } from "../../content/fr/hyperion";
import { HealthGradient } from "../health-insurance/HealthGradient";
import { HyperionFields } from "./HyperionFields";
import { ArrowIcon } from "./HyperionIcons";
import { HyperionOrderDialog } from "./HyperionOrderDialog";
import {
  annualisedReturn,
  formatFrancs,
  historicalProjection,
  netReturns,
  yearsUntilRetirement,
} from "./hyperion-model";
import { ORDER_EVENT, updateConfig, useHyperionConfig } from "./hyperion-store";

const copy = hyperionCopy.buy;
const rate = annualisedReturn(netReturns());
const interpolate = (template: string, values: Record<string, string>) =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    template,
  );

/** The hero's buy box: the parameters, the capital they lead to and the order. */
export default function HyperionBuy({
  apiUrl,
  currentYear,
}: {
  apiUrl: string;
  currentYear: number;
}) {
  const config = useHyperionConfig();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const handler = () => setOpen(true);
    document.addEventListener(ORDER_EVENT, handler);
    return () => document.removeEventListener(ORDER_EVENT, handler);
  }, []);
  const years = yearsUntilRetirement(config.birthYear, currentYear);
  const projection =
    years >= 1
      ? historicalProjection(
          {
            investment: config.investment,
            frequency: config.frequency,
            years,
            initialCapital: config.initialCapital,
          },
          rate,
        )
      : null;
  return (
    <div className="hp-buy">
      <h2 className="hp-buy-title">{copy.title}</h2>
      <HyperionFields
        config={config}
        onChange={updateConfig}
        currentYear={currentYear}
        prefix="hp-buy"
      />
      <div className="hp-buy-result" aria-live="polite">
        {projection ? (
          <>
            <p className="hp-buy-horizon">{interpolate(copy.horizon, { years: String(years) })}</p>
            <p className="hp-buy-label">{copy.projected}</p>
            <p className="hp-buy-amount">
              <span>{formatFrancs(projection.finalCapital)}</span>
              <small>{copy.currency}</small>
            </p>
            <p className="hp-buy-invested">
              {interpolate(copy.invested, { amount: formatFrancs(projection.totalInvested) })}
            </p>
            <p className="hp-buy-note">{copy.projectedNote}</p>
          </>
        ) : (
          <p className="hp-buy-note">{copy.horizonShort}</p>
        )}
      </div>
      <button type="button" className="lp-button hp-cta hp-cta-main" onClick={() => setOpen(true)}>
        <HealthGradient />
        {copy.cta}
        <ArrowIcon />
      </button>
      <a href="#simulateur" className="hp-buy-alternative">
        {copy.simulate}
        <span aria-hidden="true">↓</span>
      </a>
      <ul className="hp-assurances">
        {copy.assurances.map((text) => (
          <li key={text}>
            <span aria-hidden="true">✓</span>
            {text}
          </li>
        ))}
      </ul>
      <HyperionOrderDialog
        open={open}
        onClose={() => setOpen(false)}
        config={config}
        apiUrl={apiUrl}
      />
    </div>
  );
}
