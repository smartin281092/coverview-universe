import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, lt, lte, notLike, or } from "drizzle-orm";
import { z } from "zod";
import {
  actionCenterIdSchema,
  actionCenterQuerySchema,
  actionCenterListSchema,
  actionCenterDetailsSchema,
  actionCenterHistorySchema,
  actionCenterHistoryItemSchema,
  actionCenterResolveInputSchema,
  actionCenterResolveResultSchema,
  actionCenterManualReviewSchema,
  actionCenterManualReviewsSchema,
  actionCenterManualTransitionInputSchema,
  profileValuesSchema,
  entityProfileValuesSchema,
  type ActionCenterItem,
  type ActionCenterHistoryItem,
  type ActionCenterResolveInput,
  type ActionCenterResolveResult,
  type ActionCenterManualReview,
  type ActionCenterManualTransitionInput,
  type ServiceRequest,
} from "@coverview/contracts";
import type { createDatabase } from "../../platform/db/database.js";
import {
  lockProfileActor,
  confirmDocumentProfileFields,
  readAuthorizationNoticeActivity,
  readDocumentProfile,
  type ProfileActor,
} from "../identity/index.js";
import {
  syncManagedDocumentProfile,
  managedProfiles,
  assertDocumentProfileTarget,
} from "../profiles/index.js";
import { readAuthorizationStatus, readAuthorizationActivity } from "../authorizations/index.js";
import { DocumentError } from "./document.errors.js";
import { actionResponseValues } from "./document.action-response.js";
import { requestCompanyAction } from "./document.company-actions.repository.js";
import {
  readActionCenter,
  actionDigest,
  actionValuesHash,
  actionCenterIdentity,
} from "./document.action-center.projection.js";
import {
  actionCenterCommands,
  actionCenterManualReviews,
  actionCenterResolutions,
} from "./document.action-center.schema.js";

