import { leadViewFiltersSchema } from "@coverview/contracts/partner-navigation";
import { leadListQuerySchema } from "@coverview/contracts/partner";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { beforeAll, afterAll, expect, it } from "vitest";
import { leadCreateInputSchema, partnerApplicationInputSchema } from "@coverview/contracts/partner";
import { createDatabase } from "./db/database.js";
import { createPartnerRepository } from "../modules/partner-workspace/partner.repository.js";
import type { PartnerActor } from "../modules/partner-workspace/partner.policy.js";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let repository: ReturnType<typeof createPartnerRepository>;
let admin: PartnerActor;
const key = () => randomUUID();
async function actor(administrator = false): Promise<PartnerActor> {
  const value = { userId: `user_${key()}`, id: `session_${key()}`, administrator };
  await database.pool.query(
    "insert into identity_users(id,workos_user_id,email) values($1,$2,$3)",
    [value.userId, key(), `${key()}@assessment.test`],
  );
  await database.pool.query("insert into identity_profiles(id,user_id) values($1,$2)", [
    key(),
    value.userId,
  ]);
  await database.pool.query(
    "insert into identity_sessions(id,user_id,workos_session_id,token_hash,device,expires_at,mfa_verified_at) values($1,$2,$3,$4,'Isolated assessment',now()+interval '1 hour',now()-interval '1 second')",
    [value.id, value.userId, key(), createHash("sha256").update(key()).digest("hex")],
  );
  if (administrator)
    await database.pool.query(
      "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated test')",
      [key(), value.userId],
    );
  return value;
}
async function professional() {
  const person = await actor();
  await repository.apply(
    person,
    partnerApplicationInputSchema.parse({
      name: "Conseiller isolé",
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
async function assigned(
  owner: PartnerActor,
  advisor: PartnerActor,
  profileId: string | null = null,
) {
  let lead = await repository.create(
    owner,
    leadCreateInputSchema.parse({
      title: "Conseil isolé véhicule",
      category: "vehicle",
      object: "Voiture",
      context: "Besoin isolé",
      clientUserId: owner.userId,
      clientProfileId: profileId,
      clientName: "Personne isolée",
      email: "client@assessment.test",
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
  lead = await repository.command(
    admin,
    lead.id,
    {
      action: "assign",
      revision: lead.revision,
      responsibleId: advisor.userId,
      reason: "Test isolé",
    },
    key(),
  );
  return repository.command(advisor, lead.id, { action: "accept", revision: lead.revision }, key());
}
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_navigation_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  const migrationsFolder = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  await migrate(database.db, { migrationsFolder });
  await migrate(database.db, { migrationsFolder });
  repository = createPartnerRepository(database.pool);
  admin = await actor(true);
});
afterAll(async () => {
  if (database) await database.pool.end();
  if (container) await container.stop();
});

it("saves private versioned views, replays the same command and removes without deleting Leads", async () => {
  const person = await professional(),
    other = await professional(),
    requestKey = key();
  const input = {
    action: "save" as const,
    id: null,
    revision: 0,
    name: "Urgences privées",
    filters: leadViewFiltersSchema.parse({
      view: "mine",
      priority: "urgent",
      q: "Recherche privée",
      layout: "list",
    }),
  };
  const saved = await repository.saveLeadView(person, input, requestKey);
  expect(saved).toMatchObject({
    name: input.name,
    revision: 1,
    active: true,
    filters: input.filters,
  });
  expect((await repository.saveLeadView(person, input, requestKey)).id).toBe(saved.id);
  expect((await repository.leadViews(other)).items).toHaveLength(0);
  expect((await repository.leadViews(admin)).items).toHaveLength(0);
  await expect(
    repository.saveLeadView(other, { ...input, id: saved.id, revision: 1 }, key()),
  ).rejects.toMatchObject({ code: "PARTNER_NOT_FOUND" });
  const updated = await repository.saveLeadView(
    person,
    { ...input, id: saved.id, revision: 1, name: "Nouveau nom" },
    key(),
  );
  expect(updated.revision).toBe(2);
  await expect(
    repository.saveLeadView(person, { ...input, id: saved.id, revision: 1 }, key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  expect(
    (await repository.saveLeadView(person, { action: "remove", id: saved.id, revision: 2 }, key()))
      .active,
  ).toBe(false);
  expect((await repository.leadViews(person)).items).toHaveLength(0);
  await expect(
    database.pool.query(
      "update partner_lead_views set active=true,revision=revision+1 where id=$1",
      [saved.id],
    ),
  ).rejects.toMatchObject({ code: "23514" });
});
it("limits twenty active views atomically and releases a slot after removal", async () => {
  const person = await professional(),
    filters = leadViewFiltersSchema.parse({ view: "all" });
  for (let i = 0; i < 19; i++)
    await repository.saveLeadView(
      person,
      { action: "save", id: null, revision: 0, name: `Vue ${i}`, filters },
      key(),
    );
  const results = await Promise.allSettled(
    [20, 21].map((i) =>
      repository.saveLeadView(
        person,
        { action: "save", id: null, revision: 0, name: `Vue ${i}`, filters },
        key(),
      ),
    ),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const views = (await repository.leadViews(person)).items;
  expect(views).toHaveLength(20);
  await repository.saveLeadView(
    person,
    { action: "remove", id: views[0]!.id, revision: views[0]!.revision },
    key(),
  );
  await repository.saveLeadView(
    person,
    { action: "save", id: null, revision: 0, name: "Nouvelle vue", filters },
    key(),
  );
  expect((await repository.leadViews(person)).items).toHaveLength(20);
});
it("applies filter intersections, exclusive time bounds and pagination within current access", async () => {
  const advisor = await professional(),
    other = await professional(),
    owner = { ...(await actor()), wallet: true };
  const first = await assigned(owner, advisor),
    second = await assigned(owner, advisor),
    hidden = await assigned(owner, other);
  const from = new Date(Date.now() - 3600000).toISOString(),
    to = new Date(Date.now() + 3600000).toISOString();
  await database.pool.query(
    "update partner_leads set priority='urgent',waiting=$2 where id=any($1::text[])",
    [[first.id, second.id, hidden.id], JSON.stringify({ reason: "Attente isolée", until: to })],
  );
  const filters = leadListQuerySchema.parse({
    view: "all",
    priority: "urgent",
    assignment: "accepted",
    waiting: "active",
    createdFrom: from,
    createdTo: to,
    limit: 1,
  });
  const page1 = await repository.list(advisor, filters);
  expect(page1.items).toHaveLength(1);
  expect(page1.nextCursor).not.toBeNull();
  const page2 = await repository.list(advisor, { ...filters, cursor: page1.nextCursor! });
  expect(new Set([...page1.items, ...page2.items].map((l) => l.id))).toEqual(
    new Set([first.id, second.id]),
  );
  expect(page2.nextCursor).toBeNull();
  expect((await repository.list(advisor, { ...filters, priority: "normal" })).items).toHaveLength(
    0,
  );
  expect((await repository.list(advisor, { ...filters, waiting: "due" })).items).toHaveLength(0);
  const record = (
    await database.pool.query<{ created_at: Date }>(
      "select created_at from partner_leads where id=$1",
      [first.id],
    )
  ).rows[0]!;
  expect(
    (await repository.list(advisor, { ...filters, createdTo: record.created_at.toISOString() }))
      .items,
  ).toHaveLength(0);
  await expect(
    repository.list(advisor, { ...filters, createdFrom: to, createdTo: from }),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
});
it("rejects Wallet, revoked sessions and stale replays after membership suspension", async () => {
  const person = await professional(),
    input = {
      action: "save" as const,
      id: null,
      revision: 0,
      name: "Vue de test",
      filters: leadViewFiltersSchema.parse({}),
    },
    requestKey = key();
  await repository.saveLeadView(person, input, requestKey);
  await expect(repository.leadViews({ ...(await actor()), wallet: true })).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await database.pool.query("update partner_members set state='suspended' where user_id=$1", [
    person.userId,
  ]);
  await expect(repository.saveLeadView(person, input, requestKey)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  const active = await professional();
  await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
    active.id,
  ]);
  await expect(repository.leadViews(active)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
});
