import type { PoolClient } from "pg";
import type { PilotageMeasure } from "@coverview/contracts/partner-pilotage";
import { readCurrentContract, compareCurrentContract } from "./partner.contract.js";
import { readFinalPolicies } from "./partner.final-policy.js";
import { readOffers } from "./partner.offers.js";
import { pilotageCtes } from "./partner.pilotage-scope.js";
import { PartnerError } from "./partner.policy.js";

export const comparisonMetricKeys = ["proposed_savings", "policy_differences"] as const;
type ComparisonSource = {
  metric: (typeof comparisonMetricKeys)[number];
  leadId: string;
  title: string;
  sourceId: string;
  at: Date;
  value: number | null;
  denominator: number | null;
};
export async function pilotageComparisons(tx: PoolClient, values: unknown[]) {
  const sources: ComparisonSource[] = [],
    measures: PilotageMeasure[] = [];
  for (const metric of comparisonMetricKeys) {
    const offers = metric === "proposed_savings";
    const rows = (
      await tx.query<{
        id: string;
        lead_id: string;
        title: string;
        client_user_id: string | null;
        client_profile_id: string | null;
        at: Date;
      }>(
        `with ${pilotageCtes} select ${offers ? "o.id" : "p.id"} id,l.id lead_id,l.title,l.current_owner_id client_user_id,l.client_profile_id,${offers ? "o.published_at" : "p.created_at"} at from ${offers ? "offers o" : "partner_final_policies p join offers o on o.id=p.offer_id"} join leads l on l.id=${offers ? "o.lead_id" : "p.lead_id"} cross join bounds b where ${offers ? "o.active and o.published_at>=b.from_at and o.published_at<b.to_at" : "p.active and p.created_at>=b.from_at and p.created_at<b.to_at"} order by at desc,id limit 101`,
        values,
      )
    ).rows;
    const base = {
      metric,
      group: "offers" as const,
      unit: offers ? ("chf_minor" as const) : ("count" as const),
      basis: "cohort" as const,
      value: null,
      numerator: null,
      denominator: null,
      population: rows.length,
      canInspect: false,
    };
    if (rows.length > 100) {
      measures.push({ ...base, status: "volume_limit", reason: "comparison_volume" });
      continue;
    }
    for (const row of rows) {
      const lead = {
        id: row.lead_id,
        clientUserId: row.client_user_id,
        clientProfileId: row.client_profile_id,
      };
      let value: number | null = null;
      try {
        if (offers) {
          const current = await readCurrentContract(tx, lead),
            offer = (await readOffers(tx, lead.id, false, { offerId: row.id })).items[0];
          const comparison = offer ? compareCurrentContract(current, [offer])[0] : null;
          if (
            comparison?.premiumStatus === "calculated" &&
            comparison.annualDifferenceMinor !== null
          )
            value = -comparison.annualDifferenceMinor;
        } else {
          const policy = (await readFinalPolicies(tx, lead, false, { id: row.id })).items[0];
          if (policy && ["checked", "differences"].includes(policy.reviewState))
            value = policy.reviewState === "differences" ? 1 : 0;
        }
      } catch (error) {
        // Population access was established before this projection. A withdrawn document
        // or missing original offer invalidates this observation, not the whole report.
        if (
          !(error instanceof PartnerError) ||
          !["PARTNER_NOT_FOUND", "PARTNER_INVALID_CLIENT", "PARTNER_INVALID_DOCUMENT"].includes(
            error.code,
          )
        )
          throw error;
      }
      sources.push({
        metric,
        leadId: row.lead_id,
        title: row.title,
        sourceId: row.id,
        at: row.at,
        value,
        denominator: value === null ? null : 1,
      });
    }
    const selected = sources.filter((s) => s.metric === metric),
      known = selected.filter((s) => s.value !== null),
      sum = known.reduce((total, s) => total + s.value!, 0);
    measures.push({
      ...base,
      value: known.length ? (offers ? sum / known.length : sum) : null,
      numerator: known.length ? sum : null,
      denominator: known.length,
      population: rows.length,
      canInspect: !!rows.length,
      status: known.length ? "available" : "no_observations",
      reason:
        known.length === rows.length ? "current_canonical_comparison" : "partially_comparable",
    });
  }
  return { sources, measures };
}
