import { createHash, randomUUID } from "node:crypto";
import {
  profileAttachInputSchema,
  profileAttachSchema,
  profileChoicesSchema,
  profileConfirmInputSchema,
  profileDraftSchema,
  profileFieldSchema,
  profileSaveInputSchema,
  profileSchema,
  profileValuesSchema,
  type Profile,
  type ProfileConfirmInput,
  type ProfileDraft,
  type ProfileSaveInput,
  type ProfileValues,
} from "@coverview/contracts";
import { and, asc, desc, eq, gt, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { createDatabase } from "../../platform/db/database.js";
import {
  profileAuditEvents,
  profileChoices,
  profileCommands,
  profileDrafts,
} from "./identity.profile.schema.js";
import { identityProfiles, identitySessions, identityUsers } from "./identity.schema.js";
import { IdentityError } from "./identity.security.js";

type Database = ReturnType<typeof createDatabase>["db"];
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type ProfileRow = typeof identityProfiles.$inferSelect;
type DraftRow = typeof profileDrafts.$inferSelect;
type CommandRow = typeof profileCommands.$inferSelect;
type AuditInput = Omit<typeof profileAuditEvents.$inferInsert, "id" | "commandId" | "createdAt">;
type Scope = { kind: "user"; id: string } | { kind: "draft"; id: string };
type DraftEntry =
  | { state: "active"; draft: ProfileDraft }
  | { state: "empty" | "expired" | "attached"; draft: null };
const lifetimeMs = 24 * 60 * 60 * 1000;
const fields = profileFieldSchema.options;
const choiceCursorSchema = z
  .object({ decidedAt: z.iso.datetime(), id: z.string().regex(/^choice_[0-9a-f-]{36}$/) })
  .strict();

function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries.map(([name, item]) => `${JSON.stringify(name)}:${canonicalJson(item)}`).join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error("Unsupported command payload");
  return serialized;
}
const requestHash = (value: unknown) =>
  createHash("sha256").update(canonicalJson(value)).digest("hex");
function commandKey(value: string) {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw new IdentityError("IDENTITY_ACCESS_DENIED", 400);
  return parsed.data.toLowerCase();
}
function requireTokenHash(value: string) {
  if (!/^[0-9a-f]{64}$/.test(value)) throw new IdentityError("IDENTITY_ACCESS_DENIED", 400);
}
function requireBirthDate(value: string | null | undefined, now: Date) {
  // Civil date uses the current UTC server date; no age threshold is inferred.
  if (value && value > now.toISOString().slice(0, 10))
    throw new IdentityError("PROFILE_INVALID_BIRTH_DATE", 422);
}
function nextRevision(revision: number) {
  if (revision >= 2_147_483_647) throw new IdentityError("PROFILE_CONFLICT", 409);
  return revision + 1;
}
function toProfile(row: ProfileRow): Profile {
  return profileSchema.parse({
    id: row.id,
    userId: row.userId,
    revision: row.revision,
    step: row.step,
    fields: row.fields,
    prefill: {
      enabled: row.prefill,
      version: "1",
      decidedAt: row.prefillDecidedAt?.toISOString() ?? null,
    },
  });
}
function toDraft(row: DraftRow): ProfileDraft {
  return profileDraftSchema.parse({
    id: row.id,
    revision: row.revision,
    step: row.step,
    fields: row.fields,
    expiresAt: row.expiresAt.toISOString(),
  });
}
function entered(value: string): NonNullable<Profile["fields"]["firstName"]> {
  return { value, source: "user_entered", confidence: null, confirmedAt: null, proposal: null };
}
const ownerCondition = (scope: Scope) =>
  scope.kind === "user"
    ? eq(profileCommands.userId, scope.id)
    : eq(profileCommands.draftId, scope.id);
const ownerColumns = (scope: Scope) =>
  scope.kind === "user" ? { userId: scope.id, draftId: null } : { userId: null, draftId: scope.id };
