import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Technical local data only. This table is not the product identity or tenancy model.
export const localPreviewPersonas = pgTable(
  "local_preview_personas",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    spaceLabel: text("space_label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("local_preview_personas_fixture_id", sql`${table.id} ~ '^fixture_'`),
    check("local_preview_personas_test_email", sql`${table.email} like '%.test'`),
  ],
);
