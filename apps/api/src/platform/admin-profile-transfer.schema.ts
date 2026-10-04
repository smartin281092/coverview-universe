import { sql } from "drizzle-orm";
import { pgTable, text, integer, timestamp, uniqueIndex, check } from "drizzle-orm/pg-core";
import { identityUsers } from "../modules/identity/identity.schema.js";

// Durable transfer history contains identifiers only; personal data remains in its dossier.
// The receipt is also the permanent idempotency record for this ownership operation.
export const adminProfileTransfers = pgTable(
  "admin_profile_transfers",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id").notNull(),
    sourceUserId: text("source_user_id")
      .notNull()
      .references(() => identityUsers.id),
    destinationUserId: text("destination_user_id")
      .notNull()
      .references(() => identityUsers.id),
    administratorUserId: text("administrator_user_id")
      .notNull()
      .references(() => identityUsers.id),
    sessionId: text("session_id").notNull(),
    commandKey: text("command_key").notNull(),
    requestHash: text("request_hash").notNull(),
    revision: integer("revision").notNull(),
    authorizationPolicy: text("authorization_policy")
      .notNull()
      .default("revoke_previous_signatures"),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("admin_profile_transfers_command").on(table.administratorUserId, table.commandKey),
    check(
      "admin_profile_transfers_bounds",
      sql`${table.sourceUserId} <> ${table.destinationUserId} and ${table.revision} > 0 and ${table.requestHash} ~ '^[0-9a-f]{64}$' and ${table.authorizationPolicy} = 'revoke_previous_signatures'`,
    ),
  ],
);
