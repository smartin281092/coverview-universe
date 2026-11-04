import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  pensionSearchDetailsSchema,
  type PensionSearchDetailsInput,
} from "@coverview/contracts/pension-searches";
import { createDatabase } from "./db/database.js";
import { parseEnvironment } from "./config.js";
import { buildServer } from "./server.js";
import { createIdentityRepository } from "../modules/identity/identity.repository.js";
import { identityAdminPermissions, identitySessions } from "../modules/identity/identity.schema.js";
import { pensionSearchChallenges } from "../modules/pension-searches/pension-searches.schema.js";
import {
  createPensionSearchRepository,
  fingerprint,
  pensionSearchMandateVersion,
} from "../modules/pension-searches/pension-searches.repository.js";
let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let repository: ReturnType<typeof createPensionSearchRepository>;
// Fictitious person (ENV-09); the AVS number only passes the syntax check (756 + EAN-13 key).
const input: PensionSearchDetailsInput = {
  firstName: "Camille",
  lastName: "Exemple",
  previousNames: "Camille Test",
  birthDate: "1985-04-12",
  sex: "female",
  nationality: "Suisse",
  avsNumber: "756.1234.5678.97",
  street: "Rue Fictive 1",
  postalCode: "1200",
  city: "Genève",
  country: "Suisse",
  phone: "",
  situation: "job_change",
  employers: [{ name: "Entreprise fictive SA", city: "Lausanne", fromYear: 2008, toYear: 2014 }],
};
const details = () => pensionSearchDetailsSchema.parse(input);
async function session(email: string) {
  const result = await createIdentityRepository(database.db).createSession({
    workosUserId: `test_${randomUUID()}`,
    email,
    workosSessionId: `session_${randomUUID()}`,
    tokenHash: fingerprint(randomUUID()),
    device: "Isolated automated test",
    expiresAt: new Date(Date.now() + 3600000),
    loginStartedAt: new Date(Date.now() - 1000),
    requestId: randomUUID(),
  });
  if (!result) throw new Error("Session fixture missing");
  return result;
}
async function administrator(email: string) {
  const admin = await session(email);
  await database.db.insert(identityAdminPermissions).values({
    id: randomUUID(),
    userId: admin.userId,
    permission: "administration.access",
    evidence: "Isolated PostgreSQL pension search test",
  });
  await database.db
    .update(identitySessions)
    .set({ mfaVerifiedAt: new Date() })
    .where(eq(identitySessions.id, admin.id));
  return admin;
}
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_pension_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  await migrate(database.db, {
    migrationsFolder: fileURLToPath(new URL("../../drizzle/", import.meta.url)),
  });
  repository = createPensionSearchRepository(database.db);
});
afterAll(async () => {
  await database?.pool.end();
  await container?.stop();
});

it("rejects an AVS number with a wrong check digit and keeps the canonical format", () => {
  expect(details().avsNumber).toBe("756.1234.5678.97");
  expect(
    pensionSearchDetailsSchema.safeParse({ ...input, avsNumber: "7561234567898" }).success,
  ).toBe(false);
  expect(
    pensionSearchDetailsSchema.safeParse({
      ...input,
      birthDate: new Date().toISOString().slice(0, 10),
    }).success,
  ).toBe(false);
});

