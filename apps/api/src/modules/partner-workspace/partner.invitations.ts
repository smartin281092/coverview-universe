import { createHash, randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  clientInvitationCommandSchema,
  clientInvitationLookupSchema,
  clientInvitationNoticeVersion,
  clientInvitationPreviewSchema,
  clientInvitationResponseSchema,
  clientInvitationsSchema,
  type ClientInvitationCommand,
  type ClientInvitationResponse,
} from "@coverview/contracts/partner-invitations";
import {
  authorityCurrent,
  fail,
  failOnConcurrentAbort,
  lockActor,
  membership,
  visible,
  type Executor,
  type PartnerActor,
} from "./partner.policy.js";
import { event, newId } from "./partner.audit.js";
import {
  clientInvitationMessage,
  clientInvitationTemplate,
} from "./partner.invitation-template.js";
import type { Mailer } from "../../platform/mailer.js";

type Mutation = <T>(
  actor: PartnerActor,
  operation: string,
  key: string,
  input: unknown,
  action: (tx: PoolClient) => Promise<string>,
  project: (tx: PoolClient, id: string) => Promise<T>,
) => Promise<T>;
type LeadRow = {
  id: string;
  stage: string;
  client_user_id: string | null;
  details: { email?: string } | null;
  category: string;
  title: string;
  client_name: string;
};
type InvitationRow = {
  id: string;
  lead_id: string;
  email: string;
  state: string;
  created_by: string;
  created_at: Date;
  expires_at: Date;
  sent_at: Date | null;
  responded_at: Date | null;
  cancel_reason: string | null;
  failure: string | null;
};
export type InvitationDelivery = "configured" | "unconfigured";

const validityMs = 14 * 86_400_000;
const recipientDailyLimit = 3;
const maxAttempts = 3;
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
const email = (lead: LeadRow) => (lead.details?.email ?? "").trim().toLowerCase();
const validEmail = (value: string) => value.length <= 254 && /^[^@\s]+@[^@\s]+$/u.test(value);
const leadColumns = "l.id,l.stage,l.client_user_id,l.details,l.category,l.title,l.client_name";
// The address currently recorded on the request, compared with the address an invitation targets.
const currentRecipient = "coalesce(lower(trim(l.details->>'email')),'')";
const requestChanged = "(l.client_user_id is not null or l.stage in ('draft','completed'))";
// An invitation stays usable only while the request is open, unlinked and still names its address.
const usable = (lead: LeadRow, invitation: InvitationRow) =>
  !lead.client_user_id &&
  !["draft", "completed"].includes(lead.stage) &&
  email(lead) === invitation.email;

// A corrected email, or a request linked or closed by another path, supersedes the pending
// invitation: it is never sent or accepted afterwards.
async function supersede(db: Executor, leadId: string | null) {
  await db.query(
    `update partner_client_invitations i set state='superseded',
       failure=case when ${requestChanged} then 'request_changed' else 'recipient_changed' end
     from partner_leads l where l.id=i.lead_id and i.state in ('queued','sent')
       and (${requestChanged} or i.email<>${currentRecipient}) ${leadId ? "and i.lead_id=$1" : ""}`,
    leadId ? [leadId] : [],
  );
}

async function access(db: Executor, actor: PartnerActor, leadId: string, lock = false) {
  if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
  const lead = (
    await db.query<LeadRow>(
      `select ${leadColumns} from partner_leads l where l.id=$2 and ${visible(actor)} ${lock ? "for update of l" : ""}`,
      [actor.userId, leadId],
    )
  ).rows[0];
  if (!lead) fail("PARTNER_NOT_FOUND", 404);
  // Only CoverView or a person currently allowed to contact the client may invite them.
  const allowed =
    actor.administrator ||
    !!(
      await db.query(
        `select 1 from partner_leads l where l.id=$2 and ((l.responsible_id=$1 and ${authorityCurrent("l")})
        or exists(select 1 from partner_contributors c where c.lead_id=l.id and c.user_id=$1 and c.revoked_at is null and c.can_contact and ${authorityCurrent("c")}))`,
        [actor.userId, leadId],
      )
    ).rowCount;
  const blocker = !allowed
    ? ("access" as const)
    : lead.client_user_id
      ? ("linked" as const)
      : lead.stage === "draft"
        ? ("draft" as const)
        : lead.stage === "completed"
          ? ("closed" as const)
          : !validEmail(email(lead))
            ? ("no_email" as const)
            : null;
  return { lead, blocker };
}

