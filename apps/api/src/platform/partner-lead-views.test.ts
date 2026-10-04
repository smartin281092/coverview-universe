import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  leadCreateInputSchema,
  partnerApplicationInputSchema,
  type LeadListQuery,
} from "@coverview/contracts/partner";
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
    .withDatabase("coverview_lead_views_test")
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
    [value.userId, key(), `${key()}@views.test`],
  );
  await database.pool.query("insert into identity_profiles(id,user_id) values($1,$2)", [
    key(),
    value.userId,
  ]);
  await database.pool.query(
    "insert into identity_sessions(id,user_id,workos_session_id,token_hash,device,expires_at,mfa_verified_at) values($1,$2,$3,$4,'Isolated views',now()+interval '1 hour',now()-interval '1 second')",
    [value.id, value.userId, key(), sha256(key())],
  );
  if (administrator)
    await database.pool.query(
      "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated test')",
      [key(), value.userId],
    );
  return value;
}
async function member(
  name: string,
  roles: ("advisor" | "referrer" | "manager")[],
  organization?: string,
) {
  const person = await actor();
  await repository.apply(
    person,
    partnerApplicationInputSchema.parse({
      name,
      organization: "Organisation isolée",
      phone: "",
      roles,
      categories: ["vehicle", "health"],
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
  // Members of one team share the manager's organization.
  if (organization)
    await database.pool.query("update partner_members set organization_id=$2 where user_id=$1", [
      person.userId,
      organization,
    ]);
  return person;
}
const organizationOf = async (person: PartnerActor) =>
  (await repository.context(person)).application!.organizationId;
async function lead(
  creator: PartnerActor,
  values: { title: string; responsible?: PartnerActor; due?: string | null; source?: string },
) {
  const created = await repository.create(
    creator,
    leadCreateInputSchema.parse({
      title: values.title,
      category: "vehicle",
      object: "Voiture",
      context: "Vue isolée",
      clientUserId: null,
      clientProfileId: null,
      clientName: "Personne isolée",
      email: "",
      phone: "",
      language: "fr",
      source: values.source ?? "Test",
      transmissionAuthorized: true,
      priority: "normal",
      draft: false,
      nextAction: values.due === null ? "" : "Qualifier",
      dueAt: values.due === null ? null : (values.due ?? later(24)),
    }),
    key(),
  );
  if (!values.responsible) return created;
  const routed = await repository.command(
    admin,
    created.id,
    {
      action: "assign",
      revision: created.revision,
      responsibleId: values.responsible.userId,
      reason: "Test isolé",
    },
    key(),
  );
  return repository.command(
    values.responsible,
    created.id,
    { action: "accept", revision: routed.revision },
    key(),
  );
}
const titles = async (person: PartnerActor, query: Partial<LeadListQuery>) =>
  (
    await repository.list(person, {
      limit: 60,
      sort: "created",
      view: "all",
      ...query,
    })
  ).items
    .map((item) => item.title)
    .sort();

it("serves predefined views, filters and whole-set counts, never beyond visibility", async () => {
  const manager = await member("Marie Responsable", ["manager", "advisor"]);
  const team = await organizationOf(manager);
  const advisor = await member("Alain Conseiller", ["advisor"], team);
  const outsider = await member("Olga Externe", ["advisor"]);
  const referrer = await member("Rita Apporteuse", ["referrer"]);

  await lead(referrer, { title: "A reçu", responsible: advisor, source: "Salon" });
  // A professional cannot create it without next action; the gap appears later in the file.
  const gap = await lead(referrer, { title: "B sans action", responsible: advisor });
  await database.pool.query("update partner_leads set next_action='',due_at=null where id=$1", [
    gap.id,
  ]);
  await lead(referrer, { title: "C externe", responsible: outsider, due: later(1) });
  // An advisor creating in their own category becomes its responsible at once.
  await lead(advisor, { title: "D propre", due: later(2) });
  await lead(referrer, { title: "E sans responsable" });

  expect(await titles(advisor, { view: "received" })).toEqual(["A reçu", "B sans action"]);
  // The team view is the manager's organization; an advisor without the role has none.
  expect(await titles(manager, { view: "team" })).toEqual(["A reçu", "B sans action", "D propre"]);
  expect(await titles(advisor, { view: "team" })).toEqual([]);
  expect(await titles(admin, { view: "team" })).toHaveLength(5);
  // Filters intersect what the actor sees: the outsider's Lead stays invisible to the team.
  expect(await titles(manager, { view: "all", organizationId: team })).toEqual([
    "A reçu",
    "B sans action",
    "D propre",
  ]);
  expect(await titles(admin, { organizationId: team, source: "Salon" })).toEqual(["A reçu"]);
  expect(await titles(admin, { referrerId: referrer.userId, alert: "unassigned" })).toEqual([
    "E sans responsable",
  ]);
  expect(await titles(admin, { alert: "no_next_action" })).toEqual(["B sans action"]);
  expect(await titles(admin, { dueFrom: later(0.5), dueTo: later(3) })).toEqual([
    "C externe",
    "D propre",
  ]);

  // Sorted by due date with a cursor bound to that order; counts cover the whole filtered set.
  const page = await repository.list(admin, {
    view: "all",
    sort: "due",
    limit: 2,
    referrerId: referrer.userId,
  });
  expect(page.items.map((item) => item.title)).toEqual(["C externe", "A reçu"]);
  expect(page.counts).toMatchObject({ total: 4 });
  const next = await repository.list(admin, {
    view: "all",
    sort: "due",
    limit: 2,
    referrerId: referrer.userId,
    cursor: page.nextCursor!,
  });
  expect(next.items.map((item) => item.title)).toEqual(["E sans responsable", "B sans action"]);
  await expect(
    repository.list(admin, {
      view: "all",
      sort: "created",
      limit: 2,
      cursor: page.nextCursor!,
    }),
  ).rejects.toMatchObject({ code: "PARTNER_NOT_FOUND" });
});

it("shares a manager's team view and an Admin global view without granting any access", async () => {
  const manager = await member("Paul Responsable", ["manager", "advisor"]);
  const team = await organizationOf(manager);
  const teammate = await member("Inès Collègue", ["advisor"], team);
  const outsider = await member("Hugo Externe", ["advisor"]);
  const otherAdmin = await actor(true);
  const save = (person: PartnerActor, name: string, scope: "private" | "team" | "global") =>
    repository.saveLeadView(
      person,
      {
        action: "save",
        id: null,
        revision: 0,
        name,
        scope,
        filters: { view: "overdue", limit: 60, sort: "created", layout: "kanban" },
      },
      key(),
    );
  await expect(save(teammate, "Pas responsable", "team")).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await expect(save(manager, "Pas admin", "global")).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  const shared = await save(manager, "Retards de l'équipe", "team");
  expect(shared).toMatchObject({ scope: "team", owned: true });
  const seen = (await repository.leadViews(teammate)).items.find((view) => view.id === shared.id);
  expect(seen).toMatchObject({ name: "Retards de l'équipe", scope: "team", owned: false });
  expect((await repository.leadViews(outsider)).items.map((view) => view.id)).not.toContain(
    shared.id,
  );
  // Only the owner edits or removes a shared view.
  await expect(
    repository.saveLeadView(
      teammate,
      { action: "remove", id: shared.id, revision: shared.revision },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_NOT_FOUND" });

  const global = await save(admin, "Réseau en retard", "global");
  expect(
    (await repository.leadViews(otherAdmin)).items.find((view) => view.id === global.id),
  ).toMatchObject({
    scope: "global",
    owned: false,
  });
  expect((await repository.leadViews(manager)).items.map((view) => view.id)).not.toContain(
    global.id,
  );
  // Leaving the manager role stops sharing the team view.
  await database.pool.query("update partner_members set roles='[\"advisor\"]' where user_id=$1", [
    manager.userId,
  ]);
  expect((await repository.leadViews(teammate)).items.map((view) => view.id)).not.toContain(
    shared.id,
  );
});
