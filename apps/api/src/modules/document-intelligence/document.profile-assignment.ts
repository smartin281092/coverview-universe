import { and, inArray, isNull, ne, or } from "drizzle-orm";
import type { DocumentSummary } from "@coverview/contracts";
import { documents } from "./document.schema.js";

export const assignedDocumentCondition = () =>
  and(or(isNull(documents.purpose), ne(documents.purpose, "lead_offer")), or(
    isNull(documents.profileAssignment),
    inArray(documents.profileAssignment, ["matched", "created", "manual"]),
  ));

export function hasDocumentProfile(row: Pick<DocumentSummary, "profileAssignment" | "purpose">) {
  return (
    row.purpose !== "lead_offer" && (row.profileAssignment == null ||
    ["matched", "created", "manual"].includes(row.profileAssignment))
  );
}
