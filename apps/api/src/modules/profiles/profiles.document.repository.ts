import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  entityProfileValuesSchema,
  managedProfileIdSchema,
  profileValuesSchema,
  type DocumentExtraction,
  type ProfileSectionValues,
} from "@coverview/contracts";
import type { createDatabase } from "../../platform/db/database.js";
import { identityUsers } from "../identity/index.js";
import { managedProfiles, managedProfileSections, managedProfileAudit } from "./profiles.schema.js";
import { ManagedProfileError } from "./profiles.repository.js";

type Database = ReturnType<typeof createDatabase>["db"];
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function assertDocumentProfileTarget(
  tx: Database | Tx,
  userId: string,
  profileId: string,
) {
  const parsed = managedProfileIdSchema.safeParse(profileId);
  if (!parsed.success) throw new ManagedProfileError("MANAGED_PROFILE_NOT_FOUND", 404);
  if (profileId === "self") {
    const [owner] = await tx
      .select({ id: identityUsers.id })
      .from(identityUsers)
      .where(eq(identityUsers.id, userId))
      .limit(1);
    if (!owner) throw new ManagedProfileError("MANAGED_PROFILE_NOT_FOUND", 404);
    return null;
  }
  const [profile] = await tx
    .select()
    .from(managedProfiles)
    .where(and(eq(managedProfiles.userId, userId), eq(managedProfiles.id, profileId)))
    .limit(1);
  if (!profile) throw new ManagedProfileError("MANAGED_PROFILE_NOT_FOUND", 404);
  return profile;
}

export async function readManagedDocumentValues(
  tx: Database | Tx,
  userId: string,
  profileId: string,
) {
  await assertDocumentProfileTarget(tx, userId, profileId);
  const [section] = await tx
    .select({ values: managedProfileSections.values })
    .from(managedProfileSections)
    .where(
      and(
        eq(managedProfileSections.userId, userId),
        eq(managedProfileSections.managedProfileId, profileId),
        eq(managedProfileSections.section, "general"),
      ),
    )
    .limit(1);
  return section?.values ?? {};
}

// The caller locks the canonical owner before the document, serializing this worker
// with profile edits. Only this explicitly selected subject receives empty-field enrichment.
export async function enrichManagedDocumentProfile(
  tx: Tx,
  userId: string,
  profileId: string,
  documentId: string,
  extractions: DocumentExtraction[],
) {
  const subject = await assertDocumentProfileTarget(tx, userId, profileId);
  if (!subject) throw new ManagedProfileError("MANAGED_PROFILE_NOT_FOUND", 404);
  const condition = and(
    eq(managedProfileSections.userId, userId),
    eq(managedProfileSections.managedProfileId, profileId),
    eq(managedProfileSections.section, "general"),
  );
  const [current] = await tx
    .select()
    .from(managedProfileSections)
    .where(condition)
    .limit(1)
    .for("update");
  const values: ProfileSectionValues = { ...current?.values };
  const sources = { ...current?.documentSources };
  const schema = subject.kind === "legal_entity" ? entityProfileValuesSchema : profileValuesSchema;
  const now = new Date();
  let changed = false;
  for (const extraction of extractions) {
    const field = extraction.field as keyof ProfileSectionValues;
    if (
      values[field] !== undefined ||
      extractions.filter((item) => item.field === field).length !== 1
    )
      continue;
    const parsed = schema.safeParse({ [field]: extraction.value });
    if (
      !parsed.success ||
      (field === "birthDate" && extraction.value > now.toISOString().slice(0, 10))
    )
      continue;
    Object.assign(values, parsed.data);
    sources[field] = { documentId, extractionId: extraction.id, extractedAt: now.toISOString() };
    changed = true;
  }
  if (!changed) return;
  if ((current?.revision ?? 0) >= 2147483646 || subject.revision >= 2147483646)
    throw new ManagedProfileError("MANAGED_PROFILE_CONFLICT", 409);
  const revision = (current?.revision ?? 0) + 1;
  const patch = { values, documentSources: sources, revision, confirmedAt: null, updatedAt: now };
  if (current) await tx.update(managedProfileSections).set(patch).where(condition);
  else
    await tx
      .insert(managedProfileSections)
      .values({
        id: randomUUID(),
        userId,
        managedProfileId: profileId,
        section: "general",
        ...patch,
      });
  await tx
    .update(managedProfiles)
    .set({ revision: subject.revision + 1, updatedAt: now })
    .where(and(eq(managedProfiles.userId, userId), eq(managedProfiles.id, profileId)));
  await tx
    .insert(managedProfileAudit)
    .values({
      id: randomUUID(),
      userId,
      sessionId: "system:document-worker",
      profileId,
      section: "general",
      action: "profile.section_saved.v1",
      revision,
    });
}
