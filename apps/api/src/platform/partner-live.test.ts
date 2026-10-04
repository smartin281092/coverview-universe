import { createHash, randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { request as httpRequest, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { FastifyBaseLogger, FastifyReply } from "fastify";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { leadCreateInputSchema, partnerApplicationInputSchema } from "@coverview/contracts/partner";
import { liveEvents } from "@coverview/contracts/partner-live";
import { parseEnvironment } from "./config.js";
import { createDatabase } from "./db/database.js";
import { buildServer } from "./server.js";
import { createIdentityRepository } from "../modules/identity/identity.repository.js";
import { createIdentityService } from "../modules/identity/identity.service.js";
import { randomSecret } from "../modules/identity/identity.security.js";
import type { IdentityProvider, RemoteSession } from "../modules/identity/identity.workos.js";
import { createPartnerRepository } from "../modules/partner-workspace/partner.repository.js";
import { createLiveHub } from "../modules/partner-workspace/partner.live.js";
import type { PartnerActor } from "../modules/partner-workspace/partner.policy.js";

// The hub is exercised against real PostgreSQL notifications; the HTTP case uses an explicit
// identity provider double, never a real WorkOS login.
const example = parseEnv(
  readFileSync(new URL("../../../../.env.example", import.meta.url), "utf8"),
);
let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let repository: ReturnType<typeof createPartnerRepository>;
let admin: PartnerActor;
const key = () => randomUUID();
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const valid = () => Promise.resolve(true);

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_partner_live_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  await migrate(database.db, {
    migrationsFolder: fileURLToPath(new URL("../../drizzle/", import.meta.url)),
  });
  repository = createPartnerRepository(database.pool);
  admin = await actor(true);
});
afterAll(async () => {
  if (database) await database.pool.end();
  if (container) await container.stop();
});

async function actor(administrator = false): Promise<PartnerActor> {
  const value = { userId: `user_${key()}`, id: `session_${key()}`, administrator };
  await database.pool.query(
    "insert into identity_users(id,workos_user_id,email) values($1,$2,$3)",
    [value.userId, key(), `${key()}@live.test`],
  );
  await database.pool.query("insert into identity_profiles(id,user_id) values($1,$2)", [
    key(),
    value.userId,
  ]);
  await database.pool.query(
    "insert into identity_sessions(id,user_id,workos_session_id,token_hash,device,expires_at,mfa_verified_at) values($1,$2,$3,$4,'Isolated live',now()+interval '1 hour',now()-interval '1 second')",
    [value.id, value.userId, key(), sha256(key())],
  );
  if (administrator)
    await database.pool.query(
      "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated test')",
      [key(), value.userId],
    );
  return value;
}
async function member(name: string) {
  const person = await actor();
  await repository.apply(
    person,
    partnerApplicationInputSchema.parse({
      name,
      organization: "Organisation isolée",
      phone: "",
      roles: ["advisor"],
      categories: ["vehicle"],
      languages: "fr",
      regions: "GE",
      qualifications: "Test",
    }),
    key(),
  );
  const application = (await repository.context(person)).application!;
  await repository.review(
    admin,
    person.userId,
    {
      revision: application.revision,
      state: "approved",
      roles: ["advisor"],
      reason: "Test isolé",
      reviewDueAt: null,
      organizationState: "approved",
    },
    key(),
  );
  return person;
}
// A Wallet owner's request, accepted by its advisor.
async function owned(owner: PartnerActor, advisor: PartnerActor) {
  const lead = await repository.create(
    { ...owner, wallet: true },
    leadCreateInputSchema.parse({
      title: "Demande isolée",
      category: "vehicle",
      object: "Voiture",
      context: "Diffusion isolée",
      clientUserId: owner.userId,
      clientProfileId: null,
      clientName: "Personne isolée",
      email: "client@live.test",
      phone: "",
      language: "fr",
      source: "Test",
      transmissionAuthorized: true,
      priority: "normal",
      draft: false,
      nextAction: "Qualifier",
      dueAt: new Date(Date.now() + 86400000).toISOString(),
    }),
    key(),
  );
  const routed = await repository.command(
    admin,
    lead.id,
    { action: "assign", revision: lead.revision, responsibleId: advisor.userId, reason: "Test" },
    key(),
  );
  return repository.command(
    advisor,
    lead.id,
    { action: "accept", revision: routed.revision },
    key(),
  );
}
const insertEvent =
  "insert into partner_events(id,lead_id,actor_id,kind,audience,text) values($1,$2,$3,'test.live',$4,'')";
