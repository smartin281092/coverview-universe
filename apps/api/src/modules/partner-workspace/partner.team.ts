import type { Pool, PoolClient } from "pg";
import {
  receivedInvitationsSchema,
  teamInvitationInputSchema,
  teamInvitationLimits,
  teamRemovalInputSchema,
  teamSchema,
  type TeamInvitationInput,
  type TeamRemovalInput,
} from "@coverview/contracts/partner-team";
import type { partnerLeads } from "./partner.schema.js";
import {
  context,
  date,
  fail,
  failOnConcurrentAbort,
  lockActor,
  membership,
  type Executor,
  type PartnerActor,
} from "./partner.policy.js";
import { event, newId } from "./partner.audit.js";
import { followUpOverdueSql } from "./partner.follow-up.js";
import { logAccessDecision, withdrawOperationalAccess } from "./partner.access.js";

type Mutation = <T>(
  actor: PartnerActor,
  operation: string,
  key: string,
  input: unknown,
  action: (tx: PoolClient) => Promise<string>,
  project: (tx: PoolClient, id: string) => Promise<T>,
) => Promise<T>;
type LeadRow = typeof partnerLeads.$inferSelect;
type InvitationRow = {
  id: string;
  organization_id: string;
  email: string;
  invited_by: string;
  created_at: Date;
  expires_at: Date;
  accepted_at: Date | null;
  declined_at: Date | null;
  cancelled_at: Date | null;
};
const open = "accepted_at is null and declined_at is null and cancelled_at is null";

/** The manager's own organisation: an explicit manager role, operational, never by inference. */
async function managerOrganization(db: Executor, actor: PartnerActor, lock = false) {
  if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
  const ctx = await context(db, { ...actor, administrator: false }, lock);
  if (!ctx.operational || !ctx.application?.grantedRoles.includes("manager"))
    fail("PARTNER_ACCESS_DENIED", 403);
  return ctx.application;
}
// AuthKit sessions exist only for verified addresses; the email is refreshed at each sign-in.
async function verifiedEmail(db: Executor, actor: PartnerActor) {
  const row = (
    await db.query<{ email: string }>("select email from identity_users where id=$1", [
      actor.userId,
    ])
  ).rows[0];
  return (row?.email ?? "").trim().toLowerCase();
}
const invitationState = (row: InvitationRow) =>
  row.accepted_at
    ? "accepted"
    : row.declined_at
      ? "declined"
      : row.cancelled_at
        ? "cancelled"
        : row.expires_at.getTime() <= Date.now()
          ? "expired"
          : "pending";

async function readTeam(db: Executor, actor: PartnerActor) {
  const manager = await managerOrganization(db, actor);
  const organization = (
    await db.query<{ id: string; name: string; state: string; review_due_at: Date | null }>(
      "select id,name,state,review_due_at from partner_organizations where id=$1",
      [manager.organizationId],
    )
  ).rows[0]!;
  const members = (
    await db.query<{
      user_id: string;
      name: string;
      state: string;
      roles: string[];
      categories: string[];
      review_due_at: Date | null;
      restrictions: Record<string, unknown>;
      revision: number;
      active: number;
      overdue: number;
    }>(
      `select m.user_id,m.application->>'name' name,m.state,m.roles,m.application->'categories' categories,
        m.review_due_at,m.restrictions,m.revision,
        (select count(*)::int from partner_leads l where l.responsible_id=m.user_id and l.stage not in ('draft','completed')) active,
        (select count(*)::int from partner_leads l where l.responsible_id=m.user_id and ${followUpOverdueSql}) overdue
       from partner_members m where m.organization_id=$1 and m.state not in ('closed','rejected')
       order by m.application->>'name',m.user_id limit 100`,
      [organization.id],
    )
  ).rows;
  const invitations = (
    await db.query<InvitationRow & { inviter: string | null }>(
      `select i.*,(select application->>'name' from partner_members where user_id=i.invited_by) inviter
       from partner_team_invitations i where i.organization_id=$1 order by i.created_at desc,i.id desc limit 50`,
      [organization.id],
    )
  ).rows;
  const limits = (
    await db.query<{ open: number; recent: number }>(
      `select count(*) filter (where ${open} and expires_at>now())::int open,
        count(*) filter (where created_at>now()-interval '24 hours')::int recent
       from partner_team_invitations where organization_id=$1`,
      [organization.id],
    )
  ).rows[0]!;
  return teamSchema.parse({
    organization: {
      id: organization.id,
      name: organization.name,
      state: organization.state,
      reviewDueAt: date(organization.review_due_at),
    },
    members: members.map((m) => ({
      userId: m.user_id,
      name: m.name,
      state: m.state,
      grantedRoles: m.roles,
      categories: m.categories,
      reviewDueAt: date(m.review_due_at),
      // Kinds only: the reason and the review date of a restriction stay with CoverView and the person.
      restrictions: m.restrictions,
      revision: m.revision,
      activeLeads: m.active,
      overdueLeads: m.overdue,
      self: m.user_id === actor.userId,
      canRemove: m.user_id !== actor.userId && !m.roles.includes("manager"),
    })),
    invitations: invitations.map((i) => ({
      id: i.id,
      email: i.email,
      state: invitationState(i),
      invitedBy: i.inviter ?? "",
      createdAt: i.created_at.toISOString(),
      expiresAt: i.expires_at.toISOString(),
      decidedAt: date(i.accepted_at ?? i.declined_at ?? i.cancelled_at),
    })),
    canInvite:
      limits.open < teamInvitationLimits.open && limits.recent < teamInvitationLimits.perDay,
  });
}

