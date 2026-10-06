import type { Pool, PoolClient } from "pg";
import {
  accessDecisionSchema,
  accessDecisionsSchema,
  accessItemSchema,
  accessQueueSchema,
  organizationAccessSchema,
  organizationReviewInputSchema,
  restrictionInputSchema,
  type AccessFilter,
  type OrganizationReviewInput,
  type RestrictionInput,
} from "@coverview/contracts/partner-access";
import type { MemberRestrictions, PartnerApplication } from "@coverview/contracts/partner";
import {
  date,
  fail,
  failOnConcurrentAbort,
  lockActor,
  membership,
  type Executor,
  type PartnerActor,
} from "./partner.policy.js";
import { event, newId, type PartnerAuditActor } from "./partner.audit.js";
import { handoffWork } from "./partner.participants.js";
import { syncLeadNotifications } from "./partner.notifications.js";
import { reconcileCollaborations } from "./partner.collaboration.js";

type Mutation = <T>(
  actor: PartnerActor,
  operation: string,
  key: string,
  input: unknown,
  action: (tx: PoolClient) => Promise<string>,
  project: (tx: PoolClient, id: string) => Promise<T>,
) => Promise<T>;
type DecisionKind =
  "member_review" | "organization_review" | "restriction" | "automatic_review" | "team_removal";
type DecisionRow = {
  id: string;
  organization_id: string;
  user_id: string | null;
  kind: DecisionKind;
  state: string | null;
  roles: unknown;
  restrictions: unknown;
  reason: string | null;
  review_due_at: Date | null;
  system_actor: string | null;
  created_at: Date;
};
const system: PartnerAuditActor = { userId: null, systemActor: "partner-continuity-v1" };
const day = 86400000;
// Reminders and the Admin queue look 30 days ahead of a review or proof end date.
const horizon = 30 * day;

export async function logAccessDecision(
  db: Executor,
  decision: {
    kind: DecisionKind;
    organizationId: string;
    userId: string | null;
    state?: string | null;
    roles?: string[] | null;
    restrictions?: MemberRestrictions | null;
    reason: string | null;
    reviewDueAt?: string | Date | null;
    actorId: string | null;
  },
) {
  await db.query(
    "insert into partner_access_decisions(id,organization_id,user_id,kind,state,roles,restrictions,reason,review_due_at,actor_id,system_actor) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
    [
      newId("pad"),
      decision.organizationId,
      decision.userId,
      decision.kind,
      decision.state ?? null,
      decision.roles ? JSON.stringify(decision.roles) : null,
      decision.restrictions ? JSON.stringify(decision.restrictions) : null,
      decision.reason,
      decision.reviewDueAt ?? null,
      decision.actorId,
      decision.actorId ? null : "partner-continuity-v1",
    ],
  );
}

/**
 * Removes the operational access of these professionals to the requests they hold or contribute to:
 * requests return to CoverView for reassignment, contributions end and future commitments follow.
 * Evidence and economic rights stay untouched (I.4 « traitement des Leads actifs »).
 */
export async function withdrawOperationalAccess(
  tx: PoolClient,
  actor: PartnerAuditActor,
  revoked: string[],
) {
  if (!revoked.length) return;
  const affected = (
    await tx.query<{ id: string }>(
      `select l.id from partner_leads l where
              l.responsible_id=any($1::text[]) or exists(select 1 from partner_contributors c where c.lead_id=l.id and c.user_id=any($1::text[]) and c.revoked_at is null)
              or exists(select 1 from partner_collaborations c where c.lead_id=l.id and c.target_id=any($1::text[]) and c.state='proposed') order by l.id for update of l`,
      [revoked],
    )
  ).rows;
  const leads = (
    await tx.query<{ id: string }>(
      "update partner_leads set responsible_id=null,assignment='reassign',updated_at=now(),revision=revision+1 where responsible_id=any($1::text[]) and stage<>'completed' returning id",
      [revoked],
    )
  ).rows;
  await tx.query(
    "update partner_contributors set revoked_at=now() where user_id=any($1::text[]) and revoked_at is null",
    [revoked],
  );
  for (const lead of leads) {
    await handoffWork(tx, actor, lead.id, null);
    await event(
      tx,
      actor,
      lead.id,
      "lead.reassignment_required",
      "CoverView recherche un nouvel interlocuteur pour votre demande.",
      "client",
    );
    await syncLeadNotifications(tx, lead.id);
  }
  for (const lead of affected) {
    if (!leads.some((value) => value.id === lead.id)) {
      const current = (
        await tx.query<{ responsible_id: string | null }>(
          "select responsible_id from partner_leads where id=$1",
          [lead.id],
        )
      ).rows[0]!;
      await handoffWork(tx, actor, lead.id, current.responsible_id);
      await tx.query("update partner_leads set revision=revision+1,updated_at=now() where id=$1", [
        lead.id,
      ]);
      await event(tx, actor, lead.id, "lead.contributor_access_expired", "", "assigned");
    }
    await reconcileCollaborations(tx, lead.id, actor);
  }
}