async function event(leadId: string, audience: string, actorId: string) {
  await database.pool.query(insertEvent, [`pe_${key()}`, leadId, actorId, audience]);
}
async function notice(leadId: string, audience: string, recipientId: string | null) {
  const id = `pn_${key()}`;
  await database.pool.query(
    "insert into partner_notifications(id,lead_id,recipient_id,audience,kind,dedupe_key,action,priority) values($1,$2,$3,$4,'test.live',$1,'review','normal')",
    [id, leadId, recipientId, audience],
  );
  return id;
}

// Captures what the hub writes to one SSE response.
class Sink extends EventEmitter {
  chunks: string[] = [];
  writableEnded = false;
  setTimeout() {
    return this;
  }
  writeHead() {
    return this;
  }
  write(chunk: string) {
    this.chunks.push(chunk);
    return true;
  }
  end() {
    if (this.writableEnded) return this;
    this.writableEnded = true;
    this.emit("close");
    return this;
  }
  received(type: string) {
    return this.chunks
      .filter((chunk) => chunk.includes(`\nevent: ${type}\n`))
      .map((chunk) => JSON.parse(/\ndata: (.*)\n/u.exec(chunk)![1]!) as Record<string, unknown>);
  }
}
function stream() {
  const raw = new Sink();
  return {
    raw,
    reply: { hijack: () => undefined, getHeaders: () => ({}), raw } as unknown as FastifyReply,
  };
}
const logger = () =>
  ({ warn: vi.fn() }) as unknown as FastifyBaseLogger & { warn: ReturnType<typeof vi.fn> };

it("tells each stream that a Lead changed only after commit, by audience and visibility", async () => {
  const advisor = await member("Ada Conseillère"),
    outsider = await member("Otto Externe"),
    owner = await actor();
  const lead = await owned(owner, advisor);
  const hub = createLiveHub(database.pool, logger());
  await hub.start();
  try {
    const readers = { advisor: stream(), outsider: stream(), owner: stream(), admin: stream() };
    hub.open(readers.advisor.reply, advisor, valid);
    hub.open(readers.outsider.reply, outsider, valid);
    hub.open(readers.owner.reply, { ...owner, wallet: true }, valid);
    hub.open(readers.admin.reply, admin, valid);
    const seen = (name: keyof typeof readers) =>
      readers[name].raw.received(liveEvents.leadChanged).length;

    const pending = await database.pool.connect();
    try {
      await pending.query("begin");
      await pending.query(insertEvent, [`pe_${key()}`, lead.id, advisor.userId, "assigned"]);
      await pause(600);
      // Nothing leaves before the transaction commits.
      expect(seen("advisor")).toBe(0);
      await pending.query("commit");
    } finally {
      pending.release();
    }
    await vi.waitFor(() => expect([seen("advisor"), seen("admin")]).toEqual([1, 1]));
    expect(readers.advisor.raw.received(liveEvents.leadChanged)[0]).toMatchObject({
      leadId: lead.id,
    });
    // Assigned work is not client-facing; an unrelated professional learns nothing.
    expect([seen("owner"), seen("outsider")]).toEqual([0, 0]);

    // Three client-facing changes in one transaction reach each reader once.
    const batch = await database.pool.connect();
    try {
      await batch.query("begin");
      for (let index = 0; index < 3; index++)
        await batch.query(insertEvent, [`pe_${key()}`, lead.id, advisor.userId, "client"]);
      await batch.query("commit");
    } finally {
      batch.release();
    }
    await vi.waitFor(() =>
      expect([seen("advisor"), seen("admin"), seen("owner")]).toEqual([2, 2, 1]),
    );

    // A private note reaches nobody; CoverView events reach administrators only.
    await event(lead.id, "private", advisor.userId);
    await event(lead.id, "coverview", admin.userId);
    await vi.waitFor(() => expect(seen("admin")).toBe(3));
    await pause(600);
    expect([seen("advisor"), seen("owner"), seen("outsider")]).toEqual([2, 1, 0]);
    // The event names the Lead and nothing of its content; each stream numbers its events.
    expect(Object.keys(readers.owner.raw.received(liveEvents.leadChanged)[0]!).sort()).toEqual([
      "at",
      "leadId",
    ]);
    expect(
      readers.admin.raw.chunks
        .filter((chunk) => chunk.startsWith("id: "))
        .map((chunk) => chunk.split("\n")[0]),
    ).toEqual(["id: 1", "id: 2", "id: 3"]);
    expect(readers.owner.raw.chunks[0]).toBe("retry: 5000\n\n");
  } finally {
    await hub.stop();
  }
});