async function project(
  db: Executor,
  actor: PartnerActor,
  leadId: string,
  delivery: InvitationDelivery,
) {
  const { lead, blocker } = await access(db, actor, leadId);
  const rows = (
    await db.query<InvitationRow>(
      "select * from partner_client_invitations where lead_id=$1 order by created_at desc,id desc limit 20",
      [leadId],
    )
  ).rows;
  const items = rows.map((r) => {
    // Shown as the sending job will record it within a minute.
    const stale = ["queued", "sent"].includes(r.state) && !usable(lead, r);
    return {
      id: r.id,
      state: stale ? "superseded" : r.state,
      email: r.email,
      createdAt: r.created_at.toISOString(),
      expiresAt: r.expires_at.toISOString(),
      sentAt: r.sent_at?.toISOString() ?? null,
      respondedAt: r.responded_at?.toISOString() ?? null,
      cancelReason: r.cancel_reason,
      reason: stale
        ? lead.client_user_id || ["draft", "completed"].includes(lead.stage)
          ? "request_changed"
          : "recipient_changed"
        : r.failure,
    };
  });
  const active = items.some((i) => ["queued", "sending", "sent"].includes(i.state));
  // Without contact authority (a referrer, for instance), nothing about invitations is disclosed.
  return clientInvitationsSchema.parse({
    canInvite: !blocker && !active,
    delivery,
    blocker,
    items: blocker === "access" ? [] : items,
  });
}

