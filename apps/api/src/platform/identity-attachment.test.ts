import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createDatabase } from "./db/database.js";
import { createIdentityRepository } from "../modules/identity/identity.repository.js";
import { createDocumentRepository } from "../modules/document-intelligence/document.repository.js";
import { documents } from "../modules/document-intelligence/document.schema.js";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_attachment_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  await migrate(database.db, {
    migrationsFolder: fileURLToPath(new URL("../../drizzle/", import.meta.url)),
  });
  await migrate(database.db, {
    migrationsFolder: fileURLToPath(new URL("../../drizzle/", import.meta.url)),
  });
});
afterAll(async () => {
  if (database) await database.pool.end();
  if (container) await container.stop();
});
async function owner() {
  const session = await createIdentityRepository(database.db).createSession({
    workosUserId: `user_${randomUUID()}`,
    workosSessionId: `session_${randomUUID()}`,
    email: "attachment-owner@isolated.test",
    device: "Isolated test",
    tokenHash: digest(randomUUID()),
    expiresAt: new Date(Date.now() + 3600000),
    loginStartedAt: new Date(Date.now() - 1000),
    requestId: randomUUID(),
  });
  if (!session) throw new Error("Isolated identity unavailable");
  return session;
}
it("persists both faces with partial recovery, owner isolation and replay without a false ready state", async () => {
  const actor = await owner();
  const stranger = await owner();
  const repository = createDocumentRepository(database.db);
  const create = async (checksum: string, identity = true) =>
    repository.create(
      actor,
      {
        name: "original.jpg",
        mime: "image/jpeg",
        size: 80,
        checksum: digest(checksum),
        analysisRequested: false,
        ...(identity ? { purpose: "identity_card" as const } : {}),
      },
      randomUUID(),
    );
  const front = await create("front");
  const back = await create("back");
  const unrelated = await create("insurance", false);
  await expect(
    repository.saveIdentityAttachment(
      { userId: actor.userId, id: stranger.id },
      { revision: 0, frontId: front.id },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ code: "IDENTITY_UNAUTHENTICATED" });
  expect((await repository.identityAttachment(actor.userId)).status).toBe("missing");
  const firstInput = { revision: 0, frontId: front.id };
  const firstKey = randomUUID();
  const [first, replay] = await Promise.all([
    repository.saveIdentityAttachment(actor, firstInput, firstKey),
    repository.saveIdentityAttachment(actor, firstInput, firstKey),
  ]);
  expect(first.revision).toBe(1);
  expect(replay).toEqual(first);
  expect(first.status).toBe("processing");
  expect(first.front?.id).toBe(front.id);
  expect(first.back).toBeNull();
  expect((await repository.identityAttachment(stranger.userId)).status).toBe("missing");
  await expect(
    repository.saveIdentityAttachment(stranger, { revision: 0, frontId: front.id }, randomUUID()),
  ).rejects.toMatchObject({ code: "DOCUMENT_NOT_FOUND" });
  await expect(
    repository.saveIdentityAttachment(actor, { revision: 1, frontId: unrelated.id }, randomUUID()),
  ).rejects.toMatchObject({ code: "DOCUMENT_ATTACHMENT_INVALID" });
  await expect(
    repository.saveIdentityAttachment(actor, { ...firstInput, frontId: back.id }, firstKey),
  ).rejects.toMatchObject({ code: "DOCUMENT_IDEMPOTENCY_REUSED" });
  await expect(
    repository.saveIdentityAttachment(actor, { revision: 0, backId: back.id }, randomUUID()),
  ).rejects.toMatchObject({ code: "DOCUMENT_CONFLICT" });
  await repository.uploaded(actor, front.id, "image/jpeg");
  await database.db
    .update(documents)
    .set({ state: "ready", scanVersion: "isolated-antivirus" })
    .where(and(eq(documents.userId, actor.userId), eq(documents.id, front.id)));
  expect((await repository.identityAttachment(actor.userId)).status).toBe("incomplete");
  const complete = await repository.saveIdentityAttachment(
    actor,
    { revision: 1, backId: back.id },
    randomUUID(),
  );
  expect(complete.front?.id).toBe(front.id);
  expect(complete.status).toBe("processing");
  await repository.uploaded(actor, back.id, "image/jpeg");
  await database.db
    .update(documents)
    .set({ state: "ready", scanVersion: "isolated-antivirus" })
    .where(and(eq(documents.userId, actor.userId), eq(documents.id, back.id)));
  expect((await repository.identityAttachment(actor.userId)).status).toBe("ready");
  await expect(
    repository.saveIdentityAttachment(actor, { revision: 2, backId: front.id }, randomUUID()),
  ).rejects.toMatchObject({ code: "DOCUMENT_ATTACHMENT_INVALID" });
  const duplicate = await create("front");
  await expect(
    repository.saveIdentityAttachment(actor, { revision: 2, backId: duplicate.id }, randomUUID()),
  ).rejects.toMatchObject({ code: "DOCUMENT_ATTACHMENT_INVALID" });
  await expect(
    repository.saveIdentityAttachment(actor, { revision: 2, combinedId: front.id }, randomUUID()),
  ).rejects.toMatchObject({ code: "DOCUMENT_ATTACHMENT_INVALID" });
  await database.db
    .update(documents)
    .set({ category: "insurance" })
    .where(eq(documents.id, back.id));
  expect((await repository.identityAttachment(actor.userId)).status).toBe("needs_attention");
  await database.db
    .update(documents)
    .set({ category: "identity", state: "quarantined" })
    .where(eq(documents.id, back.id));
  expect((await repository.identityAttachment(actor.userId)).status).toBe("needs_attention");
  await repository.remove(actor, front.id);
  const afterRemoval = await repository.saveIdentityAttachment(actor, firstInput, firstKey);
  expect(afterRemoval.front).toBeNull();
  expect(afterRemoval.status).toBe("needs_attention");
  expect(afterRemoval.revision).toBe(2);
  const cleared = await repository.saveIdentityAttachment(
    actor,
    { revision: 2, frontId: null, backId: null },
    randomUUID(),
  );
  expect(cleared.status).toBe("missing");
  expect(cleared.revision).toBe(3);
  const combined = await create("combined");
  await repository.uploaded(actor, combined.id, "image/jpeg");
  await database.db
    .update(documents)
    .set({ state: "ready", scanVersion: "isolated-antivirus" })
    .where(eq(documents.id, combined.id));
  expect(
    (
      await repository.saveIdentityAttachment(
        actor,
        { revision: 3, combinedId: combined.id },
        randomUUID(),
      )
    ).status,
  ).toBe("ready");
});