it("routes notification notices to their recipient, or to administrators for CoverView", async () => {
  const advisor = await member("Bea Conseillère"),
    owner = await actor();
  const lead = await owned(owner, advisor);
  const hub = createLiveHub(database.pool, logger());
  await hub.start();
  try {
    const readers = {
      advisor: stream(),
      advisorWallet: stream(),
      owner: stream(),
      admin: stream(),
    };
    hub.open(readers.advisor.reply, advisor, valid);
    hub.open(readers.advisorWallet.reply, { ...advisor, wallet: true }, valid);
    hub.open(readers.owner.reply, { ...owner, wallet: true }, valid);
    hub.open(readers.admin.reply, admin, valid);
    const counts = () =>
      Object.values(readers).map(
        (reader) => reader.raw.received(liveEvents.notificationsChanged).length,
      );
    // Lead events from setup are not part of this case.
    await pause(600);
    for (const reader of Object.values(readers)) reader.raw.chunks.length = 0;

    const own = await notice(lead.id, "partner", advisor.userId);
    await vi.waitFor(() => expect(counts()).toEqual([1, 0, 0, 0]));
    await notice(lead.id, "wallet", owner.userId);
    await vi.waitFor(() => expect(counts()).toEqual([1, 0, 1, 0]));
    await notice(lead.id, "coverview", null);
    await vi.waitFor(() => expect(counts()).toEqual([1, 0, 1, 1]));
    // Resolving a notice changes the recipient's centre too.
    await database.pool.query("update partner_notifications set resolved_at=now() where id=$1", [
      own,
    ]);
    await vi.waitFor(() => expect(counts()).toEqual([2, 0, 1, 1]));
    await pause(400);
    expect(counts()).toEqual([2, 0, 1, 1]);
  } finally {
    await hub.stop();
  }
});

it("bounds streams per reader and surface, and closes a stream whose session ended", async () => {
  const advisor = await member("Cleo Conseillère"),
    other = await member("Dan Conseiller");
  const hub = createLiveHub(database.pool, logger());
  try {
    for (let index = 0; index < 4; index++) hub.open(stream().reply, advisor, valid);
    let refused: unknown;
    try {
      hub.open(stream().reply, advisor, valid);
    } catch (cause) {
      refused = cause;
    }
    expect(refused).toMatchObject({ code: "PARTNER_RATE_LIMITED", statusCode: 429 });
    // The same person's Wallet has its own allowance.
    hub.open(stream().reply, { ...advisor, wallet: true }, valid);
    expect(hub.size()).toBe(5);

    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    try {
      const watched = stream();
      let current = true;
      hub.open(watched.reply, other, () => Promise.resolve(current));
      vi.advanceTimersByTime(60000);
      for (let index = 0; index < 5; index++) await Promise.resolve();
      expect(watched.raw.writableEnded).toBe(false);
      expect(watched.raw.chunks).toContain(": ping\n\n");
      current = false;
      vi.advanceTimersByTime(60000);
      for (let index = 0; index < 5; index++) await Promise.resolve();
      expect(watched.raw.writableEnded).toBe(true);
      expect(hub.size()).toBe(5);
    } finally {
      vi.useRealTimers();
    }
  } finally {
    await hub.stop();
  }
  expect(hub.size()).toBe(0);
});

it("listens again after losing its connection and makes open streams resynchronize", async () => {
  const advisor = await member("Eli Conseiller"),
    owner = await actor();
  const lead = await owned(owner, advisor);
  const log = logger();
  const hub = createLiveHub(database.pool, log);
  await hub.start();
  try {
    const before = stream();
    hub.open(before.reply, advisor, valid);
    await database.pool.query(
      "select pg_terminate_backend(pid) from pg_stat_activity where query ilike 'listen partner_live%' and pid<>pg_backend_pid()",
    );
    // Missed changes are unknowable: the stream closes so the browser reconnects and re-reads.
    await vi.waitFor(() => expect(before.raw.writableEnded).toBe(true), {
      timeout: 15000,
      interval: 200,
    });
    expect(log.warn).toHaveBeenCalledWith({ dependency: "partner_live" }, "Live listener lost");
    const after = stream();
    hub.open(after.reply, advisor, valid);
    await event(lead.id, "assigned", advisor.userId);
    await vi.waitFor(() => expect(after.raw.received(liveEvents.leadChanged)).toHaveLength(1), {
      timeout: 5000,
    });
  } finally {
    await hub.stop();
  }
}, 30000);

