import { sql } from "drizzle-orm";
import {
  documentReviewGroupSchema,
  profileValuesSchema,
  entityProfileValuesSchema,
  type DocumentReviewGroup,
  type DocumentExtraction,
} from "@coverview/contracts";
import type { createDatabase } from "../../platform/db/database.js";
import { readDocumentProfile } from "../identity/index.js";
import { readManagedDocumentProfile } from "../profiles/index.js";
import { documents } from "./document.schema.js";
import { documentFieldCorrections } from "./document.field-review.schema.js";
import { sameProfileValue } from "./document.reconciliation.js";

type Database = ReturnType<typeof createDatabase>["db"];
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Row = typeof documents.$inferSelect;
const addressFields = new Set(["street", "postalCode", "city", "country"]);

export type DocumentReviewProfile = {
  kind: "person" | "legal_entity";
  revision: number;
  values: Record<string, unknown>;
};
export type DocumentFieldCorrection = Pick<
  typeof documentFieldCorrections.$inferSelect,
  "documentId" | "generation" | "extractionId" | "field" | "value" | "documentRevision"
>;

export async function readDocumentFieldCorrections(
  tx: Database | Tx,
  userId: string,
  documentIds: readonly string[],
): Promise<DocumentFieldCorrection[]> {
  if (documentIds.length === 0) return [];
  if (documentIds.length > 200) throw new Error("Document correction batch exceeds bound");
  const corrections = await tx.execute<DocumentFieldCorrection>(sql`
    select distinct on (${documentFieldCorrections.documentId}, ${documentFieldCorrections.extractionId})
      ${documentFieldCorrections.documentId} as "documentId", ${documentFieldCorrections.generation} as generation,
      ${documentFieldCorrections.extractionId} as "extractionId", ${documentFieldCorrections.field} as field,
      ${documentFieldCorrections.value} as value, ${documentFieldCorrections.documentRevision} as "documentRevision"
    from ${documentFieldCorrections} inner join ${documents}
      on ${documents.id} = ${documentFieldCorrections.documentId} and ${documents.userId} = ${documentFieldCorrections.userId}
      and ${documents.generation} = ${documentFieldCorrections.generation}
    where ${documentFieldCorrections.userId} = ${userId}
      and ${documentFieldCorrections.documentId} in (${sql.join(
        documentIds.map((id) => sql`${id}`),
        sql`, `,
      )})
    order by ${documentFieldCorrections.documentId}, ${documentFieldCorrections.extractionId}, ${documentFieldCorrections.documentRevision} desc limit 8000
  `);
  return corrections.rows;
}

export function effectiveDocumentFields(
  row: Pick<Row, "id" | "generation" | "analysis">,
  corrections: readonly DocumentFieldCorrection[],
): DocumentExtraction[] {
  return (row.analysis?.fields ?? []).map((field) => {
    const correction = corrections
      .filter(
        (item) =>
          item.documentId === row.id &&
          item.generation === row.generation &&
          item.extractionId === field.id &&
          item.field === field.field,
      )
      .sort((left, right) => right.documentRevision - left.documentRevision)[0];
    return correction ? { ...field, value: correction.value } : field;
  });
}

export async function getDocumentGroups(
  tx: Database | Tx,
  row: Row,
): Promise<DocumentReviewGroup[]> {
  if (!row.analysis) return [];
  const profile = row.managedProfileId
    ? await readManagedDocumentProfile(tx, row.userId, row.managedProfileId)
    : await readDocumentProfile(tx, row.userId).then((value) => ({
        kind: "person" as const,
        revision: value.revision,
        values: Object.fromEntries(
          Object.entries(value.fields).map(([field, content]) => [field, content?.value]),
        ),
      }));
  const corrections = await readDocumentFieldCorrections(tx, row.userId, [row.id]);
  return buildDocumentGroups(row, profile, corrections);
}

export function buildDocumentGroups(
  row: Row,
  profile: DocumentReviewProfile,
  corrections: readonly DocumentFieldCorrection[],
): DocumentReviewGroup[] {
  const shape =
    profile.kind === "legal_entity" ? entityProfileValuesSchema.shape : profileValuesSchema.shape;
  const values: Record<string, unknown> = profile.values;
  const groups = new Map<string, DocumentReviewGroup>();
  for (const extraction of effectiveDocumentFields(row, corrections)) {
    const id = addressFields.has(extraction.field) ? "address" : extraction.field;
    const group = groups.get(id) ?? {
      id,
      labelKey: id,
      fields: [],
      different: false,
      canSync: true,
      profileRevision: profile.revision,
    };
    const value = extraction.value;
    const currentValue =
      typeof values[extraction.field] === "string" ? (values[extraction.field] as string) : null;
    group.canSync =
      group.canSync &&
      Object.hasOwn(shape, extraction.field) &&
      !group.fields.some((item) => item.field === extraction.field);
    group.fields.push({
      extractionId: extraction.id,
      field: extraction.field,
      value,
      currentValue,
    });
    group.different =
      group.different || currentValue === null || !sameProfileValue(value, currentValue);
    groups.set(id, group);
  }
  return [...groups.values()].map((group) => {
    if (group.id === "address") {
      const order = ["street", "postalCode", "city", "country"];
      group.fields.sort((left, right) => order.indexOf(left.field) - order.indexOf(right.field));
    }
    return documentReviewGroupSchema.parse(group);
  });
}
