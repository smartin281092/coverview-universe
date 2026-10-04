import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  jsonb,
  boolean,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { identityUsers } from "../identity/index.js";
export const partnerLeadViews = pgTable(
  "partner_lead_views",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    name: text("name").notNull(),
    revision: integer("revision").notNull(),
    filters: jsonb("filters").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index("partner_lead_views_owner").on(t.userId, t.active, t.updatedAt, t.id),
    check(
      "partner_lead_views_bounds",
      sql`${t.revision}>0 and length(trim(${t.name})) between 2 and 60 and jsonb_typeof(${t.filters})='object' and octet_length(${t.filters}::text)<=4096`,
    ),
  ],
);
