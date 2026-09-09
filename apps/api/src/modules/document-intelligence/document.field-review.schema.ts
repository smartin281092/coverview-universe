import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  timestamp,
  foreignKey,
  check,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { DocumentExtraction } from "@coverview/contracts";
import { documents } from "./document.schema.js";

// Original analysis and source quotes are immutable; owner corrections are append-only.
export const documentFieldCorrections = pgTable(
  "document_field_corrections",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    documentId: text("document_id").notNull(),
    generation: integer("generation").notNull(),
    extractionId: text("extraction_id").notNull(),
    field: text("field").$type<DocumentExtraction["field"]>().notNull(),
    value: text("value").notNull(),
    documentRevision: integer("document_revision").notNull(),
    actor: text("actor").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId, table.documentId],
      foreignColumns: [documents.userId, documents.id],
    }),
    check(
      "document_field_corrections_bounds",
      sql`${table.generation} >= 0 and ${table.documentRevision} >= 0 and length(${table.value}) between 1 and 240`,
    ),
    check(
      "document_field_corrections_field",
      sql`${table.field} in ('firstName','lastName','birthDate','nationality','street','postalCode','city','country','documentNumber','documentType','expiresOn','phone','contactEmail','companyName','registrationNumber')`,
    ),
    uniqueIndex("document_field_corrections_revision").on(
      table.userId,
      table.documentId,
      table.generation,
      table.extractionId,
      table.documentRevision,
    ),
    index("document_field_corrections_current").on(
      table.userId,
      table.documentId,
      table.generation,
      table.extractionId,
    ),
  ],
);
