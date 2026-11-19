import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { SupplementaryCatalog } from "@coverview/contracts/supplementary-insurance";

const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });

// Supplementary insurance (LCA) comparator, 19 November 2026. Public reference data imported from
// data/supplementary-insurance/<year>: one immutable catalogue per content fingerprint.
export const supplementaryCatalogs = pgTable(
  "supplementary_catalogs",
  {
    id: text("id").primaryKey(),
    year: integer("year").notNull(),
    data: jsonb("data").$type<SupplementaryCatalog>().notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("supplementary_catalog_year").on(t.year, t.createdAt),
    check("supplementary_catalog_id", sql`${t.id} ~ '^slc_[0-9]{4}_[0-9a-f]{24}$'`),
  ],
);

// Premiums read in the insurers' official calculators, one row per product, variant, option,
// birth year, sex and reference locality. Amounts in centimes (DATA-11).
export const supplementaryPremiums = pgTable(
  "supplementary_premiums",
  {
    catalogId: text("catalog_id")
      .notNull()
      .references(() => supplementaryCatalogs.id),
    insurer: text("insurer").notNull(),
    productKey: text("product_key").notNull(),
    variant: text("variant").notNull(),
    option: text("option").notNull(),
    birthYear: integer("birth_year").notNull(),
    sex: text("sex").notNull(),
    postalCode: text("postal_code").notNull(),
    accident: boolean("accident"),
    monthlyMinor: integer("monthly_minor").notNull(),
    note: text("note"),
  },
  (t) => [
    index("supplementary_premium_profile").on(t.catalogId, t.birthYear, t.postalCode),
    unique("supplementary_premium_once")
      .on(
        t.catalogId,
        t.productKey,
        t.variant,
        t.option,
        t.birthYear,
        t.sex,
        t.postalCode,
        t.accident,
      )
      .nullsNotDistinct(),
    check(
      "supplementary_premium_valid",
      sql`${t.sex} in ('female','male') and ${t.monthlyMinor} >= 0 and ${t.postalCode} ~ '^[0-9]{4}$'`,
    ),
  ],
);

// Orders of a product from the site (19 November 2026). The table is the outbox of the internal
// notice: queued → sending → sent, or failed after the last attempt.
export const supplementaryOrders = pgTable(
  "supplementary_orders",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull(),
    reference: text("reference").notNull(),
    fingerprint: text("fingerprint").notNull(),
    catalogId: text("catalog_id")
      .notNull()
      .references(() => supplementaryCatalogs.id),
    productKey: text("product_key").notNull(),
    data: jsonb("data").notNull(),
    notification: text("notification").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    claimedAt: instant("claimed_at"),
    notifiedAt: instant("notified_at"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("supplementary_order_once").on(t.requestId),
    index("supplementary_order_queue")
      .on(t.createdAt, t.id)
      .where(sql`${t.notification} in ('queued','sending')`),
    index("supplementary_order_sent").on(t.notifiedAt),
    check(
      "supplementary_order_state",
      sql`${t.notification} in ('queued','sending','sent','failed') and ${t.attempts} >= 0 and (${t.notification} = 'sent') = (${t.notifiedAt} is not null)`,
    ),
  ],
);
