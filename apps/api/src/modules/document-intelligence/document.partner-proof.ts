import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { documentCreateInputSchema } from "@coverview/contracts";
import { DocumentError } from "./document.errors.js";

// Caller holds the declarant's membership lock; no client profile or AI processing is involved.
export async function createPartnerProof(tx: PoolClient, userId: string, raw: unknown) {
  const input = documentCreateInputSchema
    .pick({ name: true, mime: true, size: true, checksum: true })
    .parse(raw);
  const existing = (
    await tx.query<{ id: string }>(
      "select id from files where user_id=$1 and checksum=$2 and purpose='partner_competence' and managed_profile_id is null and deleted_at is null order by created_at,id limit 1",
      [userId, input.checksum],
    )
  ).rows[0];
  if (existing) return existing.id;
  const count = await tx.query(
    "select id from files where user_id=$1 and deleted_at is null limit 200",
    [userId],
  );
  if (count.rowCount === 200) throw new DocumentError("DOCUMENT_LIMIT_REACHED", 422);
  const id = `doc_${randomUUID()}`;
  await tx.query(
    `insert into files(id,user_id,name,mime,declared_mime,size,checksum,object_key,purpose,analysis_requested,retained_at)
    values($1,$2,$3,'application/octet-stream',$4,$5,$6,$7,'partner_competence',false,now())`,
    [id, userId, input.name, input.mime, input.size, input.checksum, `documents/${id}/original`],
  );
  await tx.query(
    `insert into document_audit_events(id,document_id,user_id,actor,action,revision)
    values($1,$2,$3,$3,'document.created.v1',0)`,
    [randomUUID(), id, userId],
  );
  return id;
}

export async function queuePartnerProof(
  tx: PoolClient,
  userId: string,
  id: string,
  action: { mime: string } | { revision: number },
) {
  const row = (
    await tx.query<{ state: string; revision: number }>(
      "select state,revision from files where id=$1 and user_id=$2 and purpose='partner_competence' and managed_profile_id is null and deleted_at is null for update",
      [id, userId],
    )
  ).rows[0];
  if (!row) throw new DocumentError("DOCUMENT_NOT_FOUND", 404);
  const upload = "mime" in action;
  if (upload && row.state !== "pending") return;
  if (!upload && (row.state !== "failed" || row.revision !== action.revision))
    throw new DocumentError("DOCUMENT_CONFLICT", 409);
  const next = (
    await tx.query<{ generation: number; revision: number }>(
      `update files set state='queued',failure=null,analysis_requested=false,mime=coalesce($2,mime),revision=revision+1,generation=generation+1,updated_at=now()
      where id=$1 returning generation,revision`,
      [id, upload ? action.mime : null],
    )
  ).rows[0]!;
  const kind = upload ? "document.uploaded.v1" : "document.retry_requested.v1";
  await tx.query(
    "insert into document_outbox(id,document_id,user_id,type,generation) values($1,$2,$3,$4,$5)",
    [randomUUID(), id, userId, kind, next.generation],
  );
  await tx.query(
    "insert into document_audit_events(id,document_id,user_id,actor,action,revision) values($1,$2,$3,$3,$4,$5)",
    [randomUUID(), id, userId, kind, next.revision],
  );
}