async function replay<T>(
  tx: Transaction,
  scope: Scope,
  endpoint: CommandRow["endpoint"],
  key: string,
  hash: string,
  schema: z.ZodType<T>,
  now: Date,
): Promise<T | undefined> {
  // Cleanup is bounded and scoped to the owner whose lock and authority are already acquired.
  await tx.delete(profileCommands).where(
    inArray(
      profileCommands.id,
      tx
        .select({ id: profileCommands.id })
        .from(profileCommands)
        .where(and(ownerCondition(scope), lte(profileCommands.expiresAt, now)))
        .orderBy(asc(profileCommands.expiresAt), asc(profileCommands.id))
        .limit(100),
    ),
  );
  const [previous] = await tx
    .select()
    .from(profileCommands)
    .where(
      and(
        ownerCondition(scope),
        eq(profileCommands.endpoint, endpoint),
        eq(profileCommands.key, key),
      ),
    )
    .limit(1);
  if (!previous) return undefined;
  if (previous.expiresAt <= now) {
    await tx
      .delete(profileCommands)
      .where(and(ownerCondition(scope), eq(profileCommands.id, previous.id)));
    return undefined;
  }
  if (previous.requestHash !== hash) throw new IdentityError("PROFILE_IDEMPOTENCY_REUSED", 422);
  return schema.parse(previous.response);
}
async function complete<T extends CommandRow["response"]>(
  tx: Transaction,
  scope: Scope,
  endpoint: CommandRow["endpoint"],
  key: string,
  hash: string,
  response: T,
  now: Date,
  audit?: AuditInput,
): Promise<T> {
  const id = `pcmd_${randomUUID()}`;
  await tx.insert(profileCommands).values({
    id,
    ...ownerColumns(scope),
    endpoint,
    key,
    requestHash: hash,
    responseStatus: 200,
    response,
    createdAt: now,
    expiresAt: new Date(now.getTime() + lifetimeMs),
  });
  if (audit)
    await tx
      .insert(profileAuditEvents)
      .values({ ...audit, id: `paudit_${randomUUID()}`, commandId: id, createdAt: now });
  return response;
}
async function lockOwner(tx: Transaction, userId: string, sessionId: string) {
  // Match global logout ordering: user, session, profile, optional draft. No network under lock.
  const [user] = await tx
    .select({ id: identityUsers.id, pending: identityUsers.globalRevocationPending })
    .from(identityUsers)
    .where(eq(identityUsers.id, userId))
    .limit(1)
    .for("no key update");
  if (!user || user.pending) throw new IdentityError("IDENTITY_UNAUTHENTICATED", 401);
  const [session] = await tx
    .select({ id: identitySessions.id, expiresAt: identitySessions.expiresAt })
    .from(identitySessions)
    .where(
      and(
        eq(identitySessions.id, sessionId),
        eq(identitySessions.userId, userId),
        isNull(identitySessions.revokedAt),
        gt(identitySessions.expiresAt, sql`clock_timestamp()`),
      ),
    )
    .limit(1)
    .for("update");
  if (!session) throw new IdentityError("IDENTITY_UNAUTHENTICATED", 401);
  const [profile] = await tx
    .select()
    .from(identityProfiles)
    .where(eq(identityProfiles.userId, userId))
    .limit(1)
    .for("update");
  if (!profile) throw new IdentityError("IDENTITY_NOT_FOUND", 404);
  return { profile, session };
}
function requireActiveSession(expiresAt: Date, now: Date) {
  if (expiresAt <= now) throw new IdentityError("IDENTITY_UNAUTHENTICATED", 401);
}
function requireAnonymousDraft(draft: DraftRow, now: Date) {
  if (draft.claimedBy) throw new IdentityError("PROFILE_DRAFT_ATTACHED", 409);
  if (draft.expiresAt <= now) throw new IdentityError("PROFILE_DRAFT_EXPIRED", 410);
}
function readChoiceCursor(cursor: string | undefined) {
  if (cursor === undefined) return undefined;
  try {
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(cursor)) throw new Error("Invalid cursor");
    return choiceCursorSchema.parse(
      JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown,
    );
  } catch {
    throw new IdentityError("IDENTITY_ACCESS_DENIED", 400);
  }
}

