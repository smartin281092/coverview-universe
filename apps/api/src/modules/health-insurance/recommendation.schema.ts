import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import type {
  EvidenceCatalog,
  RecommendationRules,
} from "@coverview/contracts/health-recommendation";
import { identityUsers } from "../identity/index.js";
import { healthDatasets } from "./health.schema.js";
export const recommendationCatalogs = pgTable(
  "health_recommendation_catalogs",
  {
    id: text("id").primaryKey(),
    year: integer("year").notNull(),
    datasetId: text("dataset_id")
      .notNull()
      .references(() => healthDatasets.id),
    data: jsonb("data").$type<EvidenceCatalog>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("health_recommendation_catalog_year").on(table.year, table.createdAt)],
);
export const recommendationVersions = pgTable(
  "health_recommendation_versions",
  {
    id: text("id").primaryKey(),
    year: integer("year").notNull(),
    revision: integer("revision").notNull(),
    config: jsonb("config").$type<RecommendationRules>().notNull(),
    actorId: text("actor_id").references(() => identityUsers.id),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("health_recommendation_version_number").on(table.year, table.revision),
    check("health_recommendation_revision_valid", sql`${table.revision} >= 1`),
  ],
);
export const recommendationReviews = pgTable(
  "health_recommendation_reviews",
  {
    id: text("id").primaryKey(),
    catalogId: text("catalog_id")
      .notNull()
      .references(() => recommendationCatalogs.id),
    caseId: text("case_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (table) => [uniqueIndex("health_recommendation_case_unique").on(table.catalogId, table.caseId)],
);
export const recommendationCommands = pgTable(
  "health_recommendation_commands",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id")
      .notNull()
      .references(() => identityUsers.id),
    key: text("key").notNull(),
    hash: text("hash").notNull(),
    result: jsonb("result").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("health_recommendation_command_unique").on(table.actorId, table.key)],
);
