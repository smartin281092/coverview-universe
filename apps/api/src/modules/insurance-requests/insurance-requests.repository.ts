import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, getTableColumns, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  insuranceRequestSchema,
  type InsuranceCart,
  type InsurancePerson,
  type InsuranceRequest,
  type InsuranceRequestListQuery,
  type InsuranceTransitionInput,
} from "@coverview/contracts/insurance-requests";
import type { createDatabase } from "../../platform/db/database.js";
import { lockProfileActor, IdentityError, type ProfileActor } from "../identity/index.js";
import { createInsuranceProfiles, managedProfiles } from "../profiles/index.js";
import {
  insuranceRequests as requests,
  insuranceEmailChallenges as challenges,
  insuranceRequestCommands as commands,
  insuranceEmailReservations as reservations,
} from "./insurance-requests.schema.js";
type Database = ReturnType<typeof createDatabase>["db"];
type Row = typeof requests.$inferSelect;
type Session = ProfileActor & { email: string };
export class InsuranceRequestError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
  ) {
    super(code);
    this.name = "InsuranceRequestError";
  }
}
function fail(code = "INSURANCE_REQUEST_NOT_FOUND", status = 404): never {
  throw new InsuranceRequestError(code, status);
}
export const fingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const dto = (row: Omit<Row, "email"> & { email: string | null }): InsuranceRequest =>
  insuranceRequestSchema.parse({
    ...row,
    totalMonthlyMinor: row.items.reduce((sum, item) => sum + item.offer.monthlyPremiumMinor, 0),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    submittedAt: row.submittedAt?.toISOString() ?? null,
  });
