import { and, eq, inArray, isNull, ne, notInArray, or } from "drizzle-orm";
import type { DocumentSummary } from "@coverview/contracts";
import type { createDatabase } from "../../platform/db/database.js";
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

type Database = ReturnType<typeof createDatabase>["db"];
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
// A request cites one of its person's documents (20 October 2026): the owner's own file, in that
// person's profile, neither deleted nor quarantined. Shared until the citing transaction commits.
export async function profileDocumentExists(
  tx: Tx,
  userId: string,
  profileId: string,
  documentId: string,
) {
  const [row] = await tx
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.userId, userId),
        eq(documents.managedProfileId, profileId),
        isNull(documents.deletedAt),
        notInArray(documents.state, ["deleting", "deleted", "quarantined"]),
        assignedDocumentCondition(),
      ),
    )
    .limit(1)
    .for("share");
  return !!row;
}
