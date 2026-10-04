import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { healthInsurers } from "./health.schema.js";

export const healthForeignDatasets = pgTable(
  "health_foreign_datasets",
  {
    id: text("id").primaryKey(),
    year: integer("year").notNull(),
    active: boolean("active").notNull().default(false),
    sourceUrl: text("source_url").notNull(),
    sha256: text("sha256").notNull(),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("health_foreign_active_year")
      .on(t.year)
      .where(sql`${t.active}=true`),
  ],
);
export const healthForeignPremiums = pgTable(
  "health_foreign_premiums",
  {
    id: text("id").primaryKey(),
    datasetId: text("dataset_id")
      .notNull()
      .references(() => healthForeignDatasets.id),
    insurerId: integer("insurer_id")
      .notNull()
      .references(() => healthInsurers.id),
    country: text("country").notNull(),
    ageGroup: text("age_group").notNull(),
    ageSubgroup: text("age_subgroup").notNull(),
    accident: boolean("accident").notNull(),
    deductible: integer("deductible").notNull(),
    monthlyPremiumMinor: integer("monthly_premium_minor").notNull(),
    raw: jsonb("raw").notNull(),
  },
  (t) => [
    uniqueIndex("health_foreign_grain").on(
      t.datasetId,
      t.insurerId,
      t.country,
      t.ageGroup,
      t.ageSubgroup,
      t.accident,
      t.deductible,
    ),
    index("health_foreign_compare").on(
      t.datasetId,
      t.country,
      t.ageGroup,
      t.accident,
      t.monthlyPremiumMinor,
    ),
    check("health_foreign_money", sql`${t.monthlyPremiumMinor}>=0 and ${t.deductible} in (0,300)`),
  ],
);
