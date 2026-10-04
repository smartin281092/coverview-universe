import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { InsuranceCart, InsurancePerson } from "@coverview/contracts/insurance-requests";
import { createDatabase } from "./db/database.js";
import { parseEnvironment } from "./config.js";
import { buildServer } from "./server.js";
import { createIdentityRepository } from "../modules/identity/identity.repository.js";
import { identityAdminPermissions, identitySessions } from "../modules/identity/identity.schema.js";
import { managedProfiles, managedProfileSections } from "../modules/profiles/profiles.schema.js";
import { healthDatasets, healthInsurers } from "../modules/health-insurance/health.schema.js";
import {
  healthForeignDatasets,
  healthForeignPremiums,
} from "../modules/health-insurance/health.foreign.schema.js";
import { createHealthRepository } from "../modules/health-insurance/health.repository.js";
import { createAdminProfileTransferRepository } from "./admin-profile-transfer.repository.js";
import {
  insuranceRequests,
  insuranceEmailChallenges,
  insuranceEmailReservations,
} from "../modules/insurance-requests/insurance-requests.schema.js";
import {
  createInsuranceRequestRepository,
  fingerprint,
} from "../modules/insurance-requests/insurance-requests.repository.js";
let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let repository: ReturnType<typeof createInsuranceRequestRepository>;
it("protects HTTP mutations by host, origin, CSRF, command key and browser ownership", async () => {
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
    const browser = await app.inject({
      url: "/insurance-requests/browser",
      headers: { host, origin },
    });
    expect(browser.statusCode).toBe(200);
    const cookie = String(browser.headers["set-cookie"]).split(";")[0]!,
      csrf = browser.json<{ csrfToken: string }>().csrfToken;
    const headers = { host, origin, cookie, "x-csrf-token": csrf, "idempotency-key": randomUUID() };
    const payload = { email: `${randomUUID()}@fixture.test`, access: "guest" };
    for (const bad of [
      { ...headers, host: "foreign.test" },
      { ...headers, origin: "https://foreign.test" },
      { ...headers, "x-csrf-token": "bad" },
      { ...headers, "x-csrf-token": "é".repeat(64) },
      { ...headers, cookie: "" },
    ]) {
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/insurance-requests/email",
            headers: bad,
            payload,
          })
        ).statusCode,
      ).toBe(403);
    }
    const result = await app.inject({
      method: "POST",
      url: "/insurance-requests/email",
      headers,
      payload,
    });
    expect(result.statusCode, result.body).toBe(200);
    expect(result.json()).toMatchObject({ codeStatus: "not_requested", verified: false });
    expect(
      await database.db
        .select()
        .from(insuranceEmailChallenges)
        .where(eq(insuranceEmailChallenges.email, payload.email)),
    ).toHaveLength(0);
    const id = result.json<{ id: string }>().id;
    expect(
      (await app.inject({ url: `/insurance-requests/${id}`, headers: { host, cookie } }))
        .statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ url: `/insurance-requests/${id}`, headers: { host } })).statusCode,
    ).toBe(403);
    expect(
      (await app.inject({ url: "/admin/insurance-requests", headers: { host, cookie } }))
        .statusCode,
    ).toBe(503);
  } finally {
    await app.close();
  }
});
const quote = (person: InsurancePerson) =>
  Promise.resolve({
    offer: {
      id: `premium_${person.deductible}`,
      modelId: person.modelId,
      insurerId: 1,
      insurerName: "Test insurer",
      name: "Test model",
      category: "BASE" as const,
      regionId: "VD-1",
      monthlyPremiumMinor: person.deductible === 300 ? 50000 : 40000,
      deductible: person.deductible,
      accident: person.accident,
      ageGroup: "adult" as const,
      restricted: false,
      eligibility: "region" as const,
    },
    locality: {
      id: person.localityId,
      postalCode: "1003",
      locality: "Lausanne",
      municipality: "Lausanne",
      municipalityId: 5586,
      canton: "VD",
      regionId: "VD-1",
    },
  });