export function createProfileRepository(db: Database) {
  return {
    async renewDraft(tokenHash: string): Promise<string | null> {
      requireTokenHash(tokenHash);
      return db.transaction(async (tx) => {
        const [draft] = await tx
          .select()
          .from(profileDrafts)
          .where(eq(profileDrafts.tokenHash, tokenHash))
          .limit(1)
          .for("update");
        if (!draft) return null;
        const now = new Date();
        if (!draft.claimedBy && draft.expiresAt > now)
          throw new IdentityError("PROFILE_CONFLICT", 409);
        // One stable renewal per old handle, replayable only for five minutes.
        // An older handle cannot recover any future preparation indefinitely.
        if (draft.renewedAt && now.getTime() - draft.renewedAt.getTime() > 300_000)
          throw new IdentityError("PROFILE_DRAFT_EXPIRED", 410);
        if (draft.renewedAt) return draft.renewedAt.toISOString();
        await tx
          .update(profileDrafts)
          .set({ renewedAt: now })
          .where(eq(profileDrafts.id, draft.id));
        return now.toISOString();
      });
    },
    async get(userId: string): Promise<Profile> {
      const [profile] = await db
        .select()
        .from(identityProfiles)
        .where(eq(identityProfiles.userId, userId))
        .limit(1);
      if (!profile) throw new IdentityError("IDENTITY_NOT_FOUND", 404);
      return toProfile(profile);
    },
    async save(
      userId: string,
      sessionId: string,
      suppliedInput: ProfileSaveInput,
      suppliedKey: string,
    ): Promise<Profile> {
      const input = profileSaveInputSchema.parse(suppliedInput);
      const key = commandKey(suppliedKey);
      const hash = requestHash(input);
      const scope: Scope = { kind: "user", id: userId };
      return db.transaction(async (tx) => {
        const { profile, session } = await lockOwner(tx, userId, sessionId);
        const now = new Date();
        requireActiveSession(session.expiresAt, now);
        requireBirthDate(input.fields.birthDate, now);
        const previous = await replay(tx, scope, "save", key, hash, profileSchema, now);
        if (previous) return previous;
        if (profile.revision !== input.revision) throw new IdentityError("PROFILE_CONFLICT", 409);
        const values = toProfile(profile).fields;
        for (const field of fields) {
          const value = input.fields[field];
          if (value === undefined) continue;
          if (value === null) {
            delete values[field];
            continue;
          }
          const current = values[field];
          // Explicitly retaining a canonical value rejects a proposal without losing confirmation.
          values[field] =
            current?.value === value ? { ...current, proposal: null } : entered(value);
        }
        const revision = nextRevision(profile.revision);
        const [updated] = await tx
          .update(identityProfiles)
          .set({ fields: values, step: input.step, revision })
          .where(
            and(
              eq(identityProfiles.id, profile.id),
              eq(identityProfiles.userId, userId),
              eq(identityProfiles.revision, input.revision),
            ),
          )
          .returning();
        if (!updated) throw new IdentityError("PROFILE_CONFLICT", 409);
        return complete(tx, scope, "save", key, hash, toProfile(updated), now, {
          userId,
          sessionId,
          profileId: profile.id,
          action: "profile.saved.v1",
          revision,
        });
      });
    },
    async confirm(
      userId: string,
      sessionId: string,
      suppliedInput: ProfileConfirmInput,
      suppliedKey: string,
    ): Promise<Profile> {
      const input = profileConfirmInputSchema.parse(suppliedInput);
      const key = commandKey(suppliedKey);
      const hash = requestHash(input);
      const scope: Scope = { kind: "user", id: userId };
      return db.transaction(async (tx) => {
        const { profile, session } = await lockOwner(tx, userId, sessionId);
        const now = new Date();
        requireActiveSession(session.expiresAt, now);
        const previous = await replay(tx, scope, "confirm", key, hash, profileSchema, now);
        if (previous) return previous;
        if (profile.revision !== input.revision) throw new IdentityError("PROFILE_CONFLICT", 409);
        const values = toProfile(profile).fields;
        if (Object.values(values).some((value) => value?.proposal))
          throw new IdentityError("PROFILE_CONFIRMATION_REQUIRED", 422);
        requireBirthDate(values.birthDate?.value, now);
        for (const field of fields) {
          const value = values[field];
          if (value)
            values[field] = {
              value: value.value,
              source: "user_confirmed",
              confidence: null,
              confirmedAt: now.toISOString(),
              proposal: null,
            };
        }
        const revision = nextRevision(profile.revision);
        const [updated] = await tx
          .update(identityProfiles)
          .set({
            fields: values,
            revision,
            step: "review",
            prefill: input.prefill,
            prefillDecidedAt: now,
          })
          .where(
            and(
              eq(identityProfiles.id, profile.id),
              eq(identityProfiles.userId, userId),
              eq(identityProfiles.revision, input.revision),
            ),
          )
          .returning();
        if (!updated) throw new IdentityError("PROFILE_CONFLICT", 409);
        await tx.insert(profileChoices).values({
          id: `choice_${randomUUID()}`,
          userId,
          profileId: profile.id,
          sessionId,
          purpose: "profile.prefill",
          version: input.version,
          enabled: input.prefill,
          decidedAt: now,
        });
        return complete(tx, scope, "confirm", key, hash, toProfile(updated), now, {
          userId,
          sessionId,
          profileId: profile.id,
          action: "profile.confirmed.v1",
          revision,
        });
      });
    },
    async getDraft(tokenHash: string): Promise<DraftEntry> {
      requireTokenHash(tokenHash);
      return db.transaction(async (tx) => {
        const [draft] = await tx
          .select()
          .from(profileDrafts)
          .where(eq(profileDrafts.tokenHash, tokenHash))
          .limit(1)
          .for("update");
        if (!draft) return { state: "empty", draft: null };
        if (draft.claimedBy) return { state: "attached", draft: null };
        if (draft.expiresAt <= new Date()) return { state: "expired", draft: null };
        return { state: "active", draft: toDraft(draft) };
      });
    },
    async saveDraft(
      tokenHash: string,
      suppliedInput: ProfileSaveInput,
      suppliedKey: string,
    ): Promise<ProfileDraft> {
      requireTokenHash(tokenHash);
      const input = profileSaveInputSchema.parse(suppliedInput);
      const key = commandKey(suppliedKey);
      const hash = requestHash(input);
      return db.transaction(async (tx) => {
        const createdAt = new Date();
        requireBirthDate(input.fields.birthDate, createdAt);
        // Unique hash serializes first saves without a process-local lock or a second identity.
        await tx
          .insert(profileDrafts)
          .values({
            id: `draft_${randomUUID()}`,
            tokenHash,
            fields: {},
            revision: 0,
            step: "information",
            createdAt,
            expiresAt: new Date(createdAt.getTime() + lifetimeMs),
          })
          .onConflictDoNothing({ target: profileDrafts.tokenHash });
        const [draft] = await tx
          .select()
          .from(profileDrafts)
          .where(eq(profileDrafts.tokenHash, tokenHash))
          .limit(1)
          .for("update");
        if (!draft) throw new Error("Anonymous preparation was not persisted");
        const now = new Date();
        requireAnonymousDraft(draft, now);
        requireBirthDate(input.fields.birthDate, now);
        const scope: Scope = { kind: "draft", id: draft.id };
        const previous = await replay(tx, scope, "save_draft", key, hash, profileDraftSchema, now);
        if (previous) return previous;
        if (draft.revision !== input.revision) throw new IdentityError("PROFILE_CONFLICT", 409);
        const values: ProfileValues = profileValuesSchema.parse(draft.fields);
        for (const field of fields) {
          const value = input.fields[field];
          if (value === undefined) continue;
          if (value === null) delete values[field];
          else values[field] = value;
        }
        const revision = nextRevision(draft.revision);
        const [updated] = await tx
          .update(profileDrafts)
          .set({ fields: values, revision, step: input.step })
          .where(
            and(
              eq(profileDrafts.id, draft.id),
              eq(profileDrafts.tokenHash, tokenHash),
              eq(profileDrafts.revision, input.revision),
              isNull(profileDrafts.claimedBy),
              gt(profileDrafts.expiresAt, sql`clock_timestamp()`),
            ),
          )
          .returning();
        if (!updated) throw new IdentityError("PROFILE_DRAFT_EXPIRED", 410);
        return complete(tx, scope, "save_draft", key, hash, toDraft(updated), now, {
          draftId: draft.id,
          action: "profile.draft_saved.v1",
          revision,
        });
      });
    },
    async attach(
      userId: string,
      sessionId: string,
      tokenHash: string,
      suppliedInput: z.infer<typeof profileAttachInputSchema>,
      suppliedKey: string,
    ): Promise<z.infer<typeof profileAttachSchema>> {
      requireTokenHash(tokenHash);
      const input = profileAttachInputSchema.parse(suppliedInput);
      const key = commandKey(suppliedKey);
      const hash = requestHash({ input, tokenHash });
      const scope: Scope = { kind: "user", id: userId };
      return db.transaction(async (tx) => {
        const { profile, session } = await lockOwner(tx, userId, sessionId);
        const [draft] = await tx
          .select()
          .from(profileDrafts)
          .where(eq(profileDrafts.tokenHash, tokenHash))
          .limit(1)
          .for("update");
        if (!draft) throw new IdentityError("PROFILE_DRAFT_EXPIRED", 410);
        const now = new Date();
        requireActiveSession(session.expiresAt, now);
        if (draft.claimedBy && draft.claimedBy !== userId)
          throw new IdentityError("IDENTITY_ACCESS_DENIED", 403);
        if (!draft.claimedBy && draft.expiresAt <= now)
          throw new IdentityError("PROFILE_DRAFT_EXPIRED", 410);
        const previous = await replay(tx, scope, "attach", key, hash, profileAttachSchema, now);
        if (previous) return previous;
        // Same owner retry never repeats merging, confirmation, choice history or audit.
        if (draft.claimedBy === userId)
          return complete(
            tx,
            scope,
            "attach",
            key,
            hash,
            profileAttachSchema.parse({ profile: toProfile(profile), resumeStep: draft.step }),
            now,
          );
        if (draft.revision !== input.draftRevision)
          throw new IdentityError("PROFILE_CONFLICT", 409);
        const values = toProfile(profile).fields;
        const proposed = profileValuesSchema.parse(draft.fields);
        requireBirthDate(proposed.birthDate, now);
        for (const field of fields) {
          const value = proposed[field];
          if (value === undefined) continue;
          const current = values[field];
          if (!current) {
            values[field] = entered(value);
            continue;
          }
          if (current.value === value) continue;
          // There is one proposal slot: never overwrite an earlier unresolved proposal.
          if (current.proposal && current.proposal.value !== value)
            throw new IdentityError("PROFILE_CONFLICT", 409);
          values[field] = { ...current, proposal: { value, source: "anonymous_draft" } };
        }
        const revision = nextRevision(profile.revision);
        const [updated] = await tx
          .update(identityProfiles)
          .set({ fields: values, revision, step: draft.step })
          .where(
            and(
              eq(identityProfiles.id, profile.id),
              eq(identityProfiles.userId, userId),
              eq(identityProfiles.revision, profile.revision),
            ),
          )
          .returning();
        if (!updated) throw new IdentityError("PROFILE_CONFLICT", 409);
        const [claimed] = await tx
          .update(profileDrafts)
          .set({ claimedBy: userId, claimedAt: now })
          .where(
            and(
              eq(profileDrafts.id, draft.id),
              eq(profileDrafts.tokenHash, tokenHash),
              eq(profileDrafts.revision, input.draftRevision),
              isNull(profileDrafts.claimedBy),
              gt(profileDrafts.expiresAt, sql`clock_timestamp()`),
            ),
          )
          .returning({ id: profileDrafts.id });
        if (!claimed) throw new IdentityError("PROFILE_DRAFT_EXPIRED", 410);
        return complete(
          tx,
          scope,
          "attach",
          key,
          hash,
          profileAttachSchema.parse({ profile: toProfile(updated), resumeStep: draft.step }),
          now,
          {
            userId,
            sessionId,
            profileId: profile.id,
            draftId: draft.id,
            action: "profile.draft_attached.v1",
            revision,
          },
        );
      });
    },
    async choices(userId: string, cursor?: string): Promise<z.infer<typeof profileChoicesSchema>> {
      const after = readChoiceCursor(cursor);
      const afterDate = after ? new Date(after.decidedAt) : undefined;
      const rows = await db
        .select({
          id: profileChoices.id,
          purpose: profileChoices.purpose,
          version: profileChoices.version,
          enabled: profileChoices.enabled,
          decidedAt: profileChoices.decidedAt,
        })
        .from(profileChoices)
        .where(
          and(
            eq(profileChoices.userId, userId),
            after && afterDate
              ? or(
                  lt(profileChoices.decidedAt, afterDate),
                  and(eq(profileChoices.decidedAt, afterDate), lt(profileChoices.id, after.id)),
                )
              : undefined,
          ),
        )
        .orderBy(desc(profileChoices.decidedAt), desc(profileChoices.id))
        .limit(21);
      const page = rows.slice(0, 20);
      const last = page.at(-1);
      const nextCursor =
        rows.length > 20 && last
          ? Buffer.from(
              JSON.stringify({ decidedAt: last.decidedAt.toISOString(), id: last.id }),
            ).toString("base64url")
          : null;
      return profileChoicesSchema.parse({
        choices: page.map((choice) => ({
          purpose: choice.purpose,
          version: choice.version,
          enabled: choice.enabled,
          decidedAt: choice.decidedAt.toISOString(),
        })),
        nextCursor,
      });
    },
  };
}