/** An organisation decision, journalled on its own; blocking it withdraws all its members. */
export async function applyOrganizationDecision(
  tx: PoolClient,
  actor: PartnerActor,
  organizationId: string,
  input: Pick<OrganizationReviewInput, "state" | "reason" | "reviewDueAt">,
) {
  const updated = await tx.query(
    "update partner_organizations set state=$2,reviewed_by=$3,review_reason=$4,reviewed_at=now(),review_due_at=$5,revision=revision+1 where id=$1",
    [organizationId, input.state, actor.userId, input.reason, input.reviewDueAt],
  );
  if (!updated.rowCount) fail("PARTNER_NOT_FOUND", 404);
  await logAccessDecision(tx, {
    kind: "organization_review",
    organizationId,
    userId: null,
    state: input.state,
    reason: input.reason,
    reviewDueAt: input.reviewDueAt,
    actorId: actor.userId,
  });
  await event(
    tx,
    actor,
    null,
    `organization.${input.state}`,
    input.reason,
    "coverview",
    organizationId,
  );
  if (input.state !== "approved") {
    const members = (
      await tx.query<{ user_id: string }>(
        "select user_id from partner_members where organization_id=$1 order by user_id",
        [organizationId],
      )
    ).rows.map((r) => r.user_id);
    await withdrawOperationalAccess(tx, actor, members);
  }
}

/**
 * Automatic re-review (C8a): an approved member or organisation whose review date has passed is
 * put back to « complément demandé ». Access already ended at the date, and the continuity worker
 * treats the requests; this opens the re-review the member answers by updating their application.
 */
export async function processAccessReviews(pool: Pool) {
  const tx = await pool.connect();
  try {
    await tx.query("begin");
    await tx.query("set local lock_timeout='2s'");
    await tx.query("set local statement_timeout='10s'");
    const members = (
      await tx.query<{ user_id: string; organization_id: string; review_due_at: Date }>(
        "select user_id,organization_id,review_due_at from partner_members where state='approved' and review_due_at<=now() order by review_due_at,user_id limit 50 for update skip locked",
      )
    ).rows;
    for (const member of members) {
      await tx.query(
        "update partner_members set state='needs_information',review_reason=null,reviewed_by=null,reviewed_at=now(),revision=revision+1 where user_id=$1",
        [member.user_id],
      );
      await logAccessDecision(tx, {
        kind: "automatic_review",
        organizationId: member.organization_id,
        userId: member.user_id,
        state: "needs_information",
        reason: null,
        reviewDueAt: member.review_due_at,
        actorId: null,
      });
      await event(tx, system, null, "application.review_due", "", "coverview", member.user_id);
    }
    const organizations = (
      await tx.query<{ id: string; review_due_at: Date }>(
        "select id,review_due_at from partner_organizations where state='approved' and review_due_at<=now() order by review_due_at,id limit 50 for update skip locked",
      )
    ).rows;
    for (const organization of organizations) {
      await tx.query(
        "update partner_organizations set state='needs_information',review_reason=null,reviewed_by=null,reviewed_at=now(),revision=revision+1 where id=$1",
        [organization.id],
      );
      await logAccessDecision(tx, {
        kind: "automatic_review",
        organizationId: organization.id,
        userId: null,
        state: "needs_information",
        reason: null,
        reviewDueAt: organization.review_due_at,
        actorId: null,
      });
      await event(tx, system, null, "organization.review_due", "", "coverview", organization.id);
    }
    await tx.query("commit");
    return { members: members.length, organizations: organizations.length };
  } catch (error) {
    await tx.query("rollback");
    throw error;
  } finally {
    tx.release();
  }
}

