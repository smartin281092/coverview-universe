import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  leadCreateInputSchema,
  partnerApplicationInputSchema,
  type PartnerApplication,
} from "@coverview/contracts/partner";
import { commercialTermsSchema } from "@coverview/contracts/partner-economy";
import { createDatabase } from "./db/database.js";
import { createPartnerRepository } from "../modules/partner-workspace/partner.repository.js";
import type { PartnerActor } from "../modules/partner-workspace/partner.policy.js";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let repository: ReturnType<typeof createPartnerRepository>;
let admin: PartnerActor;
const key = () => randomUUID();
const later = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();
const reason = "Décision motivée dans un test isolé";
const note = "Conditions synthétiques, uniquement dans PostgreSQL jetable";

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_team_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  await migrate(database.db, {
    migrationsFolder: fileURLToPath(new URL("../../drizzle/", import.meta.url)),
  });
  repository = createPartnerRepository(database.pool);
  admin = await actor({ administrator: true });
});
afterAll(async () => {
  if (database) await database.pool.end();
  if (container) await container.stop();
});

async function actor(
  options: { administrator?: boolean; email?: string } = {},
): Promise<PartnerActor> {
  const administrator = options.administrator ?? false;
  const value = { userId: `user_${key()}`, id: `session_${key()}`, administrator };
  await database.pool.query(
    "insert into identity_users(id,workos_user_id,email) values($1,$2,$3)",
    [value.userId, key(), options.email ?? `${key()}@team.test`],
  );
  await database.pool.query("insert into identity_profiles(id,user_id) values($1,$2)", [
    key(),
    value.userId,
  ]);
  await database.pool.query(
    "insert into identity_sessions(id,user_id,workos_session_id,token_hash,device,expires_at,mfa_verified_at) values($1,$2,$3,$4,'Isolated team',now()+interval '1 hour',now()-interval '1 second')",
    [value.id, value.userId, key(), createHash("sha256").update(key()).digest("hex")],
  );
  if (administrator)
    await database.pool.query(
      "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated test')",
      [key(), value.userId],
    );
  return value;
}
const application = (name: string, organization = `Cabinet ${name}`) =>
  partnerApplicationInputSchema.parse({
    name,
    organization,
    phone: "",
    roles: ["advisor"],
    categories: ["vehicle"],
    languages: "fr",
    regions: "GE",
    qualifications: "Test",
  });
