import { createHash, randomUUID } from "node:crypto";
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
import { createDatabase } from "./db/database.js";
import { createPartnerRepository } from "../modules/partner-workspace/partner.repository.js";
import { createDataRightsOperations } from "../modules/partner-workspace/partner.data-rights.js";
import {
  recordMatchingDecision,
  type Matching,
} from "../modules/partner-workspace/partner.matching.js";
import type { PartnerActor } from "../modules/partner-workspace/partner.policy.js";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let repository: ReturnType<typeof createPartnerRepository>;
let rights: ReturnType<typeof createDataRightsOperations>;
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
