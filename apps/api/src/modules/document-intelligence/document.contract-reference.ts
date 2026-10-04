import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { documentAnalysisSchema, documentSummarySchema } from "@coverview/contracts";
import { contractCandidateSchema } from "@coverview/contracts/partner";
import { companyOverview, insuranceFacts } from "./document.insurance.js";
import { documentPresentation } from "./document.presentation.js";
import type { documents } from "./document.schema.js";

type Executor = Pick<Pool | PoolClient, "query">;
type Row = typeof documents.$inferSelect;
// Only the caller's already-authorized exact profile is inspected. No email/name lookup.
export async function readContractCandidates(
  db: Executor,
  userId: string,
  profileId: string | null,
  documentId?: string,
  lock = false,
) {
  const result = await db.query<Record<string, unknown>>(
    `select * from files where user_id=$1 and managed_profile_id is not distinct from $2
      and deleted_at is null and state='ready' and scan_version is not null and purpose is null
      and (profile_assignment is null or profile_assignment in ('matched','created','manual'))
      ${documentId ? "and id=$3" : ""} order by created_at desc,id limit 201 ${lock ? "for share" : ""}`,
    documentId ? [userId, profileId, documentId] : [userId, profileId],
  );
  const entries = result.rows.slice(0, 200).flatMap((raw) => {
    const row = Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [
        key.replace(/_([a-z])/gu, (_, letter: string) => letter.toUpperCase()),
        value,
      ]),
    ) as Row;
    const parsed = documentAnalysisSchema.safeParse(row.analysis);
    if (!parsed.success) return [];
    const analysis = parsed.data;
    const document = documentSummarySchema.parse({
      ...row,
      profileId: row.managedProfileId ?? "self",
      profileAssignedAt: row.profileAssignedAt?.toISOString() ?? null,
      ...documentPresentation({ ...row, analysis }),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      canRetry: false,
      canDownload: true,
    });
    const facts = insuranceFacts(analysis);
    // Reuse Wallet's policy qualification; a received quote is never a current contract.
    if (!facts.companyId) return [];
    const contract = companyOverview(facts.companyId, [{ document, analysis }]).contracts[0];
    if (!contract) return [];
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          checksum: row.checksum,
          generation: row.generation,
          analysis,
          category: row.category,
          categoryCorrected: row.categoryCorrected,
        }),
      )
      .digest("hex");
    return [
      {
        candidate: contractCandidateSchema.parse({
          documentId: row.id,
          generation: row.generation,
          fingerprint,
          contract,
          facts,
        }),
        analysis,
      },
    ];
  });
  return { entries, truncated: result.rows.length > 200 };
}

export async function retainContractReference(tx: PoolClient, documentId: string) {
  // Called after ownership, target, fingerprint and consent checks under the same transaction.
  await tx.query("update files set retained_at=coalesce(retained_at,now()) where id=$1", [
    documentId,
  ]);
}
