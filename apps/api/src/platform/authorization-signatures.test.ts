import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { AuthorizationSignInput } from "@coverview/contracts";
import { createDatabase } from "./db/database.js";
import { createIdentityRepository } from "../modules/identity/identity.repository.js";
import { createProfileRepository } from "../modules/identity/identity.profile.repository.js";
import { createManagedProfileRepository } from "../modules/profiles/profiles.repository.js";
import { identitySessions } from "../modules/identity/identity.schema.js";
import {
  createAuthorizationRepository,
  readAuthorizationActivity,
} from "../modules/authorizations/index.js";
import { authorizationSignatures } from "../modules/authorizations/authorizations.schema.js";
import { createActionCenterRepository } from "../modules/document-intelligence/document.action-center.repository.js";
import { actionCenterIdentity } from "../modules/document-intelligence/document.action-center.projection.js";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
async function owner() {
  const actor = await createIdentityRepository(database.db).createSession({
    workosUserId: `user_${randomUUID()}`,
    workosSessionId: `session_${randomUUID()}`,
    email: "signatures@isolated.test",
    device: "Isolated test",
    tokenHash: createHash("sha256").update(randomUUID()).digest("hex"),
    expiresAt: new Date(Date.now() + 3600000),
    loginStartedAt: new Date(Date.now() - 1000),
    requestId: randomUUID(),
  });
  if (!actor) throw new Error("Isolated owner unavailable");
  return actor;
}
type Actor = Awaited<ReturnType<typeof owner>>;
async function identify(actor: Actor) {
  return createProfileRepository(database.db).save(
    actor.userId,
    actor.id,
    {
      revision: 0,
      step: "information",
      fields: { firstName: "Isolated", lastName: "Person", city: "Genève" },
    },
    randomUUID(),
  );
}
async function input(
  actor: Actor,
  kind: "mandate" | "procuration" = "mandate",
  profileId = "self",
): Promise<AuthorizationSignInput> {
  const draft = await createAuthorizationRepository(database.db).draft(
    actor.userId,
    kind,
    profileId,
  );
  return {
    profileId,
    profileRevision: draft.profileRevision,
    contentHash: draft.contentHash,
    signerName: profileId === "self" ? draft.profileName : "Représentant de test",
    place: "Genève",
    accepted: true,
    representative: profileId !== "self",
    drawing: [
      [
        [0.1, 0.1],
        [0.5, 0.8],
        [0.8, 0.2],
      ],
    ],
  };
}
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_signatures_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  await migrate(database.db, {
    migrationsFolder: fileURLToPath(new URL("../../drizzle/", import.meta.url)),
  });
});
afterAll(async () => {
  if (database) await database.pool.end();
  if (container) await container.stop();
});

