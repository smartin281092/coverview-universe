import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { profileValuesSchema, type DocumentExtraction } from "@coverview/contracts";
import type { createDatabase } from "../../platform/db/database.js";
import { readDocumentProfile } from "../identity/index.js";
import { managedProfiles, managedProfileSections, managedProfileAudit } from "./profiles.schema.js";

type Database = ReturnType<typeof createDatabase>["db"];
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("fr");

// The document worker already holds the owner lock used by every profile writer.
// Never use issuer names, display labels, or birth date alone to invent a subject.
export async function matchDocumentPerson(tx: Tx, userId: string, fields: DocumentExtraction[]) {
  const read = (field: "firstName" | "lastName" | "birthDate") => {
    const found = fields.filter((item) => item.field === field);
    if (found.length !== 1) return undefined;
    const parsed = profileValuesSchema.shape[field].safeParse(found[0]!.value);
    if (!parsed.success || !parsed.data) return undefined;
    if (field === "birthDate" && parsed.data > new Date().toISOString().slice(0, 10))
      return undefined;
    return parsed.data;
  };
  const firstName = read("firstName");
  const birthDate = read("birthDate");
  if (
    !firstName ||
    fields.some((field) => field.field === "companyName" || field.field === "registrationNumber")
  )
    return { status: "missing_identity" as const, profileId: null };
  if (fields.some((field) => field.field === "birthDate") && !birthDate)
    return { status: "ambiguous" as const, profileId: null };

  const holder = await readDocumentProfile(tx, userId);
  const subjects = await tx
    .select({
      id: managedProfiles.id,
      kind: managedProfiles.kind,
      values: managedProfileSections.values,
    })
    .from(managedProfiles)
    .leftJoin(
      managedProfileSections,
      and(
        eq(managedProfileSections.userId, userId),
        eq(managedProfileSections.managedProfileId, managedProfiles.id),
        eq(managedProfileSections.section, "general"),
      ),
    )
    .where(eq(managedProfiles.userId, userId))
    .limit(50);
  const candidates = [
    {
      id: "self",
      firstName: holder.fields.firstName?.value,
      birthDate: holder.fields.birthDate?.value,
    },
    ...subjects
      .filter((item) => item.kind === "person")
      .map((item) => ({
        id: item.id,
        firstName: item.values?.firstName,
        birthDate: item.values?.birthDate,
      })),
  ].filter((item) => item.firstName && normalize(item.firstName) === normalize(firstName));
  if (candidates.length) {
    // An exact DOB can disambiguate homonyms; a conflicting DOB never makes a new person.
    const exact = birthDate ? candidates.filter((item) => item.birthDate === birthDate) : [];
    const selected =
      exact.length === 1 ? exact[0] : candidates.length === 1 ? candidates[0] : undefined;
    if (!selected || (birthDate && selected.birthDate && selected.birthDate !== birthDate))
      return { status: "ambiguous" as const, profileId: null };
    return { status: "matched" as const, profileId: selected.id };
  }
  if (subjects.length >= 49) return { status: "profile_limit" as const, profileId: null };
  const id = `prf_${randomUUID()}`;
  const displayName = [firstName, read("lastName")].filter(Boolean).join(" ").slice(0, 160);
  await tx.insert(managedProfiles).values({ id, userId, kind: "person", displayName });
  await tx.insert(managedProfileAudit).values({
    id: randomUUID(),
    userId,
    sessionId: "system:document-worker",
    profileId: id,
    action: "profile.created.v1",
    revision: 0,
  });
  return { status: "created" as const, profileId: id };
}
