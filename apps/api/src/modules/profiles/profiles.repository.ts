import { createHash, randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import {
  entityProfileValuesSchema,
  financialProfileValuesSchema,
  healthProfileValuesSchema,
  managedProfileCreateInputSchema,
  managedProfileSchema,
  managedProfilesSchema,
  profileCompletionAverage,
  profileStepCompletion,
  profileSectionSaveInputSchema,
  profileSectionSchema,
  profileValuesSchema,
  type ManagedProfile,
  type ManagedProfileCreateInput,
  type Profile,
  type ProfileSection,
  type ProfileSectionName,
  type ProfileSectionSaveInput,
  type ProfileSectionValues,
} from "@coverview/contracts";
import type { createDatabase } from "../../platform/db/database.js";
import {
  IdentityError,
  lockProfileActor,
  readDocumentProfile,
  toProfile,
  type ProfileActor,
} from "../identity/index.js";
import {
  managedProfiles,
  managedProfileSections,
  managedProfileCommands,
  managedProfileAudit,
} from "./profiles.schema.js";

type Database = ReturnType<typeof createDatabase>["db"];
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Actor = ProfileActor;
type SectionRow = typeof managedProfileSections.$inferSelect;
type SubjectRow = typeof managedProfiles.$inferSelect;
export class ManagedProfileError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
  ) {
    super(code);
    this.name = "ManagedProfileError";
  }
}
function sectionValuesSchema(section: ProfileSectionName, kind: ManagedProfile["kind"]) {
  return section === "finances"
    ? financialProfileValuesSchema
    : section === "health"
      ? healthProfileValuesSchema
      : kind === "legal_entity"
        ? entityProfileValuesSchema
        : profileValuesSchema;
}
function selfGeneral(profile: Profile): ProfileSection {
  const values = Object.fromEntries(
    Object.entries(profile.fields).map(([key, value]) => [key, value?.value]),
  );
  const confirmedFields = Object.values(profile.fields).map((field) => field?.confirmedAt);
  return profileSectionSchema.parse({
    profileId: "self",
    section: "general",
    revision: profile.revision,
    step: profile.step === "address" ? "details" : profile.step,
    values,
    confirmedAt:
      confirmedFields.length && confirmedFields.every(Boolean)
        ? confirmedFields.sort().at(-1)
        : null,
    completion: profileCompletionAverage(
      profileStepCompletion("person", "general", values),
    ),
  });
}
function sectionDto(
  profileId: string,
  section: ProfileSectionName,
  kind: ManagedProfile["kind"],
  row?: SectionRow,
): ProfileSection {
  return profileSectionSchema.parse({
    profileId,
    section,
    revision: row?.revision ?? 0,
    step: row?.step ?? "information",
    values: row?.values ?? {},
    confirmedAt: row?.confirmedAt?.toISOString() ?? null,
    documentSources: row?.documentSources ?? {},
    completion: profileCompletionAverage(
      profileStepCompletion(kind, section, row?.values ?? {}),
    ),
  });
}
function profileDto(
  subject: SubjectRow | null,
  self: Profile,
  sections: SectionRow[],
): ManagedProfile {
  const id = subject?.id ?? "self";
  const kind = subject?.kind ?? "person";
  const values = (section: ProfileSectionName) =>
    sections.find(
      (row) => row.managedProfileId === (subject?.id ?? null) && row.section === section,
    );
  return managedProfileSchema.parse({
    id,
    kind,
    isSelf: !subject,
    displayName:
      subject?.displayName ??
      ([self.fields.firstName?.value, self.fields.lastName?.value]
        .filter(Boolean)
        .join(" ")
        .slice(0, 160) ||
        "Mon profil"),
    revision: subject?.revision ?? self.revision,
    completion: {
      general: subject
        ? sectionDto(id, "general", kind, values("general")).completion
        : selfGeneral(self).completion,
      finances: sectionDto(id, "finances", kind, values("finances")).completion,
      health:
        kind === "legal_entity"
          ? null
          : sectionDto(id, "health", kind, values("health")).completion,
    },
  });
}
function sectionCondition(userId: string, profileId: string, section: ProfileSectionName) {
  return and(
    eq(managedProfileSections.userId, userId),
    profileId === "self"
      ? isNull(managedProfileSections.managedProfileId)
      : eq(managedProfileSections.managedProfileId, profileId),
    eq(managedProfileSections.section, section),
  );
}
function canonical(value: unknown): string {
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
const fingerprint = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");
function nextRevision(revision: number) {
  if (revision >= 2147483647) throw new ManagedProfileError("MANAGED_PROFILE_CONFLICT", 409);
  return revision + 1;
}
async function subject(tx: Database | Tx, userId: string, id: string) {
  if (id === "self") return null;
  const [row] = await tx
    .select()
    .from(managedProfiles)
    .where(and(eq(managedProfiles.userId, userId), eq(managedProfiles.id, id)))
    .limit(1);
  if (!row) throw new ManagedProfileError("MANAGED_PROFILE_NOT_FOUND", 404);
  return row;
}
function checkSection(
  id: string,
  kind: ManagedProfile["kind"],
  section: ProfileSectionName,
  write = false,
) {
  if (
    (kind === "legal_entity" && section === "health") ||
    (write && id === "self" && section === "general")
  )
    throw new ManagedProfileError("MANAGED_PROFILE_SECTION_UNAVAILABLE", 422);
}
const commandReference = sql`jsonb_strip_nulls(jsonb_build_object('profileId', coalesce(${managedProfileCommands.response}->>'profileId', ${managedProfileCommands.response}->>'id'), 'section', ${managedProfileCommands.response}->>'section'))`;
const legacySnapshot = sql<boolean>`(${managedProfileCommands.response} ? 'values' or ${managedProfileCommands.response} ? 'displayName')`;
async function replay(
  tx: Tx,
  actor: Actor,
  operation: "create" | "save_section",
  key: string,
  hash: string,
) {
  const expired = await tx
    .select({ id: managedProfileCommands.id })
    .from(managedProfileCommands)
    .where(
      and(
        eq(managedProfileCommands.userId, actor.userId),
        lte(managedProfileCommands.expiresAt, new Date()),
      ),
    )
    .limit(100);
  if (expired.length)
    await tx.delete(managedProfileCommands).where(
      and(
        eq(managedProfileCommands.userId, actor.userId),
        inArray(
          managedProfileCommands.id,
          expired.map((row) => row.id),
        ),
      ),
    );
  const [row] = await tx
    .select()
    .from(managedProfileCommands)
    .where(
      and(
        eq(managedProfileCommands.userId, actor.userId),
        eq(managedProfileCommands.operation, operation),
        eq(managedProfileCommands.key, key),
      ),
    )
    .limit(1);
  if (!row) return null;
  if (row.expiresAt <= new Date()) {
    await tx
      .delete(managedProfileCommands)
      .where(
        and(eq(managedProfileCommands.userId, actor.userId), eq(managedProfileCommands.id, row.id)),
      );
    return null;
  }
  if (row.requestHash !== hash)
    throw new ManagedProfileError("MANAGED_PROFILE_IDEMPOTENCY_REUSED", 422);
  // Older commands used full response snapshots. Keep only the target when encountered.
  const reference = z
    .object({
      profileId: z.string().optional(),
      id: z.string().optional(),
      section: z.enum(["general", "finances", "health"]).optional(),
    })
    .parse(row.response);
  const profileId = reference.profileId ?? reference.id;
  if (!profileId) throw new ManagedProfileError("MANAGED_PROFILE_CONFLICT", 409);
  await tx
    .update(managedProfileCommands)
    .set({ response: { profileId, ...(reference.section ? { section: reference.section } : {}) } })
    .where(
      and(eq(managedProfileCommands.userId, actor.userId), eq(managedProfileCommands.id, row.id)),
    );
  return { profileId };
}
async function record(
  tx: Tx,
  actor: Actor,
  operation: "create" | "save_section",
  key: string,
  hash: string,
  response: ManagedProfile | ProfileSection,
) {
  await tx.insert(managedProfileCommands).values({
    id: `pcmd_${randomUUID()}`,
    userId: actor.userId,
    operation,
    key,
    requestHash: hash,
    response:
      "profileId" in response
        ? { profileId: response.profileId, section: response.section }
        : { profileId: response.id },
    expiresAt: new Date(Date.now() + 86400000),
  });
  await tx.insert(managedProfileAudit).values({
    id: `paudit_${randomUUID()}`,
    userId: actor.userId,
    sessionId: actor.id,
    profileId: "profileId" in response ? response.profileId : response.id,
    section: "section" in response ? response.section : null,
    action: operation === "create" ? "profile.created.v1" : "profile.section_saved.v1",
    revision: response.revision,
  });
  return response;
}
export function createManagedProfileRepository(db: Database) {
  return {
    async purgeExpiredCommands() {
      await db.transaction(async (tx) => {
        const expired = await tx
          .select({ id: managedProfileCommands.id })
          .from(managedProfileCommands)
          .where(lte(managedProfileCommands.expiresAt, new Date()))
          .orderBy(asc(managedProfileCommands.expiresAt), asc(managedProfileCommands.id))
          .limit(100)
          .for("update", { skipLocked: true });
        if (expired.length)
          await tx.delete(managedProfileCommands).where(
            inArray(
              managedProfileCommands.id,
              expired.map((row) => row.id),
            ),
          );
        const snapshots = await tx
          .select({ id: managedProfileCommands.id })
          .from(managedProfileCommands)
          .where(legacySnapshot)
          .orderBy(asc(managedProfileCommands.id))
          .limit(100)
          .for("update", { skipLocked: true });
        if (snapshots.length)
          await tx
            .update(managedProfileCommands)
            .set({ response: commandReference })
            .where(
              inArray(
                managedProfileCommands.id,
                snapshots.map((row) => row.id),
              ),
            );
      });
    },
    async list(userId: string) {
      const self = await readDocumentProfile(db, userId);
      const rows = await db
        .select()
        .from(managedProfiles)
        .where(eq(managedProfiles.userId, userId))
        .orderBy(asc(managedProfiles.createdAt), asc(managedProfiles.id))
        .limit(50);
      if (rows.length > 49) throw new ManagedProfileError("MANAGED_PROFILE_LIMIT_REACHED", 422);
      const sections = await db
        .select()
        .from(managedProfileSections)
        .where(eq(managedProfileSections.userId, userId))
        .limit(150);
      return managedProfilesSchema.parse({
        profiles: [
          profileDto(null, self, sections),
          ...rows.map((row) => profileDto(row, self, sections)),
        ],
      });
    },
    async get(userId: string, id: string) {
      const row = await subject(db, userId, id);
      const self = await readDocumentProfile(db, userId);
      const sections = await db
        .select()
        .from(managedProfileSections)
        .where(
          and(
            eq(managedProfileSections.userId, userId),
            id === "self"
              ? isNull(managedProfileSections.managedProfileId)
              : eq(managedProfileSections.managedProfileId, id),
          ),
        )
        .limit(3);
      return profileDto(row, self, sections);
    },
    async section(userId: string, id: string, section: ProfileSectionName) {
      const row = await subject(db, userId, id);
      checkSection(id, row?.kind ?? "person", section);
      if (id === "self" && section === "general")
        return selfGeneral(await readDocumentProfile(db, userId));
      const [saved] = await db
        .select()
        .from(managedProfileSections)
        .where(sectionCondition(userId, id, section))
        .limit(1);
      return sectionDto(id, section, row?.kind ?? "person", saved);
    },
    async create(actor: Actor, supplied: ManagedProfileCreateInput, suppliedKey: string) {
      const input = managedProfileCreateInputSchema.parse(supplied);
      const key = z.uuid().parse(suppliedKey).toLowerCase();
      const hash = fingerprint(
        actor.administratorUserId
          ? { input, administratorUserId: actor.administratorUserId }
          : input,
      );
      return db.transaction(async (tx) => {
        const { profile, session } = await lockProfileActor(tx, actor);
        if (session.expiresAt <= new Date())
          throw new IdentityError("IDENTITY_UNAUTHENTICATED", 401);
        const previous = await replay(tx, actor, "create", key, hash);
        if (previous) {
          const current = await subject(tx, actor.userId, previous.profileId);
          const sections = await tx
            .select()
            .from(managedProfileSections)
            .where(
              and(
                eq(managedProfileSections.userId, actor.userId),
                eq(managedProfileSections.managedProfileId, previous.profileId),
              ),
            )
            .limit(3);
          return profileDto(current, toProfile(profile), sections);
        }
        const count = await tx
          .select({ id: managedProfiles.id })
          .from(managedProfiles)
          .where(eq(managedProfiles.userId, actor.userId))
          .limit(49);
        if (count.length >= 49) throw new ManagedProfileError("MANAGED_PROFILE_LIMIT_REACHED", 422);
        const [row] = await tx
          .insert(managedProfiles)
          .values({
            id: `prf_${randomUUID()}`,
            userId: actor.userId,
            kind: input.kind,
            displayName: input.displayName,
          })
          .returning();
        if (!row) throw new ManagedProfileError("MANAGED_PROFILE_CONFLICT", 409);
        const response = profileDto(row, toProfile(profile), []);
        await record(tx, actor, "create", key, hash, response);
        return response;
      });
    },
    async saveSection(
      actor: Actor,
      id: string,
      section: ProfileSectionName,
      supplied: ProfileSectionSaveInput,
      suppliedKey: string,
    ) {
      const input = profileSectionSaveInputSchema.parse(supplied);
      if (actor.administratorUserId && input.confirm)
        throw new ManagedProfileError("MANAGED_PROFILE_INVALID_FIELDS", 422);
      const key = z.uuid().parse(suppliedKey).toLowerCase();
      const hash = fingerprint({
        profileId: id,
        section,
        input,
        administratorUserId: actor.administratorUserId,
      });
      return db.transaction(async (tx) => {
        const { session } = await lockProfileActor(tx, actor);
        if (session.expiresAt <= new Date())
          throw new IdentityError("IDENTITY_UNAUTHENTICATED", 401);
        const owner = await subject(tx, actor.userId, id);
        const kind = owner?.kind ?? "person";
        checkSection(id, kind, section, true);
        if (input.step === "contact" && section !== "general")
          throw new ManagedProfileError("MANAGED_PROFILE_INVALID_FIELDS", 422);
        const previous = await replay(tx, actor, "save_section", key, hash);
        const [saved] = await tx
          .select()
          .from(managedProfileSections)
          .where(sectionCondition(actor.userId, id, section))
          .limit(1)
          .for("update");
        if (previous) return sectionDto(id, section, kind, saved);
        if ((saved?.revision ?? 0) !== input.revision)
          throw new ManagedProfileError("MANAGED_PROFILE_CONFLICT", 409);
        const shape = sectionValuesSchema(section, kind);
        const values: Record<string, unknown> = { ...saved?.values };
        for (const [field, value] of Object.entries(input.fields)) {
          if (!Object.hasOwn(shape.shape, field))
            throw new ManagedProfileError("MANAGED_PROFILE_INVALID_FIELDS", 422);
          if (value === null) delete values[field];
          else if (value !== undefined) values[field] = value;
        }
        const parsed = shape.safeParse(values);
        if (!parsed.success || (input.confirm && input.step !== "review"))
          throw new ManagedProfileError("MANAGED_PROFILE_INVALID_FIELDS", 422);
        // Erasing/editing a value also removes any legacy retry snapshots for this section.
        await tx
          .update(managedProfileCommands)
          .set({ response: commandReference })
          .where(
            and(
              eq(managedProfileCommands.userId, actor.userId),
              legacySnapshot,
              sql`${managedProfileCommands.response}->>'profileId' = ${id}`,
              sql`${managedProfileCommands.response}->>'section' = ${section}`,
            ),
          );
        const normalized = parsed.data as ProfileSectionValues;
        if (normalized.birthDate && normalized.birthDate > new Date().toISOString().slice(0, 10))
          throw new ManagedProfileError("MANAGED_PROFILE_INVALID_FIELDS", 422);
        if (
          section === "finances" &&
          [
            normalized.annualIncomeMinor,
            normalized.monthlyExpensesMinor,
            normalized.savingsMinor,
            normalized.debtsMinor,
          ].some((value) => value !== undefined) &&
          !normalized.currency
        )
          throw new ManagedProfileError("MANAGED_PROFILE_INVALID_FIELDS", 422);
        const unchanged = canonical(normalized) === canonical(saved?.values ?? {});
        const documentSources = { ...saved?.documentSources };
        for (const [field, value] of Object.entries(input.fields)) {
          if (value !== undefined && value !== saved?.values[field as keyof ProfileSectionValues])
            delete documentSources[field];
        }
        const data = {
          values: normalized,
          documentSources,
          step: input.step,
          revision: nextRevision(input.revision),
          confirmedAt: input.confirm ? new Date() : unchanged ? (saved?.confirmedAt ?? null) : null,
          updatedAt: new Date(),
        };
        const [updated] = saved
          ? await tx
              .update(managedProfileSections)
              .set(data)
              .where(sectionCondition(actor.userId, id, section))
              .returning()
          : await tx
              .insert(managedProfileSections)
              .values({
                id: `psec_${randomUUID()}`,
                userId: actor.userId,
                managedProfileId: id === "self" ? null : id,
                section,
                ...data,
              })
              .returning();
        if (!updated) throw new ManagedProfileError("MANAGED_PROFILE_CONFLICT", 409);
        if (owner)
          await tx
            .update(managedProfiles)
            .set({ revision: nextRevision(owner.revision), updatedAt: new Date() })
            .where(and(eq(managedProfiles.userId, actor.userId), eq(managedProfiles.id, id)));
        const response = sectionDto(id, section, kind, updated);
        await record(tx, actor, "save_section", key, hash, response);
        return response;
      });
    },
  };
}