it("archives the accepted dated document and signature once; later profile edits never alter the receipt", async () => {
  const actor = await owner();
  const repository = createAuthorizationRepository(database.db);
  expect((await repository.draft(actor.userId, "mandate")).canSign).toBe(false);
  const profile = await identify(actor);
  const data = await input(actor);
  const key = randomUUID();
  const before = new Date();
  const [receipt, replay] = await Promise.all([
    repository.sign(actor, "mandate", data, key),
    repository.sign(actor, "mandate", data, key),
  ]);
  expect(replay).toEqual(receipt);
  const notices = await repository.notifications();
  expect(notices.notifications.filter((item) => item.id === receipt.id)).toEqual([
    {
      id: receipt.id,
      userId: actor.userId,
      profileId: "self",
      profileName: receipt.document.profileName,
      accountEmail: "signatures@isolated.test",
      kind: "mandate",
      signedAt: receipt.signedAt,
      revokedAt: null,
    },
  ]);
  const center = createActionCenterRepository(database.db);
  const actionId = actionCenterIdentity(actor.userId, "self", "authorization:management_mandate");
  expect((await center.details(actor.userId, actionId)).action).toMatchObject({
    state: "complete",
    canResolve: false,
    choices: [],
  });
  expect((await center.list(actor.userId, { state: "in_progress" })).actions).toEqual([]);
  expect(receipt.accepted).toBe(true);
  expect(receipt.drawing).toEqual(data.drawing);
  expect(new Date(receipt.signedAt).getTime()).toBeGreaterThanOrEqual(before.getTime());
  expect((await repository.status(actor.userId)).mandate.signedAt).toBe(receipt.signedAt);
  expect((await repository.status(actor.userId)).procuration.signedAt).toBeNull();
  const activity = await readAuthorizationActivity(database.db, actor.userId, "self");
  expect(activity).toEqual({
    entries: [
      {
        id: receipt.id,
        profileId: "self",
        kind: "mandate",
        signedAt: receipt.signedAt,
        version: receipt.document.version,
        revokedAt: null,
      },
    ],
    incomplete: false,
  });
  const { integrityHash, ...archived } = receipt;
  expect(integrityHash).toBe(createHash("sha256").update(JSON.stringify(archived)).digest("hex"));
  await createProfileRepository(database.db).save(
    actor.userId,
    actor.id,
    {
      revision: profile.revision,
      step: "address",
      fields: { city: "Lausanne" },
    },
    randomUUID(),
  );
  expect((await repository.draft(actor.userId, "mandate")).values.city).toBe("Lausanne");
  expect((await repository.receipt(actor.userId, receipt.id)).document.values.city).toBe("Genève");
  expect(await repository.receipt(actor.userId, receipt.id)).toEqual(receipt);
  expect(await repository.sign(actor, "mandate", data, key)).toEqual(receipt);
  await expect(
    repository.sign(actor, "mandate", { ...data, place: "Autre" }, key),
  ).rejects.toMatchObject({ statusCode: 422 });
  await expect(
    repository.sign(actor, "mandate", await input(actor), randomUUID()),
  ).rejects.toMatchObject({ statusCode: 409 });
});

it("rejects stale or altered documents, another signer and absent acceptance or a blank/oversized drawing", async () => {
  const actor = await owner();
  await identify(actor);
  const repository = createAuthorizationRepository(database.db);
  const data = await input(actor);
  await expect(
    repository.sign(actor, "mandate", { ...data, contentHash: "0".repeat(64) }, randomUUID()),
  ).rejects.toMatchObject({ statusCode: 409 });
  await expect(
    repository.sign(actor, "mandate", { ...data, profileRevision: 0 }, randomUUID()),
  ).rejects.toMatchObject({ statusCode: 409 });
  await expect(
    repository.sign(actor, "mandate", { ...data, signerName: "Another Person" }, randomUUID()),
  ).rejects.toMatchObject({ statusCode: 422 });
  for (const invalid of [
    { ...data, accepted: false },
    {
      ...data,
      drawing: [
        [
          [0.1, 0.1],
          [0.1, 0.1],
        ],
      ],
    },
    {
      ...data,
      drawing: [
        [
          [0.1, 0.1],
          [1.1, 0.8],
        ],
      ],
    },
    {
      ...data,
      drawing: Array.from({ length: 7 }, () =>
        Array.from({ length: 500 }, (_, i) => [i % 2, i % 2]),
      ),
    },
  ])
    await expect(
      repository.sign(actor, "mandate", invalid as AuthorizationSignInput, randomUUID()),
    ).rejects.toThrow();
  expect((await repository.status(actor.userId)).mandate.signedAt).toBeNull();
  await createProfileRepository(database.db).save(
    actor.userId,
    actor.id,
    { revision: data.profileRevision, step: "address", fields: { city: "Nyon" } },
    randomUUID(),
  );
  await expect(repository.sign(actor, "mandate", data, randomUUID())).rejects.toMatchObject({
    statusCode: 409,
  });
});

