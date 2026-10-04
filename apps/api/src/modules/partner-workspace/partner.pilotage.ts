import type { Pool, PoolClient } from "pg";
import {
  pilotageMetricSchema,
  pilotageQuerySchema,
  pilotageSchema,
  pilotageSourcesSchema,
  pilotageSourceQuerySchema,
  pilotageOptionsSchema,
  type PilotageMeasure,
  type PilotageMetric,
  type PilotageQuery,
  type PilotageScope,
} from "@coverview/contracts/partner-pilotage";
import { context, fail, visible, assigned, managed, type PartnerActor } from "./partner.policy.js";
import { economyRead, economyCursor, economyNext } from "./partner.commercial.js";
import { pilotageMetrics, metricValue } from "./partner.pilotage-metrics.js";
import {
  resolvePilotageScope,
  scopeFromQuery,
  pilotagePopulation,
  pilotageCtes,
} from "./partner.pilotage-scope.js";
import { economicMetricKeys, pilotageEconomy } from "./partner.pilotage-economy.js";
import { comparisonMetricKeys, pilotageComparisons } from "./partner.pilotage-comparisons.js";

const numeric = (value: string | number | null) => {
  if (value === null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > Number.MAX_SAFE_INTEGER) fail("PARTNER_ACTION_REQUIRED");
  return n;
};
type Aggregate = {
  metric: PilotageMetric;
  numerator: string | null;
  denominator: string | null;
  population: string;
};
export async function pilotageMeasures(
  tx: PoolClient,
  actor: PartnerActor,
  query: PilotageQuery,
  scope: PilotageScope,
  only?: PilotageMetric,
) {
  const population = await pilotagePopulation(tx, actor, query, scope);
  const keys = only ? [only] : pilotageMetricSchema.options;
  const selections = keys.flatMap((metric) =>
    pilotageMetrics[metric].sql
      ? [`select '${metric}'::text metric,m.* from (${pilotageMetrics[metric].sql}) m`]
      : [],
  );
  const rows = selections.length
    ? (
        await tx.query<Aggregate>(
          `with ${pilotageCtes}, metric_rows as (${selections.join(" union all ")}) select metric,sum(value)::text numerator,sum(denominator)::text denominator,count(*)::text population from metric_rows group by metric`,
          population.values,
        )
      ).rows
    : [];
  const byMetric = new Map(rows.map((row) => [row.metric, row]));
  const measures: PilotageMeasure[] = keys.map((metric) => {
    const definition = pilotageMetrics[metric],
      row = byMetric.get(metric),
      count = Number(row?.population ?? 0),
      numerator = numeric(row?.numerator ?? null),
      denominator = numeric(row?.denominator ?? null),
      value = definition.sql ? metricValue(definition, numerator, denominator, count) : null;
    return {
      metric,
      group: definition.group,
      unit: definition.unit,
      basis: definition.basis,
      value,
      numerator,
      denominator,
      population: count,
      canInspect: !!definition.sql && (actor.administrator || metric !== "satisfaction"),
      status: !definition.sql
        ? "source_unavailable"
        : value === null
          ? "no_observations"
          : "available",
      reason: definition.reason ?? null,
    };
  });
  if (keys.some((key) => economicMetricKeys.some((metric) => metric === key))) {
    const economic = await pilotageEconomy(tx, actor, query, scope, population.values);
    for (const measure of economic.measures) {
      const index = measures.findIndex((m) => m.metric === measure.metric);
      if (index >= 0) measures[index] = measure;
    }
  }
  if (keys.some((key) => comparisonMetricKeys.some((metric) => metric === key))) {
    const compared = await pilotageComparisons(tx, population.values);
    for (const measure of compared.measures) {
      const index = measures.findIndex((m) => m.metric === measure.metric);
      if (index >= 0) measures[index] = measure;
    }
  }
  return { measures, population };
}