async function byToken(db: Executor, token: string, lock = false) {
  return (
    await db.query<InvitationRow>(
      `select * from partner_client_invitations where token_hash=$1 ${lock ? "for update" : ""}`,
      [digest(token)],
    )
  ).rows[0];
}
async function walletEmail(db: Executor, actor: PartnerActor) {
  if (!actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
  // AuthKit sessions exist only for verified addresses; the email is refreshed at each sign-in.
  const row = (
    await db.query<{ email: string }>("select email from identity_users where id=$1", [
      actor.userId,
    ])
  ).rows[0];
  return (row?.email ?? "").trim().toLowerCase();
}
// The professional the client knows, with their organization; CoverView when it invited itself.
const requesterName = (member: Awaited<ReturnType<typeof membership>>) =>
  member ? `${member.name} (${member.organization})` : "CoverView";
const preview = (state: string, invitation?: InvitationRow, lead?: LeadRow, requester?: string) =>
  clientInvitationPreviewSchema.parse({
    state,
    emailMatches: !!lead,
    title: lead?.title ?? null,
    clientName: lead?.client_name ?? null,
    category: lead?.category ?? null,
    requester: lead ? (requester ?? null) : null,
    expiresAt: lead && invitation ? invitation.expires_at.toISOString() : null,
    notice: clientInvitationNoticeVersion,
  });

export function createInvitationOperations(
  pool: Pool,
  transaction: Mutation,
  delivery: InvitationDelivery,
) {
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
    clientInvitations: (actor: PartnerActor, leadId: string) =>
      read(actor, (tx) => project(tx, actor, leadId, delivery)),
    commandClientInvitation(
      actor: PartnerActor,
      leadId: string,
      raw: ClientInvitationCommand,
      key: string,
    ) {
      const input = clientInvitationCommandSchema.parse(raw);
      return transaction(
        actor,
        `client-invitation:${leadId}:${input.action}`,
        key,
        input,
        async (tx) => {
          const { lead, blocker } = await access(tx, actor, leadId, true);
          if (blocker === "access") fail("PARTNER_ACCESS_DENIED", 403);
          await supersede(tx, leadId);
          if (input.action === "cancel") {
            const cancelled = await tx.query(
              "update partner_client_invitations set state='cancelled',cancelled_by=$3,cancel_reason=$4 where id=$1 and lead_id=$2 and state in ('queued','sent')",
              [input.id, leadId, actor.userId, input.reason],
            );
            if (!cancelled.rowCount) fail("PARTNER_CONFLICT", 409);
            await event(tx, actor, leadId, "client.invitation_cancelled", "", "coverview");
            return leadId;
          }
          if (blocker) fail("PARTNER_INVALID_TRANSITION");
          const recipient = email(lead);
          // MAIL-07: the same answer whether or not the address belongs to an account; only the
          // invitations to one recipient are bounded, serialized per address.
          await tx.query("select pg_advisory_xact_lock(hashtextextended($1,7))", [
            `partner-invitation:${recipient}`,
          ]);
          const recent = (
            await tx.query<{ count: number }>(
              "select count(*)::int count from partner_client_invitations where email=$1 and created_at>now()-interval '24 hours'",
              [recipient],
            )
          ).rows[0]!.count;
          if (recent >= recipientDailyLimit) fail("PARTNER_RATE_LIMITED", 429);
          const active = await tx.query(
            "select 1 from partner_client_invitations where lead_id=$1 and state in ('queued','sending','sent') limit 1",
            [leadId],
          );
          if (active.rowCount) fail("PARTNER_CONFLICT", 409);
          await tx.query(
            "insert into partner_client_invitations(id,lead_id,email,created_by,expires_at) values($1,$2,$3,$4,now()+$5::interval)",
            [newId("pinv"), leadId, recipient, actor.userId, `${validityMs / 1000} seconds`],
          );
          await event(tx, actor, leadId, "client.invitation_queued", "", "coverview");
          return leadId;
        },
        (tx) => project(tx, actor, leadId, delivery),
      );
    },
    previewClientInvitation: (actor: PartnerActor, raw: unknown) =>
      read(actor, async (tx) => {
        const { token } = clientInvitationLookupSchema.parse(raw);
        const recipient = await walletEmail(tx, actor);
        const invitation = await byToken(tx, token);
        if (!invitation) return preview("unavailable");
        const lead = (
          await tx.query<LeadRow>(`select ${leadColumns} from partner_leads l where l.id=$1`, [
            invitation.lead_id,
          ])
        ).rows[0]!;
        const live =
          invitation.state === "sent" &&
          invitation.expires_at.getTime() > Date.now() &&
          usable(lead, invitation);
        // Another account learns nothing about the request, not even how the invitation ended.
        if (invitation.email !== recipient) return preview(live ? "pending" : "unavailable");
        const state = ["accepted", "declined", "cancelled", "expired"].includes(invitation.state)
          ? invitation.state
          : invitation.state === "sent" && invitation.expires_at.getTime() <= Date.now()
            ? "expired"
            : live
              ? "pending"
              : "unavailable";
        const requester = requesterName(await membership(tx, invitation.created_by));
        return preview(state, invitation, lead, requester);
      }),
    respondClientInvitation(actor: PartnerActor, raw: ClientInvitationResponse, key: string) {
      const input = clientInvitationResponseSchema.parse(raw);
      const hash = digest(input.token);
      return transaction(
        actor,
        `client-invitation-response:${hash}`,
        key,
        { ...input, token: hash },
        async (tx) => {
          const recipient = await walletEmail(tx, actor);
          const found = await byToken(tx, input.token);
          if (!found || found.email !== recipient) fail("PARTNER_NOT_FOUND", 404);
          // Same lock order as the professional commands: the request, then its invitation.
          const lead = (
            await tx.query<LeadRow>(
              `select ${leadColumns} from partner_leads l where l.id=$1 for update`,
              [found.lead_id],
            )
          ).rows[0]!;
          const invitation = (await byToken(tx, input.token, true))!;
          if (
            invitation.state !== "sent" ||
            invitation.expires_at.getTime() <= Date.now() ||
            !usable(lead, invitation)
          )
            fail("PARTNER_CONFLICT", 409);
          if (input.decision === "accept") {
            const profile = await tx.query(
              "select 1 from identity_profiles where user_id=$1 for share",
              [actor.userId],
            );
            if (!profile.rowCount) fail("PARTNER_INVALID_CLIENT");
          }
          await tx.query(
            "update partner_client_invitations set state=$2,responded_at=now(),responded_by=$3,notice_version=$4 where id=$1",
            [
              invitation.id,
              input.decision === "accept" ? "accepted" : "declined",
              actor.userId,
              input.noticeVersion,
            ],
          );
          if (input.decision === "accept") {
            // Personal subject only: no managed profile, mandate or household link is inferred.
            await tx.query(
              "update partner_leads set client_user_id=$2,client_profile_id=null,revision=revision+1,updated_at=now() where id=$1 and client_user_id is null",
              [lead.id, actor.userId],
            );
            await event(tx, actor, lead.id, "client.invitation_accepted", "", "assigned");
          } else {
            await event(tx, actor, lead.id, "client.invitation_declined", "", "assigned");
          }
          return invitation.id;
        },
        () => Promise.resolve(preview(input.decision === "accept" ? "accepted" : "declined")),
      );
    },
  };
}

