import type { Pool, PoolClient } from "pg";
import { documentAnalysisSchema } from "@coverview/contracts";
import { leadSourceReviewRevisionSql, leadSourceSnapshot } from "./document.lead-source.js";

// Exact authorized Wallet subject only. A correspondence is not classified as a policy.
export async function readCorrespondenceDocuments(
  db: Pick<Pool | PoolClient, "query">,
  userId: string,
  profileId: string | null,
  options: { documentId?: string; after?: [string | null, string | null]; lock?: boolean } = {},
) {
  const [at, id] = options.after ?? [null, null];
  const rows = (
    await db.query<Record<string, unknown>>(
      `select f.*,${leadSourceReviewRevisionSql} source_review_revision
    from files f where user_id=$1 and managed_profile_id is not distinct from $2
    and deleted_at is null and state='ready' and scan_version is not null and purpose is null
    and (profile_assignment is null or profile_assignment in ('matched','created','manual'))
    and ($3::text is null or id=$3) and ($4::timestamptz is null or (created_at,id)<($4,$5))
    order by created_at desc,id desc limit 21 ${options.lock ? "for share of f" : ""}`,
      [userId, profileId, options.documentId ?? null, at, id],
    )
  ).rows;
  return {
    rows,
    entries: rows.slice(0, 20).flatMap((row) => {
      const source = leadSourceSnapshot(row),
        parsed = documentAnalysisSchema.safeParse(row.analysis);
      return source && parsed.success
        ? [{ documentId: String(row.id), name: String(row.name), source, analysis: parsed.data }]
        : [];
    }),
  };
}