export function createPilotageOperations(pool: Pool) {
  return {
    pilotage: (actor: PartnerActor, raw: unknown) =>
      economyRead(pool, actor, async (tx) => {
        const query = pilotageQuerySchema.parse(raw),
          scope = await resolvePilotageScope(tx, actor, scopeFromQuery(query));
        const current = await pilotageMeasures(tx, actor, query, scope),
          duration = Date.parse(query.to) - Date.parse(query.from),
          previous = {
            ...query,
            from: new Date(Date.parse(query.from) - duration).toISOString(),
            to: query.from,
          };
        const compared = await pilotageMeasures(tx, actor, previous, scope);
        const breakdowns = [];
        for (const [dimension, column, label] of [
          ["stage", "l.stage", "l.stage"],
          ["category", "l.category", "l.category"],
          ["advisor", "coalesce(l.responsible_id,'')", "l.advisor_name"],
          ["organization", "coalesce(l.organization_id,'')", "l.organization_name"],
          ["source", "coalesce(l.details->>'source','')", "coalesce(l.details->>'source','')"],
        ] as const) {
          const rows = (
            await tx.query<{ key: string; label: string; count: number }>(
              `with ${pilotageCtes} select ${column} key,${label} label,count(*)::int count from leads l where l.stage not in ('draft','completed') group by ${column},${label} order by count desc,key limit 21`,
              current.population.values,
            )
          ).rows;
          breakdowns.push({
            dimension,
            items: rows.slice(0, 20).map((r) => ({ ...r, selected: null, selectionRate: null })),
            truncated: rows.length > 20,
          });
        }
        const companies = (
          await tx.query<{ key: string; label: string; count: number; selected: number }>(
            `with ${pilotageCtes} select coalesce(o.data->>'company','') key,coalesce(o.data->>'company','') label,count(*)::int count,count(*) filter(where exists(select 1 from events e where e.subject_id=o.id and e.kind='client.select' and e.created_at<b.to_at))::int selected from offers o cross join bounds b where o.published_at>=b.from_at and o.published_at<b.to_at group by o.data->>'company' order by count desc,key limit 21`,
            current.population.values,
          )
        ).rows;
        const allBreakdowns = [
          ...breakdowns,
          {
            dimension: "company" as const,
            items: companies
              .slice(0, 20)
              .map((r) => ({ ...r, selectionRate: r.count ? (r.selected / r.count) * 100 : null })),
            truncated: companies.length > 20,
          },
        ];
        let network = null;
        if (actor.administrator && scope.kind === "network") {
          const row = (
            await tx.query<{
              active_organizations: number;
              active_advisors: number;
              pending_members: number;
              suspended_members: number;
              new_members: number;
            }>(
              `select (select count(*)::int from partner_organizations where state='approved') active_organizations,count(*) filter(where m.state='approved' and o.state='approved' and m.roles ? 'advisor' and (m.review_due_at is null or m.review_due_at>now()))::int active_advisors,count(*) filter(where m.state in ('submitted','needs_information'))::int pending_members,count(*) filter(where m.state='suspended' or o.state='suspended')::int suspended_members,count(*) filter(where m.created_at>=$1 and m.created_at<$2)::int new_members from partner_members m join partner_organizations o on o.id=m.organization_id`,
              [query.from, query.to],
            )
          ).rows[0]!;
          network = {
            activeOrganizations: row.active_organizations,
            activeAdvisors: row.active_advisors,
            pendingMembers: row.pending_members,
            suspendedMembers: row.suspended_members,
            newMembers: row.new_members,
          };
        }
        return pilotageSchema.parse({
          calculatedAt: new Date().toISOString(),
          from: query.from,
          to: query.to,
          comparisonFrom: previous.from,
          comparisonTo: previous.to,
          scope,
          leadCount: current.population.ids.length,
          measures: current.measures,
          comparison: compared.measures.map((m) =>
            m.basis === "snapshot"
              ? {
                  ...m,
                  value: null,
                  numerator: null,
                  denominator: null,
                  status: "source_unavailable",
                  reason: "historical_snapshot",
                }
              : m,
          ),
          breakdowns: allBreakdowns,
          network,
        });
      }),
    pilotageSources: (actor: PartnerActor, raw: unknown) =>
      economyRead(pool, actor, async (tx) => {
        const sourceQuery = pilotageSourceQuerySchema.parse(raw),
          { metric, cursor, ...query } = sourceQuery,
          scope = await resolvePilotageScope(tx, actor, scopeFromQuery(query)),
          definition = pilotageMetrics[metric];
        const population = await pilotagePopulation(tx, actor, query, scope),
          [at, after] = economyCursor(cursor);
        if (comparisonMetricKeys.some((key) => key === metric)) {
          const compared = await pilotageComparisons(tx, population.values),
            measure = compared.measures.find((m) => m.metric === metric);
          if (!measure?.canInspect) fail("PARTNER_ACCESS_DENIED", 403);
          const sources = compared.sources
            .filter(
              (s) =>
                s.metric === metric &&
                (!at ||
                  s.at.toISOString() < at ||
                  (s.at.toISOString() === at && s.sourceId < (after ?? ""))),
            )
            .sort(
              (a, b) => b.at.getTime() - a.at.getTime() || b.sourceId.localeCompare(a.sourceId),
            );
          return pilotageSourcesSchema.parse({
            metric,
            items: sources.slice(0, 20).map((s) => ({ ...s, at: s.at.toISOString() })),
            nextCursor:
              sources.length > 20
                ? economyNext({ created_at: sources[19]!.at, id: sources[19]!.sourceId })
                : null,
          });
        }
        if (economicMetricKeys.some((key) => key === metric)) {
          const economic = await pilotageEconomy(tx, actor, query, scope, population.values),
            measure = economic.measures.find((m) => m.metric === metric);
          if (!measure?.canInspect) fail("PARTNER_ACCESS_DENIED", 403);
          const sources = economic.sources
            .filter(
              (s) =>
                s.metric === metric &&
                (!at ||
                  s.at.toISOString() < at ||
                  (s.at.toISOString() === at && s.sourceId < (after ?? ""))),
            )
            .sort(
              (a, b) => b.at.getTime() - a.at.getTime() || b.sourceId.localeCompare(a.sourceId),
            );
          return pilotageSourcesSchema.parse({
            metric,
            items: sources.slice(0, 20).map((s) => ({ ...s, at: s.at.toISOString() })),
            nextCursor:
              sources.length > 20
                ? economyNext({ created_at: sources[19]!.at, id: sources[19]!.sourceId })
                : null,
          });
        }
        if (!definition.sql || (metric === "satisfaction" && !actor.administrator))
          fail("PARTNER_ACCESS_DENIED", 403);
        const rows = (
          await tx.query<{
            lead_id: string;
            title: string;
            source_id: string;
            at: Date;
            value: string | null;
            denominator: string | null;
          }>(
            `with ${pilotageCtes},sources as (${definition.sql}) select s.*,l.title from sources s join leads l on l.id=s.lead_id where ($13::timestamptz is null or (coalesce(s.at,'1970-01-01'::timestamptz),s.source_id)<($13::timestamptz,$14::text)) order by coalesce(s.at,'1970-01-01'::timestamptz) desc,s.source_id desc limit 21`,
            [...population.values, at, after],
          )
        ).rows;
        return pilotageSourcesSchema.parse({
          metric,
          items: rows.slice(0, 20).map((r) => ({
            leadId: r.lead_id,
            title: r.title,
            sourceId: r.source_id,
            at: r.at?.toISOString() ?? null,
            value: numeric(r.value),
            denominator: numeric(r.denominator),
          })),
          nextCursor:
            rows.length > 20
              ? economyNext({ created_at: rows[19]!.at ?? new Date(0), id: rows[19]!.source_id })
              : null,
        });
      }),
    pilotageOptions: (actor: PartnerActor) =>
      economyRead(pool, actor, async (tx) => {
        if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
        const ctx = await context(tx, actor, true);
        if (!ctx.operational) fail("PARTNER_ACCESS_DENIED", 403);
        const people = (
          await tx.query<{
            id: string;
            name: string;
            organization_id: string;
            organization_name: string;
          }>(
            `select m.user_id id,m.application->>'name' name,m.organization_id,o.name organization_name from partner_members m join partner_organizations o on o.id=m.organization_id where $2::boolean or m.user_id=$1 or $3::boolean and m.organization_id=$4 order by name,m.user_id limit 101`,
            [
              actor.userId,
              actor.administrator,
              ctx.canManage,
              ctx.application?.organizationId ?? null,
            ],
          )
        ).rows;
        const organizations = (
          await tx.query<{ id: string; name: string }>(
            "select id,name from partner_organizations where $1::boolean or id=$2 order by name,id limit 101",
            [actor.administrator, ctx.application?.organizationId ?? null],
          )
        ).rows;
        const predicate = `(${visible(actor)}) and (${actor.administrator ? "true" : `${assigned} or ${managed}`})`;
        const values: { sources: string[]; companies: string[]; products: string[] } = {
          sources: [],
          companies: [],
          products: [],
        };
        let truncated = people.length > 100 || organizations.length > 100;
        for (const [key, column, join] of [
          ["sources", "l.details->>'source'", ""],
          ["companies", "o.data->>'company'", "join partner_offers o on o.lead_id=l.id"],
          ["products", "o.data->>'product'", "join partner_offers o on o.lead_id=l.id"],
        ] as const) {
          const rows = (
            await tx.query<{ value: string }>(
              `select distinct ${column} value from partner_leads l ${join} where ${predicate} and ${column} is not null order by value limit 101`,
              [actor.userId],
            )
          ).rows;
          values[key] = rows.slice(0, 100).map((r) => r.value);
          truncated ||= rows.length > 100;
        }
        return pilotageOptionsSchema.parse({
          canNetwork: actor.administrator,
          canManageOrganization: ctx.canManage,
          organizationId: ctx.application?.organizationId ?? null,
          people: people.slice(0, 100).map((p) => ({
            id: p.id,
            name: p.name,
            organizationId: p.organization_id,
            organizationName: p.organization_name,
          })),
          organizations: organizations.slice(0, 100),
          ...values,
          truncated,
        });
      }),
  };
}
