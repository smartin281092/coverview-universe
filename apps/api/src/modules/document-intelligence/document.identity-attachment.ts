import { createHash, randomUUID } from "node:crypto";
import { hasDocumentProfile } from "./document.profile-assignment.js";
import { and, asc, eq, inArray, isNull, lte } from "drizzle-orm";
import { z } from "zod";
import {
  documentIdentityAttachmentSchema,
  documentIdentityAttachmentInputSchema,
  type DocumentIdentityAttachmentInput,
  type DocumentIdentityDocumentType,
  type DocumentSummary,
} from "@coverview/contracts";
import type { createDatabase } from "../../platform/db/database.js";
import { lockProfileActor, IdentityError, type ProfileActor } from "../identity/index.js";
import { assertDocumentProfileTarget } from "../profiles/index.js";
import {
  documents,
  documentIdentityAttachments,
  managedDocumentIdentityAttachments,
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
  documentType: "unknown",
  combinedId: null,
  frontId: null,
  backId: null,
  updatedAt: new Date(),
});
const idsOf = (row: Attachment) =>
  [row.combinedId, row.frontId, row.backId].filter((id): id is string => !!id);
const targetCondition = (profileId: string) =>
  profileId === "self"
    ? isNull(documents.managedProfileId)
    : eq(documents.managedProfileId, profileId);
const attachmentTable = (profileId: string) =>
  profileId === "self" ? documentIdentityAttachments : managedDocumentIdentityAttachments;
const attachmentCondition = (userId: string, profileId: string) =>
  profileId === "self"
    ? eq(documentIdentityAttachments.userId, userId)
    : and(
        eq(managedDocumentIdentityAttachments.userId, userId),
        eq(managedDocumentIdentityAttachments.managedProfileId, profileId),
      );

function typeFromText(text: string): DocumentIdentityDocumentType {
  const normalized = text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const matches: DocumentIdentityDocumentType[] = [];
  if (/\b(passport|passeport|reisepass|passaporto)\b/u.test(normalized)) matches.push("passport");
  if (
    /\b(carte d['’ ]identite|identity card|identitatskarte|personalausweis|carta d['’ ]identita)\b/u.test(
      normalized,
    )
  )
    matches.push("identity_card");
  if (
    /\b(permis de sejour|titre de sejour|residence permit|aufenthaltstitel|aufenthaltsbewilligung|auslanderausweis|permesso di soggiorno)\b/u.test(
      normalized,
    )
  )
    matches.push("residence_permit");
  return matches.length === 1 ? matches[0]! : "unknown";
}

// Only a cited documentType extraction can relax the requirement for a second face.
// A file name or incidental mention in another document is never identity evidence.
function detectedType(records: Row[]): DocumentIdentityDocumentType {
  const detected = new Set<DocumentIdentityDocumentType>();
  for (const record of records) {
    if (record.category !== "identity" || record.state === "quarantined") continue;
    for (const field of record.analysis?.fields ?? []) {
      if (field.field !== "documentType" || !field.source.text.trim()) continue;
      const page = record.analysis?.pages.find((item) => item.page === field.source.page);
      if (!page?.text.includes(field.source.text)) continue;
      const type = typeFromText(field.source.text);
      if (type !== "unknown" && typeFromText(field.value) === type) detected.add(type);
    }
  }
  return detected.size === 1 ? [...detected][0]! : "unknown";
}

