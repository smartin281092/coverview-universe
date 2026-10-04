import type { PoolClient } from "pg";
import { leadSourceReviewRevisionSql } from "../document-intelligence/index.js";
import type { MetricDefinition } from "./partner.pilotage-metrics.js";

export const signatureMetricKeys = [
  "verified_signatures",
  "offer_signature_rate",
  "transformation_rate",
  "first_signature_days",
] as const;
const first = `(select min(s.created_at) from signatures s where s.lead_id=l.id and s.created_at>=l.created_at and s.created_at<b.observed_until)`;
const rows = (
  from: string,
  value: string,
  denominator: string,
  at: string,
  source: string,
  where: string,
) =>
  `select l.id lead_id,${source} source_id,${at} at,(${value})::numeric value,(${denominator})::numeric denominator from ${from} cross join bounds b where ${where}`;
const definitions: Record<(typeof signatureMetricKeys)[number], MetricDefinition> = {
  verified_signatures: {
    group: "activity",
    unit: "count",
    basis: "flow",
    zeroWhenEmpty: true,
    reason: "native_signature_receipt",
    sql: rows(
      "signatures s join leads l on l.id=s.lead_id",
      "1",
      "null",
      "s.created_at",
      "s.id",
      "s.created_at>=b.from_at and s.created_at<b.observed_until",
    ),
  },
  offer_signature_rate: {
    group: "conversion",
    unit: "percent",
    basis: "cohort",
    reason: "native_signature_receipt",
    sql: rows(
      "offers o join leads l on l.id=o.lead_id",
      "exists(select 1 from signatures s where s.offer_id=o.id and s.created_at>=o.published_at and s.created_at<b.observed_until)::int",
      "1",
      "o.published_at",
      "o.id",
      "o.published_at>=b.from_at and o.published_at<b.to_at",
    ),
  },
  transformation_rate: {
    group: "conversion",
    unit: "percent",
    basis: "cohort",
    reason: "native_signature_receipt",
    sql: rows("cohort l", `(${first} is not null)::int`, "1", "l.created_at", "l.id", "true"),
  },
  first_signature_days: {
    group: "conversion",
    unit: "days",
    basis: "cohort",
    reason: "native_signature_receipt",
    sql: rows(
      "cohort l",
      `extract(epoch from (${first}-l.created_at))/86400`,
      "1",
      first,
      "l.id",
      `${first} is not null`,
    ),
  },
};
// The source and current owner predicates match conclusion evidence. An event or state alone
// cannot enter these metrics, and an old catalogue must remain explicitly unavailable.
const ctes = `,signatures as materialized (
  select s.id,s.created_at,c.lead_id,c.offer_id from partner_offer_signatures s
  join partner_conclusions c on c.id=s.conclusion_id join offers o on o.id=c.offer_id
  join leads l on l.id=c.lead_id join files f on f.id=o.document_id
  where c.invalidated_at is null and c.withdrawn_at is null
  and c.owner_id=l.current_owner_id and s.actor_id=c.owner_id
  and c.subject_key=case when l.client_profile_id is null then 'self:'||l.client_user_id else 'profile:'||l.client_profile_id end
  and s.input->>'contentHash'=c.content_hash and s.input->'accepted'='true'::jsonb
  and f.deleted_at is null and f.scan_version is not null and f.state in ('ready','failed')
  and o.source_snapshot->>'checksum'=f.checksum
  and (o.source_snapshot->>'generation')::integer=f.generation
  and (o.source_snapshot->>'reviewRevision')::integer=${leadSourceReviewRevisionSql}
  and o.source_snapshot->>'category'=f.category
  and (o.source_snapshot->>'categoryCorrected')::boolean=f.category_corrected
  and coalesce(o.source_snapshot->'analysis','null'::jsonb)=coalesce(f.analysis,'null'::jsonb)
)`;
export async function signatureProjection(tx: PoolClient) {
  const available = !!(
    await tx.query<{ table: string | null }>(
      "select to_regclass('partner_conclusions')::text as table",
    )
  ).rows[0]?.table;
  return available ? { definitions, ctes } : { definitions: {}, ctes: "" };
}