const member = async (person: PartnerActor) => (await repository.context(person)).application!;
async function approve(person: PartnerActor, roles: ("advisor" | "manager")[] = ["advisor"]) {
  const current = await member(person);
  await repository.review(
    admin,
    person.userId,
    {
      revision: current.revision,
      state: "approved",
      roles,
      reason: "Validation dans un test isolé",
      reviewDueAt: null,
      ...(current.organizationState === "approved" ? {} : { organizationState: "approved" }),
    },
    key(),
  );
}
// A founding manager of their own, approved organisation.
async function manager(name: string) {
  const person = await actor();
  await repository.apply(person, application(name), key());
  await approve(person, ["advisor", "manager"]);
  return person;
}
// A colleague who joins through the real invitation path and is approved by CoverView.
async function colleague(lead: PartnerActor, name: string) {
  const email = `${key()}@cabinet.test`;
  const person = await actor({ email });
  const team = await repository.inviteTeamMember(lead, { email }, key());
  const invitation = team.invitations.find((i) => i.email === email)!;
  await repository.apply(person, application(name, "Nom saisi librement"), key(), invitation.id);
  await approve(person);
  return person;
}
async function request(owner: PartnerActor) {
  const lead = await repository.create(
    owner,
    leadCreateInputSchema.parse({
      title: "Besoin isolé",
      category: "vehicle",
      object: "Objet isolé",
      context: "Contexte isolé",
      clientUserId: owner.userId,
      clientProfileId: null,
      clientName: "Personne isolée",
      email: "client@team.test",
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
  return lead.id;
}
async function assign(by: PartnerActor, leadId: string, responsibleId: string) {
  const current = await repository.detail(by, leadId);
  return repository.command(
    by,
    leadId,
    { action: "assign", revision: current.revision, responsibleId, reason },
    key(),
  );
}
const responsible = async (leadId: string) =>
  (
    await database.pool.query<{ responsible_id: string | null; assignment: string }>(
      "select responsible_id,assignment from partner_leads where id=$1",
      [leadId],
    )
  ).rows[0]!;

it("invites a colleague by verified address, who joins by applying and is validated apart", async () => {
  const lead = await manager("Marie Manager");
  const organization = (await member(lead)).organizationId;
  const outsider = await manager("Olga Autre");
  const invited = await actor({ email: "collegue@cabinet-marie.test" });
  const stranger = await actor();

  await expect(
    repository.inviteTeamMember(outsider, { email: "x@test.test" }, key()),
  ).resolves.toBeDefined();
  const plain = await actor();
  await repository.apply(plain, application("Paul Simple"), key());
  await approve(plain);
  await expect(
    repository.inviteTeamMember(plain, { email: "y@test.test" }, key()),
  ).rejects.toMatchObject({ statusCode: 403 });
  // A current colleague's address is refused; the address is normalised.
  const own = (
    await database.pool.query<{ email: string }>("select email from identity_users where id=$1", [
      lead.userId,
    ])
  ).rows[0]!.email;
  await expect(repository.inviteTeamMember(lead, { email: own }, key())).rejects.toMatchObject({
    statusCode: 409,
  });
  const team = await repository.inviteTeamMember(
    lead,
    { email: "  Collegue@Cabinet-Marie.test " },
    key(),
  );
  const invitation = team.invitations[0]!;
  expect(invitation).toMatchObject({
    email: "collegue@cabinet-marie.test",
    state: "pending",
    invitedBy: "Marie Manager",
  });

  // Only the account verified with that address sees and accepts it.
  expect((await repository.receivedTeamInvitations(stranger)).items).toEqual([]);
  expect((await repository.receivedTeamInvitations(invited)).items).toEqual([
    {
      id: invitation.id,
      organizationName: "Cabinet Marie Manager",
      invitedBy: "Marie Manager",
      expiresAt: invitation.expiresAt,
      blocker: null,
    },
  ]);
  await expect(
    repository.apply(stranger, application("Simon Intrus"), key(), invitation.id),
  ).rejects.toMatchObject({ statusCode: 404 });
  await repository.apply(invited, application("Inès Invitée", "Nom libre"), key(), invitation.id);
  const joined: PartnerApplication = await member(invited);
  expect(joined).toMatchObject({
    organizationId: organization,
    organization: "Cabinet Marie Manager",
    state: "submitted",
    grantedRoles: [],
  });
  expect((await repository.context(invited)).operational).toBe(false);
  await expect(
    repository.apply(invited, application("Inès Invitée"), key(), invitation.id),
  ).rejects.toMatchObject({ statusCode: 404 });

  // CoverView validates the person; the organisation, already approved, is left alone.
  await approve(invited);
  expect((await repository.context(invited)).operational).toBe(true);
  expect(
    (await repository.organizationAccess(admin, organization)).decisions.filter(
      (d) => d.kind === "organization_review",
    ),
  ).toHaveLength(1);
  const view = await repository.team(lead);
  expect(view.invitations[0]).toMatchObject({ id: invitation.id, state: "accepted" });
  expect(view.members.map((m) => m.name).sort()).toEqual(["Inès Invitée", "Marie Manager"]);
});

it("lets the invited person decline, the manager cancel, and refuses expired or blocked invitations", async () => {
  const lead = await manager("Denis Directeur");
  const organization = (await member(lead)).organizationId;
  const declining = await actor({ email: "refus@cabinet-denis.test" });
  let team = await repository.inviteTeamMember(lead, { email: "refus@cabinet-denis.test" }, key());
  const declined = team.invitations[0]!;
  await repository.declineTeamInvitation(declining, declined.id, key());
  expect((await repository.receivedTeamInvitations(declining)).items).toEqual([]);
  await expect(
    repository.declineTeamInvitation(declining, declined.id, key()),
  ).rejects.toMatchObject({ statusCode: 404 });

  team = await repository.inviteTeamMember(lead, { email: "annule@cabinet-denis.test" }, key());
  const first = team.invitations[0]!;
  // A new invitation to the same address replaces the previous one.
  team = await repository.inviteTeamMember(lead, { email: "annule@cabinet-denis.test" }, key());
  expect(team.invitations.find((i) => i.id === first.id)?.state).toBe("cancelled");
  team = await repository.cancelTeamInvitation(lead, team.invitations[0]!.id, key());
  expect(team.invitations[0]!.state).toBe("cancelled");
  expect(
    (await repository.receivedTeamInvitations(await actor({ email: "annule@cabinet-denis.test" })))
      .items,
  ).toEqual([]);

  const expiredId = `pti_${key()}`;
  await database.pool.query(
    "insert into partner_team_invitations(id,organization_id,email,invited_by,created_at,expires_at) values($1,$2,'echue@cabinet-denis.test',$3,now()-interval '20 days',now()-interval '6 days')",
    [expiredId, organization, lead.userId],
  );
  const late = await actor({ email: "echue@cabinet-denis.test" });
  expect((await repository.receivedTeamInvitations(late)).items).toEqual([]);
  await expect(
    repository.apply(late, application("Luc Tardif"), key(), expiredId),
  ).rejects.toMatchObject({ statusCode: 404 });

  // An approved member of another organisation must end that membership first.
  const busy = await actor({ email: "occupe@ailleurs.test" });
  await repository.apply(busy, application("Bea Occupée"), key());
  await approve(busy);
  team = await repository.inviteTeamMember(lead, { email: "occupe@ailleurs.test" }, key());
  expect((await repository.receivedTeamInvitations(busy)).items[0]?.blocker).toBe(
    "membership_active",
  );
  await expect(
    repository.apply(busy, application("Bea Occupée"), key(), team.invitations[0]!.id),
  ).rejects.toMatchObject({ statusCode: 409 });

  // The outcome is written once, and nothing is deleted.
  await expect(
    database.pool.query("update partner_team_invitations set declined_at=null where id=$1", [
      declined.id,
    ]),
  ).rejects.toMatchObject({ code: "23514" });
  await expect(
    database.pool.query("delete from partner_team_invitations where id=$1", [declined.id]),
  ).rejects.toMatchObject({ code: "23514" });

  // Bounded: ten new invitations per day and per organisation.
  const busier = await manager("Nora Nombreuse");
  for (let index = 0; index < 10; index += 1)
    team = await repository.inviteTeamMember(busier, { email: `n${index}@nombreuse.test` }, key());
  expect(team.canInvite).toBe(false);
  await expect(
    repository.inviteTeamMember(busier, { email: "n10@nombreuse.test" }, key()),
  ).rejects.toMatchObject({ statusCode: 429 });
});

it("shows the team to its manager and lets them end a colleague's membership", async () => {
  const owner = { ...(await actor()), wallet: true };
  const lead = await manager("Hugo Hôte");
  const departing = await colleague(lead, "Dora Départ");
  const other = await manager("Ugo Ailleurs");
  const leadId = await request(owner);
  await assign(admin, leadId, departing.userId);
  const restriction = await member(departing);
  await repository.restrictMember(
    admin,
    departing.userId,
    {
      restrictionRevision: restriction.restrictionRevision,
      newLeads: true,
      leadCreation: false,
      marketplace: false,
      categories: [],
      reviewAt: later(48),
      reason,
    },
    key(),
  );

  let team = await repository.team(lead);
  const seen = team.members.find((m) => m.userId === departing.userId)!;
  expect(seen).toMatchObject({ activeLeads: 1, canRemove: true, self: false });
  expect(seen.restrictions).toEqual({
    newLeads: true,
    leadCreation: false,
    marketplace: false,
    categories: [],
  });
  expect(JSON.stringify(team)).not.toContain(reason);
  await expect(repository.team(departing)).rejects.toMatchObject({ statusCode: 403 });

  const current = await member(departing);
  await expect(
    repository.removeTeamMember(
      other,
      departing.userId,
      { revision: current.revision, reason },
      key(),
    ),
  ).rejects.toMatchObject({ statusCode: 404 });
  await expect(
    repository.removeTeamMember(lead, lead.userId, { revision: 0, reason }, key()),
  ).rejects.toMatchObject({ statusCode: 403 });
  await expect(
    repository.removeTeamMember(
      lead,
      departing.userId,
      { revision: current.revision + 1, reason },
      key(),
    ),
  ).rejects.toMatchObject({ statusCode: 409 });
  team = await repository.removeTeamMember(
    lead,
    departing.userId,
    { revision: current.revision, reason },
    key(),
  );
  expect(team.members.map((m) => m.userId)).not.toContain(departing.userId);
  expect(await responsible(leadId)).toEqual({ responsible_id: null, assignment: "reassign" });
  expect(await member(departing)).toMatchObject({ state: "closed" });
  expect((await repository.context(departing)).operational).toBe(false);
  expect((await repository.accessDecisions(departing, departing.userId)).items[0]).toMatchObject({
    kind: "team_removal",
    author: "manager",
    state: "closed",
    reason,
  });

  // Another manager of the same organisation is never removed by a peer.
  const peer = await colleague(lead, "Paula Pair");
  const peered = await member(peer);
  await repository.review(
    admin,
    peer.userId,
    {
      revision: peered.revision,
      state: "approved",
      roles: ["advisor", "manager"],
      reason,
      reviewDueAt: null,
    },
    key(),
  );
  await expect(
    repository.removeTeamMember(
      lead,
      peer.userId,
      { revision: (await member(peer)).revision, reason },
      key(),
    ),
  ).rejects.toMatchObject({ statusCode: 403 });

  // After leaving, the person may join another organisation through its invitation.
  const email = (
    await database.pool.query<{ email: string }>("select email from identity_users where id=$1", [
      departing.userId,
    ])
  ).rows[0]!.email;
  const invitation = (await repository.inviteTeamMember(other, { email }, key())).invitations[0]!;
  await repository.apply(departing, application("Dora Départ"), key(), invitation.id);
  expect(await member(departing)).toMatchObject({
    state: "submitted",
    organization: "Cabinet Ugo Ailleurs",
  });
});

it("lets the manager reassign a request within the team only, and read the team's terms", async () => {
  const owner = { ...(await actor()), wallet: true };
  const lead = await manager("Clara Cheffe");
  const first = await colleague(lead, "Fanny Première");
  const second = await colleague(lead, "Simon Second");
  const outsider = await manager("Xavier Extérieur");
  const leadId = await request(owner);
  await assign(admin, leadId, first.userId);
  expect((await repository.detail(lead, leadId)).canAssign).toBe(true);
  expect((await repository.detail(second, leadId).catch(() => null))?.canAssign ?? false).toBe(
    false,
  );

  await assign(lead, leadId, second.userId);
  expect(await responsible(leadId)).toEqual({
    responsible_id: second.userId,
    assignment: "proposed",
  });
  const decision = (
    await database.pool.query<{ actor_id: string; kind: string }>(
      "select actor_id,kind from partner_matching_decisions where lead_id=$1 order by created_at desc limit 1",
      [leadId],
    )
  ).rows[0];
  expect(decision).toEqual({ actor_id: lead.userId, kind: "manual" });
  await expect(assign(lead, leadId, outsider.userId)).rejects.toMatchObject({ statusCode: 403 });
  await expect(assign(second, leadId, first.userId)).rejects.toMatchObject({ statusCode: 403 });
  const restricted = await member(first);
  await repository.restrictMember(
    admin,
    first.userId,
    {
      restrictionRevision: restricted.restrictionRevision,
      newLeads: true,
      leadCreation: false,
      marketplace: false,
      categories: [],
      reviewAt: null,
      reason,
    },
    key(),
  );
  await expect(assign(lead, leadId, first.userId)).rejects.toMatchObject({
    code: "PARTNER_INVALID_ASSIGNEE",
  });
  const foreign = await request(owner);
  await assign(admin, foreign, outsider.userId);
  await expect(assign(lead, foreign, second.userId)).rejects.toMatchObject({ statusCode: 404 });

  // The team's terms, read only; another organisation's terms stay out of reach.
  const terms = (owned: PartnerActor) =>
    repository.createCommercialCondition(
      owned,
      {
        terms: commercialTermsSchema.parse({
          categories: ["vehicle"],
          companies: ["axa"],
          validFrom: later(-1),
          validUntil: later(24 * 30),
          supplier: { model: "success", rateBps: 2000, trigger: "commission_received" },
          currency: "CHF",
          basis: note,
          deductions: [],
          coverviewRateBps: 1000,
          contributors: [],
          collector: "coverview",
          reserveTerms: note,
          clawbackTerms: note,
          paymentTerms: note,
          validityCriteria: note,
          disputeDays: 30,
          replacementRefundTerms: note,
          sourceReference: note,
          branchRules: note,
          caps: note,
          taxTreatment: note,
          bonusTerms: note,
        }),
        confirmed: true,
      },
      key(),
    );
  const teamTerms = await terms(second);
  const foreignTerms = await terms(outsider);
  const listed = await repository.commercialConditions(lead);
  expect(listed.items.find((c) => c.id === teamTerms.id)).toMatchObject({
    ownerId: second.userId,
    canWithdraw: false,
    canReview: false,
  });
  expect(listed.items.map((c) => c.id)).not.toContain(foreignTerms.id);
  const ordinary = await repository.commercialConditions(first);
  expect(ordinary.items.map((c) => c.id)).not.toContain(teamTerms.id);
});
