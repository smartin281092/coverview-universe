import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { parseEnvironment } from "../../platform/config.js";
import { createDatabase } from "../../platform/db/database.js";
import { buildServer } from "../../platform/server.js";
import { createIdentityRepository } from "./identity.repository.js";
import { identityAdminPermissions, identityLogins, identitySessions } from "./identity.schema.js";
import { createIdentityService } from "./identity.service.js";
import { IdentityError, randomSecret, secretHash } from "./identity.security.js";
import type { IdentityProvider, RemoteSession } from "./identity.workos.js";

// Explicit provider double: these tests prove local HTTP/SQL guarantees, never a real WorkOS login.
const example = parseEnv(
  readFileSync(new URL("../../../../../.env.example", import.meta.url), "utf8"),
);
let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let repository: ReturnType<typeof createIdentityRepository>;
let app: Awaited<ReturnType<typeof buildServer>>;
let remotes: RemoteSession[];
let isUnavailable: boolean;
let isMfaValid: boolean;
let mfaChecks: number;
let remoteClockOffset: number;
const host = "127.0.0.1:4100";
const origin = "http://127.0.0.1:4101";

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18.4-alpine")
    .withDatabase("coverview_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 5000,
  });
  repository = createIdentityRepository(database.db);
  await migrate(database.db, {
    migrationsFolder: fileURLToPath(new URL("../../../drizzle/", import.meta.url)),
  });
});
afterAll(async () => {
  await database?.pool.end();
  await container?.stop();
});
beforeEach(async () => {
  remotes = [];
  isUnavailable = false;
  isMfaValid = true;
  mfaChecks = 0;
  remoteClockOffset = 0;
  const provider: IdentityProvider = {
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
        id: `session_${randomUUID()}`,
        userId: code,
        status: "active",
        authMethod: "magic_code",
        createdAt: new Date(Date.now() + remoteClockOffset).toISOString(),
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      };
      remotes.push(remote);
      return Promise.resolve({
        workosUserId: code,
        workosSessionId: remote.id,
        email: `${code}@example.test`,
      });
    },
    sessions: (id) => {
      if (isUnavailable) return Promise.reject(new IdentityError("IDENTITY_UNAVAILABLE", 503));
      return Promise.resolve(
        remotes.filter((item) => item.userId === id && item.status === "active"),
      );
    },
    revoke: (id) => {
      const item = remotes.find((remote) => remote.id === id);
      if (item) item.status = "revoked";
      return Promise.resolve();
    },
    challenge: () =>
      Promise.resolve({
        challengeId: randomUUID(),
        factorId: "factor_fixture",
        expiresAt: new Date(Date.now() + 300_000),
      }),
    verify: () => {
      mfaChecks++;
      return Promise.resolve(isMfaValid);
    },
  };
  const config = parseEnvironment({
    ...example,
    DATABASE_URL: container.getConnectionUri(),
    LOG_LEVEL: "silent",
    AUTH_ENABLED: "true",
    WORKOS_API_KEY: "fixture_not_real",
    WORKOS_CLIENT_ID: "client_fixture",
    AUTH_SESSION_SECRET: Buffer.alloc(32, 3).toString("base64"),
  });
  const service = createIdentityService(config, repository, provider, () => undefined);
  app = await buildServer(
    config,
    {
      checkReadiness: () => Promise.resolve(true),
      readPersonas: () => Promise.resolve([]),
      close: () => Promise.resolve(),
    },
    service,
  );
});
afterEach(async () => {
  await app?.close();
});

function request(url: string, cookie?: string) {
  return app.inject({ url, headers: { host, ...(cookie ? { cookie } : {}) } });
}
async function startLogin(surface = "wallet") {
  const response = await request(`/auth/login?surface=${surface}`);
  expect(response.statusCode).toBe(303);
  const location = String(response.headers.location);
  const state = new URL(location).searchParams.get("state") ?? "";
  return { state, cookie: String(response.headers["set-cookie"]).split(";")[0] ?? "" };
}
async function login(identity = `user_${randomUUID()}`, surface = "wallet") {
  const pending = await startLogin(surface);
  const callback = await request(
    `/auth/callback?code=${identity}&state=${pending.state}`,
    pending.cookie,
  );
  expect(callback.statusCode, callback.body).toBe(303);
  const cookieHeader = callback.headers["set-cookie"];
  const cookies = Array.isArray(cookieHeader) ? cookieHeader : [String(cookieHeader)];
  const fullCookie = cookies.find((value) => value.startsWith("cv_session=")) ?? "";
  const cookie = fullCookie.split(";")[0] ?? "";
  const me = await request("/identity/me", cookie);
  expect(me.statusCode, me.body).toBe(200);
  const body = me.json<{
    user: { id: string; email: string };
    session: { id: string };
    csrfToken: string;
  }>();
  return { cookie, fullCookie, body, identity, callback };
}
type Login = Awaited<ReturnType<typeof login>>;
function mutation(
  url: string,
  session: Login,
  payload: Record<string, string> = {},
  headers: Record<string, string> = {},
) {
  return app.inject({
    method: "POST",
    url,
    payload,
    headers: {
      host,
      origin,
      cookie: session.cookie,
      "x-csrf-token": session.body.csrfToken,
      "idempotency-key": randomUUID(),
      ...headers,
    },
  });
}

