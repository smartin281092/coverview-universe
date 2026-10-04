import { sql } from "drizzle-orm";
import { pgTable, text, integer, timestamp, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { identityUsers } from "../identity/index.js";
import { partnerLeads } from "./partner.schema.js";
const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });
// Wallet invitation for an unlinked contact. The token is created by the sending job and only
// its hash is kept: it exists in clear only in the email itself.
export const partnerClientInvitations = pgTable(
  "partner_client_invitations",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    email: text("email").notNull(),
    state: text("state").notNull().default("queued"),
    tokenHash: text("token_hash"),
    attempts: integer("attempts").notNull().default(0),
    createdBy: text("created_by")
      .notNull()
      .references(() => identityUsers.id),
    createdAt: instant("created_at").notNull().defaultNow(),
    expiresAt: instant("expires_at").notNull(),
    claimedAt: instant("claimed_at"),
    sentAt: instant("sent_at"),
    respondedAt: instant("responded_at"),
    respondedBy: text("responded_by").references(() => identityUsers.id),
    noticeVersion: text("notice_version"),
    cancelledBy: text("cancelled_by").references(() => identityUsers.id),
    cancelReason: text("cancel_reason"),
    failure: text("failure"),
  },
  (t) => [
    uniqueIndex("partner_invitation_token").on(t.tokenHash),
    uniqueIndex("partner_invitation_active")
      .on(t.leadId)
      .where(sql`${t.state} in ('queued','sending','sent')`),
    index("partner_invitation_queue")
      .on(t.createdAt, t.id)
      .where(sql`${t.state}='queued'`),
    index("partner_invitation_lead").on(t.leadId, t.createdAt, t.id),
    index("partner_invitation_recipient").on(t.email, t.createdAt),
    check(
      "partner_invitation_shape",
      sql`${t.state} in ('queued','sending','sent','accepted','declined','expired','cancelled','failed','superseded') and ${t.email}=lower(${t.email}) and ${t.email} ~ '^[^@\\s]+@[^@\\s]+$' and length(${t.email})<=254 and ${t.expiresAt}>${t.createdAt} and ${t.attempts} between 0 and 10 and (${t.tokenHash} is null or ${t.tokenHash} ~ '^[a-f0-9]{64}$')`,
    ),
    check(
      "partner_invitation_states",
      sql`(${t.state}<>'sent' or (${t.tokenHash} is not null and ${t.sentAt} is not null)) and ((${t.state} in ('accepted','declined')) = (${t.respondedAt} is not null and ${t.respondedBy} is not null and ${t.noticeVersion} is not null)) and ((${t.state}='cancelled') = (${t.cancelledBy} is not null and coalesce(length(trim(${t.cancelReason})),0)>=5)) and (${t.failure} is null or ${t.failure} in ('send_failed','delivery_unknown','recipient_changed','request_changed')) and ((${t.state} in ('failed','superseded')) = (${t.failure} is not null))`,
    ),
  ],
);