const legalVersion = "insurance-request-2026-09-30";
const cursorSchema = z.object({ at: z.iso.datetime(), id: z.string() });
export function createInsuranceRequestRepository(
  db: Database,
  quote: (person: InsurancePerson) => Promise<
    Pick<InsuranceRequest["items"][number], "offer" | "locality"> & {
      currentInsurerName?: string | null;
      currentInsurerBrand?: string | undefined;
    }
  >,
) {
  const owned = (browserHash: string, userId?: string) =>
    or(
      and(
        eq(requests.browserHash, browserHash),
        isNull(requests.userId),
        sql`${requests.createdAt} > now() - interval '30 days'`,
      ),
      ...(userId ? [eq(requests.userId, userId)] : []),
    );
  const visibleItems = (userId?: string) =>
    sql<
      InsuranceRequest["items"]
    >`case when ${requests.userId} is null or ${requests.state}='draft' then ${requests.items} else coalesce((select jsonb_agg(item) from jsonb_array_elements(${requests.items}) item join ${managedProfiles} p on p.id=item->>'profileId' where p.user_id=${userId ?? ""}), '[]'::jsonb) end`;
  const readable = (browserHash: string, userId?: string) =>
    or(
      and(
        eq(requests.browserHash, browserHash),
        isNull(requests.userId),
        sql`${requests.createdAt} > now()-interval '30 days'`,
      ),
      ...(userId
        ? [
            and(eq(requests.userId, userId), eq(requests.state, "draft")),
            sql`exists(select 1 from jsonb_array_elements(${requests.items}) item join ${managedProfiles} p on p.id=item->>'profileId' where p.user_id=${userId})`,
          ]
        : []),
    );
  const projection = (userId?: string) => ({
    ...getTableColumns(requests),
    items: visibleItems(userId),
    email: sql<
      string | null
    >`case when ${requests.userId} is null or ${requests.userId}=${userId ?? ""} then ${requests.email} else null end`,
    emailVerified: sql<boolean>`case when ${requests.userId} is null or ${requests.userId}=${userId ?? ""} then ${requests.emailVerified} else false end`,
    legalVersion: sql<
      string | null
    >`case when ${requests.userId} is null or ${requests.userId}=${userId ?? ""} then ${requests.legalVersion} else null end`,
  });
  return {
    async draft(browserHash: string, userId?: string) {
      const [row] = await db
        .select()
        .from(requests)
        .where(
          and(
            eq(requests.browserHash, browserHash),
            eq(requests.state, "draft"),
            owned(browserHash, userId),
          ),
        )
        .orderBy(desc(requests.createdAt))
        .limit(1);
      return row ? dto(row) : null;
    },
    async email(
      browserHash: string,
      email: string,
      key: string,
      session?: Session,
      access: "guest" | "wallet" = "wallet",
    ) {
      return db.transaction(async (tx) => {
        if (session) await lockProfileActor(tx, session);
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${browserHash}, 0))`);
        const [current] = await tx
          .select()
          .from(requests)
          .where(
            and(
              eq(requests.browserHash, browserHash),
              eq(requests.state, "draft"),
              owned(browserHash, session?.userId),
            ),
          )
          .orderBy(desc(requests.createdAt))
          .for("update")
          .limit(1);
        // Editing the email clears verification; a request already claimed by a different account is never silently moved.
        if (current?.userId && current.email !== email) fail("INSURANCE_REQUEST_CONFLICT", 409);
        const id = current?.id ?? `inq_${randomUUID()}`;
        if (current)
          await tx
            .update(requests)
            .set({
              email,
              emailVerified: current.email === email && current.emailVerified,
              updatedAt: new Date(),
            })
            .where(eq(requests.id, id));
        else await tx.insert(requests).values({ id, browserHash, email });
        // A contact email is not an authentication attempt. Never reserve or send an OTP for guests.
        if (access === "guest")
          return {
            id,
            send: false,
            sent: false,
            verified: (current?.email === email && current.emailVerified) || false,
          };
        // Canonical authentication already proves this mailbox; reuse it without a second login.
        if (session?.email.toLowerCase() === email.toLowerCase()) {
          await tx
            .update(requests)
            .set({ userId: session.userId, emailVerified: true, saveInWallet: true })
            .where(eq(requests.id, id));
          return { id, send: false, sent: false, verified: true };
        }
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`email:${email}`}, 0))`,
        );
        const [previous] = await tx
          .select()
          .from(challenges)
          .where(eq(challenges.browserHash, browserHash))
          .for("update")
          .limit(1);
        if (previous?.key === key) {
          if (previous.email !== email) fail("INSURANCE_REQUEST_IDEMPOTENCY_REUSED", 422);
          return {
            id,
            send: false,
            sent: previous.state === "sent",
            verified: current?.emailVerified ?? false,
          };
        }
        const emailHash = fingerprint(email);
        const [recent] = await tx
          .select()
          .from(reservations)
          .where(
            and(
              eq(reservations.emailHash, emailHash),
              sql`${reservations.reservedAt} > now() - interval '60 seconds'`,
            ),
          )
          .limit(1);
        if (recent) throw new IdentityError("IDENTITY_RATE_LIMITED", 429);
        const now = new Date();
        await tx
          .insert(reservations)
          .values({ emailHash, reservedAt: now })
          .onConflictDoUpdate({ target: reservations.emailHash, set: { reservedAt: now } });
        await tx
          .insert(challenges)
          .values({
            browserHash,
            email,
            key,
            state: "pending",
            attempts: 0,
            createdAt: now,
            expiresAt: new Date(now.getTime() + 600000),
          })
          .onConflictDoUpdate({
            target: challenges.browserHash,
            set: {
              email,
              key,
              state: "pending",
              attempts: 0,
              createdAt: now,
              expiresAt: new Date(now.getTime() + 600000),
            },
          });
        return { id, send: true, sent: false, verified: current?.emailVerified ?? false };
      });
    },
    async emailSent(browserHash: string, key: string, success: boolean) {
      await db
        .update(challenges)
        .set({ state: success ? "sent" : "failed" })
        .where(
          and(
            eq(challenges.browserHash, browserHash),
            eq(challenges.key, key),
            eq(challenges.state, "pending"),
          ),
        );
    },
    async beginVerification(browserHash: string, id: string) {
      return db.transaction(async (tx) => {
        const [request] = await tx
          .select()
          .from(requests)
          .where(and(eq(requests.id, id), eq(requests.browserHash, browserHash)))
          .limit(1);
        if (!request) fail();
        const [challenge] = await tx
          .select()
          .from(challenges)
          .where(eq(challenges.browserHash, browserHash))
          .for("update")
          .limit(1);
        if (
          !challenge ||
          challenge.email !== request.email ||
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
    async verifyOwner(browserHash: string, id: string, session: Session) {
      await db.transaction(async (tx) => {
        await lockProfileActor(tx, session);
        const [row] = await tx
          .select()
          .from(requests)
          .where(eq(requests.id, id))
          .for("update")
          .limit(1);
        // A verified mailbox and the request ID recover a guest request on another device.
        if (
          !row ||
          row.email.toLowerCase() !== session.email.toLowerCase() ||
          (row.userId && row.userId !== session.userId) ||
          (row.state === "draft" && row.browserHash !== browserHash)
        )
          fail();
        const items =
          row.state !== "draft" && !row.userId
            ? await createInsuranceProfiles(tx, session, row.items)
            : row.items;
        const [updated] = await tx
          .update(requests)
          .set({
            emailVerified: true,
            userId: session.userId,
            items,
            saveInWallet: row.state !== "draft" || row.saveInWallet,
          })
          .where(eq(requests.id, id))
          .returning();
        return dto(updated!);
      });
      return this.get(id, browserHash, session?.userId);
    },
    async price(input: InsuranceCart) {
      const items: InsuranceRequest["items"] = [];
      for (const person of input.items) {
        if (
          person.birthDate &&
          (Number(person.birthDate.slice(0, 4)) !== person.birthYear ||
            person.birthDate > new Date().toISOString().slice(0, 10))
        )
          fail("INSURANCE_REQUEST_INVALID", 422);
        const quoted = await quote(person);
        items.push({
          ...person,
          ...quoted,
          currentInsurerName: quoted.currentInsurerName ?? null,
          profileId: null,
        });
      }
      return items;
    },
    async save(
      browserHash: string,
      id: string,
      input: InsuranceCart,
      items: InsuranceRequest["items"],
      key: string,
      session?: Session,
    ) {
      return db.transaction(async (tx) => {
        if (session) await lockProfileActor(tx, session);
        const [row] = await tx
          .select()
          .from(requests)
          .where(
            and(
              eq(requests.id, id),
              owned(browserHash, session?.userId),
              eq(requests.state, "draft"),
            ),
          )
          .for("update")
          .limit(1);
        if (!row) fail();
        const actorId = `cart:${browserHash}`,
          hash = fingerprint(input);
        const [old] = await tx
          .select()
          .from(commands)
          .where(
            and(eq(commands.requestId, id), eq(commands.actorId, actorId), eq(commands.key, key)),
          )
          .limit(1);
        if (old) {
          if (old.hash !== hash) fail("INSURANCE_REQUEST_IDEMPOTENCY_REUSED", 422);
          return dto(row);
        }
        if (input.revision !== row.revision) fail("INSURANCE_REQUEST_CONFLICT", 409);
        const [updated] = await tx
          .update(requests)
          .set({
            items,
            draft: input,
            saveInWallet: input.saveInWallet,
            revision: row.revision + 1,
            updatedAt: new Date(),
          })
          .where(eq(requests.id, id))
          .returning();
        await tx
          .insert(commands)
          .values({ id: randomUUID(), requestId: id, actorId, key, hash, state: "draft" });
        return dto(updated!);
      });
    },
    async receipt(
      browserHash: string,
      id: string,
      input: InsuranceCart,
      key: string,
      session?: Session,
    ) {
      if (session) await db.transaction((tx) => lockProfileActor(tx, session));
      const [row] = await db
        .select()
        .from(requests)
        .where(and(eq(requests.id, id), owned(browserHash, session?.userId)))
        .limit(1);
      if (!row) fail();
      if (!row.submitKey) return null;
      if (row.submitKey !== key || row.submitHash !== fingerprint(input))
        fail("INSURANCE_REQUEST_IDEMPOTENCY_REUSED", 422);
      return this.get(id, browserHash, session?.userId);
    },
    async submit(
      browserHash: string,
      id: string,
      input: InsuranceCart,
      items: InsuranceRequest["items"],
      key: string,
      session?: Session,
    ) {
      if (!input.items.length) fail("INSURANCE_REQUEST_INVALID", 422);
      await db.transaction(async (tx) => {
        if (session) await lockProfileActor(tx, session);
        const [row] = await tx
          .select()
          .from(requests)
          .where(and(eq(requests.id, id), owned(browserHash, session?.userId)))
          .for("update")
          .limit(1);
        if (!row) fail();
        const hash = fingerprint(input);
        if (row.submitKey) {
          if (row.submitKey !== key || row.submitHash !== hash)
            fail("INSURANCE_REQUEST_IDEMPOTENCY_REUSED", 422);
          return dto(row);
        }
        if (row.state !== "draft") fail("INSURANCE_REQUEST_CONFLICT", 409);
        if (input.saveInWallet && (!session || session.userId !== row.userId || !row.emailVerified))
          fail("INSURANCE_REQUEST_EMAIL_REQUIRED", 422);
        if (
          fingerprint(row.items.map((x) => [x.id, x.offer.id, x.offer.monthlyPremiumMinor])) !==
          fingerprint(items.map((x) => [x.id, x.offer.id, x.offer.monthlyPremiumMinor]))
        )
          fail("INSURANCE_REQUEST_PRICE_CHANGED", 409);
        const finalItems =
          input.saveInWallet && session ? await createInsuranceProfiles(tx, session, items) : items;
        const now = new Date();
        const [updated] = await tx
          .update(requests)
          .set({
            items: finalItems,
            userId: input.saveInWallet ? session!.userId : null,
            state: "submitted",
            revision: row.revision + 1,
            saveInWallet: input.saveInWallet,
            legalVersion,
            submitKey: key,
            submitHash: hash,
            history: [{ state: "submitted", at: now.toISOString() }],
            submittedAt: now,
            updatedAt: now,
            draft: null,
          })
          .where(eq(requests.id, id))
          .returning();
        return dto(updated!);
      });
      return this.get(id, browserHash, session?.userId);
    },
    async get(id: string, browserHash: string, userId?: string, admin = false) {
      const [row] = await db
        .select(admin ? getTableColumns(requests) : projection(userId))
        .from(requests)
        .where(and(eq(requests.id, id), admin ? undefined : readable(browserHash, userId)))
        .limit(1);
      if (!row) fail();
      return dto(row);
    },
    async list(query: InsuranceRequestListQuery, userId?: string, admin = false) {
      if (!admin && !userId) fail();
      let cursor: z.infer<typeof cursorSchema> | undefined;
      try {
        if (query.cursor)
          cursor = cursorSchema.parse(
            JSON.parse(Buffer.from(query.cursor, "base64url").toString()),
          );
      } catch {
        fail("INSURANCE_REQUEST_INVALID", 400);
      }
      const rows = await db
        .select(admin ? getTableColumns(requests) : projection(userId))
        .from(requests)
        .where(
          and(
            admin ? undefined : readable("", userId),
            query.state ? eq(requests.state, query.state) : sql`${requests.state} <> 'draft'`,
            query.profileId
              ? sql`exists (select 1 from jsonb_array_elements(${admin ? requests.items : visibleItems(userId)}) item where item->>'profileId'=${query.profileId})`
              : undefined,
            cursor
              ? or(
                  lt(requests.createdAt, new Date(cursor.at)),
                  and(eq(requests.createdAt, new Date(cursor.at)), lt(requests.id, cursor.id)),
                )
              : undefined,
          ),
        )
        .orderBy(desc(requests.createdAt), desc(requests.id))
        .limit(26);
      const page = rows.slice(0, 25);
      const last = page.at(-1);
      return {
        requests: page.map(dto),
        nextCursor:
          rows.length > 25 && last
            ? Buffer.from(
                JSON.stringify({ at: last.createdAt.toISOString(), id: last.id }),
              ).toString("base64url")
            : null,
      };
    },
    async transition(
      id: string,
      input: InsuranceTransitionInput,
      key: string,
      actor: ProfileActor,
    ) {
      return db.transaction(async (tx) => {
        // The administrator's own profile lock rechecks permission and MFA inside the transaction, including guest requests.
        await lockProfileActor(tx, { ...actor, administratorUserId: actor.userId });
        const [row] = await tx
          .select()
          .from(requests)
          .where(eq(requests.id, id))
          .for("update")
          .limit(1);
        if (!row) fail();
        const hash = fingerprint(input);
        const [old] = await tx
          .select()
          .from(commands)
          .where(
            and(
              eq(commands.requestId, id),
              eq(commands.actorId, actor.userId),
              eq(commands.key, key),
            ),
          )
          .limit(1);
        if (old) {
          if (old.hash !== hash) fail("INSURANCE_REQUEST_IDEMPOTENCY_REUSED", 422);
          return dto(row);
        }
        const sequence = [
          "submitted",
          "reviewing",
          "insurer_contacted",
          "offer_ready",
          "completed",
        ];
        const next = sequence[sequence.indexOf(row.state) + 1];
        if (
          input.revision !== row.revision ||
          ["draft", "completed", "cancelled"].includes(row.state) ||
          (input.state !== "cancelled" && input.state !== next)
        )
          fail("INSURANCE_REQUEST_CONFLICT", 409);
        const now = new Date();
        const [updated] = await tx
          .update(requests)
          .set({
            state: input.state,
            revision: row.revision + 1,
            updatedAt: now,
            history: [...row.history, { state: input.state, at: now.toISOString() }],
          })
          .where(eq(requests.id, id))
          .returning();
        await tx.insert(commands).values({
          id: randomUUID(),
          requestId: id,
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