async function readReceived(db: Executor, actor: PartnerActor) {
  if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
  const email = await verifiedEmail(db, actor);
  const current = await membership(db, actor.userId);
  const blocker =
    current?.state === "approved"
      ? "membership_active"
      : current?.state === "suspended"
        ? "membership_suspended"
        : null;
  const rows = (
    await db.query<{ id: string; name: string; inviter: string | null; expires_at: Date }>(
      `select i.id,o.name,(select application->>'name' from partner_members where user_id=i.invited_by) inviter,i.expires_at
       from partner_team_invitations i join partner_organizations o on o.id=i.organization_id
       where i.email=$1 and i.accepted_at is null and i.declined_at is null and i.cancelled_at is null
         and i.expires_at>now() and o.state='approved' and o.id is distinct from $2
       order by i.created_at desc,i.id desc limit 20`,
      [email, current?.organizationId ?? null],
    )
  ).rows;
  return receivedInvitationsSchema.parse({
    items: rows.map((r) => ({
      id: r.id,
      organizationName: r.name,
      invitedBy: r.inviter ?? "",
      expiresAt: r.expires_at.toISOString(),
      blocker,
    })),
  });
}

/**
 * Joining through an invitation (C8b): only the account verified with the invited address, from
 * no membership or one that is not approved, suspended or already in that organisation. The
 * organisation and its name are imposed; CoverView validates the person separately.
 */
export async function acceptTeamInvitation(
  tx: PoolClient,
  actor: PartnerActor,
  invitationId: string,
) {
  const invitation = (
    await tx.query<InvitationRow & { name: string; organization_state: string }>(
      `select i.*,o.name,o.state organization_state from partner_team_invitations i
       join partner_organizations o on o.id=i.organization_id where i.id=$1 for update of i`,
      [invitationId],
    )
  ).rows[0];
  if (
    !invitation ||
    invitationState(invitation) !== "pending" ||
    invitation.email !== (await verifiedEmail(tx, actor))
  )
    fail("PARTNER_NOT_FOUND", 404);
  if (invitation.organization_state !== "approved") fail("PARTNER_ACTION_REQUIRED");
  const current = await membership(tx, actor.userId, true);
  if (
    current &&
    (["approved", "suspended"].includes(current.state) ||
      current.organizationId === invitation.organization_id)
  )
    fail("PARTNER_CONFLICT", 409);
  await tx.query(
    "update partner_team_invitations set accepted_by=$2,accepted_at=now() where id=$1",
    [invitationId, actor.userId],
  );
  await event(tx, actor, null, "team.invitation_accepted.v1", "", "coverview", invitationId);
  return { organizationId: invitation.organization_id, organizationName: invitation.name };
}

/** A manager reassigns a request of their team to an eligible colleague (C8b, I.3 affectations). */
export async function requireTeamAssignment(
  tx: PoolClient,
  actor: PartnerActor,
  lead: LeadRow,
  responsibleId: string,
) {
  const manager = await managerOrganization(tx, actor, true);
  const holder = lead.responsibleId ? await membership(tx, lead.responsibleId, true) : null;
  const target = await membership(tx, responsibleId, true);
  if (
    !holder ||
    holder.organizationId !== manager.organizationId ||
    !target ||
    target.organizationId !== manager.organizationId
  )
    fail("PARTNER_ACCESS_DENIED", 403);
}

