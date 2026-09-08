import { createHash } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import type { FileStorage } from "../../platform/file-storage.js";
import type { ProfileActor } from "../identity/index.js";
import { createDocumentRepository, DocumentError } from "./document.repository.js";

type Actor = ProfileActor;
export function createDocumentService(
  repository: ReturnType<typeof createDocumentRepository>,
  storage: FileStorage,
) {
  return {
    async upload(actor: Actor, id: string, bytes: Buffer) {
      await repository.authorizeUpload(actor, id);
      const row = await repository.original(actor.userId, id);
      if (
        bytes.length !== row.size ||
        createHash("sha256").update(bytes).digest("hex") !== row.checksum
      )
        throw new DocumentError("DOCUMENT_UPLOAD_INVALID", 422);
      if (row.state !== "pending") return repository.get(actor.userId, id);
      let mime = "application/octet-stream";
      // Signature detection only; document parsing is forbidden before antivirus.
      try {
        mime = (await fileTypeFromBuffer(bytes.subarray(0, 32)))?.mime ?? mime;
      } catch {
        /* Undetectable/truncated content is preserved as unknown, scanned before any parser. */
      }
      try {
        await storage.put(row.objectKey, bytes);
        const saved = await storage.get(row.objectKey);
        if (
          saved.length !== row.size ||
          createHash("sha256").update(saved).digest("hex") !== row.checksum
        )
          throw new Error("Stored original integrity failed");
      } catch (cause) {
        throw new DocumentError("DOCUMENT_STORAGE_UNAVAILABLE", 503, { cause });
      }
      try {
        return await repository.uploaded(actor, id, mime);
      } catch (error) {
        if (error instanceof DocumentError && error.code === "DOCUMENT_NOT_FOUND")
          await storage.remove(row.objectKey);
        throw error;
      }
    },
    async download(actor: Actor, id: string) {
      await repository.access(actor, id);
      const row = await repository.original(actor.userId, id);
      let bytes: Buffer;
      try {
        bytes = await storage.get(row.objectKey);
      } catch (cause) {
        throw new DocumentError("DOCUMENT_STORAGE_UNAVAILABLE", 503, { cause });
      }
      if (
        bytes.length !== row.size ||
        createHash("sha256").update(bytes).digest("hex") !== row.checksum
      )
        throw new DocumentError("DOCUMENT_STORAGE_UNAVAILABLE", 503);
      await repository.access(actor, id);
      return { bytes, name: row.name, checksum: row.checksum };
    },
  };
}
