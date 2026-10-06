import { sql } from "drizzle-orm";
import { pgTable, text, boolean, jsonb, timestamp, index, check } from "drizzle-orm/pg-core";
import { identityUsers } from "../identity/index.js";
const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });
// Proof that a person exported their Partner data (C7a): who, from which session and surface, the
// manifest version and counts. Never the content, which is generated on demand and not stored.
export const partnerDataExports = pgTable(
  "partner_data_exports",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    sessionId: text("session_id").notNull(),
    surface: text("surface").notNull(),
    manifestVersion: text("manifest_version").notNull(),
    complete: boolean("complete").notNull().default(false),
    counts: jsonb("counts").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("partner_data_export_user").on(t.userId, t.createdAt, t.id),
    check("partner_data_export_surface", sql`${t.surface} in ('wallet','partner')`),
  ],
);
