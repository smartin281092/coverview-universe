import { createHash, randomUUID } from "node:crypto";
import { and, asc, eq, getTableColumns, inArray, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import {
  documentIdentityAttachmentSchema,
  documentIdentityAttachmentInputSchema,
  type DocumentIdentityAttachmentInput,
  type DocumentSummary,
} from "@coverview/contracts";
import type { createDatabase } from "../../platform/db/database.js";
import { lockProfileActor, IdentityError, type ProfileActor } from "../identity/index.js";
import {
  documents,
  documentIdentityAttachments,
  documentIdentityAttachmentCommands,
  documentAudit,
} from "./document.schema.js";
import { DocumentError } from "./document.errors.js";

type Database = ReturnType<typeof createDatabase>["db"];
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Attachment = typeof documentIdentityAttachments.$inferSelect;
type Row = typeof documents.$inferSelect;
const empty = (userId: string): Attachment => ({
  userId,
  revision: 0,
  combinedId: null,
  frontId: null,
  backId: null,
  updatedAt: new Date(),
});
const idsOf = (row: Attachment) =>
  [row.combinedId, row.frontId, row.backId].filter((id): id is string => !!id);

export function createIdentityAttachmentRepository(
  db: Database,
  summary: (row: Row) => DocumentSummary,
) {
  async function read(tx: Database | Tx, userId: string, attachment?: Attachment) {
    const row =
      attachment ??
      (
        await tx
          .select()
          .from(documentIdentityAttachments)
          .where(eq(documentIdentityAttachments.userId, userId))
          .limit(1)
      )[0] ??
      empty(userId);
    const ids = idsOf(row);
    const records = ids.length
      ? await tx
          .select({
            ...getTableColumns(documents),
            analysis: sql<Row["analysis"]>`case when ${documents.analysis} is null then null else
        (${documents.analysis} - 'fields' - 'pages') || jsonb_build_object('fields', '[]'::jsonb, 'pages',
        jsonb_build_array((${documents.analysis}->'pages'->0) || jsonb_build_object('text', left(${documents.analysis}->'pages'->0->>'text', 12000)))) end`,
          })
          .from(documents)
          .where(
            and(
              eq(documents.userId, userId),
              isNull(documents.managedProfileId),
              inArray(documents.id, ids),
            ),
          )
          .limit(3)
      : [];
    const visible = records.filter(
      (record) => !record.deletedAt && !["deleted", "deleting"].includes(record.state),
    );
    const get = (id: string | null) => {
      const record = visible.find((candidate) => candidate.id === id);
      return record ? summary(record) : null;
    };
    const summaries = visible.map(summary);
    const full = !!row.combinedId || !!(row.frontId && row.backId);
    const invalid =
      visible.length !== ids.length ||
      summaries.some(
        (document) =>
          document.state === "quarantined" ||
          document.category !== "identity" ||
          (document.state === "failed" && !document.canDownload),
      );
    const processing = summaries.some((document) =>
      ["pending", "queued", "scanning", "reading"].includes(document.state),
    );
    const ready = full && summaries.every((document) => document.canDownload);
    return documentIdentityAttachmentSchema.parse({
      revision: row.revision,
      combined: get(row.combinedId),
      front: get(row.frontId),
      back: get(row.backId),
      status:
        ids.length === 0
          ? "missing"
          : invalid
            ? "needs_attention"
            : processing
              ? "processing"
              : ready
                ? "ready"
                : "incomplete",
    });
  }
  return {
    identityAttachment: (userId: string) => read(db, userId),
    async saveIdentityAttachment(
      actor: ProfileActor,
      input: DocumentIdentityAttachmentInput,
      key: string,
    ) {
      const payload = documentIdentityAttachmentInputSchema.parse(input);
      const normalizedKey = z.uuid().parse(key).toLowerCase();
      const signature = createHash("sha256")
        .update(JSON.stringify(Object.entries(payload).sort(([a], [b]) => a.localeCompare(b))))
        .digest("hex");
      return db.transaction(async (tx) => {
        const { session } = await lockProfileActor(tx, actor);
        if (actor.administratorUserId) throw new DocumentError("DOCUMENT_ATTACHMENT_INVALID", 422);
        const now = new Date();
        if (session.expiresAt <= now) throw new IdentityError("IDENTITY_UNAUTHENTICATED", 401);
        const current =
          (
            await tx
              .select()
              .from(documentIdentityAttachments)
              .where(eq(documentIdentityAttachments.userId, actor.userId))
              .limit(1)
              .for("update")
          )[0] ?? empty(actor.userId);
        const previous = (
          await tx
            .select()
            .from(documentIdentityAttachmentCommands)
            .where(
              and(
                eq(documentIdentityAttachmentCommands.userId, actor.userId),
                eq(documentIdentityAttachmentCommands.key, normalizedKey),
              ),
            )
            .limit(1)
        )[0];
        if (previous && previous.expiresAt > now) {
          if (previous.hash !== signature)
            throw new DocumentError("DOCUMENT_IDEMPOTENCY_REUSED", 422);
          // No old filename/status survives a subsequent removal or quarantine through replay.
          return read(tx, actor.userId, current);
        }
        if (current.revision !== payload.revision || current.revision >= 2147483646)
          throw new DocumentError("DOCUMENT_CONFLICT", 409);
        const next: Attachment = {
          ...current,
          revision: current.revision + 1,
          updatedAt: now,
          ...(payload.combinedId !== undefined ? { combinedId: payload.combinedId } : {}),
          ...(payload.frontId !== undefined ? { frontId: payload.frontId } : {}),
          ...(payload.backId !== undefined ? { backId: payload.backId } : {}),
        };
        const ids = idsOf(next);
        if ((next.combinedId && (next.frontId || next.backId)) || new Set(ids).size !== ids.length)
          throw new DocumentError("DOCUMENT_ATTACHMENT_INVALID", 422);
        const rows = ids.length
          ? await tx
              .select()
              .from(documents)
              .where(
                and(
                  eq(documents.userId, actor.userId),
                  isNull(documents.managedProfileId),
                  inArray(documents.id, ids),
                ),
              )
              .orderBy(asc(documents.id))
              .limit(3)
              .for("update")
          : [];
        if (
          rows.length !== ids.length ||
          rows.some((row) => row.deletedAt || ["deleted", "deleting"].includes(row.state))
        )
          throw new DocumentError("DOCUMENT_NOT_FOUND", 404);
        if (
          rows.some((row) => row.category !== "identity" || row.state === "quarantined") ||
          new Set(rows.map((row) => row.checksum)).size !== rows.length
        )
          throw new DocumentError("DOCUMENT_ATTACHMENT_INVALID", 422);
        await tx
          .insert(documentIdentityAttachments)
          .values(next)
          .onConflictDoUpdate({ target: documentIdentityAttachments.userId, set: next });
        if (previous)
          await tx
            .delete(documentIdentityAttachmentCommands)
            .where(
              and(
                eq(documentIdentityAttachmentCommands.id, previous.id),
                eq(documentIdentityAttachmentCommands.userId, actor.userId),
              ),
            );
        await tx.insert(documentIdentityAttachmentCommands).values({
          id: randomUUID(),
          userId: actor.userId,
          key: normalizedKey,
          hash: signature,
          expiresAt: new Date(now.getTime() + 86400000),
        });
        // Audit references originals, never their contents or the client's identity fields.
        const auditIds = [...new Set([...idsOf(current), ...ids])];
        if (auditIds.length)
          await tx.insert(documentAudit).values(
            auditIds.map((id) => ({
              id: randomUUID(),
              documentId: id,
              userId: actor.userId,
              actor: actor.id,
              action: "document.identity_attachment_changed.v1",
              revision: next.revision,
            })),
          );
        return read(tx, actor.userId, next);
      });
    },
  };
}

export async function cleanupIdentityAttachmentCommands(db: Database) {
  await db
    .delete(documentIdentityAttachmentCommands)
    .where(
      inArray(
        documentIdentityAttachmentCommands.id,
        db
          .select({ id: documentIdentityAttachmentCommands.id })
          .from(documentIdentityAttachmentCommands)
          .where(lte(documentIdentityAttachmentCommands.expiresAt, new Date()))
          .orderBy(
            asc(documentIdentityAttachmentCommands.expiresAt),
            asc(documentIdentityAttachmentCommands.id),
          )
          .limit(100),
      ),
    );
}
