import { z } from "zod";
import { leadOfferInputSchema, leadOfferSchema } from "@coverview/contracts/partner";
import {
  leadSourceSnapshot,
  leadSourceSnapshotSchema,
  leadSourceReviewRevisionSql,
} from "../document-intelligence/index.js";
import { date, fail, type Executor } from "./partner.policy.js";

export async function requireOfferSource(db: Executor, documentId: string, snapshot: unknown) {
  const stored = leadSourceSnapshotSchema.safeParse(snapshot);
  // Acquire the file lock first, then use a new statement snapshot for append-only corrections.
  // Otherwise a correction committing while FOR SHARE waits can be absent from the subquery.
  await db.query("select id from files where id=$1 for share", [documentId]);
  const row = (
    await db.query<Record<string, unknown>>(
      `select f.*, ${leadSourceReviewRevisionSql} source_review_revision from files f where f.id=$1`,
      [documentId],
    )
  ).rows[0];
  const current = row ? leadSourceSnapshot(row) : null;
  if (!current) return fail("PARTNER_INVALID_DOCUMENT");
  if (!stored.success || current.fingerprint !== stored.data.fingerprint)
    return fail("PARTNER_CONFLICT", 409);
  return stored.data;
}

export async function readOffers(
  db: Executor,
  leadId: string,
  wallet: boolean,
  options: { offerId?: string; history?: boolean; cursor?: string } = {},
) {
  const values: unknown[] = [leadId];
  const clauses = ["o.lead_id=$1"];
  if (wallet) clauses.push("o.published_at is not null");
  if (options.offerId) {
    values.push(options.offerId);
    clauses.push(`o.id=$${values.length}`);
  }
  if (options.cursor) {
    let cursor: { at: string; id: string };
    try {
      cursor = z
        .object({ at: z.iso.datetime(), id: z.string().max(100), leadId: z.literal(leadId) })
        .parse(JSON.parse(Buffer.from(options.cursor, "base64url").toString("utf8")));
    } catch {
      return fail("PARTNER_NOT_FOUND", 400);
    }
    values.push(cursor.at, cursor.id);
    clauses.push(`(o.created_at,o.id)<($${values.length - 1}::timestamptz,$${values.length})`);
  }
  const limit = options.offerId ? 1 : options.history ? 20 : 100;
  const result = await db.query<Record<string, unknown>>(
    `select o.*,row_to_json(f) source_row, ${leadSourceReviewRevisionSql} source_review_revision,
      exists(select 1 from partner_offers p join partner_events e on e.subject_id=p.id
        where p.lead_id=o.lead_id and p.family_id=o.family_id and p.version<o.version
        and e.kind in ('client.view','client.select','document.viewed') and e.audience='client') updated_since_viewed
     from partner_offers o left join files f on f.id=o.document_id
     where ${clauses.join(" and ")} order by ${options.history ? "" : "o.active desc,"}o.created_at desc,o.id desc limit ${limit + 1}`,
    values,
  );
  const items = result.rows.slice(0, limit).map((row) => {
    const original = row.source_row
      ? z.record(z.string(), z.unknown()).parse(row.source_row)
      : null;
    const current = original
      ? leadSourceSnapshot({ ...original, source_review_revision: row.source_review_revision })
      : null;
    const stored = leadSourceSnapshotSchema.safeParse(row.source_snapshot);
    const sourceStatus = !current
      ? "unavailable"
      : !stored.success
        ? "unbound"
        : current.fingerprint === stored.data.fingerprint
          ? "current"
          : "changed";
    const data = leadOfferInputSchema.parse(row.data);
    const unexpired = !data.validUntil || new Date(data.validUntil).getTime() > Date.now();
    const usable =
      sourceStatus === "current" &&
      row.active === true &&
      unexpired &&
      !["cancelled", "replaced", "expired", "refused"].includes(String(row.state));
    return leadOfferSchema.parse({
      ...data,
      id: row.id,
      version: row.version,
      active: row.active,
      state: row.state,
      reviewedAt: date(row.reviewed_at as Date | null),
      publishedAt: date(row.published_at as Date | null),
      createdAt: date(row.created_at as Date),
      reviewedBy: wallet ? null : row.reviewed_by,
      publishedBy: wallet ? null : row.published_by,
      sourceStatus,
      sourceGeneration: stored.success ? stored.data.generation : null,
      canDownload: !!current && (!stored.success || stored.data.checksum === current.checksum),
      canCompare: usable && !!row.reviewed_at,
      canChoose:
        usable &&
        !!row.reviewed_at &&
        !!row.published_at &&
        ["published", "viewed", "selected"].includes(String(row.state)),
      updatedSinceViewed: row.updated_since_viewed === true,
    });
  });
  const last = result.rows[Math.min(result.rows.length, limit) - 1];
  return {
    items,
    nextCursor:
      options.history && result.rows.length > limit && last
        ? Buffer.from(
            JSON.stringify({ leadId, at: date(last.created_at as Date), id: last.id }),
          ).toString("base64url")
        : null,
  };
}
