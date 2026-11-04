import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  pensionSearchSchema,
  pensionSearchStages,
  type PensionSearch,
  type PensionSearchListQuery,
  type PensionSearchTransitionInput,
} from "@coverview/contracts/pension-searches";
import type { createDatabase } from "../../platform/db/database.js";
import { lockProfileActor, IdentityError, type ProfileActor } from "../identity/index.js";
import {
  pensionSearches as searches,
  pensionSearchChallenges as challenges,
  pensionSearchCommands as commands,
} from "./pension-searches.schema.js";
type Database = ReturnType<typeof createDatabase>["db"];
type Row = typeof searches.$inferSelect;
type Session = ProfileActor & { email: string };
export class PensionSearchError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
  ) {
    super(code);
    this.name = "PensionSearchError";
  }
}
function fail(code = "PENSION_SEARCH_NOT_FOUND", status = 404): never {
  throw new PensionSearchError(code, status);
}
export const fingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
// The mandate text shown in the last step of the order; a new text takes a new version.
export const pensionSearchMandateVersion = "pension-search-2026-11-04";
const codeLifetimeMs = 10 * 60 * 1000;
const dto = (row: Row): PensionSearch =>
  pensionSearchSchema.parse({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
const cursorSchema = z.object({ at: z.iso.datetime(), id: z.string() });

export function createPensionSearchRepository(db: Database) {
  return {
    /** Prepares an email code for this browser. A connected account with the same address needs none. */
    async email(browserHash: string, email: string, key: string, session?: Session) {
      if (session?.email.toLowerCase() === email)
        return { send: false, sent: false, verified: true };
      return db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${browserHash}, 0))`);
        const emailHash = fingerprint(email);
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${emailHash}, 0))`);
        const [previous] = await tx
          .select()
          .from(challenges)
          .where(eq(challenges.browserHash, browserHash))
          .for("update")
          .limit(1);
        if (previous?.key === key) {
          if (previous.email !== email) fail("PENSION_SEARCH_IDEMPOTENCY_REUSED", 422);
          return { send: false, sent: previous.state === "sent", verified: false };
        }
        // One code a minute for a mailbox, whichever browser asks for it.
        const [recent] = await tx
          .select({ at: challenges.createdAt })
          .from(challenges)
          .where(
            and(
              eq(challenges.emailHash, emailHash),
              sql`${challenges.createdAt} > now() - interval '60 seconds'`,
            ),
          )
          .limit(1);
        if (recent) throw new IdentityError("IDENTITY_RATE_LIMITED", 429);
        const now = new Date();
        const values = {
          email,
          emailHash,
          key,
          state: "pending" as const,
          attempts: 0,
          createdAt: now,
          expiresAt: new Date(now.getTime() + codeLifetimeMs),
        };
        await tx
          .insert(challenges)
          .values({ browserHash, ...values })
          .onConflictDoUpdate({ target: challenges.browserHash, set: values });
        return { send: true, sent: false, verified: false };
      });
    },
    async emailSent(browserHash: string, key: string, sent: boolean) {
      await db
        .update(challenges)
        .set({ state: sent ? "sent" : "failed" })
        .where(
          and(
            eq(challenges.browserHash, browserHash),
            eq(challenges.key, key),
            eq(challenges.state, "pending"),
          ),
        );
    },
    /** Takes one of the five attempts of the browser's current code. */
    async beginVerification(browserHash: string) {
      return db.transaction(async (tx) => {
        const [challenge] = await tx
          .select()
          .from(challenges)
          .where(eq(challenges.browserHash, browserHash))
          .for("update")
          .limit(1);
        if (
          !challenge ||
          challenge.state !== "sent" ||
          challenge.attempts >= 5 ||
          challenge.expiresAt.getTime() <= Date.now()
        )
          throw new IdentityError("IDENTITY_INVALID_CALLBACK", 400);
        await tx
          .update(challenges)
          .set({ state: "verifying", attempts: challenge.attempts + 1 })
          .where(eq(challenges.browserHash, browserHash));
        return challenge;
      });
    },
    async finishVerification(browserHash: string, key: string, success: boolean) {
      await db
        .update(challenges)
        .set({ state: success ? "consumed" : "sent" })
        .where(
          and(
            eq(challenges.browserHash, browserHash),
            eq(challenges.key, key),
            eq(challenges.state, "verifying"),
          ),
        );
    },
    /** Records the order of the verified account. Replaying the same key returns the same search. */
    async submit(session: Session, details: PensionSearch["details"], key: string) {
      return db.transaction(async (tx) => {
        await lockProfileActor(tx, session);
        const hash = fingerprint(details);
        const [existing] = await tx
          .select()
          .from(searches)
          .where(and(eq(searches.userId, session.userId), eq(searches.submitKey, key)))
          .limit(1);
        if (existing) {
          if (existing.submitHash !== hash) fail("PENSION_SEARCH_IDEMPOTENCY_REUSED", 422);
          return dto(existing);
        }
        const now = new Date();
        const [row] = await tx
          .insert(searches)
          .values({
            id: `lpp_${randomUUID()}`,
            userId: session.userId,
            email: session.email.toLowerCase(),
            details,
            mandateVersion: pensionSearchMandateVersion,
            submitKey: key,
            submitHash: hash,
            history: [{ state: "submitted", at: now.toISOString() }],
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        return dto(row!);
      });
    },
    /** The owner's search, or any search for an administrator. Knowing the id is never enough. */
    async get(id: string, userId: string | undefined, admin = false) {
      if (!admin && !userId) fail();
      const [row] = await db
        .select()
        .from(searches)
        .where(and(eq(searches.id, id), admin ? undefined : eq(searches.userId, userId ?? "")))
        .limit(1);
      if (!row) fail();
      return dto(row);
    },
    async list(query: PensionSearchListQuery, userId: string | undefined, admin = false) {
      if (!admin && !userId) fail();
      let cursor: z.infer<typeof cursorSchema> | undefined;
      try {
        if (query.cursor)
          cursor = cursorSchema.parse(
            JSON.parse(Buffer.from(query.cursor, "base64url").toString()),
          );
      } catch {
        fail("PENSION_SEARCH_NOT_FOUND", 400);
      }
      const rows = await db
        .select()
        .from(searches)
        .where(
          and(
            admin ? undefined : eq(searches.userId, userId ?? ""),
            query.state ? eq(searches.state, query.state) : undefined,
            cursor
              ? or(
                  lt(searches.createdAt, new Date(cursor.at)),
                  and(eq(searches.createdAt, new Date(cursor.at)), lt(searches.id, cursor.id)),
                )
              : undefined,
          ),
        )
        .orderBy(desc(searches.createdAt), desc(searches.id))
        .limit(26);
      const page = rows.slice(0, 25);
      const last = page.at(-1);
      return {
        searches: page.map(dto),
        nextCursor:
          rows.length > 25 && last
            ? Buffer.from(
                JSON.stringify({ at: last.createdAt.toISOString(), id: last.id }),
              ).toString("base64url")
            : null,
      };
    },
    /** One step forward, or cancelled before completion, by an administrator with MFA. */
    async transition(
      id: string,
      input: PensionSearchTransitionInput,
      key: string,
      actor: ProfileActor,
    ) {
      return db.transaction(async (tx) => {
        await lockProfileActor(tx, { ...actor, administratorUserId: actor.userId });
        const [row] = await tx
          .select()
          .from(searches)
          .where(eq(searches.id, id))
          .for("update")
          .limit(1);
        if (!row) fail();
        const hash = fingerprint(input);
        const [old] = await tx
          .select()
          .from(commands)
          .where(
            and(
              eq(commands.searchId, id),
              eq(commands.actorId, actor.userId),
              eq(commands.key, key),
            ),
          )
          .limit(1);
        if (old) {
          if (old.hash !== hash) fail("PENSION_SEARCH_IDEMPOTENCY_REUSED", 422);
          return dto(row);
        }
        const next =
          pensionSearchStages[(pensionSearchStages as readonly string[]).indexOf(row.state) + 1];
        if (
          input.revision !== row.revision ||
          row.state === "completed" ||
          row.state === "cancelled" ||
          (input.state !== "cancelled" && input.state !== next)
        )
          fail("PENSION_SEARCH_CONFLICT", 409);
        const now = new Date();
        const [updated] = await tx
          .update(searches)
          .set({
            state: input.state,
            revision: row.revision + 1,
            updatedAt: now,
            history: [...row.history, { state: input.state, at: now.toISOString() }],
          })
          .where(eq(searches.id, id))
          .returning();
        await tx.insert(commands).values({
          id: randomUUID(),
          searchId: id,
          actorId: actor.userId,
          key,
          hash,
          state: input.state,
        });
        return dto(updated!);
      });
    },
  };
}