it("requires explicit representation for each managed person or company and prevents owner/profile receipt leaks", async () => {
  const actor = await owner();
  const stranger = await owner();
  const managed = createManagedProfileRepository(database.db);
  const repository = createAuthorizationRepository(database.db);
  for (const kind of ["person", "legal_entity"] as const) {
    const subject = await managed.create(
      actor,
      { kind, displayName: "Managed test" },
      randomUUID(),
    );
    await managed.saveSection(
      actor,
      subject.id,
      "general",
      {
        revision: 0,
        step: "information",
        fields:
          kind === "person"
            ? { firstName: "Managed", lastName: "Person" }
            : { companyName: "Managed SA" },
      },
      randomUUID(),
    );
    const data = await input(actor, "mandate", subject.id);
    await expect(
      repository.sign(actor, "mandate", { ...data, representative: false }, randomUUID()),
    ).rejects.toMatchObject({ statusCode: 422 });
    await expect(repository.draft(stranger.userId, "mandate", subject.id)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(repository.sign(stranger, "mandate", data, randomUUID())).rejects.toMatchObject({
      statusCode: 404,
    });
    const receipt = await repository.sign(actor, "mandate", data, randomUUID());
    expect(
      (await repository.notifications()).notifications.find((item) => item.id === receipt.id),
    ).toMatchObject({
      userId: actor.userId,
      profileId: subject.id,
      profileName: receipt.document.profileName,
    });
    expect((await repository.status(actor.userId, subject.id)).mandate.id).toBe(receipt.id);
    expect((await repository.status(actor.userId)).mandate.signedAt).toBeNull();
    await expect(repository.receipt(stranger.userId, receipt.id)).rejects.toMatchObject({
      statusCode: 404,
    });
  }
});

it("rechecks the active session before replay and does not treat a revoked signature as active", async () => {
  const actor = await owner();
  await identify(actor);
  const repository = createAuthorizationRepository(database.db);
  const data = await input(actor);
  const key = randomUUID();
  const receipt = await repository.sign(actor, "mandate", data, key);
  await database.db
    .update(authorizationSignatures)
    .set({ revokedAt: new Date() })
    .where(eq(authorizationSignatures.id, receipt.id));
  expect((await repository.status(actor.userId)).mandate.signedAt).toBeNull();
  await expect(repository.sign(actor, "mandate", data, key)).rejects.toMatchObject({
    statusCode: 422,
  });
  expect(await repository.receipt(actor.userId, receipt.id)).toEqual(receipt);
  const nextData = await input(actor);
  const nextKey = randomUUID();
  await repository.sign(actor, "mandate", nextData, nextKey);
  await database.db
    .update(identitySessions)
    .set({ revokedAt: new Date() })
    .where(eq(identitySessions.id, actor.id));
  await expect(repository.sign(actor, "mandate", nextData, nextKey)).rejects.toMatchObject({
    code: "IDENTITY_UNAUTHENTICATED",
  });
});

it("paginates durable signature notifications without duplicates and retains revocation metadata", async () => {
  const actor = await owner();
  await identify(actor);
  const repository = createAuthorizationRepository(database.db);
  const data = await input(actor, "procuration");
  const key = randomUUID();
  const receipt = await repository.sign(actor, "procuration", data, key);
  await repository.sign(actor, "procuration", data, key);
  const center = createActionCenterRepository(database.db);
  expect(
    (
      await center.details(
        actor.userId,
        actionCenterIdentity(actor.userId, "self", "authorization:procuration"),
      )
    ).action.state,
  ).toBe("complete");
  const [template] = await database.db
    .select()
    .from(authorizationSignatures)
    .where(eq(authorizationSignatures.id, receipt.id));
  if (!template) throw new Error("Missing signature fixture");
  const copies = Array.from({ length: 22 }, () => {
    const id = `sig_${randomUUID()}`;
    return {
      ...template,
      id,
      commandKey: randomUUID(),
      revokedAt: new Date(),
      receipt: { ...receipt, id },
    };
  });
  // Historical revoked signatures with identical timestamps exercise the stable tie breaker.
  await database.db.insert(authorizationSignatures).values(copies);
  const items = [];
  let cursor: string | undefined;
  do {
    const page = await repository.notifications(cursor);
    expect(page.notifications.length).toBeLessThanOrEqual(20);
    items.push(...page.notifications);
    cursor = page.nextCursor ?? undefined;
    expect(items.length).toBeLessThan(100);
  } while (cursor);
  expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
  expect(items.filter((item) => item.userId === actor.userId)).toHaveLength(23);
  expect(items.filter((item) => item.id === receipt.id)).toHaveLength(1);
  expect(
    items
      .filter((item) => copies.some((copy) => copy.id === item.id))
      .every((item) => item.revokedAt !== null),
  ).toBe(true);
  expect(items.every((item) => !("drawing" in item) && !("receipt" in item))).toBe(true);
  await expect(repository.notifications("invalid")).rejects.toMatchObject({ statusCode: 400 });
});
