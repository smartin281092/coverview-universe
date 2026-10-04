import type { Pool } from "pg";
import { leadCategorySchema } from "@coverview/contracts/partner";
import {
  adminOverviewQuerySchema,
  adminOverviewSchema,
  type AdminOverviewQuery,
} from "@coverview/contracts/partner-overview";
import { pilotageQuerySchema } from "@coverview/contracts/partner-pilotage";
import { economyRead } from "./partner.commercial.js";
import { followUpOverdueSql } from "./partner.follow-up.js";
import { pilotageMeasures } from "./partner.pilotage.js";
import { resolvePilotageScope, scopeFromQuery } from "./partner.pilotage-scope.js";
import { fail, type PartnerActor } from "./partner.policy.js";

const ratingMinimum = 5;
const active = "l.stage not in ('draft','completed')";
const closedIn = "l.stage='completed' and l.stage_changed_at>=$1 and l.stage_changed_at<$2";
const rate = (part: number, whole: number) =>
  whole ? Math.round((part / whole) * 1000) / 10 : null;

export function createOverviewOperations(pool: Pool) {
  return {
    async adminOverview(actor: PartnerActor, raw: AdminOverviewQuery) {
      if (actor.wallet || !actor.administrator) fail("PARTNER_ACCESS_DENIED", 403);
      const query = adminOverviewQuerySchema.parse(raw);
      const category = query.category ?? null;
      const followUp = (
        await pool.query<Record<string, number>>(
          `select count(*) filter (where ${active})::int active,
            count(*) filter (where ${active} and (l.waiting is null or (l.waiting->>'until')::timestamptz<=now()) and (l.next_action='' or l.due_at is null))::int no_next_action,
            count(*) filter (where ${active} and l.responsible_id is not null and l.first_useful_at is null
              and coalesce(l.first_action_due_at,l.notified_at+interval '24 hours')<=now())::int first_action_overdue,
            count(*) filter (where ${followUpOverdueSql})::int overdue,
            count(*) filter (where ${active} and l.responsible_id is null)::int unassigned,
            count(*) filter (where ${active} and l.assignment in ('coverview','reassign'))::int coverview_queue
          from partner_leads l where ($1::text is null or l.category=$1)`,
          [category],
        )
      ).rows[0]!;
      // A manual decision after an earlier one, or any automatic proposal, is a reassignment.
      const reassignments = (
        await pool.query<{ manual: number; automatic: number }>(
          `select count(*) filter (where d.kind='automatic')::int automatic,
            count(*) filter (where d.kind='manual' and exists(select 1 from partner_matching_decisions p
              where p.lead_id=d.lead_id and (p.created_at,p.id)<(d.created_at,d.id)))::int manual
          from partner_matching_decisions d join partner_leads l on l.id=d.lead_id
          where d.created_at>=$1 and d.created_at<$2 and ($3::text is null or l.category=$3)`,
          [query.from, query.to, category],
        )
      ).rows[0]!;
      const rows = (
        await pool.query<{
          user_id: string;
          name: string | null;
          organization_id: string;
          organization: string;
          active: number;
          closed: number;
          contracts: number;
          cycle_days: string | null;
          overdue: number;
          responses: number;
          average: string | null;
        }>(
          `with per as (
            select l.responsible_id user_id,
              count(*) filter (where ${active})::int active,
              count(*) filter (where ${closedIn})::int closed,
              count(*) filter (where ${closedIn} and l.result='contract')::int contracts,
              avg(extract(epoch from l.stage_changed_at-l.created_at)/86400) filter (where ${closedIn} and l.result='contract') cycle_days,
              count(*) filter (where ${followUpOverdueSql})::int overdue
            from partner_leads l where l.responsible_id is not null and ($3::text is null or l.category=$3)
            group by l.responsible_id),
          rated as (
            select a.advisor_id user_id,count(*)::int responses,avg((r.response->>'rating')::numeric) average
            from partner_survey_responses r join partner_surveys s on s.id=r.survey_id
            join partner_survey_attributions a on a.survey_id=s.id
            where s.invalidated_at is null and r.created_at>=$1 and r.created_at<$2 and ($3::text is null or a.category=$3)
              and not exists(select 1 from partner_evaluation_contests c where c.subject_kind='survey' and c.subject_id=s.id and c.decision='accepted')
            group by a.advisor_id)
          select m.user_id,m.application->>'name' name,m.organization_id,o.name organization,
            coalesce(p.active,0) active,coalesce(p.closed,0) closed,coalesce(p.contracts,0) contracts,p.cycle_days,
            coalesce(p.overdue,0) overdue,coalesce(r.responses,0) responses,r.average
          from partner_members m join partner_organizations o on o.id=m.organization_id
          left join per p on p.user_id=m.user_id left join rated r on r.user_id=m.user_id
          where m.roles ? 'advisor' and (m.state='approved' or p.user_id is not null or r.user_id is not null)
          order by coalesce(p.active,0) desc,coalesce(p.closed,0) desc,m.user_id limit 101`,
          [query.from, query.to, category],
        )
      ).rows;
      const advisors = rows.slice(0, 100).map((row) => ({
        userId: row.user_id,
        name: row.name ?? row.user_id,
        organizationId: row.organization_id,
        organization: row.organization,
        active: row.active,
        closed: row.closed,
        contracts: row.contracts,
        conversionRate: rate(row.contracts, row.closed),
        overdue: row.overdue,
        cycleDays: row.cycle_days === null ? null : Math.round(Number(row.cycle_days) * 10) / 10,
        responses: row.responses,
        satisfaction:
          row.average !== null && row.responses >= ratingMinimum
            ? Math.round(Number(row.average) * 10) / 10
            : null,
      }));
      const organizations = new Map<
        string,
        {
          organizationId: string;
          name: string;
          advisors: number;
          active: number;
          closed: number;
          contracts: number;
          overdue: number;
        }
      >();
      for (const advisor of advisors) {
        const entry = organizations.get(advisor.organizationId) ?? {
          organizationId: advisor.organizationId,
          name: advisor.organization,
          advisors: 0,
          active: 0,
          closed: 0,
          contracts: 0,
          overdue: 0,
        };
        entry.advisors += 1;
        entry.active += advisor.active;
        entry.closed += advisor.closed;
        entry.contracts += advisor.contracts;
        entry.overdue += advisor.overdue;
        organizations.set(advisor.organizationId, entry);
      }
      // The statistics' own measure, so both screens always agree on CoverView's receipts.
      const coverview = await economyRead(pool, actor, async (tx) => {
        const measure = async (branch: string | null) => {
          const pilotage = pilotageQuerySchema.parse({
            from: query.from,
            to: query.to,
            scope: "network",
            ...(branch ? { category: branch } : {}),
          });
          const scope = await resolvePilotageScope(tx, actor, scopeFromQuery(pilotage));
          return (await pilotageMeasures(tx, actor, pilotage, scope, "coverview_revenue"))
            .measures[0]!;
        };
        const revenue = await measure(category);
        const branches = [];
        if (!category)
          for (const branch of leadCategorySchema.options)
            branches.push({ ...(await measure(branch)), category: branch });
        return { revenue, branches, costs: "unrecorded" as const };
      });
      return adminOverviewSchema.parse({
        from: query.from,
        to: query.to,
        followUp: {
          active: followUp.active,
          noNextAction: followUp.no_next_action,
          firstActionOverdue: followUp.first_action_overdue,
          overdue: followUp.overdue,
          unassigned: followUp.unassigned,
          coverviewQueue: followUp.coverview_queue,
        },
        reassignments,
        advisors,
        organizations: [...organizations.values()]
          .map((entry) => ({ ...entry, conversionRate: rate(entry.contracts, entry.closed) }))
          .sort((a, b) => b.active - a.active || a.name.localeCompare(b.name))
          .slice(0, 100),
        coverview,
        truncated: rows.length > 100,
      });
    },
  };
}