export function createIdentityAttachmentRepository(
  db: Database,
  summary: (row: Row) => DocumentSummary,
) {
  async function read(
    tx: Database | Tx,
    userId: string,
    profileId: string,
    company: boolean,
    attachment?: Attachment,
  ) {
    const row =
      attachment ??
      (
        await tx
          .select()
          .from(attachmentTable(profileId))
          .where(attachmentCondition(userId, profileId))
          .limit(1)
      )[0] ??
      empty(userId);
    const ids = idsOf(row);
    const records = ids.length
      ? await tx
          .select()
          .from(documents)
          .where(
            and(
              eq(documents.userId, userId),
              targetCondition(profileId),
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
    const documentType = company
      ? "unknown"
      : row.documentType !== "unknown"
        ? row.documentType
        : detectedType(visible);
    const backRequired = !company && documentType !== "passport";
    const full = !!row.combinedId || (!company && !!(row.frontId && (row.backId || !backRequired)));
    const invalid =
      visible.length !== ids.length ||
      (company && !!(row.frontId || row.backId)) ||
      summaries.some(
        (document) =>
          document.state === "quarantined" ||
          (company ? document.category === "identity" : document.category !== "identity") ||
          (document.state === "failed" && !document.canDownload),
      );
    const processing = summaries.some((document) =>
      ["pending", "queued", "scanning", "reading"].includes(document.state),
    );
    const ready = full && summaries.every((document) => document.canDownload);
    return documentIdentityAttachmentSchema.parse({
      profileId,
      documentType,
      documentTypeSource:
        !company && row.documentType !== "unknown"
          ? "declared"
          : documentType !== "unknown"
            ? "detected"
            : "unknown",
      backRequired,
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
    async identityAttachment(userId: string, profileId = "self") {
      const subject = await assertDocumentProfileTarget(db, userId, profileId);
      return read(db, userId, profileId, subject?.kind === "legal_entity");
    },
    async saveIdentityAttachment(
      actor: ProfileActor,
      input: DocumentIdentityAttachmentInput,
      key: string,
    ) {
      const payload = documentIdentityAttachmentInputSchema.parse(input);
      const profileId = payload.profileId ?? "self";
      const normalizedKey = z.uuid().parse(key).toLowerCase();
      const signature = createHash("sha256")
        .update(JSON.stringify(Object.entries(payload).sort(([a], [b]) => a.localeCompare(b))))
        .digest("hex");
      return db.transaction(async (tx) => {
        const { session } = await lockProfileActor(tx, actor);
        if (actor.administratorUserId) throw new DocumentError("DOCUMENT_ATTACHMENT_INVALID", 422);
        const subject = await assertDocumentProfileTarget(tx, actor.userId, profileId);
        const company = subject?.kind === "legal_entity";
        const now = new Date();
        if (session.expiresAt <= now) throw new IdentityError("IDENTITY_UNAUTHENTICATED", 401);
        const current =
          (
            await tx
              .select()
              .from(attachmentTable(profileId))
              .where(attachmentCondition(actor.userId, profileId))
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
          return read(tx, actor.userId, profileId, company, current);
        }
        if (current.revision !== payload.revision || current.revision >= 2147483646)
          throw new DocumentError("DOCUMENT_CONFLICT", 409);
        if (company && payload.documentType !== undefined && payload.documentType !== "unknown")
          throw new DocumentError("DOCUMENT_ATTACHMENT_INVALID", 422);
        const next: Attachment = {
          ...current,
          revision: current.revision + 1,
          updatedAt: now,
          ...(payload.documentType !== undefined ? { documentType: payload.documentType } : {}),
          ...(payload.combinedId !== undefined ? { combinedId: payload.combinedId } : {}),
          ...(payload.frontId !== undefined ? { frontId: payload.frontId } : {}),
          ...(payload.backId !== undefined ? { backId: payload.backId } : {}),
          ...(company ? { documentType: "unknown" } : {}),
        };
        const ids = idsOf(next);
        if (
          (next.combinedId && (next.frontId || next.backId)) ||
          (company && (next.frontId || next.backId)) ||
          new Set(ids).size !== ids.length
        )
          throw new DocumentError("DOCUMENT_ATTACHMENT_INVALID", 422);
        const rows = ids.length
          ? await tx
              .select()
              .from(documents)
              .where(
                and(
                  eq(documents.userId, actor.userId),
                  targetCondition(profileId),
                  inArray(documents.id, ids),
                ),
              )
              .orderBy(asc(documents.id))
              .limit(3)
              .for("update")
          : [];
        if (
          rows.length !== ids.length ||
          rows.some(
            (row) =>
              row.deletedAt ||
              !hasDocumentProfile(row) ||
              ["deleted", "deleting"].includes(row.state),
          )
        )
          throw new DocumentError("DOCUMENT_NOT_FOUND", 404);
        if (
          rows.some(
            (row) =>
              (company ? row.category === "identity" : row.category !== "identity") ||
              row.state === "quarantined",
          ) ||
          new Set(rows.map((row) => row.checksum)).size !== rows.length
        )
          throw new DocumentError("DOCUMENT_ATTACHMENT_INVALID", 422);
        if (profileId === "self")
          await tx
            .insert(documentIdentityAttachments)
            .values(next)
            .onConflictDoUpdate({ target: documentIdentityAttachments.userId, set: next });
        else
          await tx
            .insert(managedDocumentIdentityAttachments)
            .values({ ...next, managedProfileId: profileId })
            .onConflictDoUpdate({
              target: [
                managedDocumentIdentityAttachments.userId,
                managedDocumentIdentityAttachments.managedProfileId,
              ],
              set: next,
            });
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
        return read(tx, actor.userId, profileId, company, next);
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