it("serves the stream over HTTP only to the surface's own app with a valid session", async () => {
  const remotes: RemoteSession[] = [];
  const outside = () => Promise.reject(new Error("Outside this case"));
  const provider: IdentityProvider = {
    factors: outside,
    enroll: outside,
    challengeEnrollment: outside,
    cancelEnrollment: outside,
    challenge: outside,
    verify: outside,
    authorization: () => {
      const state = randomSecret();
      return Promise.resolve({
        url: `https://auth.example.test/authorize?state=${state}`,
        state,
        codeVerifier: randomSecret(),
      });
    },
    exchange: (code) => {
      const remote: RemoteSession = {
        id: `session_${key()}`,
        userId: code,
        status: "active",
        authMethod: "magic_code",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };
      remotes.push(remote);
      return Promise.resolve({
        workosUserId: code,
        workosSessionId: remote.id,
        email: `${code}@live.test`,
        authenticatedAt: null,
      });
    },
    sessions: (id) =>
      Promise.resolve(remotes.filter((item) => item.userId === id && item.status === "active")),
    revoke: (id) => {
      const item = remotes.find((remote) => remote.id === id);
      if (item) item.status = "revoked";
      return Promise.resolve();
    },
  };
  const config = parseEnvironment({
    ...example,
    DATABASE_URL: container.getConnectionUri(),
    LOG_LEVEL: "silent",
    AUTH_ENABLED: "true",
    DOCUMENTS_ENABLED: "false",
    PARTNER_JOBS_ENABLED: "false",
    WORKOS_API_KEY: "fixture_not_real",
    WORKOS_CLIENT_ID: "client_fixture",
    AUTH_SESSION_SECRET: Buffer.alloc(32, 7).toString("base64"),
  });
  const service = createIdentityService(
    config,
    createIdentityRepository(database.db),
    provider,
    () => undefined,
  );
  const app = await buildServer(
    config,
    {
      checkReadiness: () => Promise.resolve(true),
      readPersonas: () => Promise.resolve([]),
      close: () => Promise.resolve(),
    },
    service,
  );
  try {
    const host = new URL(config.AUTH_API_ORIGIN).host,
      wallet = config.AUTH_WALLET_ORIGIN;
    const login = await app.inject({ url: "/auth/login?surface=wallet", headers: { host } });
    const state = new URL(String(login.headers.location)).searchParams.get("state") ?? "";
    const callback = await app.inject({
      url: `/auth/callback?code=user_${key()}&state=${state}`,
      headers: { host, cookie: String(login.headers["set-cookie"]).split(";")[0]! },
    });
    const cookies = ([] as string[]).concat(callback.headers["set-cookie"] ?? []);
    const cookie = (cookies.find((value) => value.startsWith("cv_session=")) ?? "").split(";")[0]!;
    const me = (await app.inject({ url: "/identity/me", headers: { host, cookie } })).json<{
      user: { id: string };
      session: { id: string };
    }>();
    const owner = { userId: me.user.id, id: me.session.id, administrator: false };
    const advisor = await member("Flo Conseillère");
    const lead = await owned(owner, advisor);

    // Refusals happen before any stream opens: wrong or missing origin, foreign host, no session.
    for (const headers of [
      { host, cookie },
      { host, cookie, origin: config.AUTH_PARTNER_ORIGIN! },
      { host: "foreign.test", cookie, origin: wallet },
    ])
      expect((await app.inject({ url: "/wallet/live", headers })).statusCode).toBe(403);
    expect(
      (await app.inject({ url: "/partner/live", headers: { host, cookie, origin: wallet } }))
        .statusCode,
    ).toBe(403);
    expect(
      (await app.inject({ url: "/wallet/live", headers: { host, origin: wallet } })).statusCode,
    ).toBe(401);

    await app.listen({ port: 0, host: "127.0.0.1" });
    const port = (app.server.address() as AddressInfo).port;
    const response = await new Promise<IncomingMessage>((resolve, reject) => {
      httpRequest(
        {
          host: "127.0.0.1",
          port,
          path: "/wallet/live",
          headers: { host, origin: wallet, cookie },
        },
        resolve,
      )
        .on("error", reject)
        .end();
    });
    let body = "";
    response.setEncoding("utf8");
    response.on("data", (chunk: string) => {
      body += chunk;
    });
    try {
      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("text/event-stream; charset=utf-8");
      expect(response.headers["cache-control"]).toBe("no-cache, no-transform");
      expect(response.headers["access-control-allow-origin"]).toBe(wallet);
      expect(response.headers["access-control-allow-credentials"]).toBe("true");
      await vi.waitFor(() => expect(body).toContain("retry: 5000"));
      // Quiet for longer than the server's 10-second idle cut, the stream stays open.
      await pause(11000);
      expect(response.destroyed).toBe(false);
      await event(lead.id, "client", advisor.userId);
      await vi.waitFor(() => expect(body).toContain(`event: ${liveEvents.leadChanged}\n`), {
        timeout: 5000,
      });
      expect(body).toContain(lead.id);
    } finally {
      response.destroy();
    }
  } finally {
    await app.close();
  }
}, 40000);