it("protects HTTP mutations by host, origin, CSRF and command key, and reads only with a session", async () => {
  const example = parseEnv(
    readFileSync(new URL("../../../../.env.example", import.meta.url), "utf8"),
  );
  const config = parseEnvironment({
    ...example,
    DATABASE_URL: container.getConnectionUri(),
    AUTH_ENABLED: "false",
    DOCUMENTS_ENABLED: "false",
    LOG_LEVEL: "silent",
  });
  const app = await buildServer(config, {
    checkReadiness: () => Promise.resolve(true),
    readPersonas: () => Promise.resolve([]),
    close: () => Promise.resolve(),
  });
  try {
    const host = new URL(config.AUTH_API_ORIGIN).host,
      origin = config.AUTH_WWW_ORIGIN;
    expect(
      (
        await app.inject({
          url: "/pension-searches/browser",
          headers: { host, origin: "https://foreign.test" },
        })
      ).statusCode,
    ).toBe(403);
    const browser = await app.inject({
      url: "/pension-searches/browser",
      headers: { host, origin },
    });
    expect(browser.statusCode).toBe(200);
    expect(browser.json()).toMatchObject({ authEnabled: false, accountEmail: null });
    const cookie = String(browser.headers["set-cookie"]).split(";")[0]!,
      csrf = browser.json<{ csrfToken: string }>().csrfToken;
    expect(cookie).toMatch(/^cv_pension=/);
    const headers = { host, origin, cookie, "x-csrf-token": csrf, "idempotency-key": randomUUID() };
    const payload = { email: `${randomUUID()}@fixture.test` };
    for (const bad of [
      { ...headers, host: "foreign.test" },
      { ...headers, origin: "https://foreign.test" },
      { ...headers, "x-csrf-token": "bad" },
      { ...headers, "x-csrf-token": "é".repeat(64) },
      { ...headers, cookie: "" },
    ])
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/pension-searches/email",
            headers: bad,
            payload,
          })
        ).statusCode,
      ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/pension-searches/email",
          headers: { ...headers, "idempotency-key": "not-a-key" },
          payload,
        })
      ).statusCode,
    ).toBe(400);
    // Without the identity provider no code can be sent: said explicitly, never a false success.
    const email = await app.inject({
      method: "POST",
      url: "/pension-searches/email",
      headers,
      payload,
    });
    expect(email.statusCode, email.body).toBe(200);
    expect(email.json()).toEqual({ codeStatus: "unavailable", verified: false });
    const order = { details: input, mandate: true };
    // Ordering and reading always take an account session.
    expect(
      (await app.inject({ method: "POST", url: "/pension-searches", headers, payload: order }))
        .statusCode,
    ).toBe(503);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/pension-searches",
          headers,
          payload: { ...order, mandate: false },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await app.inject({ url: "/pension-searches", headers: { host, cookie } })).statusCode,
    ).toBe(503);
    expect(
      (await app.inject({ url: "/pension-searches", headers: { host: "foreign.test", cookie } }))
        .statusCode,
    ).toBe(403);
    expect(
      (await app.inject({ url: "/admin/pension-searches", headers: { host, cookie } })).statusCode,
    ).toBe(503);
  } finally {
    await app.close();
  }
});

it("limits email codes to one a minute per mailbox, five attempts and ten minutes", async () => {
  const browser = fingerprint(randomUUID()),
    other = fingerprint(randomUUID()),
    email = `${randomUUID()}@fixture.test`,
    key = randomUUID();
  expect(await repository.email(browser, email, key)).toEqual({
    send: true,
    sent: false,
    verified: false,
  });
  // A replayed command does not send a second code; reusing its key for another address is refused.
  expect(await repository.email(browser, email, key)).toMatchObject({ send: false });
  await expect(repository.email(browser, `x${email}`, key)).rejects.toMatchObject({
    code: "PENSION_SEARCH_IDEMPOTENCY_REUSED",
  });
  await expect(repository.email(other, email, randomUUID())).rejects.toMatchObject({
    code: "IDENTITY_RATE_LIMITED",
  });
  // A code not sent cannot be verified.
  await expect(repository.beginVerification(browser)).rejects.toMatchObject({
    code: "IDENTITY_INVALID_CALLBACK",
  });
  await repository.emailSent(browser, key, true);
  for (let attempt = 0; attempt < 5; attempt++) {
    const challenge = await repository.beginVerification(browser);
    expect(challenge.email).toBe(email);
    await repository.finishVerification(browser, key, false);
  }
  await expect(repository.beginVerification(browser)).rejects.toMatchObject({
    code: "IDENTITY_INVALID_CALLBACK",
  });
  // An expired code is refused too, and a consumed one cannot be replayed.
  const late = fingerprint(randomUUID()),
    lateKey = randomUUID();
  await repository.email(late, `late-${email}`, lateKey);
  await repository.emailSent(late, lateKey, true);
  await database.db
    .update(pensionSearchChallenges)
    .set({ expiresAt: new Date(Date.now() - 1000) })
    .where(eq(pensionSearchChallenges.browserHash, late));
  await expect(repository.beginVerification(late)).rejects.toMatchObject({
    code: "IDENTITY_INVALID_CALLBACK",
  });
  const fresh = fingerprint(randomUUID()),
    freshKey = randomUUID();
  await repository.email(fresh, `fresh-${email}`, freshKey);
  await repository.emailSent(fresh, freshKey, true);
  await repository.beginVerification(fresh);
  await repository.finishVerification(fresh, freshKey, true);
  await expect(repository.beginVerification(fresh)).rejects.toMatchObject({
    code: "IDENTITY_INVALID_CALLBACK",
  });
  // A connected account with the same address needs no code at all.
  const owner = await session(`owner-${email}`);
  expect(
    await repository.email(fingerprint(randomUUID()), `owner-${email}`, randomUUID(), owner),
  ).toEqual({
    send: false,
    sent: false,
    verified: true,
  });
});

