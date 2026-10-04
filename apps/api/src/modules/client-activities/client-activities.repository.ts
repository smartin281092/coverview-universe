import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, lt, lte, or } from "drizzle-orm";
import { z } from "zod";
import {
  clientActivitySchema,
  clientActivitiesQuerySchema,
  clientActivitiesSchema,
  clientActivityCreateInputSchema,
  clientActivityUpdateInputSchema,
  type ClientActivity,
  type ClientActivityCreateInput,
  type ClientActivityUpdateInput,
} from "@coverview/contracts";
import type { createDatabase } from "../../platform/db/database.js";
import { IdentityError, lockProfileActor, type ProfileActor } from "../identity/index.js";
import { assertDocumentProfileTarget } from "../profiles/index.js";
import {
  clientActivities,
  clientActivityCommands,
  clientActivityAudit,
} from "./client-activities.schema.js";

type Database = ReturnType<typeof createDatabase>["db"];
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Actor = ProfileActor & { administratorUserId: string };
type Row = typeof clientActivities.$inferSelect;
export class ClientActivityError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
  ) {
    super(code);
    this.name = "ClientActivityError";
  }
}
function scope(userId: string, profileId: string) {
  return and(
    eq(clientActivities.userId, userId),
    profileId === "self"
      ? isNull(clientActivities.managedProfileId)
      : eq(clientActivities.managedProfileId, profileId),
  );
}
function dto(row: Row): ClientActivity {
  return clientActivitySchema.parse({
    ...row,
    profileId: row.managedProfileId ?? "self",
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}
async function get(tx: Database | Tx, userId: string, profileId: string, id: string) {
  const [row] = await tx
    .select()
    .from(clientActivities)
    .where(and(scope(userId, profileId), eq(clientActivities.id, id)))
    .limit(1);
  if (!row) throw new ClientActivityError("CLIENT_ACTIVITY_NOT_FOUND", 404);
  return dto(row);
}
async function authorize(tx: Tx, actor: Actor, profileId: string) {
  if (!actor.administratorUserId) throw new IdentityError("IDENTITY_ACCESS_DENIED", 403);
  await lockProfileActor(tx, actor);
  await assertDocumentProfileTarget(tx, actor.userId, profileId);
}
export function createClientActivityRepository(db: Database) {
  async function save(
    actor: Actor,
    profileId: string,
    input: ClientActivityCreateInput | ClientActivityUpdateInput,
    key: string,
    id?: string,
  ) {
    if (!z.uuid().safeParse(key).success)
      throw new ClientActivityError("PLATFORM_INVALID_REQUEST", 400);
    const parsed = id
      ? clientActivityUpdateInputSchema.parse(input)
      : clientActivityCreateInputSchema.parse(input);
    const requestHash = createHash("sha256")
      .update(
        JSON.stringify({
          profileId,
          id,
          input: parsed,
          administratorUserId: actor.administratorUserId,
        }),
      )
      .digest("hex");
    return db.transaction(async (tx) => {
      await authorize(tx, actor, profileId);
      const [previous] = await tx
        .select()
        .from(clientActivityCommands)
        .where(
          and(eq(clientActivityCommands.userId, actor.userId), eq(clientActivityCommands.key, key)),
        )
        .limit(1);
      if (previous && previous.expiresAt > new Date()) {
        if (previous.requestHash !== requestHash)
          throw new ClientActivityError("CLIENT_ACTIVITY_IDEMPOTENCY_REUSED", 422);
        return get(tx, actor.userId, profileId, previous.activityId);
      }
      if (previous)
        await tx.delete(clientActivityCommands).where(eq(clientActivityCommands.id, previous.id));
      const current = id ? await get(tx, actor.userId, profileId, id) : null;
      if (
        current &&
        (!("revision" in parsed) ||
          parsed.revision !== current.revision ||
          current.revision >= 2147483647)
      )
        throw new ClientActivityError("CLIENT_ACTIVITY_CONFLICT", 409);
      const activityId = current?.id ?? `cact_${randomUUID()}`;
      const now = new Date();
      const values = {
        kind: parsed.kind,
        title: parsed.title,
        description: parsed.description,
        state: parsed.state,
        startsAt: parsed.startsAt ? new Date(parsed.startsAt) : null,
        endsAt: parsed.endsAt ? new Date(parsed.endsAt) : null,
        timezone: parsed.timezone,
        revision: current ? current.revision + 1 : 0,
        updatedAt: now,
      };
      if (current)
        await tx
          .update(clientActivities)
          .set(values)
          .where(and(scope(actor.userId, profileId), eq(clientActivities.id, activityId)));
      else
        await tx.insert(clientActivities).values({
          id: activityId,
          userId: actor.userId,
          managedProfileId: profileId === "self" ? null : profileId,
          ...values,
        });
      await tx.insert(clientActivityCommands).values({
        id: randomUUID(),
        userId: actor.userId,
        profileId,
        key,
        requestHash,
        activityId,
        expiresAt: new Date(now.getTime() + 86400000),
      });
      await tx.insert(clientActivityAudit).values({
        id: randomUUID(),
        userId: actor.userId,
        profileId,
        activityId,
        administratorUserId: actor.administratorUserId,
        sessionId: actor.id,
        action: current ? "updated" : "created",
        revision: values.revision,
      });
      return get(tx, actor.userId, profileId, activityId);
    });
  }
  return {
    list(actor: Actor, profileId: string, input: z.input<typeof clientActivitiesQuerySchema> = {}) {
      const query = clientActivitiesQuerySchema.parse(input);
      return db.transaction(async (tx) => {
        await authorize(tx, actor, profileId);
        const cursor = query.cursor ? await get(tx, actor.userId, profileId, query.cursor) : null;
        const rows = await tx
          .select()
          .from(clientActivities)
          .where(
            and(
              scope(actor.userId, profileId),
              query.kind ? eq(clientActivities.kind, query.kind) : undefined,
              cursor
                ? or(
                    lt(clientActivities.createdAt, new Date(cursor.createdAt)),
                    and(
                      eq(clientActivities.createdAt, new Date(cursor.createdAt)),
                      lt(clientActivities.id, cursor.id),
                    ),
                  )
                : undefined,
            ),
          )
          .orderBy(desc(clientActivities.createdAt), desc(clientActivities.id))
          .limit(21);
        return clientActivitiesSchema.parse({
          activities: rows.slice(0, 20).map(dto),
          nextCursor: rows.length > 20 ? rows[19]?.id : null,
        });
      });
    },
    get(actor: Actor, profileId: string, id: string) {
      return db.transaction(async (tx) => {
        await authorize(tx, actor, profileId);
        return get(tx, actor.userId, profileId, id);
      });
    },
    create: (actor: Actor, profileId: string, input: ClientActivityCreateInput, key: string) =>
      save(actor, profileId, input, key),
    update: (
      actor: Actor,
      profileId: string,
      id: string,
      input: ClientActivityUpdateInput,
      key: string,
    ) => save(actor, profileId, input, key, id),
    async purgeExpiredCommands() {
      await db.transaction(async (tx) => {
        const expired = await tx
          .select({ id: clientActivityCommands.id })
          .from(clientActivityCommands)
          .where(lte(clientActivityCommands.expiresAt, new Date()))
          .limit(100)
          .for("update", { skipLocked: true });
        if (expired.length)
          await tx.delete(clientActivityCommands).where(
            inArray(
              clientActivityCommands.id,
              expired.map((row) => row.id),
            ),
          );
      });
    },
  };
}