type Database = ReturnType<typeof createDatabase>["db"];
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Query = z.infer<typeof actionCenterQuerySchema>;
type Locked = Awaited<ReturnType<typeof lockProfileActor>>;
type Center = Awaited<ReturnType<typeof readActionCenter>>;
const conflict = () => new DocumentError("DOCUMENT_CONFLICT", 409);
const invalid = () => new DocumentError("DOCUMENT_REVIEW_INVALID", 422);
const missing = () => new DocumentError("DOCUMENT_NOT_FOUND", 404);
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
function decode<T>(cursor: string | undefined, schema: z.ZodType<T>): T | null {
  if (!cursor) return null;
  try {
    return schema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
  } catch {
    throw invalid();
  }
}
function navigation(items: ActionCenterItem[], id: string) {
  const active = items.filter((item) => item.state !== "complete");
  const index = active.findIndex((item) => item.id === id);
  return {
    previousId:
      active.length > 1 && index >= 0
        ? active[(index - 1 + active.length) % active.length]!.id
        : null,
    nextId:
      index >= 0
        ? active.length > 1
          ? active[(index + 1) % active.length]!.id
          : null
        : (active[0]?.id ?? null),
  };
}
function manualDto(row: typeof actionCenterManualReviews.$inferSelect) {
  return actionCenterManualReviewSchema.parse({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}
function sourceReferences(item: ActionCenterItem) {
  return [
    ...new Map(
      item.variants
        .flatMap((variant) => variant.sources)
        .map((source) => [source.documentId, source]),
    ).values(),
  ].slice(0, 200);
}
function activityId(value: unknown) {
  const hash = actionDigest(value);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
export function createActionCenterRepository(db: Database) {
  async function execute<T extends ActionCenterResolveResult | ActionCenterManualReview>(
    actor: ProfileActor,
    operation: "resolve" | "manual_transition",
    input: unknown,
    key: string,
    schema: z.ZodType<T>,
    run: (tx: Tx, locked: Locked) => Promise<T>,
    prerequisite?: (tx: Tx) => Promise<void>,
  ) {
    if (!z.uuid().safeParse(key).success) throw invalid();
    const requestHash = actionDigest(input);
    return db.transaction(async (tx) => {
      const locked = await lockProfileActor(tx, actor);
      const actorUserId = actor.administratorUserId ?? actor.userId;
      if (prerequisite) await prerequisite(tx);
      const [previous] = await tx
        .select()
        .from(actionCenterCommands)
        .where(
          and(
            eq(actionCenterCommands.userId, actor.userId),
            eq(actionCenterCommands.actorUserId, actorUserId),
            eq(actionCenterCommands.operation, operation),
            eq(actionCenterCommands.key, key),
          ),
        )
        .limit(1);
      const now = new Date();
      if (previous && previous.expiresAt > now) {
        if (previous.requestHash !== requestHash)
          throw new DocumentError("DOCUMENT_IDEMPOTENCY_REUSED", 422);
        return schema.parse(previous.response);
      }
      if (previous)
        await tx.delete(actionCenterCommands).where(eq(actionCenterCommands.id, previous.id));
      const result = await run(tx, locked);
      await tx.insert(actionCenterCommands).values({
        id: randomUUID(),
        userId: actor.userId,
        actorUserId,
        operation,
        key,
        requestHash,
        response: result,
        expiresAt: new Date(now.getTime() + 86400000),
      });
      return result;
    });
  }
  return {
    async list(userId: string, input: Query = {}) {
      const query = actionCenterQuerySchema.parse(input);
      const scope = query.profileId ?? "all";
      const cursor = decode(
        query.cursor,
        z
          .object({
            id: actionCenterIdSchema,
            scope: z.string().max(100),
            state: z.enum(["pending", "in_progress"]).optional(),
          })
          .strict(),
      );
      if (cursor && (cursor.scope !== scope || cursor.state !== query.state)) throw invalid();
      const center = await readActionCenter(db, userId, query.profileId);
      const visible = center.actions
        .map(({ item }) => item)
        .filter(
          (item) =>
            item.state !== "complete" &&
            (!query.state || item.state === query.state) &&
            (!cursor || item.id.localeCompare(cursor.id) > 0),
        );
      const actions = visible.slice(0, 20);
      return actionCenterListSchema.parse({
        actions,
        summary: center.summary,
        nextCursor:
          visible.length > 20
            ? encode({
                id: actions.at(-1)!.id,
                scope,
                ...(query.state ? { state: query.state } : {}),
              })
            : null,
      });
    },
    async summary(userId: string, profileId?: string) {
      return (await readActionCenter(db, userId, profileId)).summary;
    },
    async details(userId: string, suppliedId: string, profileId?: string) {
      const id = actionCenterIdSchema.parse(suppliedId);
      const center = await readActionCenter(db, userId, profileId);
      const action = center.actions.find(({ item }) => item.id === id)?.item;
      if (!action) throw missing();
      return actionCenterDetailsSchema.parse({
        action,
        ...navigation(
          center.actions.map(({ item }) => item),
          id,
        ),
      });
    },
    async history(userId: string, input: Query = {}) {
      const query = actionCenterQuerySchema.parse(input);
      const scope = query.profileId ?? "all";
      const cursor = decode(
        query.cursor,
        z.object({ at: z.iso.datetime(), id: z.uuid(), scope: z.string().max(100) }).strict(),
      );
      if (cursor && cursor.scope !== scope) throw invalid();
      if (query.profileId) await assertDocumentProfileTarget(db, userId, query.profileId);
      const rows = await db
        .select()
        .from(actionCenterResolutions)
        .where(
          and(
            eq(actionCenterResolutions.userId, userId),
            query.profileId ? eq(actionCenterResolutions.profileId, query.profileId) : undefined,
            cursor
              ? or(
                  lt(actionCenterResolutions.createdAt, new Date(cursor.at)),
                  and(
                    eq(actionCenterResolutions.createdAt, new Date(cursor.at)),
                    lt(actionCenterResolutions.id, cursor.id),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(desc(actionCenterResolutions.createdAt), desc(actionCenterResolutions.id))
        .limit(21);
      const [signatures, notices, profile, subjects] = await Promise.all([
        readAuthorizationActivity(db, userId, query.profileId),
        !query.profileId || query.profileId === "self"
          ? readAuthorizationNoticeActivity(db, userId)
          : Promise.resolve({ entries: [], incomplete: false }),
        readDocumentProfile(db, userId),
        db
          .select({ id: managedProfiles.id, displayName: managedProfiles.displayName })
          .from(managedProfiles)
          .where(eq(managedProfiles.userId, userId))
          .limit(51),
      ]);
      const names = new Map(subjects.map((subject) => [subject.id, subject.displayName]));
      names.set(
        "self",
        [profile.fields.firstName?.value, profile.fields.lastName?.value]
          .filter(Boolean)
          .join(" ") || "—",
      );
      const activity: ActionCenterHistoryItem[] = [
        ...signatures.entries.map((signature): ActionCenterHistoryItem => {
          const topic = `authorization:${signature.kind === "mandate" ? "management_mandate" : "procuration"}`;
          return {
            id: activityId(["signature", signature.id]),
            actionId: actionCenterIdentity(userId, signature.profileId, topic),
            profileId: signature.profileId,
            profileName: names.get(signature.profileId) ?? "—",
            topic,
            kind: "authorization",
            choice: "signed",
            beforeValues: {},
            afterValues: {},
            response: null,
            sources: [],
            createdAt: signature.signedAt,
            actor: "owner",
            authorizationEvidence: {
              version: signature.version,
              signatureId: signature.id,
              revokedAt: signature.revokedAt,
            },
          };
        }),
        ...notices.entries.map((notice): ActionCenterHistoryItem => ({
          id: activityId(["notice", userId, notice.version, notice.firstOpenedAt]),
          actionId: actionCenterIdentity(userId, "self", "authorization:lsa45"),
          profileId: "self",
          profileName: names.get("self")!,
          topic: "authorization:lsa45",
          kind: "authorization",
          choice: "opened",
          beforeValues: {},
          afterValues: {},
          response: null,
          sources: [],
          createdAt: notice.firstOpenedAt,
          actor: "owner",
          authorizationEvidence: { version: notice.version, signatureId: null, revokedAt: null },
        })),
      ];
      const merged = [
        ...rows.map((row) => actionCenterHistoryItemSchema.parse(row.history)),
        ...activity.filter(
          (entry) =>
            !cursor ||
            entry.createdAt < cursor.at ||
            (entry.createdAt === cursor.at && entry.id < cursor.id),
        ),
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
      const entries = merged.slice(0, 20);
      const last = entries.at(-1);
      return actionCenterHistorySchema.parse({
        entries,
        nextCursor:
          merged.length > 20 && last ? encode({ at: last.createdAt, id: last.id, scope }) : null,
        incomplete: signatures.incomplete || notices.incomplete || subjects.length > 50,
      });
    },
    resolve(
      actor: ProfileActor,
      suppliedId: string,
      supplied: ActionCenterResolveInput,
      key: string,
    ) {
      if (actor.administratorUserId) throw invalid();
      const id = actionCenterIdSchema.parse(suppliedId);
      const input = actionCenterResolveInputSchema.parse(supplied);
      let before: Center;
      return execute(
        actor,
        "resolve",
        { id, input },
        key,
        actionCenterResolveResultSchema,
        async (tx, locked) => {
          const selected = before.actions.find(({ item }) => item.id === id);
          if (!selected) throw missing();
          const item = selected.item;
          if (item.fingerprint !== input.fingerprint) throw conflict();
          if (
            !item.canResolve ||
            !item.choices.some((choice) => choice.id === input.choice && choice.enabled)
          )
            throw invalid();
          if (input.choice !== "variant" && input.variantId) throw invalid();
          if (input.choice !== "correct" && input.values) throw invalid();
          if (input.choice === "custom" && !input.response) throw invalid();
          let values: Record<string, string> = {};
          let sources = sourceReferences(item);
          if (input.choice === "variant") {
            const variant = item.variants.find((entry) => entry.id === input.variantId);
            if (!variant) throw invalid();
            values = variant.values;
            sources = variant.sources;
          } else if (input.choice === "correct") {
            values =
              input.values ??
              (input.response ? actionResponseValues(item.topic, input.response) : {});
            if (!Object.keys(values).length) throw invalid();
            const allowed =
              item.topic === "address" ? ["street", "postalCode", "city", "country"] : [item.topic];
            if (Object.keys(values).some((field) => !allowed.includes(field))) throw invalid();
          }
          if (Object.keys(values).length) {
            const profile = before.context.profiles.get(item.profileId);
            if (!profile) throw missing();
            const parsed = (
              profile.kind === "legal_entity" ? entityProfileValuesSchema : profileValuesSchema
            ).safeParse(values);
            if (!parsed.success) throw invalid();
            values = Object.fromEntries(
              Object.entries(parsed.data).filter(
                (entry): entry is [string, string] => typeof entry[1] === "string",
              ),
            );
            if (!Object.keys(values).length) throw invalid();
            if (item.profileId === "self")
              await confirmDocumentProfileFields(
                tx,
                locked.profile,
                profileValuesSchema.parse(parsed.data),
              );
            else
              await syncManagedDocumentProfile(
                tx,
                actor,
                item.profileId,
                item.profileRevision,
                values,
              );
          }
          const requests: ServiceRequest[] = [];
          if (input.choice === "notify") {
            const recipients = item.companies.filter((company) => company.canRequest);
            if (!recipients.length) throw invalid();
            for (const company of recipients)
              requests.push(await requestCompanyAction(tx, actor, company, true));
          }
          const afterValues = { ...item.currentValues, ...values };
          const now = new Date();
          const resolutionId = randomUUID();
          const history: ActionCenterHistoryItem = {
            id: resolutionId,
            actionId: id,
            profileId: item.profileId,
            profileName: item.profileName,
            topic: item.topic,
            kind: item.kind,
            choice: input.choice,
            beforeValues: item.currentValues,
            afterValues,
            response: input.response ?? null,
            sources,
            createdAt: now.toISOString(),
            actor: "owner",
          };
          await tx.insert(actionCenterResolutions).values({
            id: resolutionId,
            userId: actor.userId,
            managedProfileId: item.profileId === "self" ? null : item.profileId,
            profileId: item.profileId,
            actionId: id,
            topic: item.topic,
            observedHash: selected.observedHash,
            profileHash: actionValuesHash(afterValues),
            fingerprint: input.fingerprint,
            history,
            actorUserId: actor.userId,
            sessionId: actor.id,
            createdAt: now,
          });
          if (input.choice === "custom")
            await tx.insert(actionCenterManualReviews).values({
              id: randomUUID(),
              userId: actor.userId,
              resolutionId,
              actionId: id,
              profileId: item.profileId,
              profileName: item.profileName,
              topic: item.topic,
              response: input.response!,
            });
          const after = await readActionCenter(tx, actor.userId);
          const action = after.actions.find((entry) => entry.item.id === id)?.item;
          if (!action) throw missing();
          return actionCenterResolveResultSchema.parse({
            resolution: history,
            action,
            summary: after.summary,
            nextId:
              action.state === "pending"
                ? action.id
                : navigation(
                    after.actions.map(({ item: entry }) => entry),
                    id,
                  ).nextId,
            requests,
          });
        },
        async (tx) => {
          before = await readActionCenter(tx, actor.userId);
          const item = before.actions.find((entry) => entry.item.id === id)?.item;
          if (!item) throw missing();
          // Recheck before cached responses too: old custom commands cannot bypass signing.
          if (item.kind === "authorization") throw invalid();
          if (
            input.choice === "notify" &&
            !(await readAuthorizationStatus(tx, actor.userId, item.profileId)).mandate.signedAt
          )
            throw new DocumentError("DOCUMENT_MANDATE_REQUIRED", 409);
        },
      );
    },
    async manualReviews(cursorInput?: string) {
      const cursor = decode(cursorInput, z.object({ at: z.iso.datetime(), id: z.uuid() }).strict());
      const rows = await db
        .select()
        .from(actionCenterManualReviews)
        .where(
          and(
            notLike(actionCenterManualReviews.topic, "authorization:%"),
            cursor
              ? or(
                  lt(actionCenterManualReviews.createdAt, new Date(cursor.at)),
                  and(
                    eq(actionCenterManualReviews.createdAt, new Date(cursor.at)),
                    lt(actionCenterManualReviews.id, cursor.id),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(desc(actionCenterManualReviews.createdAt), desc(actionCenterManualReviews.id))
        .limit(21);
      const reviews = rows.slice(0, 20).map(manualDto);
      const last = reviews.at(-1);
      return actionCenterManualReviewsSchema.parse({
        reviews,
        nextCursor: rows.length > 20 && last ? encode({ at: last.createdAt, id: last.id }) : null,
      });
    },
    transitionManual(
      actor: ProfileActor,
      supplied: ActionCenterManualTransitionInput,
      key: string,
    ) {
      if (!actor.administratorUserId || actor.userId !== supplied.userId) throw invalid();
      const input = actionCenterManualTransitionInputSchema.parse(supplied);
      return execute(
        actor,
        "manual_transition",
        input,
        key,
        actionCenterManualReviewSchema,
        async (tx) => {
          const [current] = await tx
            .select()
            .from(actionCenterManualReviews)
            .where(
              and(
                eq(actionCenterManualReviews.userId, actor.userId),
                eq(actionCenterManualReviews.id, input.id),
              ),
            )
            .limit(1)
            .for("update");
          if (!current) throw missing();
          if (
            current.revision !== input.revision ||
            current.state === "resolved" ||
            (current.state === "in_progress" && input.state === "in_progress")
          )
            throw conflict();
          const now = new Date();
          const [updated] = await tx
            .update(actionCenterManualReviews)
            .set({
              state: input.state,
              revision: current.revision + 1,
              resolution: input.resolution ?? null,
              updatedAt: now,
            })
            .where(
              and(
                eq(actionCenterManualReviews.userId, actor.userId),
                eq(actionCenterManualReviews.id, current.id),
              ),
            )
            .returning();
          if (!updated) throw missing();
          if (input.state === "resolved") {
            const [origin] = await tx
              .select()
              .from(actionCenterResolutions)
              .where(
                and(
                  eq(actionCenterResolutions.userId, actor.userId),
                  eq(actionCenterResolutions.id, current.resolutionId),
                ),
              )
              .limit(1);
            if (!origin) throw missing();
            const id = randomUUID();
            const history: ActionCenterHistoryItem = {
              ...origin.history,
              id,
              choice: "manual_completed",
              response: input.resolution!,
              actor: "administrator",
              createdAt: now.toISOString(),
            };
            await tx.insert(actionCenterResolutions).values({
              id,
              userId: actor.userId,
              managedProfileId: origin.managedProfileId,
              profileId: origin.profileId,
              actionId: origin.actionId,
              topic: origin.topic,
              observedHash: origin.observedHash,
              profileHash: origin.profileHash,
              fingerprint: origin.fingerprint,
              history,
              actorUserId: actor.administratorUserId!,
              sessionId: actor.id,
              createdAt: now,
            });
          }
          return manualDto(updated);
        },
      );
    },
    async purgeExpiredCommands() {
      await db
        .delete(actionCenterCommands)
        .where(
          inArray(
            actionCenterCommands.id,
            db
              .select({ id: actionCenterCommands.id })
              .from(actionCenterCommands)
              .where(lte(actionCenterCommands.expiresAt, new Date()))
              .orderBy(asc(actionCenterCommands.expiresAt), asc(actionCenterCommands.id))
              .limit(100),
          ),
        );
    },
  };
}
