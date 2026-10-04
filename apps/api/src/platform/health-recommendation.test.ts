import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq } from "drizzle-orm";
import { beforeAll, afterAll, expect, it } from "vitest";
import { parseEnvironment } from "./config.js";
import { createDatabase } from "./db/database.js";
import { buildServer } from "./server.js";
import { createIdentityRepository } from "../modules/identity/identity.repository.js";
import { createIdentityService } from "../modules/identity/identity.service.js";
import { identityAdminPermissions, identitySessions } from "../modules/identity/identity.schema.js";
import { randomSecret, secretHash } from "../modules/identity/identity.security.js";
import type { IdentityProvider, RemoteSession } from "../modules/identity/identity.workos.js";

// Real isolated PostgreSQL and explicit identity-provider double; no live account or MFA bypass.
let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let app: Awaited<ReturnType<typeof buildServer>>;
const remotes: RemoteSession[] = [];
const host = "127.0.0.1:4100",
  origin = "http://127.0.0.1:4102";
const unused = () => Promise.reject(new Error("Not used in comparator authorization checks"));
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18.4-alpine")
    .withDatabase("coverview_recommendation_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 5000,
  });
  await migrate(database.db, {
    migrationsFolder: fileURLToPath(new URL("../../drizzle/", import.meta.url)),
  });
  const provider: IdentityProvider = {
    authorization: unused,
    exchange: unused,
    revoke: unused,
    factors: unused,
    enroll: unused,
    challengeEnrollment: unused,
    cancelEnrollment: unused,
    challenge: unused,
    verify: unused,
    sessions: (id) => Promise.resolve(remotes.filter((remote) => remote.userId === id)),
  };
  const config = parseEnvironment({
    ...parseEnv(readFileSync(new URL("../../../../.env.example", import.meta.url), "utf8")),
    DATABASE_URL: container.getConnectionUri(),
    LOG_LEVEL: "silent",
    AUTH_ENABLED: "true",
    DOCUMENTS_ENABLED: "false",
    PARTNER_JOBS_ENABLED: "false",
    WORKOS_API_KEY: "fixture_not_real",
    WORKOS_CLIENT_ID: "client_fixture",
    AUTH_SESSION_SECRET: Buffer.alloc(32, 3).toString("base64"),
  });
  const service = createIdentityService(
    config,
    createIdentityRepository(database.db),
    provider,
    () => undefined,
  );
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
afterAll(async () => {
  await app?.close();
  await database?.pool.end();
  await container?.stop();
});
function request(url: string, cookie?: string) {
  return app.inject({ url, headers: { host, ...(cookie ? { cookie } : {}) } });
}
async function login() {
  const token = randomSecret(),
    userId = `user_${randomUUID()}`,
    remoteId = `session_${randomUUID()}`;
  const createdAt = new Date(Date.now() - 1000),
    expiresAt = new Date(Date.now() + 3600000);
  await createIdentityRepository(database.db).createSession({
    workosUserId: userId,
    workosSessionId: remoteId,
    email: "comparator@example.test",
    device: "Synthetic integration test",
    tokenHash: secretHash(token),
    expiresAt,
    loginStartedAt: createdAt,
    requestId: randomUUID(),
  });
  remotes.push({
    id: remoteId,
    userId,
    status: "active",
    authMethod: "magic_code",
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });
  const cookie = `cv_session=${token}`,
    me = await request("/identity/me", cookie);
  expect(me.statusCode, me.body).toBe(200);
  return {
    cookie,
    body: me.json<{ user: { id: string }; session: { id: string }; csrfToken: string }>(),
  };
}
type Login = Awaited<ReturnType<typeof login>>;

