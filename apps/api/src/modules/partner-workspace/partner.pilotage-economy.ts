import type { PoolClient } from "pg";
import {
  commercialTermsSchema,
  economyEntryInputSchema,
} from "@coverview/contracts/partner-economy";
import type {
  PilotageMetric,
  PilotageScope,
  PilotageQuery,
  PilotageMeasure,
} from "@coverview/contracts/partner-pilotage";
import type { PartnerActor } from "./partner.policy.js";
import {
  calculateEconomy,
  economyEstimateShare,
  type EconomyPosting,
} from "./partner.economy-calculation.js";
import { pilotageCtes } from "./partner.pilotage-scope.js";
import { pilotageMetrics } from "./partner.pilotage-metrics.js";

export const economicMetricKeys = [
  "pipeline_minimum",
  "pipeline_maximum",
  "weighted_pipeline_minimum",
  "weighted_pipeline_maximum",
  "confirmed_commission",
  "received_commission",
  "available_commission",
  "reserved_commission",
  "paid_commission",
  "clawback_commission",
  "recovered_commission",
  "disputed_commission",
  "recovery_due_commission",
  "coverview_revenue",
] as const satisfies readonly PilotageMetric[];
type EconomicMetric = (typeof economicMetricKeys)[number];
type EconomicSource = {
  metric: EconomicMetric;
  leadId: string;
  title: string;
  sourceId: string;
  at: Date;
  value: number | null;
  denominator: null;
};
export async function pilotageEconomy(
  tx: PoolClient,
  actor: PartnerActor,
  query: PilotageQuery,
  scope: PilotageScope,
  values: unknown[],
) {
  const personal =
    scope.kind === "self" ? actor.userId : scope.kind === "individual" ? scope.userIds[0]! : null;
  const permitted = actor.administrator || personal === actor.userId;
  const empty = (
    metric: EconomicMetric,
    status: PilotageMeasure["status"],
    reason: string,
  ): PilotageMeasure => ({
    metric,
    group: "economy",
    unit: "chf_minor",
    basis: pilotageMetrics[metric].basis,
    value: null,
    numerator: null,
    denominator: null,
    population: 0,
    canInspect: false,
    status,
    reason,
  });
  if (!permitted)
    return {
      sources: [] as EconomicSource[],
      measures: economicMetricKeys.map((m) => empty(m, "restricted", "personal_economy_only")),
    };
  const cases = (
    await tx.query<{
      id: string;
      lead_id: string;
      title: string;
      stage: string;
      publisher_id: string;
      target_id: string;
      terms: unknown;
      created_at: Date;
    }>(
      `with ${pilotageCtes} select c.id,l.id lead_id,l.title,l.stage,r.publisher_id,r.target_id,t.terms,c.created_at from partner_economy_cases c join partner_market_reservations r on r.id=c.agreement_id join partner_commercial_conditions t on t.id=r.condition_id join leads l on l.id=r.lead_id where c.stream='contract_commission' and r.state='accepted' and ($11::boolean or r.publisher_id=$1 or r.target_id=$1 or exists(select 1 from jsonb_array_elements(t.terms->'contributors') contributor where contributor->>'userId'=$1)) order by c.created_at,c.id limit 501`,
      values,
    )
  ).rows;
  if (cases.length > 500)
    return {
      sources: [] as EconomicSource[],
      measures: economicMetricKeys.map((m) => empty(m, "volume_limit", "economic_volume")),
    };
  const entries = (
    await tx.query<{
      id: string;
      case_id: string;
      revision: number;
      entry: unknown;
      created_at: Date;
    }>(
      "select * from partner_economy_entries where case_id=any($1::text[]) order by case_id,revision limit 10001",
      [cases.map((c) => c.id)],
    )
  ).rows;
  if (entries.length > 10000)
    return {
      sources: [] as EconomicSource[],
      measures: economicMetricKeys.map((m) => empty(m, "volume_limit", "economic_volume")),
    };
  const byCase = new Map<string, (EconomyPosting & { createdAt: Date })[]>();
  for (const e of entries) {
    const postings = byCase.get(e.case_id) ?? [];
    postings.push({
      id: e.id,
      revision: e.revision,
      entry: economyEntryInputSchema.parse(e.entry),
      createdAt: e.created_at,
    });
    byCase.set(e.case_id, postings);
  }
  const sources: EconomicSource[] = [],
    from = Date.parse(query.from),
    until = Math.min(Date.parse(query.to), Date.now());
  for (const c of cases) {
    const terms = commercialTermsSchema.parse(c.terms),
      postings = byCase.get(c.id) ?? [];
    if (postings.length > 1000)
      return {
        sources: [] as EconomicSource[],
        measures: economicMetricKeys.map((m) => empty(m, "volume_limit", "economic_volume")),
      };
    const calc = (end: number) =>
      calculateEconomy(
        terms,
        c.publisher_id,
        c.target_id,
        false,
        postings.filter((p) => p.createdAt.getTime() < end),
      );
    const now = calc(Date.now() + 1),
      end = calc(until),
      start = calc(from);
    const own = (v: ReturnType<typeof calculateEconomy>) =>
      personal ? v.balances.find((b) => b.beneficiary === personal) : null;
    const endOwn = own(end),
      startOwn = own(start),
      nowOwn = own(now);
    const push = (metric: EconomicMetric, value: number | null, at = c.created_at) =>
      sources.push({
        metric,
        leadId: c.lead_id,
        title: c.title,
        sourceId: c.id,
        at,
        value,
        denominator: null,
      });
    if (c.stage !== "completed" && c.stage !== "draft") {
      const estimate = now.estimate
        ? personal
          ? economyEstimateShare(now.estimate, terms, c.publisher_id, c.target_id, personal)
          : now.estimate
        : null;
      push("pipeline_minimum", estimate?.minimumMinor ?? null);
      push("pipeline_maximum", estimate?.maximumMinor ?? null);
      push("weighted_pipeline_minimum", estimate?.weightedMinimumMinor ?? null);
      push("weighted_pipeline_maximum", estimate?.weightedMaximumMinor ?? null);
    }
    if (c.created_at.getTime() < until) {
      const endPostings = postings.filter((p) => p.createdAt.getTime() < until),
        hasReceipt = endPostings.some((p) => p.entry.kind === "receive");
      const last = endPostings.at(-1)?.createdAt ?? c.created_at;
      const confirmed = personal ? (endOwn?.confirmedMinor ?? null) : end.confirmedMinor;
      const priorConfirmed = personal ? (startOwn?.confirmedMinor ?? null) : start.confirmedMinor;
      push(
        "confirmed_commission",
        confirmed === null ? null : confirmed - (priorConfirmed ?? 0),
        last,
      );
      // Flow = change in the ledger replay over the period, including dated reversals.
      // No other party's shares enter a personal measure.
      push(
        "received_commission",
        !hasReceipt
          ? null
          : personal
            ? (endOwn?.receivedMinor ?? null) === null
              ? null
              : endOwn!.receivedMinor - (startOwn?.receivedMinor ?? 0)
            : end.receivedMinor - start.receivedMinor,
        last,
      );
      if (actor.administrator)
        push(
          "coverview_revenue",
          !hasReceipt
            ? null
            : (end.balances.find((b) => b.beneficiary === "coverview")?.receivedMinor ?? 0) -
                (start.balances.find((b) => b.beneficiary === "coverview")?.receivedMinor ?? 0),
          last,
        );
      for (const [metric, field] of [
        ["paid_commission", "paidMinor"],
        ["clawback_commission", "clawbackMinor"],
        ["recovered_commission", "recoveredMinor"],
      ] as const) {
        const total = (projection: ReturnType<typeof calculateEconomy>) =>
          personal
            ? (own(projection)?.[field] ?? null)
            : projection.balances.reduce((n, b) => n + b[field], 0);
        const current = total(end),
          previous = total(start);
        push(
          metric,
          end.confirmedMinor === null || current === null ? null : current - (previous ?? 0),
          last,
        );
      }
    }
    push(
      "available_commission",
      now.confirmedMinor === null
        ? null
        : personal
          ? (nowOwn?.availableMinor ?? null)
          : now.balances.reduce((sum, b) => sum + b.availableMinor, 0),
    );
    push(
      "reserved_commission",
      now.confirmedMinor === null
        ? null
        : personal
          ? (nowOwn?.reservedMinor ?? null)
          : now.balances.reduce((sum, b) => sum + b.reservedMinor, 0),
    );
    for (const [metric, field] of [
      ["disputed_commission", "disputedMinor"],
      ["recovery_due_commission", "recoveryDueMinor"],
    ] as const)
      push(
        metric,
        now.confirmedMinor === null
          ? null
          : personal
            ? (nowOwn?.[field] ?? null)
            : now.balances.reduce((sum, b) => sum + b[field], 0),
      );
  }
  const measures = economicMetricKeys.map((metric) => {
    if (metric === "coverview_revenue" && !actor.administrator)
      return empty(metric, "restricted", "coverview_only");
    const rows = sources.filter((s) => s.metric === metric),
      known = rows.filter((s) => s.value !== null),
      sum = known.reduce((n, s) => n + s.value!, 0);
    if (!Number.isSafeInteger(sum)) return empty(metric, "volume_limit", "economic_volume");
    if (!rows.length) return empty(metric, "no_observations", "no_economic_cases");
    return {
      ...empty(
        metric,
        known.length === rows.length ? "available" : "source_unavailable",
        known.length === rows.length
          ? personal
            ? "personal_share"
            : "case_gross"
          : "incomplete_economic_sources",
      ),
      value: known.length === rows.length ? sum : null,
      numerator: known.length ? sum : null,
      denominator: known.length,
      population: rows.length,
      canInspect: true,
    };
  });
  return { sources, measures };
}
