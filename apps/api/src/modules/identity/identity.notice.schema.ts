import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { identitySessions, identityUsers } from "./identity.schema.js";

export const identityNoticeOpenings = pgTable(
  "identity_notice_openings",
  {
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    version: text("version").notNull(),
    firstOpenedAt: timestamp("first_opened_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
    sessionId: text("session_id")
      .notNull()
      .references(() => identitySessions.id),
  },
  (table) => [primaryKey({ columns: [table.userId, table.version] })],
);
