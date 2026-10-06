import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { identityUsers } from "../identity/index.js";
import { partnerOrganizations } from "./partner.schema.js";
const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });
// Invitation of a colleague by the manager of an organisation (C8b). It is bound to the invited
// address: only an account verified with it sees and accepts it, by applying to the organisation.
// One outcome at most, set once; never deleted.
export const partnerTeamInvitations = pgTable(
  "partner_team_invitations",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => partnerOrganizations.id),
    email: text("email").notNull(),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => identityUsers.id),
    createdAt: instant("created_at").notNull().defaultNow(),
    expiresAt: instant("expires_at").notNull(),
    acceptedBy: text("accepted_by").references(() => identityUsers.id),
    acceptedAt: instant("accepted_at"),
    declinedAt: instant("declined_at"),
    cancelledBy: text("cancelled_by").references(() => identityUsers.id),
    cancelledAt: instant("cancelled_at"),
  },
  (t) => [
    index("partner_team_invitations_email").on(t.email, t.createdAt),
    index("partner_team_invitations_organization").on(t.organizationId, t.createdAt),
    uniqueIndex("partner_team_invitation_open")
      .on(t.organizationId, t.email)
      .where(sql`${t.acceptedAt} is null and ${t.declinedAt} is null and ${t.cancelledAt} is null`),
    check(
      "partner_team_invitation_email",
      sql`${t.email}=lower(trim(${t.email})) and length(${t.email}) between 3 and 254 and position('@' in ${t.email})>1`,
    ),
    check("partner_team_invitation_expiry", sql`${t.expiresAt}>${t.createdAt}`),
    check(
      "partner_team_invitation_outcome",
      sql`num_nonnulls(${t.acceptedAt},${t.declinedAt},${t.cancelledAt})<=1 and (${t.acceptedAt} is null)=(${t.acceptedBy} is null) and (${t.cancelledAt} is null)=(${t.cancelledBy} is null)`,
    ),
  ],
);