// Sending job (MAIL-01). The token is created at the claim and only its hash is stored. A send
// interrupted after the claim is never retried blindly: it becomes "failed" for review.
export async function processClientInvitations(
  pool: Pool,
  mailer: Mailer | null,
  walletOrigin: string,
) {
  await supersede(pool, null);
  await pool.query(
    "update partner_client_invitations set state='expired' where state in ('queued','sent') and expires_at<=now()",
  );
  await pool.query(
    "update partner_client_invitations set state='failed',failure='delivery_unknown' where state='sending' and claimed_at<now()-interval '10 minutes'",
  );
  if (!mailer) return { sent: 0, failed: 0 };
  let sent = 0,
    failed = 0;
  for (let i = 0; i < 20; i += 1) {
    const token = randomBytes(32).toString("base64url");
    // A refused send waits 5 minutes per attempt already made before the next one.
    const claimed = (
      await pool.query<{
        id: string;
        email: string;
        expires_at: Date;
        category: string;
        created_by: string;
      }>(
        `update partner_client_invitations i set state='sending',claimed_at=now(),token_hash=$1,attempts=attempts+1
        from partner_leads l where l.id=i.lead_id and i.id=(
          select q.id from partner_client_invitations q join partner_leads ql on ql.id=q.lead_id
          where q.state='queued' and (q.claimed_at is null or q.claimed_at<now()-q.attempts*interval '5 minutes')
            and ql.client_user_id is null and ql.stage not in ('draft','completed')
            and q.email=coalesce(lower(trim(ql.details->>'email')),'')
          order by q.created_at,q.id for update of q skip locked limit 1)
        returning i.id,i.email,i.expires_at,l.category,i.created_by`,
        [digest(token)],
      )
    ).rows[0];
    if (!claimed) break;
    const requester = requesterName(await membership(pool, claimed.created_by));
    const message = clientInvitationMessage({
      locale: "fr",
      requester,
      category: claimed.category as Parameters<typeof clientInvitationMessage>[0]["category"],
      link: `${walletOrigin}/activation#token=${token}`,
      expiresAt: claimed.expires_at,
    });
    try {
      await mailer.send({
        to: claimed.email,
        ...message,
        tag: clientInvitationTemplate,
        reference: claimed.id,
      });
    } catch {
      // Refused before acceptance (or timed out): retried later with a new token, then "failed".
      await pool.query(
        `update partner_client_invitations set token_hash=null,
           state=case when attempts>=${maxAttempts} then 'failed' else 'queued' end,
           failure=case when attempts>=${maxAttempts} then 'send_failed' end
         where id=$1 and state='sending'`,
        [claimed.id],
      );
      failed += 1;
      continue;
    }
    await pool.query(
      "update partner_client_invitations set state='sent',sent_at=now() where id=$1 and state='sending'",
      [claimed.id],
    );
    sent += 1;
  }
  return { sent, failed };
}
