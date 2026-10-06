import {
  profileImageMimeSchema,
  profileImageSchema,
  type ProfileImageChoice,
} from "@coverview/contracts/partner-profiles";
import type { PoolClient } from "pg";
import { createPartnerProof } from "../document-intelligence/index.js";
import { fail, type Executor } from "./partner.policy.js";

// Profile photo and organisation logo (C8c): files of the professional proof circuit, scanned
// before any publication and served by the API only.
export type ImagePurpose = "partner_profile_photo" | "partner_organization_logo";
type FileRow = {
  id: string;
  user_id: string;
  purpose: string | null;
  checksum: string;
  state: string;
  mime: string;
  revision: number;
  scan_version: string | null;
  deleted_at: Date | null;
  managed_profile_id: string | null;
};
export async function readImage(db: Executor, documentId: string | null, lock = false) {
  if (!documentId) return null;
  return (
    (
      await db.query<FileRow>(
        `select id,user_id,purpose,checksum,state,mime,revision,scan_version,deleted_at,managed_profile_id from files where id=$1${lock ? " for share" : ""}`,
        [documentId],
      )
    ).rows[0] ?? null
  );
}
/** The exact, scanned file of its purpose; `ready` only, never a failed analysis. */
export const imageReady = (
  file: FileRow | null,
  purpose: ImagePurpose,
  checksum: string | null,
): file is FileRow =>
  !!file &&
  file.purpose === purpose &&
  file.checksum === checksum &&
  file.managed_profile_id === null &&
  !file.deleted_at &&
  !!file.scan_version &&
  file.state === "ready";
export const imageMime = (file: FileRow) =>
  profileImageMimeSchema.safeParse(file.mime).data ?? null;
export function imageView(file: FileRow | null, writable: boolean) {
  if (!file) return null;
  const state =
    file.state === "pending"
      ? "awaiting_upload"
      : ["queued", "scanning", "reading"].includes(file.state)
        ? "processing"
        : file.state === "ready" && file.scan_version && !file.deleted_at
          ? "ready"
          : file.state === "failed"
            ? "failed"
            : "rejected";
  return profileImageSchema.parse({
    state,
    mime: state === "ready" ? imageMime(file) : null,
    documentRevision: file.revision,
    canUpload: writable && state === "awaiting_upload",
    canRetry: writable && state === "failed",
  });
}
/**
 * The picture of a new version: the previous one kept, none, or a new file awaiting its bytes.
 * The new file belongs to the person who sends it.
 */
export async function chooseImage(
  tx: PoolClient,
  ownerId: string,
  choice: ProfileImageChoice,
  previous: { documentId: string | null; checksum: string | null } | null,
  purpose: ImagePurpose,
  documentsAvailable: boolean,
) {
  if (choice === "keep")
    return { documentId: previous?.documentId ?? null, checksum: previous?.checksum ?? null };
  if (choice === "remove") return { documentId: null, checksum: null };
  if (!documentsAvailable) fail("PARTNER_UNAVAILABLE", 503);
  return {
    documentId: await createPartnerProof(tx, ownerId, choice, purpose),
    checksum: choice.checksum,
  };
}
/** Only an image the scanner may read is queued; any other detected type stays unsent. */
export function requireImageMime(mime: string) {
  if (!profileImageMimeSchema.safeParse(mime).success) fail("PARTNER_INVALID_DOCUMENT");
}
