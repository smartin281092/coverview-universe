import { and, inArray, isNull, ne, or } from "drizzle-orm";
import type { DocumentSummary } from "@coverview/contracts";
import { documents } from "./document.schema.js";

export const assignedDocumentCondition = () =>
  and(
    or(
      isNull(documents.purpose),
      and(ne(documents.purpose, "lead_offer"), ne(documents.purpose, "partner_competence")),
    ),
    or(
      isNull(documents.profileAssignment),
      inArray(documents.profileAssignment, ["matched", "created", "manual"]),
    ),
  );

export function hasDocumentProfile(row: Pick<DocumentSummary, "profileAssignment" | "purpose">) {
  return (
    row.purpose !== "lead_offer" &&
    row.purpose !== "partner_competence" &&
    (row.profileAssignment == null ||
      ["matched", "created", "manual"].includes(row.profileAssignment))
  );
}
