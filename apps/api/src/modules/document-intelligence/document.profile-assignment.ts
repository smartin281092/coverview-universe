import { inArray, isNull, or } from "drizzle-orm";
import type { DocumentSummary } from "@coverview/contracts";
import { documents } from "./document.schema.js";

export const assignedDocumentCondition = () =>
  or(
    isNull(documents.profileAssignment),
    inArray(documents.profileAssignment, ["matched", "created", "manual"]),
  );

export function hasDocumentProfile(row: Pick<DocumentSummary, "profileAssignment">) {
  return (
    row.profileAssignment == null ||
    ["matched", "created", "manual"].includes(row.profileAssignment)
  );
}
