import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  entityProfileValuesSchema,
  managedProfileCreateInputSchema,
  profileValuesSchema,
  type DocumentExtraction,
  type ManagedProfileCreateInput,
} from "@coverview/contracts";
import type { createDatabase } from "../../platform/db/database.js";
import type { ProfileActor } from "../identity/index.js";
import { managedProfiles, managedProfileAudit } from "./profiles.schema.js";
import { ManagedProfileError } from "./profiles.repository.js";

type Database = ReturnType<typeof createDatabase>["db"];
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export function documentProfileCreation(
  fields: DocumentExtraction[],
): ManagedProfileCreateInput | null {
  const read = (field: "firstName" | "lastName" | "companyName") => {
    const found = fields.filter((item) => item.field === field);
    if (found.length !== 1) return undefined;
    const schema =
      field === "companyName"
        ? entityProfileValuesSchema.shape[field]
        : profileValuesSchema.shape[field];
    const parsed = schema.safeParse(found[0]!.value);
    return parsed.success && parsed.data ? parsed.data : undefined;
  };
  const company = fields.some((item) => ["companyName", "registrationNumber"].includes(item.field));
  const person = fields.some((item) => ["firstName", "lastName", "birthDate"].includes(item.field));
  if (company && person) return null;
  if (company) {
    const displayName = read("companyName");
    return displayName ? { kind: "legal_entity", displayName: displayName.slice(0, 160) } : null;
  }
  const firstName = read("firstName");
  if (!firstName) return null;
  return {
    kind: "person",
    displayName: [firstName, read("lastName")].filter(Boolean).join(" ").slice(0, 160),
  };
}

// The document command holds the owner lock and commits creation, enrichment and assignment together.
export async function createProfileFromDocument(
  tx: Tx,
  actor: ProfileActor,
  fields: DocumentExtraction[],
  supplied?: ManagedProfileCreateInput,
) {
  const input = supplied
    ? managedProfileCreateInputSchema.parse(supplied)
    : documentProfileCreation(fields);
  if (!input) throw new ManagedProfileError("MANAGED_PROFILE_INVALID_FIELDS", 422);
  const existing = await tx
    .select({ id: managedProfiles.id })
    .from(managedProfiles)
    .where(eq(managedProfiles.userId, actor.userId))
    .limit(49);
  if (existing.length >= 49) throw new ManagedProfileError("MANAGED_PROFILE_LIMIT_REACHED", 422);
  const id = `prf_${randomUUID()}`;
  await tx.insert(managedProfiles).values({ id, userId: actor.userId, ...input });
  await tx.insert(managedProfileAudit).values({
    id: randomUUID(),
    userId: actor.userId,
    sessionId: actor.administratorUserId
      ? `admin:${actor.administratorUserId}:session:${actor.id}`
      : actor.id,
    profileId: id,
    action: "profile.created.v1",
    revision: 0,
  });
  return id;
}