const decision = (row: DecisionRow) =>
  accessDecisionSchema.parse({
    id: row.id,
    kind: row.kind,
    subject: row.user_id ? "member" : "organization",
    userId: row.user_id,
    organizationId: row.organization_id,
    state: row.state,
    roles: row.roles ?? null,
    restrictions: row.restrictions ?? null,
    reason: row.reason,
    reviewDueAt: date(row.review_due_at),
    author: row.system_actor ? "system" : row.kind === "team_removal" ? "manager" : "coverview",
    at: row.created_at.toISOString(),
  });
// A member reads their own decisions and those of their current organisation.
async function memberDecisions(db: Executor, userId: string, organizationId: string) {
  const rows = (
    await db.query<DecisionRow>(
      "select * from partner_access_decisions where user_id=$1 or (user_id is null and organization_id=$2) order by created_at desc,id desc limit 50",
      [userId, organizationId],
    )
  ).rows;
  return rows.map(decision);
}
const restricted = (r: MemberRestrictions) =>
  r.newLeads || r.leadCreation || r.marketplace || r.categories.length > 0;
const dueState = (value: string | null, now: number) =>
  !value
    ? null
    : Date.parse(value) <= now
      ? "lapsed"
      : Date.parse(value) <= now + horizon
        ? "soon"
        : null;

async function proofs(db: Executor, userId: string) {
  const rows = (
    await db.query<{
      kind: "competence" | "convention";
      category: string;
      company_id: string | null;
      valid_until: Date;
    }>(
      `select * from (
        select distinct on (category) 'competence' kind,category,null::text company_id,decision,valid_until
        from partner_competence_decisions where user_id=$1 order by category,revision desc) c
       where decision='reviewed' and valid_until<=now()+interval '30 days'
       union all
       select * from (
        select distinct on (category,company_id) 'convention' kind,category,company_id,decision,valid_until
        from partner_convention_decisions where user_id=$1 order by category,company_id,revision desc) v
       where decision='reviewed' and valid_until<=now()+interval '30 days'
       order by valid_until limit 30`,
      [userId],
    )
  ).rows;
  return rows.map((r) => ({
    kind: r.kind,
    category: r.category,
    companyId: r.company_id,
    validUntil: r.valid_until.toISOString(),
    state: r.valid_until.getTime() <= Date.now() ? "expired" : "soon",
  }));
}
async function accessItem(db: Executor, application: PartnerApplication) {
  const now = Date.now();
  const extra = (
    await db.query<{ name: string; active: number }>(
      "select o.name,(select count(*)::int from partner_leads l where l.responsible_id=$1 and l.stage not in ('draft','completed')) active from partner_organizations o where o.id=$2",
      [application.userId, application.organizationId],
    )
  ).rows[0];
  return accessItemSchema.parse({
    application,
    organizationName: extra?.name ?? application.organization,
    flags: {
      review: application.state === "approved" ? dueState(application.reviewDueAt, now) : null,
      organizationReview:
        application.organizationState === "approved"
          ? dueState(application.organizationReviewDueAt, now)
          : null,
      restricted: restricted(application.restrictions),
      restrictionReview: restricted(application.restrictions)
        ? dueState(application.restrictions.reviewAt, now)
        : null,
    },
    proofs: await proofs(db, application.userId),
    activeLeads: extra?.active ?? 0,
  });
}

const restrictionPredicate = `(coalesce((m.restrictions->>'newLeads')::boolean,false) or coalesce((m.restrictions->>'leadCreation')::boolean,false)
  or coalesce((m.restrictions->>'marketplace')::boolean,false) or jsonb_array_length(coalesce(m.restrictions->'categories','[]'::jsonb))>0)`;
const proofPredicate = `(exists(select 1 from (select distinct on (category) decision,valid_until from partner_competence_decisions d where d.user_id=m.user_id order by category,revision desc) c
    where c.decision='reviewed' and c.valid_until<=now()+interval '30 days')
  or exists(select 1 from (select distinct on (category,company_id) decision,valid_until from partner_convention_decisions d where d.user_id=m.user_id order by category,company_id,revision desc) v
    where v.decision='reviewed' and v.valid_until<=now()+interval '30 days'))`;
