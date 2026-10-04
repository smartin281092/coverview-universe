import { z } from "zod";
import { offerImportSchema } from "@coverview/contracts/partner";
import {
  leadSourceSnapshot,
  leadSourceReviewRevisionSql,
  leadImportAnalysis,
} from "../document-intelligence/index.js";
import { date, fail, type Executor } from "./partner.policy.js";

export async function readOfferImports(
  db: Executor,
  leadId: string,
  writable: boolean,
  options: { id?: string; cursor?: string } = {},
) {
  const values: unknown[] = [leadId];
  const clauses = ["i.lead_id=$1"];
  if (options.id) {
    values.push(options.id);
    clauses.push(`i.id=$${values.length}`);
  }
  if (options.cursor) {
    try {
      const cursor = z
        .object({ leadId: z.literal(leadId), id: z.string().max(100), at: z.iso.datetime() })
        .parse(JSON.parse(Buffer.from(options.cursor, "base64url").toString("utf8")));
      values.push(cursor.at, cursor.id);
      clauses.push(`(i.created_at,i.id)<($${values.length - 1}::timestamptz,$${values.length})`);
    } catch {
      fail("PARTNER_NOT_FOUND", 400);
    }
  }
  const rows = (
    await db.query<Record<string, unknown>>(
      `select f.*,i.id import_id,i.created_at imported_at,i.offer_id,
    ${leadSourceReviewRevisionSql} source_review_revision from partner_offer_imports i join files f on f.id=i.document_id
    where ${clauses.join(" and ")} order by i.created_at desc,i.id desc limit ${options.id ? 1 : 21}`,
      values,
    )
  ).rows;
  const items = rows.slice(0, 20).map((row) => {
    const safe = !!leadSourceSnapshot(row),
      live = !row.deleted_at;
    return offerImportSchema.parse({
      id: row.import_id,
      documentId: row.id,
      name: row.name,
      checksum: row.checksum,
      size: row.size,
      state: row.state,
      revision: row.revision,
      failure: row.failure,
      analysis: leadImportAnalysis(row),
      offerId: row.offer_id,
      createdAt: date(row.imported_at as Date),
      canUpload: writable && live && row.state === "pending",
      canRetry: writable && live && row.state === "failed" && !row.offer_id,
      canPrepare: writable && safe && !row.offer_id,
      canDownload: safe,
    });
  });
  const last = items.at(-1);
  return {
    items,
    nextCursor:
      rows.length > 20 && last
        ? Buffer.from(JSON.stringify({ leadId, at: last.createdAt, id: last.id })).toString(
            "base64url",
          )
        : null,
  };
}
