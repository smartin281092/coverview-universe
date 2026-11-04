import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import type { PensionSearch } from "@coverview/contracts/pension-searches";
import { identityUsers } from "../identity/index.js";
const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });
// A search for forgotten LPP assets, ordered by a verified Wallet account (4 November 2026).
// details holds the identity given for the search, including the AVS number (sensitive PII).
export const pensionSearches = pgTable(
  "pension_searches",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    email: text("email").notNull(),
    state: text("state").$type<PensionSearch["state"]>().notNull().default("submitted"),
    revision: integer("revision").notNull().default(0),
    details: jsonb("details").$type<PensionSearch["details"]>().notNull(),
    mandateVersion: text("mandate_version").notNull(),
    submitKey: text("submit_key").notNull(),
    submitHash: text("submit_hash").notNull(),
    history: jsonb("history").$type<PensionSearch["history"]>().notNull().default([]),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("pension_searches_owner_list").on(table.userId, table.createdAt, table.id),
    index("pension_searches_admin_list").on(table.state, table.createdAt, table.id),
    uniqueIndex("pension_searches_submit_key").on(table.userId, table.submitKey),
    check("pension_searches_id", sql`${table.id} ~ '^lpp_[0-9a-f-]{36}$'`),
    check(
      "pension_searches_state",
      sql`${table.state} in ('submitted','reviewing','search_sent','results_received','completed','cancelled')`,
    ),
    check("pension_searches_revision", sql`${table.revision} >= 0`),
  ],
);
// One email code at a time per browser; email_hash spaces out codes sent to the same mailbox.
export const pensionSearchChallenges = pgTable(
  "pension_search_challenges",
  {
    browserHash: text("browser_hash").primaryKey(),
    email: text("email").notNull(),
    emailHash: text("email_hash").notNull(),
    key: text("key").notNull(),
    state: text("state")
      .$type<"pending" | "sent" | "verifying" | "consumed" | "failed">()
      .notNull(),
    attempts: integer("attempts").notNull().default(0),
    createdAt: instant("created_at").notNull(),
    expiresAt: instant("expires_at").notNull(),
  },
  (table) => [
    index("pension_search_challenges_email").on(table.emailHash, table.createdAt),
    index("pension_search_challenges_expiry").on(table.expiresAt),
    check("pension_search_challenges_hash", sql`${table.browserHash} ~ '^[0-9a-f]{64}$'`),
  ],
);
export const pensionSearchCommands = pgTable(
  "pension_search_commands",
  {
    id: text("id").primaryKey(),
    searchId: text("search_id")
      .notNull()
      .references(() => pensionSearches.id, { onDelete: "cascade" }),
    actorId: text("actor_id").notNull(),
    key: text("key").notNull(),
    hash: text("hash").notNull(),
    state: text("state").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("pension_search_commands_key").on(table.searchId, table.actorId, table.key),
  ],
);
