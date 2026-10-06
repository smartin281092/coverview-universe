import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  leadCategorySchema,
  leadCreateInputSchema,
  partnerApplicationInputSchema,
} from "@coverview/contracts/partner";
import type { MatchingCandidate } from "@coverview/contracts/partner-matching";
import type { z } from "zod";
import { parseEnvironment } from "./config.js";
import { createDatabase } from "./db/database.js";
import { buildServer } from "./server.js";
import { createIdentityRepository } from "../modules/identity/identity.repository.js";
import { createIdentityService } from "../modules/identity/identity.service.js";
import { randomSecret } from "../modules/identity/identity.security.js";
import type { IdentityProvider, RemoteSession } from "../modules/identity/identity.workos.js";
import { createPartnerRepository } from "../modules/partner-workspace/partner.repository.js";
import { createDataRightsOperations } from "../modules/partner-workspace/partner.data-rights.js";
import { createDataRequestOperations } from "../modules/partner-workspace/partner.data-requests.js";
import { createDataErasureOperations } from "../modules/partner-workspace/partner.data-erasure.js";
import {
  recordMatchingDecision,
  type Matching,
} from "../modules/partner-workspace/partner.matching.js";
import type { PartnerActor } from "../modules/partner-workspace/partner.policy.js";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let repository: ReturnType<typeof createPartnerRepository>;
let rights: ReturnType<typeof createDataRightsOperations>;
let requests: ReturnType<typeof createDataRequestOperations>;
let erasure: ReturnType<typeof createDataErasureOperations>;
let admin: PartnerActor;
type LeadCategory = z.infer<typeof leadCategorySchema>;
const key = () => randomUUID();
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const later = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_data_rights_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  await migrate(database.db, {
    migrationsFolder: fileURLToPath(new URL("../../drizzle/", import.meta.url)),
  });
  repository = createPartnerRepository(database.pool);
  rights = createDataRightsOperations(database.pool, repository);
  requests = createDataRequestOperations(database.pool);
  erasure = createDataErasureOperations(database.pool);
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
    [value.userId, key(), `${key()}@rights.test`],
  );
  await database.pool.query("insert into identity_profiles(id,user_id) values($1,$2)", [
    key(),
    value.userId,
  ]);
  await database.pool.query(
    "insert into identity_sessions(id,user_id,workos_session_id,token_hash,device,expires_at,mfa_verified_at) values($1,$2,$3,$4,'Isolated rights',now()+interval '1 hour',now())",
    [value.id, value.userId, key(), sha256(key())],
  );
  if (administrator)
    await database.pool.query(
      "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated test')",
      [key(), value.userId],
    );
  return value;
}
async function owner() {
  return { ...(await actor()), wallet: true };
}
async function managedProfile(person: PartnerActor, name: string) {
  const id = `profile_${key()}`;
  await database.pool.query(
    "insert into managed_profiles(id,user_id,display_name,kind) values($1,$2,$3,'person')",
    [id, person.userId, name],
  );
  return id;
}
async function professional(name: string, category: LeadCategory) {
  const person = await actor();
  await repository.apply(
    person,
    partnerApplicationInputSchema.parse({
      name,
      organization: `Cabinet ${name}`,
      phone: "",
      roles: ["advisor"],
      categories: [category],
      languages: "fr",
      regions: "GE",
      qualifications: "Test",
    }),
    key(),
  );
  const member = (await repository.context(person)).application!;
  await repository.review(
    admin,
    person.userId,
    {
      revision: member.revision,
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
// One of the owner's requests, accepted by its advisor; the contact details are distinctive.
async function request(
  client: PartnerActor,
  advisor: PartnerActor,
  category: LeadCategory,
  marker: string,
  profileId: string | null = null,
) {
  const lead = await repository.create(
    client,
    leadCreateInputSchema.parse({
      title: `Demande ${marker}`,
      category,
      object: "Objet isolé",
      objectReference: `REF-${marker}`,
      context: `Contexte ${marker}`,
      clientUserId: client.userId,
      clientProfileId: profileId,
      clientName: `Personne ${marker}`,
      email: `${marker.toLowerCase()}@client.test`,
      phone: `+41 79 000 ${marker.length.toString().padStart(2, "0")}`,
      language: "fr",
      source: `Recommandation ${marker}`,
      transmissionAuthorized: true,
      priority: "normal",
      draft: false,
      nextAction: "Qualifier",
      dueAt: later(24),
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
function candidate(person: PartnerActor, rank: number): MatchingCandidate {
  return {
    rank,
    userId: person.userId,
    name: `Nom ${rank}`,
    organization: `Organisation ${rank}`,
    competence: "category",
    convention: "category",
    language: "matches",
    region: "matches",
    mode: "unknown",
    availability: "upcoming",
    capacity: rank === 1 ? "open" : "unknown",
    referent: false,
    relationship: false,
    activeLeads: rank,
    recentAssignments: 0,
    reasons: [],
    caveats: [],
  };
}
// A decision as the matching service stores it: the chosen person against a stored ranking.
async function decision(leadId: string, chosen: PartnerActor, ranking: PartnerActor[]) {
  await recordMatchingDecision(database.pool, {
    leadId,
    cycle: 1,
    kind: "manual",
    actorId: admin.userId,
    chosenUserId: chosen.userId,
    reason: "Décision documentée dans un test isolé",
    matching: {
      preferences: {} as Matching["preferences"],
      candidates: ranking.map((person, index) => candidate(person, index + 1)),
      excluded: [{ reason: "language", count: 2 }],
      evaluated: ranking.length + 2,
      truncated: false,
      basis: sha256(key()),
    },
  });
}

it("exports a client's own requests with their contact details, profiles included, and nothing of another client", async () => {
  const client = await owner(),
    other = await owner(),
    advisor = await professional("Anne Conseil", "vehicle");
  const child = await managedProfile(client, "Enfant isolé");
  const own = await request(client, advisor, "vehicle", "Alpha");
  const managed = await request(client, advisor, "vehicle", "Bravo", child);
  const foreign = await request(other, advisor, "vehicle", "Charlie");

  const result = await rights.walletExport(client);
  expect(result.manifest).toMatchObject({
    version: "partner-data-export-v1",
    surface: "wallet",
    complete: false,
    truncated: [],
  });
  expect(result.requests.map((item) => item.lead.id).sort()).toEqual([own.id, managed.id].sort());
  const alpha = result.requests.find((item) => item.lead.id === own.id)!;
  // Hidden from the Wallet detail until now, these are the client's own data and their origin.
  expect(alpha.lead.email).toBeNull();
  expect(alpha.contact).toEqual({
    email: "alpha@client.test",
    phone: "+41 79 000 05",
    language: "fr",
    context: "Contexte Alpha",
    objectReference: "REF-Alpha",
    source: "Recommandation Alpha",
    transmissionAuthorized: true,
  });
  expect(alpha.internal).toBeNull();
  expect(result.manifest.counts).toMatchObject({ requests: 2, contact: 2, internal: 0 });
  expect(result.register.entries.find((entry) => entry.category === "internal")?.access).toBe(
    "on_request",
  );
  const text = JSON.stringify(result);
  expect(text).not.toContain(foreign.id);
  expect(text).not.toContain("charlie@client.test");

  // The proof records who exported, from which session and what, never the content.
  const proof = (
    await database.pool.query<Record<string, unknown>>(
      "select user_id,session_id,surface,manifest_version,complete,counts from partner_data_exports where id=$1",
      [result.manifest.exportId],
    )
  ).rows[0]!;
  expect(proof).toMatchObject({
    user_id: client.userId,
    session_id: client.id,
    surface: "wallet",
    manifest_version: "partner-data-export-v1",
    complete: false,
  });
  expect(JSON.stringify(proof)).not.toContain("alpha@client.test");
  await expect(
    database.pool.query("update partner_data_exports set complete=true where id=$1", [
      result.manifest.exportId,
    ]),
  ).rejects.toMatchObject({ code: "23514" });
  await expect(
    database.pool.query("delete from partner_data_exports where id=$1", [result.manifest.exportId]),
  ).rejects.toMatchObject({ code: "23514" });
  expect((await rights.walletData(client)).exports.map((item) => item.id)).toEqual([
    result.manifest.exportId,
  ]);
  expect((await rights.walletData(other)).exports).toEqual([]);

  // A transferred profile takes its requests to the new owner, in the export as on screen.
  await database.pool.query("update managed_profiles set user_id=$2 where id=$1", [
    child,
    other.userId,
  ]);
  expect((await rights.walletExport(client)).requests.map((item) => item.lead.id)).toEqual([
    own.id,
  ]);
  expect((await rights.walletExport(other)).requests.map((item) => item.lead.id).sort()).toEqual(
    [managed.id, foreign.id].sort(),
  );
});

it("refuses an export to a revoked session and to another surface", async () => {
  const client = await owner(),
    advisor = await professional("Bruno Conseil", "household");
  await request(client, advisor, "household", "Delta");
  await expect(rights.walletExport({ ...advisor, wallet: false })).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await expect(rights.professionalExport(client)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
    client.id,
  ]);
  await expect(rights.walletExport(client)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await expect(rights.walletData(client)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  expect(
    (
      await database.pool.query("select 1 from partner_data_exports where user_id=$1", [
        client.userId,
      ])
    ).rowCount,
  ).toBe(0);
});

it("opens each professional's own internal scores to them, and nobody else's", async () => {
  const client = await owner(),
    first = await professional("Chloé Classée", "legal"),
    second = await professional("Denis Choisi", "legal"),
    outsider = await professional("Émile Absent", "legal");
  const lead = await request(client, second, "legal", "Echo");
  // Chloé was first; the choice went to Denis, second.
  await decision(lead.id, second, [first, second]);

  const chloe = await rights.professionalData(first);
  expect(chloe.matching.items).toHaveLength(1);
  expect(chloe.matching.items[0]).toMatchObject({
    category: "legal",
    kind: "manual",
    rank: 1,
    first: true,
    chosen: false,
    criteria: { capacity: "open", activeLeads: 1, competence: "category" },
  });
  const denis = await rights.professionalData(second);
  expect(denis.matching.items[0]).toMatchObject({ rank: 2, first: false, chosen: true });
  expect((await rights.professionalData(outsider)).matching.items).toEqual([]);
  // Only one's own line: no other candidate, no request, no free-text reason.
  const shown = JSON.stringify(chloe);
  for (const hidden of [second.userId, lead.id, "Décision documentée", "Nom 2"])
    expect(shown).not.toContain(hidden);

  // The referrer evaluation, an Admin view until now, is open to the person it describes.
  expect(await repository.referrerEvaluation(first, first.userId)).toMatchObject({
    userId: first.userId,
  });
  await expect(repository.referrerEvaluation(first, second.userId)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await expect(repository.referrerEvaluation(client, first.userId)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  expect(await repository.referrerEvaluation(admin, first.userId)).toMatchObject({
    userId: first.userId,
  });

  const exported = await rights.professionalExport(first);
  expect(exported.manifest).toMatchObject({ surface: "partner", complete: false });
  expect(exported.context.application?.name).toBe("Chloé Classée");
  expect(exported.matching.items[0]?.rank).toBe(1);
  expect(exported.referrer?.userId).toBe(first.userId);
  expect(exported.manifest.counts.internal_scores).toBe(2);
  const text = JSON.stringify(exported);
  for (const hidden of [second.userId, outsider.userId, lead.id])
    expect(text).not.toContain(hidden);
  expect((await rights.professionalData(first)).exports.map((item) => item.id)).toEqual([
    exported.manifest.exportId,
  ]);
  await expect(rights.walletData(first)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
});

// The HTTP case uses an explicit identity provider double, never a real WorkOS login.
const example = parseEnv(
  readFileSync(new URL("../../../../.env.example", import.meta.url), "utf8"),
);
async function server() {
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
        email: `${code}@rights.test`,
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
  return { app, config, host: new URL(config.AUTH_API_ORIGIN).host };
}

it("serves the copy over HTTP to the signed-in person only, as a protected, rate-limited mutation", async () => {
  const { app, config, host } = await server();
  async function signIn() {
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
      csrfToken: string;
    }>();
    return {
      cookie,
      csrf: me.csrfToken,
      actor: { userId: me.user.id, id: me.session.id, administrator: false, wallet: true },
    };
  }
  try {
    const signed = await signIn(),
      cookie = signed.cookie,
      client = signed.actor;
    const advisor = await professional("Gaël Conseil", "pension");
    const lead = await request(client, advisor, "pension", "Golf");

    const summary = await app.inject({ url: "/wallet/data", headers: { host, cookie } });
    expect(summary.statusCode).toBe(200);
    expect(summary.json()).toEqual({
      registerVersion: "partner-data-register-v1",
      exports: [],
      requests: [],
    });
    expect((await app.inject({ url: "/wallet/data", headers: { host } })).statusCode).toBe(401);

    const mutation = (headers: Record<string, string>, session = cookie) =>
      app.inject({
        method: "POST",
        url: "/wallet/data/exports",
        headers: { host, cookie: session, "content-type": "application/json", ...headers },
        payload: {},
      });
    const protectedHeaders = {
      origin: config.AUTH_WALLET_ORIGIN,
      "x-csrf-token": signed.csrf,
      "idempotency-key": key(),
    };
    // Without the session's CSRF token, nothing is produced or recorded.
    const forged = await mutation({ origin: config.AUTH_WALLET_ORIGIN, "idempotency-key": key() });
    expect(forged.statusCode).toBe(403);
    expect(
      (
        await database.pool.query("select 1 from partner_data_exports where user_id=$1", [
          client.userId,
        ])
      ).rowCount,
    ).toBe(0);

    const exported = await mutation(protectedHeaders);
    expect(exported.statusCode).toBe(200);
    expect(exported.headers["cache-control"]).toBe("no-store");
    const copy = exported.json<{
      manifest: { exportId: string; counts: Record<string, number> };
      requests: { lead: { id: string }; contact: { email: string } }[];
    }>();
    expect(copy.requests.map((item) => item.lead.id)).toEqual([lead.id]);
    expect(copy.requests[0]?.contact.email).toBe("golf@client.test");
    expect(
      (await app.inject({ url: "/wallet/data", headers: { host, cookie } })).json<{
        exports: { id: string }[];
      }>().exports[0]?.id,
    ).toBe(copy.manifest.exportId);

    // Six attempts an hour per session, the refused one included: the seventh is refused before
    // any read. Someone else on the same address keeps their own quota.
    for (let index = 0; index < 4; index += 1)
      expect((await mutation({ ...protectedHeaders, "idempotency-key": key() })).statusCode).toBe(
        200,
      );
    expect((await mutation({ ...protectedHeaders, "idempotency-key": key() })).statusCode).toBe(
      429,
    );
    expect(
      (
        await database.pool.query("select 1 from partner_data_exports where user_id=$1", [
          client.userId,
        ])
      ).rowCount,
    ).toBe(5);
    const neighbour = await signIn();
    expect(
      (
        await mutation(
          {
            origin: config.AUTH_WALLET_ORIGIN,
            "x-csrf-token": neighbour.csrf,
            "idempotency-key": key(),
          },
          neighbour.cookie,
        )
      ).statusCode,
    ).toBe(200);
  } finally {
    await app.close();
  }
}, 60000);

it("files requests about one's data within bounds, and lets CoverView answer them as allowed", async () => {
  const client = await owner(),
    stranger = await owner(),
    advisor = await professional("Hugo Requête", "health");
  const child = await managedProfile(client, "Enfant requête");
  const own = await request(client, advisor, "health", "Hotel");
  // The advisor's own working notes, which only a complete access opens to the client.
  const noted = await repository.command(
    advisor,
    own.id,
    {
      action: "note",
      revision: own.revision,
      text: "Note interne sur le client.",
      audience: "assigned",
    },
    key(),
  );
  await repository.command(
    advisor,
    own.id,
    {
      action: "task",
      revision: noted.revision,
      task: {
        title: "Rappeler le client",
        description: "Avant la fin de la semaine",
        responsibleId: advisor.userId,
        dueAt: later(48),
        priority: "normal",
        reminderAt: null,
      },
    },
    key(),
  );
  const childLead = await request(client, advisor, "health", "India", child);
  const foreign = await request(stranger, advisor, "health", "Juliett");
  const file = (input: Record<string, unknown>, k = key()) =>
    requests.fileWalletDataRequest(
      client,
      {
        kind: "other",
        profileId: null,
        category: null,
        leadId: null,
        message: "Une question sur mes données.",
        ...input,
      },
      k,
    );

  const replayKey = key();
  const rectification = await file(
    {
      kind: "rectification",
      category: "contact",
      leadId: own.id,
      message: "Mon numéro de téléphone a changé.",
    },
    replayKey,
  );
  expect(rectification).toMatchObject({
    surface: "wallet",
    kind: "rectification",
    state: "received",
    subject: { kind: "self", profileId: null },
    category: "contact",
    lead: { id: own.id, title: "Demande Hotel", category: "health" },
    revision: 0,
  });
  // A replay returns the same request; the same key for something else is refused.
  expect(
    (
      await file(
        {
          kind: "rectification",
          category: "contact",
          leadId: own.id,
          message: "Mon numéro de téléphone a changé.",
        },
        replayKey,
      )
    ).id,
  ).toBe(rectification.id);
  await expect(file({ kind: "erasure" }, replayKey)).rejects.toMatchObject({
    code: "PARTNER_IDEMPOTENCY_REUSED",
  });
  // The same request is not filed twice while open.
  await expect(
    file({
      kind: "rectification",
      category: "contact",
      leadId: own.id,
      message: "Encore mon numéro de téléphone.",
    }),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  // Only one's own subjects and the requests one sees, of the same subject.
  for (const input of [
    { leadId: foreign.id },
    { profileId: child, leadId: own.id },
    { profileId: null, leadId: childLead.id },
    { profileId: await managedProfile(stranger, "Profil étranger") },
  ])
    await expect(file(input)).rejects.toMatchObject({ code: "PARTNER_NOT_FOUND" });

  const erasure = await file({ kind: "erasure", message: "Merci d’effacer mes données Partner." });
  const access = await file({
    kind: "complete_access",
    category: "internal",
    message: "Je souhaite un accès complet.",
  });
  const other = await file({ message: "Comment sont choisis mes conseillers ?" });
  await file({
    kind: "rectification",
    profileId: child,
    leadId: childLead.id,
    message: "Le nom de mon enfant est mal écrit.",
  });
  // Five open requests per person: the sixth waits for an answer or a withdrawal.
  await expect(
    file({ profileId: child, message: "Une autre question sur mon enfant." }),
  ).rejects.toMatchObject({ code: "PARTNER_RATE_LIMITED" });
  const withdrawn = await requests.withdrawDataRequest(client, other.id, { revision: 0 }, key());
  expect(withdrawn).toMatchObject({ state: "withdrawn", revision: 1 });
  await expect(
    requests.withdrawDataRequest(client, other.id, { revision: 1 }, key()),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_TRANSITION" });
  await expect(
    requests.withdrawDataRequest(stranger, erasure.id, { revision: 0 }, key()),
  ).rejects.toMatchObject({ code: "PARTNER_NOT_FOUND" });

  // The queue is Admin-only, oldest open request first.
  for (const someone of [client, advisor])
    await expect(requests.adminDataRequests(someone, { state: "open" })).rejects.toMatchObject({
      code: "PARTNER_ACCESS_DENIED",
    });
  const queue = await requests.adminDataRequests(admin, { state: "open" });
  const mine = queue.items.filter((item) => item.requester.id === client.userId);
  expect(mine.map((item) => item.id).slice(0, 3)).toEqual([
    rectification.id,
    erasure.id,
    access.id,
  ]);
  expect(mine.find((item) => item.id === erasure.id)?.allowedOutcomes).toEqual(["refused"]);

  const taken = await requests.takeDataRequest(admin, rectification.id, { revision: 0 }, key());
  expect(taken).toMatchObject({ state: "in_progress", takenBy: { id: admin.userId } });
  await expect(
    requests.takeDataRequest(admin, rectification.id, { revision: 1 }, key()),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_TRANSITION" });
  const answer = (outcome: string, id: string, revision: number) =>
    requests.answerDataRequest(
      admin,
      id,
      { revision, outcome, answer: "Réponse documentée de CoverView." },
      key(),
    );
  // An erasure is declared done only by its execution, never by hand.
  await expect(answer("done", erasure.id, 0)).rejects.toMatchObject({
    code: "PARTNER_INVALID_TRANSITION",
  });
  await expect(answer("granted", rectification.id, 1)).rejects.toMatchObject({
    code: "PARTNER_INVALID_TRANSITION",
  });
  expect(await answer("done", rectification.id, 1)).toMatchObject({
    state: "answered",
    outcome: "done",
    answeredBy: { id: admin.userId },
    allowedOutcomes: [],
  });
  const before = Date.now();
  const granted = await answer("granted", access.id, 0);
  const until = Date.parse(granted.accessUntil ?? "");
  expect(until - before).toBeGreaterThan(13.9 * 86400000);
  expect(until - before).toBeLessThan(14.1 * 86400000);

  // A granted complete access opens internal notes and every journal audience, for that subject
  // only.
  const copy = await rights.walletExport(client);
  const self = copy.requests.find((item) => item.lead.id === own.id);
  const managed = copy.requests.find((item) => item.lead.id === childLead.id);
  const internal = self?.internal;
  expect(internal?.events.map((item) => item.text)).toContain("Note interne sur le client.");
  expect(self?.lead.events.map((item) => item.text)).not.toContain("Note interne sur le client.");
  expect(internal?.tasks.map((item) => item.title)).toEqual(["Rappeler le client"]);
  expect(managed?.internal).toBeNull();
  expect(copy.manifest.complete).toBe(true);
  expect(copy.manifest.counts.internal).toBe(
    (internal?.events.length ?? 0) + (internal?.tasks.length ?? 0),
  );
  expect((await rights.walletExport(stranger)).manifest.complete).toBe(false);

  // The answer is the person's to read; the request stays frozen.
  const summary = await rights.walletData(client);
  expect(summary.requests.find((item) => item.id === rectification.id)).toMatchObject({
    outcome: "done",
    answer: "Réponse documentée de CoverView.",
  });
  await expect(
    database.pool.query(
      "update partner_data_requests set answer='Autre réponse documentée',revision=revision+1 where id=$1",
      [rectification.id],
    ),
  ).rejects.toMatchObject({ code: "23514" });
  await expect(
    database.pool.query("delete from partner_data_requests where id=$1", [erasure.id]),
  ).rejects.toMatchObject({ code: "23514" });

  // A professional files for themselves; their erasure is answered, never declared done by hand.
  const professionalRequest = await requests.fileProfessionalDataRequest(
    advisor,
    {
      kind: "erasure",
      category: "membership",
      message: "Je quitte le réseau, merci d’effacer mes données.",
    },
    key(),
  );
  expect(professionalRequest).toMatchObject({ surface: "partner", subject: { kind: "member" } });
  expect(() =>
    requests.fileProfessionalDataRequest(
      advisor,
      { kind: "complete_access", category: null, message: "Accès complet à mes données." },
      key(),
    ),
  ).toThrow();
  await expect(answer("done", professionalRequest.id, 0)).rejects.toMatchObject({
    code: "PARTNER_INVALID_TRANSITION",
  });
  expect(await answer("answered", professionalRequest.id, 0)).toMatchObject({
    outcome: "answered",
  });
  expect((await rights.professionalData(advisor)).requests.map((item) => item.id)).toEqual([
    professionalRequest.id,
  ]);
  await expect(
    requests.fileWalletDataRequest(
      advisor,
      {
        kind: "other",
        profileId: null,
        category: null,
        leadId: null,
        message: "Question depuis Partner.",
      },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
});

it("erases a client's identifying layer after a server preview, keeps what must be kept and says so", async () => {
  const client = await owner(),
    advisor = await professional("Inès Effacement", "household");
  const child = await managedProfile(client, "Enfant effacement");
  // Erasable: a closed request with an appointment, a note, a task, preferences and an invitation.
  const erasable = await request(client, advisor, "household", "Kilo");
  let step = await repository.command(
    advisor,
    erasable.id,
    {
      action: "appointment",
      revision: erasable.revision,
      appointment: {
        advisorId: advisor.userId,
        startsAt: later(72),
        durationMinutes: 60,
        mode: "home",
        location: "Rue de la Personne 12, 1200 Genève",
        timezone: "Europe/Zurich",
      },
    },
    key(),
  );
  step = await repository.command(
    advisor,
    erasable.id,
    {
      action: "note",
      revision: step.revision,
      text: "Allergie déclarée par le client.",
      audience: "assigned",
    },
    key(),
  );
  step = await repository.command(
    advisor,
    erasable.id,
    {
      action: "task",
      revision: step.revision,
      task: {
        title: "Appeler Mme Kilo",
        description: "Numéro privé",
        responsibleId: advisor.userId,
        dueAt: later(48),
        priority: "normal",
        reminderAt: null,
      },
    },
    key(),
  );
  await database.pool.query(
    "insert into partner_client_invitations(id,lead_id,email,created_by,expires_at) values($1,$2,'kilo@client.test',$3,now()+interval '14 days')",
    [`pci_${key()}`, erasable.id, advisor.userId],
  );
  await repository.command(
    advisor,
    erasable.id,
    {
      action: "close",
      revision: step.revision,
      result: "client_refusal",
      reason: "client_refusal",
      comment: "Le client renonce.",
    },
    key(),
  );
  // Kept: a closed request with an open complaint.
  const disputed = await request(client, advisor, "household", "Lima");
  await repository.createQualityCase(
    advisor,
    disputed.id,
    {
      kind: "complaint",
      summary: "Réclamation en cours d’examen.",
      priority: "high",
      sharedWithClient: true,
      confirmed: true,
    },
    key(),
  );
  const closedDispute = await repository.detail(advisor, disputed.id);
  await repository.command(
    advisor,
    disputed.id,
    {
      action: "close",
      revision: closedDispute.revision,
      result: "client_refusal",
      reason: "client_refusal",
      comment: "Clôture malgré la réclamation.",
    },
    key(),
  );
  // Open: the managed profile's request is still in progress.
  await request(client, advisor, "household", "Mike", child);

  const self = await requests.fileWalletDataRequest(
    client,
    {
      kind: "erasure",
      profileId: null,
      category: null,
      leadId: null,
      message: "Merci d’effacer mes données de conseil.",
    },
    key(),
  );
  const forChild = await requests.fileWalletDataRequest(
    client,
    {
      kind: "erasure",
      profileId: child,
      category: null,
      leadId: null,
      message: "Merci d’effacer les données de mon enfant.",
    },
    key(),
  );
  await expect(erasure.erasurePlan(client, self.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  const childPlan = await erasure.erasurePlan(admin, forChild.id);
  expect(childPlan.blocked).toBe("open_requests");
  await expect(
    erasure.executeErasure(
      admin,
      forChild.id,
      {
        revision: 0,
        basis: childPlan.basis,
        attestation: true,
        answer: "Effacement impossible pour l’instant.",
      },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });

  const plan = await erasure.erasurePlan(admin, self.id);
  expect(plan.blocked).toBeNull();
  expect(plan.leads.map((lead) => [lead.id, lead.status, lead.holds])).toEqual([
    [erasable.id, "erasable", []],
    [disputed.id, "kept", ["dispute"]],
  ]);
  expect(plan.retained).toContain("surveys_complaints");
  await expect(
    erasure.executeErasure(
      admin,
      self.id,
      { revision: 0, basis: "0".repeat(64), attestation: true, answer: "Effacement effectué." },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  const executeKey = key();
  const execution = {
    revision: 0,
    basis: plan.basis,
    attestation: true as const,
    answer: "Effacement effectué ; une demande est conservée pour sa réclamation.",
  };
  const answered = await erasure.executeErasure(admin, self.id, execution, executeKey);
  expect(answered).toMatchObject({ state: "answered", outcome: "partially_done" });
  expect(answered.erasure?.kept).toEqual([
    { leadId: disputed.id, category: "household", holds: ["dispute"] },
  ]);
  expect(answered.erasure?.erased).toMatchObject({
    requests: 1,
    tasks: 1,
    appointments: 1,
    invitations: 1,
  });
  expect(answered.erasure?.erased.events).toBeGreaterThan(0);
  // A replay returns the same answer without erasing twice.
  expect((await erasure.executeErasure(admin, self.id, execution, executeKey)).revision).toBe(
    answered.revision,
  );

  const lead = (
    await database.pool.query<Record<string, unknown>>(
      "select title,client_name,object,next_action,details,client_user_id,client_profile_id,client_erased_at,client_erasure_request_id from partner_leads where id=$1",
      [erasable.id],
    )
  ).rows[0]!;
  expect(lead).toMatchObject({
    title: "Demande effacée",
    client_name: "Client effacé",
    object: "",
    next_action: "",
    client_user_id: null,
    client_profile_id: null,
    client_erasure_request_id: self.id,
  });
  expect(lead.client_erased_at).toBeInstanceOf(Date);
  expect(lead.details).toEqual({
    context: "",
    email: "",
    phone: "",
    language: "",
    source: "",
    objectReference: "",
    transmissionAuthorized: true,
  });
  const leftovers = (
    await database.pool.query<{ text: string }>(
      `select string_agg(x,' | ') text from (
        select text x from partner_events where lead_id=$1
        union all select title||' '||description from partner_tasks where lead_id=$1
        union all select location from partner_appointments where lead_id=$1
        union all select email from partner_client_invitations where lead_id=$1) t`,
      [erasable.id],
    )
  ).rows[0]!.text;
  for (const gone of [
    "Allergie",
    "Mme Kilo",
    "Numéro privé",
    "Rue de la Personne",
    "kilo@client.test",
  ])
    expect(leftovers).not.toContain(gone);
  expect(leftovers).toContain("erased@coverview.invalid");
  expect(
    (
      await database.pool.query(
        "select 1 from partner_advice_preferences where lead_id=$1 union all select 1 from partner_notifications where lead_id=$1 and audience='wallet'",
        [erasable.id],
      )
    ).rowCount,
  ).toBe(0);
  // The client no longer sees the erased request; the kept one stays theirs. The advisor keeps a
  // closed request without the client's words.
  expect(
    (await repository.list(client, { view: "all", sort: "created", limit: 60 })).items.map(
      (i) => i.id,
    ),
  ).toEqual(expect.not.arrayContaining([erasable.id]));
  expect((await repository.detail(client, disputed.id)).id).toBe(disputed.id);
  await expect(repository.detail(client, erasable.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  expect(await repository.detail(advisor, erasable.id)).toMatchObject({
    title: "Demande effacée",
    clientName: "Client effacé",
    clientUserId: null,
  });
  // Outside an erasure, an invitation's recipient still cannot change.
  for (const email of ["autre@client.test", "erased@coverview.invalid"])
    await expect(
      database.pool.query("update partner_client_invitations set email=$2 where lead_id=$1", [
        disputed.id,
        email,
      ]),
    ).resolves.toMatchObject({ rowCount: 0 });
  await database.pool.query(
    "insert into partner_client_invitations(id,lead_id,email,created_by,expires_at) values($1,$2,'lima@client.test',$3,now()+interval '14 days')",
    [`pci_${key()}`, disputed.id, advisor.userId],
  );
  for (const email of ["autre@client.test", "erased@coverview.invalid"])
    await expect(
      database.pool.query("update partner_client_invitations set email=$2 where lead_id=$1", [
        disputed.id,
        email,
      ]),
    ).rejects.toMatchObject({ code: "23514" });
  // The person reads what was erased and what was kept, and why.
  const summary = (await rights.walletData(client)).requests.find((item) => item.id === self.id);
  expect(summary).toMatchObject({
    outcome: "partially_done",
    erasure: { kept: [{ holds: ["dispute"] }] },
  });
});
