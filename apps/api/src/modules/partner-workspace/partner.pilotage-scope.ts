import type { PoolClient } from "pg";
import {
  pilotageScopeSchema,
  type PilotageScope,
  type PilotageQuery,
} from "@coverview/contracts/partner-pilotage";
import {
  context,
  fail,
  membership,
  visible,
  assigned,
  managed,
  authorityCurrent,
  type PartnerActor,
} from "./partner.policy.js";

export async function resolvePilotageScope(
  tx: PoolClient,
  actor: PartnerActor,
  raw: PilotageScope,
  write = false,
) {
  if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
  const scope = pilotageScopeSchema.parse(raw),
    ctx = await context(tx, actor, true);
  if (!ctx.operational) fail("PARTNER_ACCESS_DENIED", 403);
  if (scope.kind === "network" && !actor.administrator) fail("PARTNER_ACCESS_DENIED", 403);
  if (scope.kind === "individual") {
    const userId = scope.userIds[0]!;
    if (userId !== actor.userId && !actor.administrator) {
      if (write || !ctx.canManage) fail("PARTNER_ACCESS_DENIED", 403);
      const target = await membership(tx, userId, true);
      if (!target || target.organizationId !== ctx.application?.organizationId)
        fail("PARTNER_NOT_FOUND", 404);
    }
    if (actor.administrator && !(await membership(tx, userId, true)))
      fail("PARTNER_NOT_FOUND", 404);
  }
  if (scope.kind === "organization" || scope.kind === "team") {
    if (
      !actor.administrator &&
      (!ctx.canManage || scope.organizationId !== ctx.application?.organizationId)
    )
      fail("PARTNER_ACCESS_DENIED", 403);
    if (
      !(
        await tx.query("select id from partner_organizations where id=$1 for share", [
          scope.organizationId,
        ])
      ).rowCount
    )
      fail("PARTNER_NOT_FOUND", 404);
    if (scope.kind === "team") {
      const people = (
        await tx.query<{ user_id: string }>(
          "select user_id from partner_members where organization_id=$1 and user_id=any($2::text[]) for share",
          [scope.organizationId, scope.userIds],
        )
      ).rows;
      if (people.length !== scope.userIds.length) fail("PARTNER_NOT_FOUND", 404);
    }
  }
  return scope;
}
export function scopeFromQuery(query: PilotageQuery): PilotageScope {
  return pilotageScopeSchema.parse({
    kind: query.scope,
    organizationId: query.organizationId ?? null,
    userIds: query.members ? query.members.split(",") : [],
  });
}
const scopedLeadPredicate = `($8::text='network' or $8='organization' and exists(select 1 from partner_members pm where pm.user_id=l.responsible_id and pm.organization_id=$9) or $8 in ('self','individual','team') and (l.responsible_id=any($10::text[]) or exists(select 1 from partner_contributors pc where pc.lead_id=l.id and pc.user_id=any($10::text[]) and pc.revoked_at is null and pc.access_scope='advice' and ${authorityCurrent("pc")})))`;
const filteredLeadPredicate = `($4::text is null or l.category=$4) and ($5::text is null or l.details->>'source'=$5) and (($6::text is null and $7::text is null) or exists(select 1 from partner_offers fo where fo.lead_id=l.id and ($6::text is null or fo.data->>'company'=$6) and ($7::text is null or fo.data->>'product'=$7)))`;
export async function pilotagePopulation(
  tx: PoolClient,
  actor: PartnerActor,
  query: PilotageQuery,
  scope: PilotageScope,
) {
  const values: unknown[] = [
    actor.userId,
    query.from,
    query.to,
    query.category ?? null,
    query.source ?? null,
    query.company ?? null,
    query.product ?? null,
    scope.kind,
    scope.organizationId,
    scope.kind === "self" ? [actor.userId] : scope.userIds,
    actor.administrator,
  ];
  // A period query must not return a partial portfolio. The explicit ceiling also bounds locks.
  const leads = (
    await tx.query<{ id: string }>(
      `select l.id from partner_leads l where $2::timestamptz<$3::timestamptz and $11::boolean=$11 and (${visible(actor)}) and (${actor.administrator ? "true" : `${assigned} or ${managed}`}) and ${scopedLeadPredicate} and ${filteredLeadPredicate} order by l.id limit 10001 for share of l`,
      values,
    )
  ).rows;
  if (leads.length > 10000) fail("PARTNER_ACTION_REQUIRED");
  const ids = leads.map((l) => l.id);
  await tx.query(
    "select p.id from managed_profiles p where exists(select 1 from partner_leads l where l.id=any($1::text[]) and l.client_profile_id=p.id) order by p.id for share",
    [ids],
  );
  const contributors = (
    await tx.query<{ user_id: string }>(
      "select user_id from partner_contributors where lead_id=any($1::text[]) and revoked_at is null order by lead_id,user_id limit 10001 for share",
      [ids],
    )
  ).rows;
  if (contributors.length > 10000) fail("PARTNER_ACTION_REQUIRED");
  await tx.query(
    "select m.user_id from partner_members m join partner_organizations o on o.id=m.organization_id where m.user_id=any($1::text[]) or exists(select 1 from partner_leads l where l.id=any($2::text[]) and l.responsible_id=m.user_id) order by m.user_id for share of m,o",
    [contributors.map((c) => c.user_id), ids],
  );
  // Re-evaluate the predicate after acquiring membership/contribution locks; revocations that
  // raced the snapshot are converted to a repeatable-read conflict by PostgreSQL.
  return { ids, values: [...values, ids] };
}
export const pilotageCtes = `
  bounds as (select $2::timestamptz from_at,$3::timestamptz to_at,least($3::timestamptz,now()) observed_until,$8::text scope_kind,$10::text[] user_ids,$9::text organization_id),
  leads as materialized (select l.*,case when l.client_profile_id is null then l.client_user_id else mp.user_id end current_owner_id,coalesce(m.application->>'name','') advisor_name,m.organization_id,coalesce(o.name,'') organization_name from partner_leads l left join managed_profiles mp on mp.id=l.client_profile_id left join partner_members m on m.user_id=l.responsible_id left join partner_organizations o on o.id=m.organization_id where l.id=any($12::text[]) and ${filteredLeadPredicate} and ${scopedLeadPredicate}),
  cohort as materialized (select l.* from leads l cross join bounds b where l.created_at>=b.from_at and l.created_at<b.to_at and l.stage<>'draft'),
  events as materialized (select e.* from partner_events e join leads l on l.id=e.lead_id where e.audience in ('assigned','client')),
  offers as materialized (select o.* from partner_offers o join leads l on l.id=o.lead_id where ($6::text is null or o.data->>'company'=$6) and ($7::text is null or o.data->>'product'=$7)),
  appointments as materialized (select a.* from partner_appointments a join leads l on l.id=a.lead_id),
  contacts as materialized (select e.id,e.lead_id,e.created_at at from events e where e.kind='contact.reached' union all select r.id,r.lead_id,(r.input->>'occurredAt')::timestamptz from partner_communication_records r join leads l on l.id=r.lead_id where r.invalidated_at is null and r.owner_id is not distinct from l.current_owner_id and r.subject_key=case when l.client_profile_id is null then 'self:'||coalesce(l.client_user_id,'null') else 'profile:'||l.client_profile_id end and r.input->>'outcome' in ('reached','received')),
  quality as materialized (select q.* from partner_quality_cases q join leads l on l.id=q.lead_id where $11::boolean or q.author_id=$1 and q.invalidated_at is null and q.owner_id is not distinct from l.current_owner_id)
`;
