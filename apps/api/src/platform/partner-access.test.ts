import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  competenceDeclarationSchema,
  competenceDecisionSchema,
  leadCreateInputSchema,
  partnerApplicationInputSchema,
  type LeadDetail,
} from "@coverview/contracts/partner";
import { marketPublicationSchema } from "@coverview/contracts/partner-economy";
import { createDatabase } from "./db/database.js";
import { createPartnerRepository } from "../modules/partner-workspace/partner.repository.js";
import { processAccessReviews } from "../modules/partner-workspace/partner.access.js";
import type { PartnerActor } from "../modules/partner-workspace/partner.policy.js";

type Category = "vehicle" | "household" | "legal";
let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let repository: ReturnType<typeof createPartnerRepository>;
let admin: PartnerActor;
const key = () => randomUUID();
const later = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();
const reason = "Décision motivée dans un test isolé";

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_access_test")
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
    [value.userId, key(), `${key()}@access.test`],
  );
  await database.pool.query("insert into identity_profiles(id,user_id) values($1,$2)", [
    key(),
    value.userId,
  ]);
  await database.pool.query(
    "insert into identity_sessions(id,user_id,workos_session_id,token_hash,device,expires_at,mfa_verified_at) values($1,$2,$3,$4,'Isolated access',now()+interval '1 hour',now()-interval '1 second')",
    [value.id, value.userId, key(), createHash("sha256").update(key()).digest("hex")],
  );
  if (administrator)
    await database.pool.query(
      "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated test')",
      [key(), value.userId],
    );
  return value;
}
async function applicant(name: string, categories: Category[] = ["vehicle"]) {
  const person = await actor();
  await repository.apply(
    person,
    partnerApplicationInputSchema.parse({
      name,
      organization: `Cabinet ${name}`,
      phone: "",
      roles: ["advisor"],
      categories,
      languages: "fr",
      regions: "GE",
      qualifications: "Test",
    }),
    key(),
  );
  return person;
}
async function professional(name: string, categories: Category[] = ["vehicle"]) {
  const person = await applicant(name, categories);
  const member = (await repository.context(person)).application!;
  await repository.review(
    admin,
    person.userId,
    {
      revision: member.revision,
      state: "approved",
      roles: ["advisor"],
      reason: "Validation dans un test isolé",
      reviewDueAt: null,
      organizationState: "approved",
    },
    key(),
  );
  return person;
}
const application = async (person: PartnerActor) => (await repository.context(person)).application!;
async function request(owner: PartnerActor, category: Category = "vehicle") {
  const lead = await repository.create(
    owner,
    leadCreateInputSchema.parse({
      title: "Besoin isolé",
      category,
      object: "Objet isolé",
      context: "Contexte isolé",
      clientUserId: owner.userId,
      clientProfileId: null,
      clientName: "Personne isolée",
      email: "client@access.test",
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
  return repository.detail(owner, lead.id);
}
async function assign(lead: LeadDetail, responsibleId: string) {
  const current = await repository.detail(admin, lead.id);
  return repository.command(
    admin,
    lead.id,
    { action: "assign", revision: current.revision, responsibleId, reason },
    key(),
  );
}
async function restrict(
  person: PartnerActor,
  values: Partial<{
    newLeads: boolean;
    leadCreation: boolean;
    marketplace: boolean;
    categories: Category[];
    reviewAt: string | null;
  }>,
) {
  const current = await application(person);
  return repository.restrictMember(
    admin,
    person.userId,
    {
      restrictionRevision: current.restrictionRevision,
      newLeads: false,
      leadCreation: false,
      marketplace: false,
      categories: [],
      reviewAt: null,
      reason,
      ...values,
    },
    key(),
  );
}
async function competence(person: PartnerActor, category: Category, validUntil: string) {
  const current = await repository.competence(person, person.userId, category);
  const dossier = await repository.declareCompetence(
    person,
    person.userId,
    category,
    competenceDeclarationSchema.parse({
      revision: 0,
      professionalRevision: current.professionalRevision,
      declaration: "Compétence déclarée dans un test isolé",
      file: {
        name: "Preuve.pdf",
        mime: "application/pdf",
        size: 20,
        checksum: createHash("sha256").update(key()).digest("hex"),
      },
      confirmed: true,
    }),
    key(),
  );
  await repository.completeCompetenceUpload(
    person,
    person.userId,
    category,
    dossier.current!.id,
    "application/pdf",
  );
  // Isolated scanner result, never a claim about a real certificate.
  await database.pool.query(
    "update files set state='ready',scan_version='isolated',revision=revision+1 where id=$1",
    [dossier.current!.documentId],
  );
  const reviewed = await repository.competence(person, person.userId, category);
  await repository.decideCompetence(
    admin,
    person.userId,
    category,
    competenceDecisionSchema.parse({
      revision: reviewed.current!.revision,
      decision: "reviewed",
      reason: "Examen isolé",
      scope: "Périmètre de test",
      coverage: "category",
      validUntil,
      documentRevision: reviewed.current!.documentRevision,
      originalChecked: true,
    }),
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

it("restricts new engagements only, keeps the requests in progress and journals the decision", async () => {
  const owner = { ...(await actor()), wallet: true };
  const restricted = await professional("Rita Restreinte", ["vehicle", "household"]);
  const colleague = await professional("Colin Collègue");
  const current = await request(owner);
  await assign(current, restricted.userId);
  const proposal = await repository.detail(restricted, current.id);
  await repository.command(
    restricted,
    current.id,
    { action: "accept", revision: proposal.revision },
    key(),
  );
  const referents = async () =>
    (await repository.referentProfile(owner, "self", "vehicle")).candidates.map((c) => c.id);
  expect(await referents()).toContain(restricted.userId);
  const before = await application(restricted);

  // Only CoverView decides, on a fresh revision and on declared categories only.
  await expect(
    repository.restrictMember(
      colleague,
      restricted.userId,
      {
        restrictionRevision: 0,
        newLeads: true,
        leadCreation: false,
        marketplace: false,
        categories: [],
        reviewAt: null,
        reason,
      },
      key(),
    ),
  ).rejects.toMatchObject({ statusCode: 403 });
  await expect(restrict(restricted, { categories: ["legal"] })).rejects.toMatchObject({
    code: "PARTNER_ACTION_REQUIRED",
  });
  const item = await restrict(restricted, { newLeads: true, reviewAt: later(48) });
  // No longer offered to the client as the usual advisor for the next requests.
  expect(await referents()).not.toContain(restricted.userId);
  expect(item).toMatchObject({
    flags: { restricted: true, restrictionReview: "soon" },
    application: { restrictions: { newLeads: true, reviewAt: expect.any(String) as string } },
    activeLeads: 1,
  });
  await expect(
    repository.restrictMember(
      admin,
      restricted.userId,
      {
        restrictionRevision: before.restrictionRevision,
        newLeads: false,
        leadCreation: false,
        marketplace: false,
        categories: [],
        reviewAt: null,
        reason,
      },
      key(),
    ),
  ).rejects.toMatchObject({ statusCode: 409 });
  // The membership revision is untouched: appointments, links and proposals keep their basis.
  expect((await application(restricted)).revision).toBe(before.revision);

  // A new request: excluded from matching with its own reason, never assigned or transferred.
  const next = await request(owner);
  const matching = await repository.leadMatching(admin, next.id);
  expect(matching.excluded).toContainEqual({ reason: "restricted", count: 1 });
  await expect(assign(next, restricted.userId)).rejects.toMatchObject({
    code: "PARTNER_INVALID_ASSIGNEE",
  });
  await assign(next, colleague.userId);
  const proposed = await repository.detail(admin, next.id);
  await expect(
    repository.command(
      admin,
      next.id,
      {
        action: "collaboration_propose",
        revision: proposed.revision,
        terms: {
          targetId: restricted.userId,
          mode: "co_advice",
          access: "read",
          communication: "referent_only",
          scope: "Analyse partagée du besoin",
          responsibilities: "Avis sur les offres reçues",
          reason,
          economicNote: "Aucune répartition convenue",
          existingRightsPreserved: true,
          transmissionConfirmed: true,
        },
      },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_ASSIGNEE" });

  // The request in progress continues with its responsible.
  const held = await repository.detail(restricted, current.id);
  await repository.command(
    restricted,
    current.id,
    { action: "note", revision: held.revision, text: "Suivi poursuivi", audience: "private" },
    key(),
  );
  expect((await responsible(current.id)).responsible_id).toBe(restricted.userId);

  // A transmitted request goes to CoverView instead of self-assignment; transmission can stop too.
  const transmitted = await repository.create(
    restricted,
    leadCreateInputSchema.parse({
      title: "Demande transmise",
      category: "vehicle",
      object: "Objet transmis",
      context: "Contexte transmis",
      clientUserId: null,
      clientProfileId: null,
      clientName: "Contact transmis",
      email: "contact@access.test",
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
  expect((await responsible(transmitted.id)).responsible_id).toBeNull();
  await restrict(restricted, { newLeads: true, leadCreation: true });
  expect((await repository.context(restricted)).canCreate).toBe(false);
  await expect(
    repository.create(
      restricted,
      leadCreateInputSchema.parse({
        title: "Demande refusée",
        category: "vehicle",
        object: "Objet",
        context: "Contexte",
        clientUserId: null,
        clientProfileId: null,
        clientName: "Contact",
        email: "refus@access.test",
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
    ),
  ).rejects.toMatchObject({ statusCode: 403 });

  // A category restriction is limited to that category.
  await restrict(restricted, { categories: ["household"] });
  await assign(await request(owner), restricted.userId);
  await expect(assign(await request(owner, "household"), restricted.userId)).rejects.toMatchObject({
    code: "PARTNER_INVALID_ASSIGNEE",
  });

  // A marketplace restriction stops publication before anything else is read.
  const publication = marketPublicationSchema.parse({
    leadRevision: held.revision,
    conditionId: "pcc_unknown",
    language: "fr",
    canton: "GE",
    modes: ["video"],
    reason: "specialist",
    qualification: "contacted",
    steps: ["contact"],
    constraints: [],
    expiresAt: later(1),
    publicationConfirmed: true,
  });
  await expect(
    repository.publishMarket(restricted, current.id, publication, key()),
  ).rejects.not.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  await restrict(restricted, { marketplace: true });
  await expect(
    repository.publishMarket(restricted, current.id, publication, key()),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED", statusCode: 403 });

  // Each decision is journalled with its author, reason and content; the person reads theirs.
  const journal = await repository.accessDecisions(admin, restricted.userId);
  expect(journal.items.filter((d) => d.kind === "restriction")).toHaveLength(4);
  expect(journal.items[0]).toMatchObject({
    kind: "restriction",
    author: "coverview",
    reason,
    restrictions: { marketplace: true, newLeads: false },
  });
  expect((await repository.accessDecisions(restricted, restricted.userId)).items).toHaveLength(
    journal.items.length,
  );
  await expect(repository.accessDecisions(colleague, restricted.userId)).rejects.toMatchObject({
    statusCode: 403,
  });
  await expect(
    database.pool.query("update partner_access_decisions set reason='Réécrite' where user_id=$1", [
      restricted.userId,
    ]),
  ).rejects.toMatchObject({ code: "23514" });
});

it("decides an organisation on its own and withdraws every member when it is blocked", async () => {
  const owner = { ...(await actor()), wallet: true };
  const lead = await professional("Léa Responsable");
  const member = await professional("Marc Membre");
  const organizationId = (await application(lead)).organizationId;
  await database.pool.query("update partner_members set organization_id=$1 where user_id=$2", [
    organizationId,
    member.userId,
  ]);
  const held = await request(owner);
  await assign(held, member.userId);
  let organization = await repository.organizationAccess(admin, organizationId);
  expect(organization).toMatchObject({ state: "approved", activeLeads: 1 });
  expect(organization.members.map((m) => m.name).sort()).toEqual([
    "Léa Responsable",
    "Marc Membre",
  ]);

  // A member review that leaves the organisation unchanged records no organisation decision.
  const reviewed = await application(lead);
  await repository.review(
    admin,
    lead.userId,
    {
      revision: reviewed.revision,
      state: "approved",
      roles: ["advisor", "manager"],
      reason: "Rôle de responsable accordé",
      reviewDueAt: null,
      organizationState: "approved",
    },
    key(),
  );
  organization = await repository.organizationAccess(admin, organizationId);
  expect(organization.decisions.filter((d) => d.kind === "organization_review")).toHaveLength(1);

  await expect(
    repository.reviewOrganization(
      admin,
      organizationId,
      { revision: organization.revision + 1, state: "suspended", reason, reviewDueAt: null },
      key(),
    ),
  ).rejects.toMatchObject({ statusCode: 409 });
  organization = await repository.reviewOrganization(
    admin,
    organizationId,
    { revision: organization.revision, state: "suspended", reason, reviewDueAt: null },
    key(),
  );
  expect(organization.decisions[0]).toMatchObject({
    kind: "organization_review",
    subject: "organization",
    state: "suspended",
    reason,
    author: "coverview",
  });
  // Every member loses operational access; their own decisions stay as they were.
  expect(await responsible(held.id)).toEqual({ responsible_id: null, assignment: "reassign" });
  for (const person of [lead, member]) {
    const context = await repository.context(person);
    expect(context.operational).toBe(false);
    expect(context.application?.state).toBe("approved");
  }
  const restored = await repository.reviewOrganization(
    admin,
    organizationId,
    { revision: organization.revision, state: "approved", reason, reviewDueAt: later(24 * 90) },
    key(),
  );
  expect(restored).toMatchObject({ state: "approved", reviewDueAt: expect.any(String) as string });
  expect((await repository.context(member)).operational).toBe(true);
  expect((await responsible(held.id)).responsible_id).toBeNull();
  // The member reads their organisation's decisions with their own.
  expect(
    (await repository.accessDecisions(member, member.userId)).items.filter(
      (d) => d.subject === "organization",
    ),
  ).toHaveLength(3);
});

it("opens the re-review when a member's or an organisation's date falls due", async () => {
  const lapsing = await professional("Paul Périodique");
  const soon = await professional("Sarah Bientôt");
  for (const [person, interval] of [
    [lapsing, "-1 minute"],
    [soon, "10 days"],
  ] as const)
    await database.pool.query(
      `update partner_members set review_due_at=now()+interval '${interval}' where user_id=$1`,
      [person.userId],
    );
  const queue = await repository.accessQueue(admin, "reviews");
  const flags = (person: PartnerActor) =>
    queue.items.find((i) => i.application.userId === person.userId)?.flags.review;
  expect(flags(lapsing)).toBe("lapsed");
  expect(flags(soon)).toBe("soon");
  expect((await repository.context(lapsing)).operational).toBe(false);

  expect((await processAccessReviews(database.pool)).members).toBeGreaterThanOrEqual(1);
  const reopened = await application(lapsing);
  expect(reopened).toMatchObject({ state: "needs_information", reviewReason: null });
  expect((await application(soon)).state).toBe("approved");
  const decisions = (await repository.accessDecisions(lapsing, lapsing.userId)).items;
  expect(decisions[0]).toMatchObject({
    kind: "automatic_review",
    author: "system",
    state: "needs_information",
    reason: null,
  });
  const events = await database.pool.query(
    "select system_actor from partner_events where kind='application.review_due' and subject_id=$1",
    [lapsing.userId],
  );
  expect(events.rows).toEqual([{ system_actor: "partner-continuity-v1" }]);
  // Replaying the job opens nothing more.
  await processAccessReviews(database.pool);
  expect((await repository.accessDecisions(admin, lapsing.userId)).items).toHaveLength(
    decisions.length,
  );

  // The member answers by updating their application; CoverView reviews it again.
  await repository.apply(
    lapsing,
    partnerApplicationInputSchema.parse({
      name: "Paul Périodique",
      organization: "Cabinet Paul Périodique",
      phone: "",
      roles: ["advisor"],
      categories: ["vehicle"],
      languages: "fr",
      regions: "GE",
      qualifications: "Dossier mis à jour",
    }),
    key(),
  );
  const resubmitted = await application(lapsing);
  expect(resubmitted.state).toBe("submitted");
  await repository.review(
    admin,
    lapsing.userId,
    {
      revision: resubmitted.revision,
      state: "approved",
      roles: ["advisor"],
      reason: "Réexamen favorable",
      reviewDueAt: later(24 * 365),
    },
    key(),
  );
  expect((await repository.context(lapsing)).operational).toBe(true);

  // An organisation whose date falls due is reopened the same way, for all its members.
  const organizationId = (await application(soon)).organizationId;
  await database.pool.query(
    "update partner_organizations set review_due_at=now()-interval '1 minute' where id=$1",
    [organizationId],
  );
  expect((await processAccessReviews(database.pool)).organizations).toBeGreaterThanOrEqual(1);
  expect((await repository.context(soon)).operational).toBe(false);
  expect((await repository.organizationAccess(admin, organizationId)).decisions[0]).toMatchObject({
    kind: "automatic_review",
    subject: "organization",
    state: "needs_information",
  });
});

it("lists pending applications, restrictions and proofs about to end in the Admin queue", async () => {
  const pending = await applicant("Nina Nouvelle");
  const proven = await professional("Pierre Preuve");
  await competence(proven, "vehicle", later(48));
  const limited = await professional("Laure Limitée");
  await restrict(limited, { marketplace: true });

  const ids = async (filter: "pending" | "restricted" | "proofs") =>
    (await repository.accessQueue(admin, filter)).items.map((i) => i.application.userId);
  expect(await ids("pending")).toContain(pending.userId);
  expect(await ids("restricted")).toContain(limited.userId);
  expect(await ids("restricted")).not.toContain(proven.userId);
  const proofs = await repository.accessQueue(admin, "proofs");
  expect(proofs.items.find((i) => i.application.userId === proven.userId)?.proofs).toEqual([
    {
      kind: "competence",
      category: "vehicle",
      companyId: null,
      validUntil: expect.any(String) as string,
      state: "soon",
    },
  ]);
  expect(proofs.counts.proofs).toBeGreaterThanOrEqual(1);
  expect(proofs.counts.pending).toBeGreaterThanOrEqual(1);
  await expect(repository.accessQueue(proven, "all")).rejects.toMatchObject({ statusCode: 403 });
});