export function createTeamOperations(pool: Pool, transaction: Mutation) {
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
  return {
    team: (actor: PartnerActor) => read(actor, (tx) => readTeam(tx, actor)),
    receivedTeamInvitations: (actor: PartnerActor) => read(actor, (tx) => readReceived(tx, actor)),
    inviteTeamMember(actor: PartnerActor, raw: TeamInvitationInput, key: string) {
      const input = teamInvitationInputSchema.parse(raw);
      return transaction(
        actor,
        "team.invitation",
        key,
        input,
        async (tx) => {
          const manager = await managerOrganization(tx, actor, true);
          const organizationId = manager.organizationId;
          await tx.query("select id from partner_organizations where id=$1 for update", [
            organizationId,
          ]);
          // Only a current colleague's address is refused: nothing is said about other accounts.
          const colleague = await tx.query(
            `select 1 from partner_members m join identity_users u on u.id=m.user_id
             where m.organization_id=$1 and lower(trim(u.email))=$2 and m.state not in ('closed','rejected')`,
            [organizationId, input.email],
          );
          if (colleague.rowCount) fail("PARTNER_CONFLICT", 409);
          const limits = (
            await tx.query<{ open: number; recent: number }>(
              `select count(*) filter (where ${open} and expires_at>now() and email<>$2)::int open,
                count(*) filter (where created_at>now()-interval '24 hours')::int recent
               from partner_team_invitations where organization_id=$1`,
              [organizationId, input.email],
            )
          ).rows[0]!;
          if (
            limits.open >= teamInvitationLimits.open ||
            limits.recent >= teamInvitationLimits.perDay
          )
            fail("PARTNER_RATE_LIMITED", 429);
          // A new invitation to the same address replaces the previous one, expired or not.
          await tx.query(
            `update partner_team_invitations set cancelled_by=$3,cancelled_at=now() where organization_id=$1 and email=$2 and ${open}`,
            [organizationId, input.email, actor.userId],
          );
          const id = newId("pti");
          await tx.query(
            "insert into partner_team_invitations(id,organization_id,email,invited_by,expires_at) values($1,$2,$3,$4,now()+make_interval(days=>$5))",
            [id, organizationId, input.email, actor.userId, teamInvitationLimits.days],
          );
          await event(tx, actor, null, "team.invitation_created.v1", "", "coverview", id);
          return id;
        },
        (tx) => readTeam(tx, actor),
      );
    },
    cancelTeamInvitation(actor: PartnerActor, id: string, key: string) {
      return transaction(
        actor,
        `team.invitation_cancel:${id}`,
        key,
        { id },
        async (tx) => {
          const manager = await managerOrganization(tx, actor, true);
          const cancelled = await tx.query(
            `update partner_team_invitations set cancelled_by=$3,cancelled_at=now() where id=$1 and organization_id=$2 and ${open}`,
            [id, manager.organizationId, actor.userId],
          );
          if (!cancelled.rowCount) fail("PARTNER_NOT_FOUND", 404);
          await event(tx, actor, null, "team.invitation_cancelled.v1", "", "coverview", id);
          return id;
        },
        (tx) => readTeam(tx, actor),
      );
    },
    declineTeamInvitation(actor: PartnerActor, id: string, key: string) {
      return transaction(
        actor,
        `team.invitation_decline:${id}`,
        key,
        { id },
        async (tx) => {
          if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
          const declined = await tx.query(
            `update partner_team_invitations set declined_at=now() where id=$1 and email=$2 and ${open}`,
            [id, await verifiedEmail(tx, actor)],
          );
          if (!declined.rowCount) fail("PARTNER_NOT_FOUND", 404);
          await event(tx, actor, null, "team.invitation_declined.v1", "", "coverview", id);
          return id;
        },
        (tx) => readReceived(tx, actor),
      );
    },
    removeTeamMember(actor: PartnerActor, userId: string, raw: TeamRemovalInput, key: string) {
      const input = teamRemovalInputSchema.parse(raw);
      return transaction(
        actor,
        `team.removal:${userId}`,
        key,
        input,
        async (tx) => {
          const manager = await managerOrganization(tx, actor, true);
          await tx.query("select user_id from partner_members where user_id=$1 for update", [
            userId,
          ]);
          const member = await membership(tx, userId);
          // Never oneself nor another manager: CoverView decides those.
          if (
            !member ||
            member.organizationId !== manager.organizationId ||
            ["closed", "rejected"].includes(member.state)
          )
            fail("PARTNER_NOT_FOUND", 404);
          if (userId === actor.userId || member.grantedRoles.includes("manager"))
            fail("PARTNER_ACCESS_DENIED", 403);
          if (member.revision !== input.revision) fail("PARTNER_CONFLICT", 409);
          await tx.query(
            "update partner_members set state='closed',revision=revision+1 where user_id=$1",
            [userId],
          );
          await logAccessDecision(tx, {
            kind: "team_removal",
            organizationId: manager.organizationId,
            userId,
            state: "closed",
            reason: input.reason,
            actorId: actor.userId,
          });
          await withdrawOperationalAccess(tx, actor, [userId]);
          await event(tx, actor, null, "application.closed", input.reason, "coverview", userId);
          return userId;
        },
        (tx) => readTeam(tx, actor),
      );
    },
  };
}
