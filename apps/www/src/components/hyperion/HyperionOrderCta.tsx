import { HealthGradient } from "../health-insurance/HealthGradient";
import { ArrowIcon } from "./HyperionIcons";
import { requestOrder } from "./hyperion-store";

/** The closing call to action: the comparator's shader button, opening the order dialog. */
export default function HyperionOrderCta({ label }: { label: string }) {
  return (
    <button type="button" className="lp-button hp-cta" onClick={requestOrder}>
      <HealthGradient />
      {label}
      <ArrowIcon />
    </button>
  );
}