describe("identity HTTP with real PostgreSQL and an explicit WorkOS double", () => {
  it("binds callback state to a browser, consumes it once, and refuses arbitrary destinations", async () => {
    const pending = await startLogin();
    expect((await request(`/auth/callback?code=fixture&state=${pending.state}`)).statusCode).toBe(
      400,
    );
    expect(
      (await request(`/auth/callback?code=fixture&state=wrong`, pending.cookie)).statusCode,
    ).toBe(400);
    expect(
      (await request(`/auth/callback?code=fixture&state=${pending.state}`, pending.cookie))
        .statusCode,
    ).toBe(303);
    expect(
      (await request(`/auth/callback?code=fixture&state=${pending.state}`, pending.cookie))
        .statusCode,
    ).toBe(400);
    expect(
      (await request("/auth/login?surface=wallet&returnTo=https://evil.test")).statusCode,
    ).toBe(400);
    expect((await request("/auth/login?surface=evil")).statusCode).toBe(400);
    expect((await request("/auth/login?surface=wallet&surface=admin")).statusCode).toBe(400);
  });
  it("rejects expired login transactions", async () => {
    const pending = await startLogin();
    await database.db
      .update(identityLogins)
      .set({
        createdAt: new Date(Date.now() - 7200_000),
        expiresAt: new Date(Date.now() - 3600_000),
      })
      .where(eq(identityLogins.stateHash, secretHash(pending.state)));
    expect(
      (await request(`/auth/callback?code=fixture&state=${pending.state}`, pending.cookie))
        .statusCode,
    ).toBe(400);
  });
  it("recovers provider callback errors only on the server-bound surface without a session", async () => {
    const pending = await startLogin("admin");
    const denied = await request(`/auth/callback?error=access_denied&state=wrong`, pending.cookie);
    expect(denied.statusCode).toBe(400);
    expect(denied.headers.location).toBeUndefined();
    const response = await request(
      `/auth/callback?error=access_denied&state=${pending.state}`,
      pending.cookie,
    );
    expect(response.statusCode).toBe(303);
    expect(response.headers.location).toBe("http://127.0.0.1:4102/account?authError=callback");
    expect(String(response.headers["set-cookie"])).not.toContain("cv_session=");
    expect(
      (await request(`/auth/callback?code=fixture&state=${pending.state}`, pending.cookie))
        .statusCode,
    ).toBe(400);
    const outage = await startLogin("www");
    isUnavailable = true;
    const failed = await request(
      `/auth/callback?code=fixture&state=${outage.state}`,
      outage.cookie,
    );
    expect(failed.statusCode).toBe(303);
    expect(failed.headers.location).toBe("http://127.0.0.1:4103/account?authError=callback");
    expect(String(failed.headers["set-cookie"])).not.toContain("cv_session=");
  });
  it("exposes only an opaque HttpOnly session and the owner's private projection across surfaces", async () => {
    const owner = await login();
    const outsider = await login();
    expect(owner.fullCookie).toContain("HttpOnly");
    expect(owner.fullCookie).toContain("SameSite=Lax");
    expect(owner.fullCookie).not.toContain("Domain=");
    expect(owner.callback.headers["referrer-policy"]).toBe("no-referrer");
    expect(owner.callback.headers.location).toBe(`${origin}/account`);
    expect(
      (await request(`/identity/workspace/${owner.body.user.id}`, owner.cookie)).json(),
    ).toEqual({ ownerId: owner.body.user.id, email: owner.body.user.email });
    expect(
      (await request(`/identity/workspace/${owner.body.user.id}`, outsider.cookie)).statusCode,
    ).toBe(403);
    expect((await request("/identity/admin?role=admin&app=admin", owner.cookie)).statusCode).toBe(
      403,
    );
    const www = await app.inject({
      url: "/identity/me",
      headers: { host, origin: "http://127.0.0.1:4103", cookie: owner.cookie },
    });
    expect(www.statusCode).toBe(200);
    expect(www.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:4103");
    expect(www.headers["access-control-allow-credentials"]).toBe("true");
    expect(www.body).not.toMatch(/accessToken|refreshToken|sealedSession|workosUserId|tokenHash/);
  });
  it("refuses unsafe mutation origins, CSRF and host rebinding before changing data", async () => {
    const owner = await login();
    for (const headers of [
      { origin: "https://evil.test" },
      { origin: "" },
      { "x-csrf-token": "wrong" },
      { host: "evil.test" },
    ]) {
      expect(
        (await mutation("/identity/logout", owner, { scope: "all" }, headers)).statusCode,
      ).toBe(403);
    }
    expect((await request("/identity/me", owner.cookie)).statusCode).toBe(200);
    expect(
      (await mutation("/identity/logout", owner, { scope: "all", role: "admin" })).statusCode,
    ).toBe(400);
  });
  it("denies missing, expired and provider-revoked sessions at the next request", async () => {
    expect((await request("/identity/me")).statusCode).toBe(401);
    const owner = await login();
    const remote = remotes.find((item) => item.userId === owner.identity);
    if (!remote) throw new Error("Test fixture missing");
    remote.status = "revoked";
    expect((await request("/identity/me", owner.cookie)).statusCode).toBe(401);
    const another = await login();
    await database.db
      .update(identitySessions)
      .set({
        createdAt: new Date(Date.now() - 7200_000),
        expiresAt: new Date(Date.now() - 3600_000),
      })
      .where(eq(identitySessions.id, another.body.session.id));
    expect((await request("/identity/me", another.cookie)).statusCode).toBe(401);
  });
  it("fails closed during provider outage without turning it into logout or a false success", async () => {
    const owner = await login();
    isUnavailable = true;
    const denied = await request("/identity/me", owner.cookie);
    expect(denied.statusCode).toBe(503);
    expect(denied.json()).toMatchObject({ error: { code: "IDENTITY_UNAVAILABLE" } });
    isUnavailable = false;
    expect((await request("/identity/me", owner.cookie)).statusCode).toBe(200);
  });
  it("revokes only an owned device and enforces both local and global logout", async () => {
    const owner = await login();
    const second = await login(owner.identity);
    const outsider = await login();
    expect(
      (await mutation(`/identity/sessions/${outsider.body.session.id}/revoke`, owner)).statusCode,
    ).toBe(404);
    expect(
      (await mutation(`/identity/sessions/${second.body.session.id}/revoke`, owner)).statusCode,
    ).toBe(200);
    expect((await request("/identity/me", second.cookie)).statusCode).toBe(401);
    expect((await request("/identity/me", outsider.cookie)).statusCode).toBe(200);
    expect((await mutation("/identity/logout", owner, { scope: "all" })).json()).toEqual({
      success: true,
      remoteRevocation: "complete",
    });
    expect((await request("/identity/me", owner.cookie)).statusCode).toBe(401);
    expect(
      remotes.filter((item) => item.userId === owner.identity && item.status === "active"),
    ).toHaveLength(0);
  });
  it("retains an exact retry after remote logout failure and never lets an old cookie revoke new sessions", async () => {
    const owner = await login();
    const key = randomUUID();
    isUnavailable = true;
    const pending = await mutation(
      "/identity/logout",
      owner,
      { scope: "all" },
      { "idempotency-key": key },
    );
    expect(pending.json()).toEqual({ success: true, remoteRevocation: "pending" });
    expect((await request("/identity/me", owner.cookie)).statusCode).toBe(401);
    isUnavailable = false;
    expect(
      (
        await mutation("/identity/logout", owner, { scope: "all" }, { "idempotency-key": key })
      ).json(),
    ).toEqual({ success: true, remoteRevocation: "complete" });
    const fresh = await login(owner.identity);
    expect((await mutation("/identity/logout", owner, { scope: "all" })).statusCode).toBe(401);
    expect(
      (await mutation("/identity/logout", owner, { scope: "all" }, { "idempotency-key": key }))
        .statusCode,
    ).toBe(200);
    expect((await request("/identity/me", fresh.cookie)).statusCode).toBe(200);
  });
  it("revokes existing local devices despite provider clock skew beyond the global logout cutoff", async () => {
    const owner = await login();
    const second = await login(owner.identity);
    for (const remote of remotes.filter((item) => item.userId === owner.identity))
      remote.createdAt = new Date(Date.now() + 60_000).toISOString();
    expect((await mutation("/identity/logout", owner, { scope: "all" })).json()).toEqual({
      success: true,
      remoteRevocation: "complete",
    });
    expect((await request("/identity/me", second.cookie)).statusCode).toBe(401);
    expect(
      remotes.filter((item) => item.userId === owner.identity && item.status === "active"),
    ).toHaveLength(0);
  });
  it("reconciles pending logout without revoking a new login when the provider clock is behind", async () => {
    const owner = await login();
    isUnavailable = true;
    expect((await mutation("/identity/logout", owner, { scope: "all" })).json()).toMatchObject({
      remoteRevocation: "pending",
    });
    isUnavailable = false;
    remoteClockOffset = -60_000;
    // Local timestamps have millisecond precision; this scenario requires a strictly later login.
    await delay(2);
    const fresh = await login(owner.identity);
    expect((await request("/identity/me", fresh.cookie)).statusCode).toBe(200);
    expect(
      remotes.filter((item) => item.userId === owner.identity && item.status === "active"),
    ).toHaveLength(1);
  });
  it("does not let a backlog of inactive pending rows hide an active device during global logout", async () => {
    const owner = await login();
    await database.db.insert(identitySessions).values(
      Array.from({ length: 100 }, (_, index) => ({
        id: `a_backlog_${randomUUID()}_${index}`,
        userId: owner.body.user.id,
        workosSessionId: `inactive_${randomUUID()}`,
        tokenHash: secretHash(randomSecret()),
        device: "Fixture backlog",
        expiresAt: new Date(Date.now() + 3600_000),
        revokedAt: new Date(),
        remoteRevocationPending: true,
      })),
    );
    for (const remote of remotes.filter((item) => item.userId === owner.identity))
      remote.createdAt = new Date(Date.now() + 60_000).toISOString();
    expect((await mutation("/identity/logout", owner, { scope: "all" })).json()).toMatchObject({
      remoteRevocation: "complete",
    });
    expect(
      remotes.filter((item) => item.userId === owner.identity && item.status === "active"),
    ).toHaveLength(0);
    expect(await repository.listPendingRevocations(owner.body.user.id, 100)).toHaveLength(0);
  });
  it("requires a session-bound MFA challenge, rotates its cookie and rereads explicit admin permission", async () => {
    const admin = await login();
    expect((await mutation("/identity/mfa/challenge", admin)).statusCode).toBe(403);
    await database.db.insert(identityAdminPermissions).values({
      id: randomUUID(),
      userId: admin.body.user.id,
      permission: "administration.access",
      evidence: "Fictitious identity: test only",
    });
    expect((await request("/identity/admin", admin.cookie)).json()).toMatchObject({
      error: { code: "IDENTITY_MFA_REQUIRED" },
    });
    expect((await mutation("/identity/mfa/challenge", admin)).statusCode).toBe(200);
    isMfaValid = false;
    expect((await mutation("/identity/mfa/verify", admin, { code: "123456" })).statusCode).toBe(
      400,
    );
    isMfaValid = true;
    expect((await mutation("/identity/mfa/verify", admin, { code: "123456" })).statusCode).toBe(
      400,
    );
    expect(mfaChecks).toBe(1);
    expect((await mutation("/identity/mfa/challenge", admin)).statusCode).toBe(200);
    const verified = await mutation("/identity/mfa/verify", admin, { code: "123456" });
    expect(verified.statusCode, verified.body).toBe(200);
    const newCookie = String(verified.headers["set-cookie"]).split(";")[0] ?? "";
    expect(newCookie).not.toBe(admin.cookie);
    expect((await request("/identity/me", admin.cookie)).statusCode).toBe(401);
    expect((await request("/identity/admin", newCookie)).statusCode).toBe(200);
    await database.db
      .update(identityAdminPermissions)
      .set({ revokedAt: new Date() })
      .where(eq(identityAdminPermissions.userId, admin.body.user.id));
    expect((await request("/identity/admin", newCookie)).statusCode).toBe(403);
  });
  it("rate-limits login attempts", async () => {
    for (let index = 0; index < 30; index++)
      expect((await request("/auth/login?surface=wallet")).statusCode).toBe(303);
    expect((await request("/auth/login?surface=wallet")).statusCode).toBe(429);
  });
});