it("records one search per order key for its account, readable by its owner only", async () => {
  const email = `${randomUUID()}@fixture.test`;
  const owner = await session(email),
    outsider = await session(`other-${email}`);
  const key = randomUUID();
  const [first, second] = await Promise.all([
    repository.submit(owner, details(), key),
    repository.submit(owner, details(), key),
  ]);
  expect(second.id).toBe(first.id);
  expect(first).toMatchObject({
    email,
    state: "submitted",
    revision: 0,
    mandateVersion: pensionSearchMandateVersion,
    history: [{ state: "submitted" }],
  });
  expect(first.details.employers).toHaveLength(1);
  await expect(
    repository.submit(owner, { ...details(), city: "Lausanne" }, key),
  ).rejects.toMatchObject({ code: "PENSION_SEARCH_IDEMPOTENCY_REUSED" });
  expect((await repository.get(first.id, owner.userId)).id).toBe(first.id);
  await expect(repository.get(first.id, outsider.userId)).rejects.toMatchObject({
    code: "PENSION_SEARCH_NOT_FOUND",
  });
  await expect(repository.get(first.id, undefined)).rejects.toMatchObject({ statusCode: 404 });
  expect((await repository.list({}, outsider.userId)).searches).toHaveLength(0);
  const another = await repository.submit(owner, details(), randomUUID());
  const page = await repository.list({}, owner.userId);
  expect(page.searches.map((item) => item.id)).toEqual([another.id, first.id]);
  expect(page.nextCursor).toBeNull();
});

it("moves a search one step at a time by an administrator with MFA, with replay and conflicts", async () => {
  const email = `${randomUUID()}@fixture.test`;
  const owner = await session(email);
  const admin = await administrator(`admin-${email}`);
  const actor = { id: admin.id, userId: admin.userId };
  const search = await repository.submit(owner, details(), randomUUID());
  const key = randomUUID();
  const reviewing = await repository.transition(
    search.id,
    { state: "reviewing", revision: 0 },
    key,
    actor,
  );
  expect(reviewing).toMatchObject({ state: "reviewing", revision: 1 });
  // The same command replayed changes nothing.
  expect(
    await repository.transition(search.id, { state: "reviewing", revision: 0 }, key, actor),
  ).toMatchObject({ state: "reviewing", revision: 1 });
  await expect(
    repository.transition(search.id, { state: "completed", revision: 1 }, key, actor),
  ).rejects.toMatchObject({ code: "PENSION_SEARCH_IDEMPOTENCY_REUSED" });
  // No skipped step, no stale revision.
  await expect(
    repository.transition(search.id, { state: "completed", revision: 1 }, randomUUID(), actor),
  ).rejects.toMatchObject({ code: "PENSION_SEARCH_CONFLICT" });
  await expect(
    repository.transition(search.id, { state: "search_sent", revision: 0 }, randomUUID(), actor),
  ).rejects.toMatchObject({ code: "PENSION_SEARCH_CONFLICT" });
  let current = reviewing;
  for (const state of ["search_sent", "results_received", "completed"] as const)
    current = await repository.transition(
      search.id,
      { state, revision: current.revision },
      randomUUID(),
      actor,
    );
  expect(current.history.map((event) => event.state)).toEqual([
    "submitted",
    "reviewing",
    "search_sent",
    "results_received",
    "completed",
  ]);
  await expect(
    repository.transition(
      search.id,
      { state: "cancelled", revision: current.revision },
      randomUUID(),
      actor,
    ),
  ).rejects.toMatchObject({ code: "PENSION_SEARCH_CONFLICT" });
  // The owner reads the same steps; the admin list filters by state.
  expect((await repository.get(search.id, owner.userId)).state).toBe("completed");
  expect(
    (await repository.list({ state: "completed" }, undefined, true)).searches.some(
      (item) => item.id === search.id,
    ),
  ).toBe(true);
  // Without MFA, or without the permission, the transaction refuses the transition.
  const cancelled = await repository.submit(owner, details(), randomUUID());
  await database.db
    .update(identitySessions)
    .set({ mfaVerifiedAt: null })
    .where(eq(identitySessions.id, admin.id));
  await expect(
    repository.transition(cancelled.id, { state: "cancelled", revision: 0 }, randomUUID(), actor),
  ).rejects.toBeTruthy();
  const plain = await session(`plain-${email}`);
  await expect(
    repository.transition(cancelled.id, { state: "cancelled", revision: 0 }, randomUUID(), {
      id: plain.id,
      userId: plain.userId,
    }),
  ).rejects.toBeTruthy();
  expect((await repository.get(cancelled.id, owner.userId)).state).toBe("submitted");
});