const filters: Record<Exclude<AccessFilter, "all">, { where: string; order: string }> = {
  pending: {
    where: "m.state in ('submitted','needs_information')",
    order: "m.created_at,m.user_id",
  },
  reviews: {
    where: `(m.state='approved' and m.review_due_at<=now()+interval '30 days') or (o.state='approved' and o.review_due_at<=now()+interval '30 days')`,
    order: "least(m.review_due_at,o.review_due_at),m.user_id",
  },
  restricted: {
    where: restrictionPredicate,
    order: "(m.restrictions->>'reviewAt')::timestamptz nulls last,m.user_id",
  },
  proofs: {
    where: `m.state not in ('closed','rejected') and ${proofPredicate}`,
    order: "m.user_id",
  },
};

export function createAccessOperations(pool: Pool, transaction: Mutation) {
  async function read<T>(actor: PartnerActor, action: (tx: PoolClient) => Promise<T>) {
    const tx = await pool.connect();
    try {
      await tx.query("begin isolation level repeatable read");
      await lockActor(tx, actor);
      const result = await action(tx);
      await lockActor(tx, actor);
      await tx.query("commit");
      return result;
    } catch (cause) {
      await tx.query("rollback");
      failOnConcurrentAbort(cause);
      throw cause;
    } finally {
      tx.release();
    }
  }
  async function organizationAccess(tx: PoolClient, id: string) {
    const row = (
      await tx.query<{
        id: string;
        name: string;
        state: string;
        revision: number;
        review_reason: string | null;
        reviewed_at: Date | null;
        review_due_at: Date | null;
      }>("select * from partner_organizations where id=$1", [id])
    ).rows[0];
    if (!row) return fail("PARTNER_NOT_FOUND", 404);
    const members = (
      await tx.query<{ user_id: string; name: string; state: string; roles: string[] }>(
        "select user_id,application->>'name' name,state,roles from partner_members where organization_id=$1 order by application->>'name',user_id limit 100",
        [id],
      )
    ).rows;
    const active = (
      await tx.query<{ count: number }>(
        `select count(*)::int count from partner_leads l where l.stage not in ('draft','completed') and (
          exists(select 1 from partner_members m where m.organization_id=$1 and m.user_id=l.responsible_id)
          or exists(select 1 from partner_contributors c join partner_members m on m.user_id=c.user_id where c.lead_id=l.id and c.revoked_at is null and m.organization_id=$1))`,
        [id],
      )
    ).rows[0]!.count;
    const decisions = (
      await tx.query<DecisionRow>(
        "select * from partner_access_decisions where organization_id=$1 order by created_at desc,id desc limit 50",
        [id],
      )
    ).rows.map(decision);
    return organizationAccessSchema.parse({
      id: row.id,
      name: row.name,
      state: row.state,
      revision: row.revision,
      reviewReason: row.review_reason,
      reviewedAt: date(row.reviewed_at),
      reviewDueAt: date(row.review_due_at),
      members: members.map((m) => ({
        userId: m.user_id,
        name: m.name,
        state: m.state,
        roles: m.roles,
      })),
      activeLeads: active,
      decisions,
    });
  }
  return {
    accessQueue: (actor: PartnerActor, filter: AccessFilter) =>
      read(actor, async (tx) => {
        if (!actor.administrator) fail("PARTNER_ACCESS_DENIED", 403);
        const chosen = filter === "all" ? null : filters[filter];
        const ids = (
          await tx.query<{ user_id: string }>(
            `select m.user_id from partner_members m join partner_organizations o on o.id=m.organization_id
             ${chosen ? `where ${chosen.where}` : ""} order by ${chosen ? chosen.order : "m.created_at desc,m.user_id"} limit 100`,
          )
        ).rows;
        const items = [];
        for (const { user_id } of ids) {
          const application = await membership(tx, user_id);
          if (application) items.push(await accessItem(tx, application));
        }
        const count = async (key: Exclude<AccessFilter, "all">) =>
          (
            await tx.query<{ count: number }>(
              `select count(*)::int count from partner_members m join partner_organizations o on o.id=m.organization_id where ${filters[key].where}`,
            )
          ).rows[0]!.count;
        return accessQueueSchema.parse({
          filter,
          items,
          counts: {
            pending: await count("pending"),
            reviews: await count("reviews"),
            restricted: await count("restricted"),
            proofs: await count("proofs"),
          },
        });
      }),
    accessDecisions: (actor: PartnerActor, userId: string) =>
      read(actor, async (tx) => {
        if (actor.wallet || (!actor.administrator && actor.userId !== userId))
          fail("PARTNER_ACCESS_DENIED", 403);
        const member = await membership(tx, userId);
        if (!member) return accessDecisionsSchema.parse({ items: [] });
        return accessDecisionsSchema.parse({
          items: await memberDecisions(tx, userId, member.organizationId),
        });
      }),
    organizationAccess: (actor: PartnerActor, id: string) =>
      read(actor, async (tx) => {
        if (!actor.administrator) fail("PARTNER_ACCESS_DENIED", 403);
        return organizationAccess(tx, id);
      }),
    restrictMember(actor: PartnerActor, userId: string, raw: RestrictionInput, key: string) {
      const input = restrictionInputSchema.parse(raw);
      return transaction(
        actor,
        `access.restriction:${userId}`,
        key,
        input,
        async (tx) => {
          if (!actor.administrator || actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
          if (actor.userId === userId) fail("PARTNER_ACCESS_DENIED", 403);
          await tx.query("select user_id from partner_members where user_id=$1 for update", [
            userId,
          ]);
          const member = await membership(tx, userId);
          if (!member) fail("PARTNER_NOT_FOUND", 404);
          if (member.restrictionRevision !== input.restrictionRevision)
            fail("PARTNER_CONFLICT", 409);
          // Only declared categories can be excluded; a review date is always in the future.
          if (
            input.categories.some((c) => !member.categories.includes(c)) ||
            (input.reviewAt && Date.parse(input.reviewAt) <= Date.now())
          )
            fail("PARTNER_ACTION_REQUIRED");
          const restrictions: MemberRestrictions = {
            newLeads: input.newLeads,
            leadCreation: input.leadCreation,
            marketplace: input.marketplace,
            categories: [...new Set(input.categories)].sort(),
            reviewAt: restricted({ ...input, reviewAt: null }) ? input.reviewAt : null,
          };
          await tx.query(
            "update partner_members set restrictions=$2,restriction_revision=restriction_revision+1 where user_id=$1",
            [userId, JSON.stringify(restrictions)],
          );
          await logAccessDecision(tx, {
            kind: "restriction",
            organizationId: member.organizationId,
            userId,
            restrictions,
            reason: input.reason,
            reviewDueAt: restrictions.reviewAt,
            actorId: actor.userId,
          });
          await event(
            tx,
            actor,
            null,
            restricted(restrictions) ? "application.restricted" : "application.restriction_lifted",
            input.reason,
            "coverview",
            userId,
          );
          return userId;
        },
        async (tx, id) => {
          const member = await membership(tx, id);
          if (!member) return fail("PARTNER_NOT_FOUND", 404);
          return accessItem(tx, member);
        },
      );
    },
    reviewOrganization(
      actor: PartnerActor,
      organizationId: string,
      raw: OrganizationReviewInput,
      key: string,
    ) {
      const input = organizationReviewInputSchema.parse(raw);
      return transaction(
        actor,
        `access.organization:${organizationId}`,
        key,
        input,
        async (tx) => {
          if (!actor.administrator || actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
          const row = (
            await tx.query<{ revision: number }>(
              "select revision from partner_organizations where id=$1 for update",
              [organizationId],
            )
          ).rows[0];
          if (!row) fail("PARTNER_NOT_FOUND", 404);
          if (row.revision !== input.revision) fail("PARTNER_CONFLICT", 409);
          // Nobody decides on their own organisation.
          const own = await tx.query(
            "select 1 from partner_members where user_id=$1 and organization_id=$2",
            [actor.userId, organizationId],
          );
          if (own.rowCount) fail("PARTNER_ACCESS_DENIED", 403);
          if (input.reviewDueAt && Date.parse(input.reviewDueAt) <= Date.now())
            fail("PARTNER_ACTION_REQUIRED");
          await applyOrganizationDecision(tx, actor, organizationId, input);
          return organizationId;
        },
        (tx, id) => organizationAccess(tx, id),
      );
    },
  };
}
