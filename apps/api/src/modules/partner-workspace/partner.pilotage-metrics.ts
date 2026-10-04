import type { PilotageMetric, PilotageMeasure } from "@coverview/contracts/partner-pilotage";

export type MetricDefinition = {
  group: PilotageMeasure["group"];
  unit: PilotageMeasure["unit"];
  basis: PilotageMeasure["basis"];
  sql: string | null;
  reason?: string;
  zeroWhenEmpty?: boolean;
};
const during = (at: string) => `${at}>=b.from_at and ${at}<b.to_at`;
const row = (
  from: string,
  value = "1::numeric",
  denominator = "null::numeric",
  at = "l.created_at",
  where = "true",
  source = "l.id",
) =>
  `select l.id lead_id,${source} source_id,${at} at,(${value})::numeric value,(${denominator})::numeric denominator from ${from} cross join bounds b where ${where}`;
const count = (
  sql: string,
  basis: MetricDefinition["basis"] = "flow",
  group: MetricDefinition["group"] = "activity",
): MetricDefinition => ({ group, unit: "count", basis, sql, zeroWhenEmpty: true });
const ratio = (sql: string, group: MetricDefinition["group"] = "conversion"): MetricDefinition => ({
  group,
  unit: "percent",
  basis: "cohort",
  sql,
});
const days = (sql: string, basis: MetricDefinition["basis"] = "cohort"): MetricDefinition => ({
  group: "conversion",
  unit: "days",
  basis,
  sql,
});
const firstContact = `(select min(c.at) from contacts c where c.lead_id=l.id and c.at>=l.created_at and c.at<b.to_at)`;
const firstAppointment = `(select min(a.starts_at) from appointments a where a.lead_id=l.id and a.state='completed' and a.starts_at>=l.created_at and a.starts_at<b.observed_until)`;
const firstOffer = `(select min(o.published_at) from offers o where o.lead_id=l.id and o.published_at>=l.created_at and o.published_at<b.to_at)`;
const published = `offers o join leads l on l.id=o.lead_id`;
const cohortPublished = `offers o join leads l on l.id=o.lead_id`;
const firstDecision = `(select min(e.created_at) from events e where e.subject_id=o.id and e.kind in ('client.select','client.refuse') and e.created_at>=o.published_at and e.created_at<b.to_at)`;
const unavailable = (
  group: MetricDefinition["group"],
  unit: MetricDefinition["unit"],
  reason: string,
  basis: MetricDefinition["basis"] = "flow",
): MetricDefinition => ({ group, unit, basis, sql: null, reason });
export const pilotageMetrics: Record<PilotageMetric, MetricDefinition> = {
  new_leads: count(row("cohort l")),
  active_leads: count(
    row("leads l", "1", "null", "now()", "l.stage not in ('draft','completed')"),
    "snapshot",
  ),
  closed_leads: count(
    row(
      "leads l",
      "1",
      "null",
      "l.stage_changed_at",
      `l.stage='completed' and ${during("l.stage_changed_at")}`,
    ),
  ),
  lost_leads: count(
    row(
      "leads l",
      "1",
      "null",
      "l.stage_changed_at",
      `l.stage='completed' and l.result in ('lost','refused','cancelled','client_refusal','no_suitable_solution','abandoned','no_response') and ${during("l.stage_changed_at")}`,
    ),
  ),
  declared_contracts: count(
    row(
      "leads l",
      "1",
      "null",
      "l.stage_changed_at",
      `l.stage='completed' and l.result='contract' and ${during("l.stage_changed_at")}`,
    ),
  ),
  verified_signatures: unavailable("activity", "count", "signature_proof"),
  contacts: count(
    row("contacts c join leads l on l.id=c.lead_id", "1", "null", "c.at", during("c.at"), "c.id"),
  ),
  appointments_scheduled: count(
    row(
      "appointments a join leads l on l.id=a.lead_id",
      "1",
      "null",
      "a.starts_at",
      `a.state='scheduled' and ${during("a.starts_at")}`,
      "a.id",
    ),
  ),
  appointments_completed: count(
    row(
      "appointments a join leads l on l.id=a.lead_id",
      "1",
      "null",
      "a.starts_at",
      `a.state='completed' and a.starts_at<b.observed_until and ${during("a.starts_at")}`,
      "a.id",
    ),
  ),
  tasks_completed: count(
    row(
      "partner_tasks t join leads l on l.id=t.lead_id",
      "1",
      "null",
      "t.completed_at",
      `t.state='done' and ${during("t.completed_at")}`,
      "t.id",
    ),
  ),
  tasks_overdue: count(
    row(
      "partner_tasks t join leads l on l.id=t.lead_id",
      "1",
      "null",
      "t.due_at",
      "t.state='open' and t.due_at<now()",
      "t.id",
    ),
    "snapshot",
  ),
  market_received: count(
    row(
      "partner_market_reservations r join leads l on l.id=r.lead_id",
      "1",
      "null",
      "r.decided_at",
      `r.state='accepted' and ${during("r.decided_at")} and (b.scope_kind='network' or b.scope_kind='organization' and exists(select 1 from partner_members rm where rm.user_id=r.target_id and rm.organization_id=b.organization_id) or b.scope_kind in ('self','individual','team') and r.target_id=any(b.user_ids))`,
      "r.id",
    ),
  ),
  market_transmitted: count(
    row(
      "partner_market_reservations r join leads l on l.id=r.lead_id",
      "1",
      "null",
      "r.decided_at",
      `r.state='accepted' and ${during("r.decided_at")} and (b.scope_kind='network' or b.scope_kind='organization' and exists(select 1 from partner_members rm where rm.user_id=r.publisher_id and rm.organization_id=b.organization_id) or b.scope_kind in ('self','individual','team') and r.publisher_id=any(b.user_ids))`,
      "r.id",
    ),
  ),
  contact_rate: ratio(row("cohort l", `(${firstContact} is not null)::int`, "1")),
  appointment_rate: ratio(row("cohort l", `(${firstAppointment} is not null)::int`, "1")),
  appointment_offer_rate: ratio(
    row(
      "cohort l",
      `coalesce(${firstOffer}>=${firstAppointment},false)::int`,
      "1",
      "l.created_at",
      `${firstAppointment} is not null`,
    ),
  ),
  offer_signature_rate: unavailable("conversion", "percent", "signature_proof", "cohort"),
  transformation_rate: unavailable("conversion", "percent", "signature_proof", "cohort"),
  first_contact_days: days(
    row(
      "cohort l",
      `extract(epoch from (${firstContact}-l.created_at))/86400`,
      "1",
      "l.created_at",
      `${firstContact} is not null`,
    ),
  ),
  first_appointment_days: days(
    row(
      "cohort l",
      `extract(epoch from (${firstAppointment}-l.created_at))/86400`,
      "1",
      "l.created_at",
      `${firstAppointment} is not null`,
    ),
  ),
  first_offer_days: days(
    row(
      "cohort l",
      `extract(epoch from (${firstOffer}-l.created_at))/86400`,
      "1",
      "l.created_at",
      `${firstOffer} is not null`,
    ),
  ),
  first_signature_days: unavailable("conversion", "days", "signature_proof", "cohort"),
  cycle_days: days(
    row(
      "leads l",
      "extract(epoch from (l.stage_changed_at-l.created_at))/86400",
      "1",
      "l.stage_changed_at",
      `l.stage='completed' and ${during("l.stage_changed_at")}`,
    ),
    "flow",
  ),
  stage_days: days(
    row(
      "leads l",
      "extract(epoch from (now()-l.stage_changed_at))/86400",
      "1",
      "l.stage_changed_at",
      "l.stage not in ('draft','completed')",
    ),
    "snapshot",
  ),
  offers_prepared: count(
    row(published, "1", "null", "o.created_at", during("o.created_at"), "o.id"),
    "flow",
    "offers",
  ),
  offers_presented: count(
    row(published, "1", "null", "o.published_at", during("o.published_at"), "o.id"),
    "flow",
    "offers",
  ),
  offers_per_lead: {
    group: "offers",
    unit: "count",
    basis: "cohort",
    sql: row(
      "cohort l",
      `(select count(*) from offers o where o.lead_id=l.id and o.published_at<b.to_at)`,
      "1",
    ),
  },
  decisions: count(
    row(
      "events e join leads l on l.id=e.lead_id",
      "1",
      "null",
      "e.created_at",
      `e.kind in ('client.select','client.refuse','client.keep_current') and ${during("e.created_at")}`,
      "e.id",
    ),
    "flow",
    "offers",
  ),
  offer_open_rate: ratio(
    row(
      cohortPublished,
      "exists(select 1 from events e where e.subject_id=o.id and e.kind='client.view' and e.created_at<b.to_at)::int",
      "1",
      "o.published_at",
      during("o.published_at"),
      "o.id",
    ),
    "offers",
  ),
  offer_selection_rate: ratio(
    row(
      cohortPublished,
      "exists(select 1 from events e where e.subject_id=o.id and e.kind='client.select' and e.created_at<b.to_at)::int",
      "1",
      "o.published_at",
      during("o.published_at"),
      "o.id",
    ),
    "offers",
  ),
  offer_decision_days: {
    group: "offers",
    unit: "days",
    basis: "cohort",
    sql: row(
      cohortPublished,
      `extract(epoch from (${firstDecision}-o.published_at))/86400`,
      "1",
      "o.published_at",
      `${during("o.published_at")} and ${firstDecision} is not null`,
      "o.id",
    ),
  },
  keep_current_rate: ratio(
    row(
      "cohort l",
      "exists(select 1 from events e where e.lead_id=l.id and e.kind='client.keep_current' and e.created_at<b.to_at)::int",
      "1",
      "l.created_at",
      `${firstOffer} is not null`,
    ),
    "offers",
  ),
  satisfaction: {
    group: "quality",
    unit: "rating",
    basis: "flow",
    sql: row(
      "partner_survey_responses r join partner_surveys s on s.id=r.survey_id join leads l on l.id=s.lead_id",
      "(r.response->>'rating')::numeric",
      "1",
      "r.created_at",
      `${during("r.created_at")} and s.invalidated_at is null and s.owner_id=l.current_owner_id and s.subject_key=case when l.client_profile_id is null then 'self:'||l.client_user_id else 'profile:'||l.client_profile_id end`,
      "s.id",
    ),
  },
  survey_responses: count(
    row(
      "partner_survey_responses r join partner_surveys s on s.id=r.survey_id join leads l on l.id=s.lead_id",
      "1",
      "null",
      "r.created_at",
      `${during("r.created_at")} and s.invalidated_at is null and s.owner_id=l.current_owner_id and s.subject_key=case when l.client_profile_id is null then 'self:'||l.client_user_id else 'profile:'||l.client_profile_id end`,
      "s.id",
    ),
    "flow",
    "quality",
  ),
  on_time_rate: ratio(
    row(
      "cohort l",
      "coalesce(l.first_useful_at<=l.first_action_due_at,false)::int",
      "1",
      "l.created_at",
      "l.first_action_due_at is not null and l.first_action_due_at<b.observed_until",
    ),
    "quality",
  ),
  reassignment_rate: ratio(
    row(
      "cohort l",
      "exists(select 1 from events e where e.lead_id=l.id and e.kind in ('lead.transferred','lead.reassignment_required','lead.continuity_escalated') and e.created_at<b.to_at)::int",
      "1",
    ),
    "quality",
  ),
  complaints: count(
    row(
      "quality q join leads l on l.id=q.lead_id",
      "1",
      "null",
      "q.created_at",
      `q.kind='complaint' and ${during("q.created_at")}`,
      "q.id",
    ),
    "flow",
    "quality",
  ),
  quality_checks: count(
    row(
      "quality q join leads l on l.id=q.lead_id",
      "1",
      "null",
      "q.created_at",
      `q.kind in ('verification','corrective_action') and ${during("q.created_at")}`,
      "q.id",
    ),
    "flow",
    "quality",
  ),
  quality_pending: count(
    row(
      "quality q join leads l on l.id=q.lead_id",
      "1",
      "null",
      "q.created_at",
      "coalesce((select a.input->>'action' from partner_quality_actions a where a.case_id=q.id and a.input->>'action'<>'reply' order by a.revision desc limit 1),'')<>'close'",
      "q.id",
    ),
    "snapshot",
    "quality",
  ),
  inactive_leads: count(
    row(
      "leads l",
      "1",
      "null",
      "l.updated_at",
      "l.stage not in ('draft','completed') and greatest(l.created_at,coalesce((select max(e.created_at) from events e where e.lead_id=l.id and e.kind not in ('client.view')),l.created_at))<now()-interval '30 days'",
    ),
    "snapshot",
    "quality",
  ),
  undocumented_contracts: count(
    row(
      "leads l",
      "1",
      "null",
      "l.updated_at",
      "(l.stage='contract_issued' or l.result='contract') and not exists(select 1 from partner_final_policies p where p.lead_id=l.id and p.active)",
    ),
    "snapshot",
    "quality",
  ),
  complete_follow_up_rate: {
    ...ratio(
      row(
        "leads l",
        "(length(trim(l.next_action))>0 and l.due_at is not null)::int",
        "1",
        "now()",
        "l.stage not in ('draft','completed')",
      ),
      "quality",
    ),
    basis: "snapshot",
  },
  pipeline_minimum: unavailable("economy", "chf_minor", "economic_projection", "snapshot"),
  pipeline_maximum: unavailable("economy", "chf_minor", "economic_projection", "snapshot"),
  weighted_pipeline_minimum: unavailable("economy", "chf_minor", "economic_projection", "snapshot"),
  weighted_pipeline_maximum: unavailable("economy", "chf_minor", "economic_projection", "snapshot"),
  confirmed_commission: unavailable("economy", "chf_minor", "economic_projection"),
  received_commission: unavailable("economy", "chf_minor", "economic_projection"),
  signed_commission: unavailable("economy", "chf_minor", "signature_proof"),
  available_commission: unavailable("economy", "chf_minor", "economic_projection", "snapshot"),
  reserved_commission: unavailable("economy", "chf_minor", "economic_projection", "snapshot"),
  paid_commission: unavailable("economy", "chf_minor", "economic_projection"),
  clawback_commission: unavailable("economy", "chf_minor", "economic_projection"),
  recovered_commission: unavailable("economy", "chf_minor", "economic_projection"),
  disputed_commission: unavailable("economy", "chf_minor", "economic_projection", "snapshot"),
  recovery_due_commission: unavailable("economy", "chf_minor", "economic_projection", "snapshot"),
  coverview_revenue: unavailable("economy", "chf_minor", "economic_projection"),
  proposed_savings: unavailable("offers", "chf_minor", "comparable_verified_premiums", "cohort"),
  policy_differences: unavailable("offers", "count", "verified_policy_comparison"),
};

/** Same rows feed totals and drill-down. Count, ratio and average grains never share joins. */
export function metricValue(
  definition: MetricDefinition,
  numerator: number | null,
  denominator: number | null,
  population: number,
) {
  if (!population) return definition.zeroWhenEmpty ? 0 : null;
  if (denominator !== null)
    return denominator
      ? ((numerator ?? 0) / denominator) * (definition.unit === "percent" ? 100 : 1)
      : null;
  return numerator;
}