it("protects comparator administration, CSRF, revisions and idempotent configuration history", async () => {
  const { defaultRecommendationRules } =
    await import("../modules/health-insurance/recommendation.engine.js");
  const admin = await login(),
    url = "/admin/health-recommendation";
  expect((await request(url)).statusCode).toBe(401);
  expect((await request(url, admin.cookie)).statusCode).toBe(403);
  const permissionId = randomUUID();
  await database.db.insert(identityAdminPermissions).values({
    id: permissionId,
    userId: admin.body.user.id,
    permission: "administration.access",
    evidence: "Synthetic comparator authorization test",
  });
  expect((await request(url, admin.cookie)).statusCode).toBe(403);
  await database.db
    .update(identitySessions)
    .set({ mfaVerifiedAt: new Date() })
    .where(eq(identitySessions.id, admin.body.session.id));
  const state = await request(url, admin.cookie);
  expect(state.statusCode, state.body).toBe(200);
  const revision = state.json<{ rules: { revision: number } }>().rules.revision;
  const payload = {
    expectedRevision: revision,
    config: defaultRecommendationRules,
    reason: "Configuration de test synthétique",
  };
  for (const headers of [
    { "x-csrf-token": "wrong" },
    { origin: "https://foreign.example" },
    { host: "foreign.example" },
  ])
    expect((await mutation(url + "/publish", admin, payload, headers)).statusCode).toBe(403);
  const key = randomUUID(),
    headers = { "idempotency-key": key };
  const saved = await mutation(url + "/publish", admin, payload, headers);
  expect(saved.statusCode, saved.body).toBe(200);
  expect((await mutation(url + "/publish", admin, payload, headers)).json()).toEqual(saved.json());
  expect((await mutation(url + "/publish", admin, payload)).statusCode).toBe(409);
  expect(
    (
      await mutation(
        url + "/publish",
        admin,
        { ...payload, reason: "Autre motif de test" },
        headers,
      )
    ).statusCode,
  ).toBe(422);
  const history = (await request(url, admin.cookie)).json<{
    rules: { revision: number };
    history: { id: string }[];
  }>();
  expect(history.rules.revision).toBe(revision + 1);
  expect(
    history.history.filter((item) => item.id === saved.json<{ id: string }>().id),
  ).toHaveLength(1);
  const { context } = await import("../modules/health-insurance/recommendation.fixtures.js");
  const { healthDatasets, healthInsurers, healthModels } =
    await import("../modules/health-insurance/health.schema.js");
  const catalog = context().catalog;
  catalog.cases.push({
    id: "review_fixture",
    insurerId: 97,
    insurerName: "Fixture a",
    modelIds: ["model_a"],
    modelNames: ["Modèle fictif a"],
    year: 2027,
    regions: ["VD-1"],
    rule: "Conditions de test",
    confirmed: "Fixture synthétique",
    missing: "Réseau à confirmer",
    sourceIds: ["source_fixture"],
    impact: "Compatibilité",
    provisionalTreatment: "Vérification",
    question: "Quel réseau est applicable ?",
    action: "Revue opérateur",
    priority: "blocking",
    status: "open",
    owner: null,
    revision: 0,
    history: [],
  });
  await database.db
    .insert(healthDatasets)
    .values({ id: catalog.datasetId, year: 2027, active: true, sources: [], counts: {} });
  await database.db
    .insert(healthInsurers)
    .values(catalog.insurers.map((item) => ({ id: item.id, name: item.legalName })));
  await database.db.insert(healthModels).values(
    catalog.models.map((model) => ({
      id: model.id,
      datasetId: catalog.datasetId,
      insurerId: model.insurerId,
      tariffCode: model.tariffCode,
      name: model.name,
      category: model.category,
    })),
  );
  const publication = {
    catalog,
    expectedCatalogId: null,
    reason: "Preuves fictives pour le contrôle des versions",
  };
  const publishKey = { "idempotency-key": randomUUID() };
  const published = await mutation(url + "/catalog", admin, publication, publishKey);
  expect(published.statusCode, published.body).toBe(200);
  expect((await mutation(url + "/catalog", admin, publication, publishKey)).json()).toEqual(
    published.json(),
  );
  expect((await mutation(url + "/catalog", admin, publication)).statusCode).toBe(409);
  expect((await request(`${url}/catalog/${catalog.id}`)).statusCode).toBe(401);
  const originalVersion = await request(`${url}/catalog/${catalog.id}`, admin.cookie);
  expect(originalVersion.statusCode).toBe(200);
  expect(originalVersion.json<{ publication: { reason: string } }>().publication.reason).toBe(
    publication.reason,
  );
  const reviewUrl = `${url}/reviews/${catalog.id}/review_fixture`;
  const resolution = {
    expectedRevision: 0,
    status: "in_review",
    owner: "Opérateur fictif",
    note: "Contrôle synthétique documenté",
  };
  const reviewKey = { "idempotency-key": randomUUID() };
  const updated = await mutation(reviewUrl, admin, resolution, reviewKey);
  expect(updated.statusCode, updated.body).toBe(200);
  expect(updated.json<{ history: unknown[] }>().history).toHaveLength(1);
  expect((await mutation(reviewUrl, admin, resolution, reviewKey)).json()).toEqual(updated.json());
  expect((await mutation(reviewUrl, admin, resolution)).statusCode).toBe(409);
  const publicCatalog = await request("/health-insurance/recommendation-catalog?year=2027");
  const projected = publicCatalog.json<{
    publication: unknown;
    cases: { owner: unknown; history: unknown[] }[];
  }>();
  expect(projected.publication).toBeNull();
  expect(projected.cases[0]?.owner).toBeNull();
  expect(projected.cases[0]?.history).toEqual([]);
  const nextCatalog = { ...catalog, id: "catalog_fixture_restored" };
  expect(
    (
      await mutation(url + "/catalog", admin, {
        ...publication,
        catalog: { ...nextCatalog, models: [] },
        expectedCatalogId: catalog.id,
      })
    ).statusCode,
  ).toBe(422);
  expect(
    (
      await mutation(url + "/catalog", admin, {
        ...publication,
        catalog: nextCatalog,
        expectedCatalogId: catalog.id,
      })
    ).statusCode,
  ).toBe(200);
  const finalCatalogState = (await request(url, admin.cookie)).json<{
    catalogHistory: { id: string }[];
    catalog: { id: string };
  }>();
  expect(finalCatalogState.catalogHistory.map((item) => item.id)).toEqual([
    nextCatalog.id,
    catalog.id,
  ]);
  expect(finalCatalogState.catalog.id).toBe(nextCatalog.id);
  await database.db
    .update(identityAdminPermissions)
    .set({ revokedAt: new Date() })
    .where(eq(identityAdminPermissions.id, permissionId));
  expect((await request(url, admin.cookie)).statusCode).toBe(403);
  expect(
    (await mutation(url + "/publish", admin, { ...payload, expectedRevision: revision + 1 }))
      .statusCode,
  ).toBe(403);
});

function mutation(
  url: string,
  session: Login,
  payload: Record<string, unknown> = {},
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