const cart = (saveInWallet = false): InsuranceCart => ({
  revision: 0,
  saveInWallet,
  items: [
    {
      id: randomUUID(),
      firstName: "Test",
      lastName: "Parent",
      sex: "female",
      birthYear: 1990,
      currentInsurerId: null,
      modelId: "model_fixture",
      localityId: "locality_fixture",
      accident: true,
      deductible: 2500,
    },
    {
      id: randomUUID(),
      firstName: "Test",
      lastName: "Proche",
      sex: "male",
      birthYear: 1992,
      currentInsurerId: null,
      modelId: "model_fixture",
      localityId: "locality_fixture",
      accident: false,
      deductible: 300,
    },
  ],
});
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
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_insurance_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  await migrate(database.db, {
    migrationsFolder: fileURLToPath(new URL("../../drizzle/", import.meta.url)),
  });
  repository = createInsuranceRequestRepository(database.db, quote);
});
afterAll(async () => {
  await database?.pool.end();
  await container?.stop();
});
it("quotes foreign offers from PostgreSQL, rejects wrong deductibles and creates country-only Wallet profiles", async () => {
  await database.db
    .insert(healthDatasets)
    .values({ id: "foreign_test_swiss", year: 2027, active: true, sources: [], counts: {} });
  await database.db
    .insert(healthInsurers)
    .values({ id: 987654, name: "Fictional cross-border insurer" });
  await database.db
    .insert(healthForeignDatasets)
    .values({
      id: "foreign_test",
      year: 2027,
      active: true,
      sourceUrl: "https://example.test/fictional.csv",
      sha256: "a".repeat(64),
    });
  await database.db.insert(healthForeignPremiums).values([
    {
      id: "foreign_test_adult",
      datasetId: "foreign_test",
      insurerId: 987654,
      country: "FR",
      ageGroup: "adult",
      ageSubgroup: "E1",
      accident: true,
      deductible: 300,
      monthlyPremiumMinor: 23456,
      raw: {},
    },
    {
      id: "foreign_test_child",
      datasetId: "foreign_test",
      insurerId: 987654,
      country: "FR",
      ageGroup: "child",
      ageSubgroup: "K1",
      accident: true,
      deductible: 0,
      monthlyPremiumMinor: 5678,
      raw: {},
    },
  ]);
  const health = createHealthRepository(database.pool),
    foreignRequests = createInsuranceRequestRepository(database.db, health.quote);
  const input = cart(true);
  input.items = input.items
    .slice(0, 1)
    .map((person) => ({
      ...person,
      modelId: "hfm_2027_987654",
      localityId: "hfl_FR",
      deductible: 300,
      accident: true,
    }));
  const priced = await foreignRequests.price(input);
  expect(priced[0]?.offer).toMatchObject({
    monthlyPremiumMinor: 23456,
    residenceCountry: "FR",
    regionId: "EU-FR",
  });
  const person = input.items[0]!;
  await expect(health.quote({ ...person, deductible: 2500 })).rejects.toMatchObject({
    statusCode: 422,
  });
  await expect(health.quote({ ...person, localityId: "hfl_DE" })).rejects.toMatchObject({
    statusCode: 422,
  });
  await expect(health.quote({ ...person, modelId: "hfm_2026_987654" })).rejects.toMatchObject({
    statusCode: 422,
  });
  expect(
    (await health.quote({ ...person, birthYear: 2020, deductible: 0 })).offer.monthlyPremiumMinor,
  ).toBe(5678);
  const browser = fingerprint(randomUUID()),
    email = `foreign-${randomUUID()}@fixture.test`,
    owner = await session(email);
  const draft = await foreignRequests.email(browser, email, randomUUID(), owner, "wallet");
  await foreignRequests.save(browser, draft.id, input, priced, randomUUID(), owner);
  const submitted = await foreignRequests.submit(
    browser,
    draft.id,
    input,
    priced,
    randomUUID(),
    owner,
  );
  expect(submitted.state).toBe("submitted");
  expect(submitted.items[0]?.locality).toMatchObject({ country: "FR", municipalityId: null });
  const sections = await database.db
    .select()
    .from(managedProfileSections)
    .where(eq(managedProfileSections.managedProfileId, submitted.items[0]!.profileId!));
  const general = sections.find((s) => s.section === "general")?.values;
  expect(general).toMatchObject({ country: "FR", firstName: person.firstName });
  expect(general).not.toHaveProperty("city");
  expect(general).not.toHaveProperty("postalCode");
});
it("keeps guest email separate from identity and upgrades the same cart only after mailbox proof", async () => {
  const browser = fingerprint(randomUUID()),
    email = `${randomUUID()}@fixture.test`;
  const owner = await session(email);
  const guest = await repository.email(browser, email, randomUUID(), owner, "guest");
  expect(guest).toMatchObject({ send: false, sent: false, verified: false });
  expect(
    await database.db
      .select()
      .from(insuranceEmailChallenges)
      .where(eq(insuranceEmailChallenges.browserHash, browser)),
  ).toHaveLength(0);
  expect(
    await database.db
      .select()
      .from(insuranceEmailReservations)
      .where(eq(insuranceEmailReservations.emailHash, fingerprint(email))),
  ).toHaveLength(0);
  const input = cart(),
    items = await repository.price(input);
  const saved = await repository.save(browser, guest.id, input, items, randomUUID(), owner);
  expect((await repository.get(guest.id, browser)).items).toHaveLength(2);
  // Knowing an existing account's email alone never attaches the request to that account.
  const challenge = await repository.email(browser, email, randomUUID(), undefined, "wallet");
  expect(challenge).toMatchObject({ id: guest.id, send: true, verified: false });
  expect((await repository.list({}, owner.userId)).requests).toHaveLength(0);
  const connected = await repository.email(browser, email, randomUUID(), owner, "wallet");
  expect(connected).toMatchObject({ id: guest.id, send: false, sent: false, verified: true });
  const restored = await repository.get(guest.id, browser, owner.userId);
  expect(restored).toMatchObject({
    revision: saved.revision,
    saveInWallet: true,
    emailVerified: true,
  });
  expect(restored.items).toEqual(saved.items);
  await expect(repository.get(guest.id, browser)).rejects.toMatchObject({ statusCode: 404 });
});
it("never accepts a different or revoked Wallet session as proof for the chosen mailbox", async () => {
  const browser = fingerprint(randomUUID()),
    email = `${randomUUID()}@fixture.test`;
  const other = await session(`other-${email}`);
  const result = await repository.email(browser, email, randomUUID(), other, "wallet");
  expect(result).toMatchObject({ send: true, verified: false });
  expect((await repository.list({}, other.userId)).requests).toHaveLength(0);
  const owner = await session(email);
  await database.db
    .update(identitySessions)
    .set({ revokedAt: new Date() })
    .where(eq(identitySessions.id, owner.id));
  await expect(
    repository.email(browser, email, randomUUID(), owner, "wallet"),
  ).rejects.toMatchObject({ statusCode: 401 });
});
it("isolates guest drafts and requests, replays a concurrent submission once, and protects prices", async () => {
  const browser = fingerprint(randomUUID()),
    input = cart(),
    email = `${randomUUID()}@fixture.test`,
    key = randomUUID();
  const draft = await repository.email(browser, email, randomUUID());
  const items = await repository.price(input);
  await repository.save(browser, draft.id, input, items, randomUUID());
  await expect(repository.get(draft.id, fingerprint(randomUUID()))).rejects.toMatchObject({
    statusCode: 404,
  });
  await expect(
    repository.submit(
      browser,
      draft.id,
      input,
      items.map((item) => ({ ...item, offer: { ...item.offer, monthlyPremiumMinor: 1 } })),
      key,
    ),
  ).rejects.toMatchObject({ code: "INSURANCE_REQUEST_PRICE_CHANGED" });
  const submitted = await Promise.all(
    Array.from({ length: 4 }, () => repository.submit(browser, draft.id, input, items, key)),
  );
  expect(new Set(submitted.map((x) => x.id)).size).toBe(1);
  expect(submitted[0]).toMatchObject({ state: "submitted", totalMonthlyMinor: 90000, revision: 2 });
  expect(submitted[0]!.history).toHaveLength(1);
  await expect(
    repository.submit(browser, draft.id, { ...input, saveInWallet: true }, items, key),
  ).rejects.toMatchObject({ code: "INSURANCE_REQUEST_IDEMPOTENCY_REUSED" });
  const other = await session(`other-${email}`);
  await expect(repository.verifyOwner(browser, draft.id, other)).rejects.toMatchObject({
    statusCode: 404,
  });
  expect((await repository.list({}, other.userId)).requests).toHaveLength(0);
});
it("requires email proof, creates family profiles atomically, and refuses a revoked owner", async () => {
  const browser = fingerprint(randomUUID()),
    email = `${randomUUID()}@fixture.test`,
    input = cart(true),
    draft = await repository.email(browser, email, randomUUID());
  const owner = await session(email),
    items = await repository.price(input),
    key = randomUUID();
  await repository.save(browser, draft.id, input, items, randomUUID());
  await expect(
    repository.submit(browser, draft.id, input, items, key, owner),
  ).rejects.toMatchObject({ code: "INSURANCE_REQUEST_EMAIL_REQUIRED" });
  await repository.verifyOwner(browser, draft.id, owner);
  const result = await repository.submit(browser, draft.id, input, items, key, owner);
  const replay = await repository.submit(browser, draft.id, input, items, key, owner);
  expect(replay.items.map((x) => x.profileId)).toEqual(result.items.map((x) => x.profileId));
  const profiles = await database.db
    .select()
    .from(managedProfiles)
    .where(eq(managedProfiles.userId, owner.userId));
  expect(profiles).toHaveLength(2);
  expect(
    result.items.every((item) => profiles.some((profile) => profile.id === item.profileId)),
  ).toBe(true);
  await expect(repository.get(draft.id, browser)).rejects.toMatchObject({ statusCode: 404 });
  expect((await repository.list({}, owner.userId)).requests).toHaveLength(1);
  await database.db
    .update(identitySessions)
    .set({ revokedAt: new Date() })
    .where(eq(identitySessions.id, owner.id));
  await expect(
    repository.submit(browser, draft.id, input, items, key, owner),
  ).rejects.toMatchObject({ statusCode: 401 });
});
it("reserves an OTP once, bounds attempts, expires challenges and rate limits by mailbox", async () => {
  const browser = fingerprint(randomUUID()),
    email = `${randomUUID()}@fixture.test`,
    key = randomUUID();
  const draft = await repository.email(browser, email, key);
  expect(draft.send).toBe(true);
  expect((await repository.email(browser, email, key)).send).toBe(false);
  await expect(
    repository.email(fingerprint(randomUUID()), email, randomUUID()),
  ).rejects.toMatchObject({ statusCode: 429 });
  await repository.emailSent(browser, key, true);
  const reserved = await Promise.allSettled([
    repository.beginVerification(browser, draft.id),
    repository.beginVerification(browser, draft.id),
  ]);
  expect(reserved.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  await repository.finishVerification(browser, key, false);
  for (let i = 1; i < 5; i++) {
    await repository.beginVerification(browser, draft.id);
    await repository.finishVerification(browser, key, false);
  }
  await expect(repository.beginVerification(browser, draft.id)).rejects.toMatchObject({
    statusCode: 400,
  });
});
it("records only ordered administrator transitions with fresh permission and MFA", async () => {
  const browser = fingerprint(randomUUID()),
    input = cart(),
    draft = await repository.email(browser, `${randomUUID()}@fixture.test`, randomUUID()),
    items = await repository.price(input);
  await repository.save(browser, draft.id, input, items, randomUUID());
  await repository.submit(browser, draft.id, input, items, randomUUID());
  const admin = await session(`${randomUUID()}@fixture.test`),
    key = randomUUID();
  await expect(
    repository.transition(draft.id, { state: "reviewing", revision: 2 }, key, admin),
  ).rejects.toMatchObject({ statusCode: 403 });
  const permission = randomUUID();
  await database.db.insert(identityAdminPermissions).values({
    id: permission,
    userId: admin.userId,
    permission: "administration.access",
    evidence: "Isolated test only",
  });
  await expect(
    repository.transition(draft.id, { state: "reviewing", revision: 2 }, key, admin),
  ).rejects.toMatchObject({ code: "IDENTITY_MFA_REQUIRED" });
  await database.db
    .update(identitySessions)
    .set({ mfaVerifiedAt: new Date() })
    .where(eq(identitySessions.id, admin.id));
  await expect(
    repository.transition(draft.id, { state: "completed", revision: 2 }, randomUUID(), admin),
  ).rejects.toMatchObject({ statusCode: 409 });
  const changed = await repository.transition(
    draft.id,
    { state: "reviewing", revision: 2 },
    key,
    admin,
  );
  expect(changed.state).toBe("reviewing");
  expect(changed.history).toHaveLength(2);
  expect(
    (await repository.transition(draft.id, { state: "reviewing", revision: 2 }, key, admin))
      .history,
  ).toHaveLength(2);
  await database.db
    .update(identityAdminPermissions)
    .set({ revokedAt: new Date() })
    .where(eq(identityAdminPermissions.id, permission));
  await expect(
    repository.transition(
      draft.id,
      { state: "insurer_contacted", revision: 3 },
      randomUUID(),
      admin,
    ),
  ).rejects.toMatchObject({ statusCode: 403 });
});
it("expires guest access and allows verified recovery without exposing a claimed request", async () => {
  const browser = fingerprint(randomUUID()),
    email = `${randomUUID()}@fixture.test`,
    input = cart(),
    draft = await repository.email(browser, email, randomUUID()),
    items = await repository.price(input);
  await repository.save(browser, draft.id, input, items, randomUUID());
  await repository.submit(browser, draft.id, input, items, randomUUID());
  await database.db
    .update(insuranceRequests)
    .set({ createdAt: new Date(Date.now() - 31 * 86400000) })
    .where(eq(insuranceRequests.id, draft.id));
  await expect(repository.get(draft.id, browser)).rejects.toMatchObject({ statusCode: 404 });
  const owner = await session(email);
  const recovered = await repository.verifyOwner(fingerprint(randomUUID()), draft.id, owner);
  expect(recovered.saveInWallet).toBe(true);
  expect(recovered.items.every((x) => x.profileId)).toBe(true);
});
it("rejects stale cart writes, replays saved commands, and keeps mailbox throttling across address changes", async () => {
  const browser = fingerprint(randomUUID()),
    email = `${randomUUID()}@fixture.test`,
    input = cart(),
    draft = await repository.email(browser, email, randomUUID()),
    items = await repository.price(input),
    key = randomUUID();
  const saved = await repository.save(browser, draft.id, input, items, key);
  expect(saved.revision).toBe(1);
  expect((await repository.save(browser, draft.id, input, items, key)).revision).toBe(1);
  await expect(
    repository.save(browser, draft.id, input, items, randomUUID()),
  ).rejects.toMatchObject({ statusCode: 409 });
  await repository.email(browser, `${randomUUID()}@fixture.test`, randomUUID());
  await expect(repository.email(browser, email, randomUUID())).rejects.toMatchObject({
    statusCode: 429,
  });
});
it("lets another signed-out person start a draft without exposing the verified draft", async () => {
  const browser = fingerprint(randomUUID()),
    email = `${randomUUID()}@fixture.test`,
    draft = await repository.email(browser, email, randomUUID()),
    owner = await session(email);
  await repository.verifyOwner(browser, draft.id, owner);
  expect(await repository.draft(browser)).toBeNull();
  const next = await repository.email(browser, `${randomUUID()}@fixture.test`, randomUUID());
  expect(next.id).not.toBe(draft.id);
  await expect(repository.get(draft.id, browser)).rejects.toMatchObject({ statusCode: 404 });
});
it("moves only the transferred person's private tracking, including submission receipts", async () => {
  const browser = fingerprint(randomUUID()),
    email = `${randomUUID()}@fixture.test`,
    owner = await session(email),
    destination = await session(`${randomUUID()}@fixture.test`),
    admin = await session(`${randomUUID()}@fixture.test`);
  const input = cart(true),
    draft = await repository.email(browser, email, randomUUID()),
    items = await repository.price(input),
    key = randomUUID();
  await repository.save(browser, draft.id, input, items, randomUUID());
  await repository.verifyOwner(browser, draft.id, owner);
  const submitted = await repository.submit(browser, draft.id, input, items, key, owner);
  await database.db.insert(identityAdminPermissions).values({
    id: randomUUID(),
    userId: admin.userId,
    permission: "administration.access",
    evidence: "Isolated transfer test",
  });
  await database.db
    .update(identitySessions)
    .set({ mfaVerifiedAt: new Date() })
    .where(eq(identitySessions.id, admin.id));
  const transfers = createAdminProfileTransferRepository(database.db);
  const actor = { id: admin.id, userId: owner.userId, administratorUserId: admin.userId };
  await transfers.transfer(
    actor,
    submitted.items[0]!.profileId!,
    { destinationUserId: destination.userId, revision: 0 },
    randomUUID(),
  );
  const received = await repository.get(draft.id, "", destination.userId);
  expect(received).toMatchObject({ email: null, legalVersion: null, totalMonthlyMinor: 40000 });
  expect(received.items).toHaveLength(1);
  expect((await repository.list({}, destination.userId)).requests[0]!.items).toHaveLength(1);
  expect((await repository.receipt(browser, draft.id, input, key, owner))!.items).toHaveLength(1);
  expect(
    (await repository.submit(browser, draft.id, input, items, key, owner)).totalMonthlyMinor,
  ).toBe(50000);
  expect((await repository.get(draft.id, "", undefined, true)).items).toHaveLength(2);
  await transfers.transfer(
    actor,
    submitted.items[1]!.profileId!,
    { destinationUserId: destination.userId, revision: 0 },
    randomUUID(),
  );
  await expect(repository.get(draft.id, browser, owner.userId)).rejects.toMatchObject({
    statusCode: 404,
  });
  expect((await repository.list({}, owner.userId)).requests).toHaveLength(0);
});
