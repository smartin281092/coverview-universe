import { and, inArray, isNull, ne, notInArray, or } from "drizzle-orm";
import type { DocumentSummary } from "@coverview/contracts";
import { documents } from "./document.schema.js";
import { isProfessionalPurpose, professionalPurposes } from "./document.purposes.js";

export const assignedDocumentCondition = () =>
  and(
    or(
      isNull(documents.purpose),
      and(
        ne(documents.purpose, "lead_offer"),
        notInArray(documents.purpose, [...professionalPurposes]),
      ),
    ),
    or(
      isNull(documents.profileAssignment),
      inArray(documents.profileAssignment, ["matched", "created", "manual"]),
    ),
  );

export function hasDocumentProfile(row: Pick<DocumentSummary, "profileAssignment" | "purpose">) {
  return (
    row.purpose !== "lead_offer" &&
    !isProfessionalPurpose(row.purpose) &&
    (row.profileAssignment == null ||
      ["matched", "created", "manual"].includes(row.profileAssignment))
  );
}
