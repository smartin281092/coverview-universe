import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import type { InsuranceRequest, InsuranceCart } from "@coverview/contracts/insurance-requests";
import { identityUsers } from "../identity/index.js";
const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });
export const insuranceRequests = pgTable(
  "insurance_requests",
  {
    id: text("id").primaryKey(),
    browserHash: text("browser_hash").notNull(),
    userId: text("user_id").references(() => identityUsers.id),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    state: text("state").$type<InsuranceRequest["state"]>().notNull().default("draft"),
    revision: integer("revision").notNull().default(0),
    items: jsonb("items").$type<InsuranceRequest["items"]>().notNull().default([]),
    saveInWallet: boolean("save_in_wallet").notNull().default(false),
    legalVersion: text("legal_version"),
    submitHash: text("submit_hash"),
    submitKey: text("submit_key"),
    history: jsonb("history").$type<InsuranceRequest["history"]>().notNull().default([]),
    draft: jsonb("draft").$type<InsuranceCart>(),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
    submittedAt: instant("submitted_at"),
  },
  (table) => [
    index("insurance_requests_owner_list").on(table.userId, table.createdAt, table.id),
    index("insurance_requests_admin_list").on(table.state, table.createdAt, table.id),
    index("insurance_requests_browser").on(table.browserHash, table.createdAt),
    uniqueIndex("insurance_requests_guest_draft")
      .on(table.browserHash)
      .where(sql`${table.state} = 'draft' and ${table.userId} is null`),
    check("insurance_requests_hash", sql`${table.browserHash} ~ '^[0-9a-f]{64}$'`),
    check(
      "insurance_requests_state",
      sql`${table.state} in ('draft','submitted','reviewing','insurer_contacted','offer_ready','completed','cancelled')`,
    ),
    check("insurance_requests_revision", sql`${table.revision} >= 0`),
  ],
);
export const insuranceEmailChallenges = pgTable(
  "insurance_email_challenges",
  {
    browserHash: text("browser_hash").primaryKey(),
    email: text("email").notNull(),
    key: text("key").notNull(),
    state: text("state")
      .$type<"pending" | "sent" | "verifying" | "consumed" | "failed">()
      .notNull(),
    attempts: integer("attempts").notNull().default(0),
    createdAt: instant("created_at").notNull(),
    expiresAt: instant("expires_at").notNull(),
  },
  (table) => [index("insurance_email_rate").on(table.email, table.createdAt)],
);
export const insuranceRequestCommands = pgTable(
  "insurance_request_commands",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => insuranceRequests.id, { onDelete: "cascade" }),
    actorId: text("actor_id").notNull(),
    key: text("key").notNull(),
    hash: text("hash").notNull(),
    state: text("state").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("insurance_request_commands_key").on(table.requestId, table.actorId, table.key),
  ],
);

export const insuranceEmailReservations = pgTable("insurance_email_reservations", {
  emailHash: text("email_hash").primaryKey(),
  reservedAt: instant("reserved_at").notNull(),
});
