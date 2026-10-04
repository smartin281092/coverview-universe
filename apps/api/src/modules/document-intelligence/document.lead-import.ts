import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { documentCreateInputSchema, documentAnalysisSchema } from "@coverview/contracts";
import { DocumentError } from "./document.repository.js";
import { leadSourceSnapshot } from "./document.lead-source.js";

// All callers hold the current actor and Lead locks and authorize the operation first.
export async function createLeadOfferUpload(tx: PoolClient, userId: string, source: unknown) {
  const input = documentCreateInputSchema
    .pick({ name: true, mime: true, size: true, checksum: true })
    .parse(source);
  const count = await tx.query(
    "select id from files where user_id=$1 and deleted_at is null limit 200",
    [userId],
  );
  if (count.rowCount === 200) throw new DocumentError("DOCUMENT_LIMIT_REACHED", 422);
  const id = `doc_${randomUUID()}`;
  await tx.query(
    `insert into files(id,user_id,name,mime,declared_mime,size,checksum,object_key,purpose,analysis_requested,retained_at)
    values($1,$2,$3,'application/octet-stream',$4,$5,$6,$7,'lead_offer',true,now())`,
    [id, userId, input.name, input.mime, input.size, input.checksum, `documents/${id}/original`],
  );
  await tx.query(
    `insert into document_audit_events(id,document_id,user_id,actor,action,revision)
    values($1,$2,$3,$3,'document.created.v1',0)`,
    [randomUUID(), id, userId],
  );
  return id;
}

export function leadImportAnalysis(row: Record<string, unknown>) {
  if (!leadSourceSnapshot(row))
    return ["pending", "queued", "scanning", "reading"].includes(String(row.state))
      ? ("pending" as const)
      : ("unavailable" as const);
  const parsed = documentAnalysisSchema.safeParse(row.analysis);
  return !parsed.success
    ? ("absent" as const)
    : parsed.data.warnings?.length
      ? ("partial" as const)
      : ("available" as const);
}

export async function queueLeadOfferUpload(
  tx: PoolClient,
  documentId: string,
  actorId: string,
  action: { mime: string } | { revision: number },
) {
  const row = (
    await tx.query<Record<string, unknown>>("select * from files where id=$1 for update", [
      documentId,
    ])
  ).rows[0];
  if (!row || row.purpose !== "lead_offer" || row.deleted_at)
    throw new DocumentError("DOCUMENT_NOT_FOUND", 404);
  const upload = "mime" in action;
  if (upload && row.state !== "pending") return;
  if (!upload && (row.revision !== action.revision || row.state !== "failed"))
    throw new DocumentError("DOCUMENT_CONFLICT", 409);
  const updated = (
    await tx.query<{ user_id: string; generation: number; revision: number }>(
      `update files set state='queued',failure=null,analysis_requested=true,mime=coalesce($2,mime),
    revision=revision+1,generation=generation+1,updated_at=now() where id=$1 returning user_id,generation,revision`,
      [documentId, upload ? action.mime : null],
    )
  ).rows[0]!;
  const kind = upload ? "document.uploaded.v1" : "document.retry_requested.v1";
  await tx.query(
    `insert into document_outbox(id,document_id,user_id,type,generation) values($1,$2,$3,$4,$5)`,
    [randomUUID(), documentId, updated.user_id, kind, updated.generation],
  );
  await tx.query(
    `insert into document_audit_events(id,document_id,user_id,actor,action,revision) values($1,$2,$3,$4,$5,$6)`,
    [randomUUID(), documentId, updated.user_id, actorId, kind, updated.revision],
  );
}
