import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, expect, it } from "vitest";
import { leadCreateInputSchema, partnerApplicationInputSchema } from "@coverview/contracts/partner";
import { createDatabase } from "./db/database.js";
import { createPartnerRepository } from "../modules/partner-workspace/partner.repository.js";
import type { PartnerActor } from "../modules/partner-workspace/partner.policy.js";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let repository: ReturnType<typeof createPartnerRepository>;
let admin: PartnerActor;
const key = () => randomUUID();
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const later = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_overview_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  const migrationsFolder = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  await migrate(database.db, { migrationsFolder });
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
    [value.userId, key(), `${key()}@overview.test`],
  );
  await database.pool.query("insert into identity_profiles(id,user_id) values($1,$2)", [
    key(),
    value.userId,
  ]);
  await database.pool.query(
    "insert into identity_sessions(id,user_id,workos_session_id,token_hash,device,expires_at,mfa_verified_at) values($1,$2,$3,$4,'Isolated overview',now()+interval '1 hour',now()-interval '1 second')",
    [value.id, value.userId, key(), sha256(key())],
  );
  if (administrator)
    await database.pool.query(
      "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated test')",
      [key(), value.userId],
    );
  return value;
}
async function member(name: string, roles: ("advisor" | "referrer")[]) {
  const person = await actor();
  await repository.apply(
    person,
    partnerApplicationInputSchema.parse({
      name,
      organization: `Cabinet ${name}`,
      phone: "",
      roles,
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
      roles,
      reason: "Test isolé",
      reviewDueAt: null,
      organizationState: "approved",
    },
    key(),
  );
  return person;
}
async function lead(creator: PartnerActor, title: string) {
  return repository.create(
    creator,
    leadCreateInputSchema.parse({
      title,
      category: "vehicle",
      object: "Voiture",
      context: "Aperçu isolé",
      clientUserId: null,
      clientProfileId: null,
      clientName: "Personne isolée",
      email: "",
      phone: "",
      language: "fr",
      source: "Test",
      transmissionAuthorized: true,
      priority: "normal",
      draft: false,
      nextAction: "Qualifier",
      dueAt: later(24),
    }),
    key(),
  );
}
const assign = async (id: string, responsible: PartnerActor) =>
  repository.command(
    admin,
    id,
    {
      action: "assign",
      revision: (await repository.detail(admin, id)).revision,
      responsibleId: responsible.userId,
      reason: "Choix documenté dans un test isolé",
    },
    key(),
  );
const period = () => ({
  from: new Date(Date.now() - 86400000).toISOString(),
  to: new Date(Date.now() + 3600000).toISOString(),
});

it("gives CoverView absolute follow-up counts, reassignments and advisor comparisons", async () => {
  const anna = await member("Anna", ["advisor"]);
  const boris = await member("Boris", ["advisor"]);
  const referrer = await member("Rita", ["referrer"]);
  const first = await lead(referrer, "Réattribué");
  await assign(first.id, anna);
  await assign(first.id, boris);
  const second = await lead(referrer, "Signé");
  await assign(second.id, anna);
  await database.pool.query(
    "update partner_leads set stage='completed',result='contract',reason='price',stage_changed_at=now() where id=$1",
    [second.id],
  );
  const third = await lead(referrer, "Perdu");
  await assign(third.id, anna);
  await database.pool.query(
    "update partner_leads set stage='completed',result='lost',reason='price',stage_changed_at=now() where id=$1",
    [third.id],
  );
  const gap = await lead(referrer, "Sans action");
  await database.pool.query("update partner_leads set next_action='',due_at=null where id=$1", [
    gap.id,
  ]);

  const overview = await repository.adminOverview(admin, period());
  expect(overview.followUp).toMatchObject({ active: 2, noNextAction: 1, unassigned: 1 });
  expect(overview.reassignments).toEqual({ manual: 1, automatic: 0 });
  const row = (name: string) => overview.advisors.find((item) => item.name === name)!;
  expect(row("Anna")).toMatchObject({
    active: 0,
    closed: 2,
    contracts: 1,
    conversionRate: 50,
    responses: 0,
    satisfaction: null,
  });
  expect(row("Anna").cycleDays).not.toBeNull();
  expect(row("Boris")).toMatchObject({ active: 1, closed: 0, conversionRate: null });
  expect(overview.organizations.find((item) => item.name === "Cabinet Anna")).toMatchObject({
    advisors: 1,
    closed: 2,
    contracts: 1,
    conversionRate: 50,
  });
  // A category without Leads empties every count, never the structure.
  expect(
    (await repository.adminOverview(admin, { ...period(), category: "health" })).followUp,
  ).toEqual({
    active: 0,
    noNextAction: 0,
    firstActionOverdue: 0,
    overdue: 0,
    unassigned: 0,
    coverviewQueue: 0,
  });
  await expect(repository.adminOverview(anna, period())).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
});
