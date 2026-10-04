import type { PoolClient } from "pg";
import { createHash } from "node:crypto";
import { z } from "zod";

export const leadSourceSnapshotSchema = z.object({
  checksum: z.string().regex(/^[a-f0-9]{64}$/u),
  generation: z.number().int().nonnegative(),
  reviewRevision: z.number().int().nonnegative(),
  analysis: z.unknown(),
  category: z.string(),
  categoryCorrected: z.boolean(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
});

// Immutable review records survive ownership transfer; files.revision alone also changes on transfer.
export const leadSourceReviewRevisionSql = `greatest(
  coalesce((select max(document_revision) from document_field_corrections where document_id=f.id and generation=f.generation),0),
  coalesce((select max(revision) from document_decisions where document_id=f.id),0))`;

// The caller must authorize the Lead or the owned upload before reading this projection.
export function leadSourceSnapshot(row: Record<string, unknown>) {
  if (row.deleted_at || !row.scan_version || !["ready", "failed"].includes(String(row.state)))
    return null;
  const content = {
    checksum: row.checksum,
    generation: row.generation,
    reviewRevision: Number(row.source_review_revision),
    analysis: row.analysis ?? null,
    category: row.category,
    categoryCorrected: row.category_corrected,
  };
  // JSONB key order is stable for rows read from PostgreSQL; persist this exact payload.
  return leadSourceSnapshotSchema.parse({
    ...content,
    fingerprint: createHash("sha256").update(JSON.stringify(content)).digest("hex"),
  });
}

// Called inside the Lead transaction. The row lock also serializes deletion of the source.
export async function retainLeadSource(
  tx: PoolClient,
  documentId: string,
  actor: { userId: string; administrator: boolean },
  client: { userId: string | null; profileId: string | null },
  previouslyRetained = false,
) {
  const result = await tx.query<Record<string, unknown>>(
    "select id,user_id,managed_profile_id,retained_at from files where id=$1 and deleted_at is null and state not in ('deleted','deleting','quarantined') for update",
    [documentId],
  );
  const source = result.rows[0];
  if (
    !source ||
    (source.user_id !== actor.userId &&
      !(previouslyRetained && source.retained_at) &&
      !(
        actor.administrator &&
        (client.profileId
          ? source.managed_profile_id === client.profileId
          : source.user_id === client.userId && source.managed_profile_id === null)
      ))
  )
    return false;
  await tx.query("update files set retained_at=coalesce(retained_at,now()) where id=$1", [
    documentId,
  ]);
  return true;
}
