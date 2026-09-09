import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  foreignKey,
  check,
} from "drizzle-orm/pg-core";
import type { AuthorizationReceipt } from "@coverview/contracts";
import { identityUsers } from "../identity/index.js";
import { managedProfiles } from "../profiles/index.js";

export const authorizationSignatures = pgTable(
  "authorization_signatures",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    managedProfileId: text("managed_profile_id"),
    profileId: text("profile_id").notNull(),
    kind: text("kind").$type<"procuration" | "mandate">().notNull(),
    version: text("version").notNull(),
    sessionId: text("session_id").notNull(),
    commandKey: text("command_key").notNull(),
    requestHash: text("request_hash").notNull(),
    receipt: jsonb("receipt").$type<AuthorizationReceipt>().notNull(),
    signedAt: timestamp("signed_at", { withTimezone: true, precision: 3 }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, precision: 3 }),
  },
  (table) => [
    foreignKey({
      columns: [table.userId, table.managedProfileId],
      foreignColumns: [managedProfiles.userId, managedProfiles.id],
    }),
    check("authorization_signatures_kind", sql`${table.kind} in ('procuration','mandate')`),
    check(
      "authorization_signatures_target",
      sql`(${table.profileId} = 'self' and ${table.managedProfileId} is null) or (${table.profileId} = ${table.managedProfileId} and ${table.managedProfileId} is not null)`,
    ),
    uniqueIndex("authorization_signatures_command").on(table.userId, table.commandKey),
    uniqueIndex("authorization_signatures_active")
      .on(table.userId, table.profileId, table.kind, table.version)
      .where(sql`${table.revokedAt} is null`),
    index("authorization_signatures_owner").on(table.userId, table.profileId),
  ],
);
