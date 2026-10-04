import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  advicePreferencesInputSchema,
  capacityInputSchema,
  competenceDeclarationSchema,
  competenceDecisionSchema,
  conventionDeclarationSchema,
  conventionDecisionSchema,
  leadCreateInputSchema,
  partnerApplicationInputSchema,
  professionalLanguageSchema,
  swissCantonSchema,
  type LeadDetail,
} from "@coverview/contracts/partner";
import { createDatabase } from "./db/database.js";
import { createPartnerRepository } from "../modules/partner-workspace/partner.repository.js";
import { processPartnerContinuity } from "../modules/partner-workspace/partner.continuity.js";
import type { PartnerActor } from "../modules/partner-workspace/partner.policy.js";

type Category = "vehicle" | "household" | "legal" | "business" | "pension";
let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let repository: ReturnType<typeof createPartnerRepository>;
let admin: PartnerActor;
const key = () => randomUUID();
const later = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_matching_test")
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

async function actor(administrator = false): Promise<PartnerActor> {
  const value = { userId: `user_${key()}`, id: `session_${key()}`, administrator };
  await database.pool.query(
    "insert into identity_users(id,workos_user_id,email) values($1,$2,$3)",
    [value.userId, key(), `${key()}@matching.test`],
  );
  await database.pool.query("insert into identity_profiles(id,user_id) values($1,$2)", [
    key(),
    value.userId,
  ]);
  await database.pool.query(
    "insert into identity_sessions(id,user_id,workos_session_id,token_hash,device,expires_at,mfa_verified_at) values($1,$2,$3,$4,'Isolated matching',now()+interval '1 hour',now()-interval '1 second')",
    [value.id, value.userId, key(), createHash("sha256").update(key()).digest("hex")],
  );
  if (administrator)
    await database.pool.query(
      "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated test')",
      [key(), value.userId],
    );
  return value;
}
async function professional(name: string, category: Category) {
  const person = await actor();
  await repository.apply(
    person,
    partnerApplicationInputSchema.parse({
      name,
      organization: "Organisation isolée",
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
async function ready(documentId: string) {
  // Isolated scanner result, never a claim about a real certificate.
  await database.pool.query(
    "update files set state='ready',scan_version='isolated',revision=revision+1 where id=$1",
    [documentId],
  );
}
async function competence(person: PartnerActor, category: Category, coverage = "category") {
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
  await ready(dossier.current!.documentId);
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
      coverage,
      validUntil: later(48),
      documentRevision: reviewed.current!.documentRevision,
      originalChecked: true,
    }),
    key(),
  );
}
async function convention(person: PartnerActor, name: string, category: Category) {
  const bytes = Buffer.from("%PDF-1.7\nIsolated convention, no real agreement");
  let dossier = await repository.declareConvention(
    person,
    person.userId,
    category,
    "axa",
    conventionDeclarationSchema.parse({
      revision: 0,
      professionalRevision: 1,
      subjectName: name,
      subjectOrganization: "Organisation isolée",
      declaration: "Convention déclarée dans un test isolé",
      confirmed: true,
      file: {
        name: "Convention.pdf",
        mime: "application/pdf",
        size: bytes.length,
        checksum: createHash("sha256").update(bytes).digest("hex"),
      },
    }),
    key(),
  );
  await repository.completeConventionUpload(
    person,
    person.userId,
    category,
    "axa",
    dossier.current!.id,
    "application/pdf",
  );
  await ready(dossier.current!.documentId);
  dossier = await repository.convention(person, person.userId, category, "axa");
  await repository.decideConvention(
    admin,
    person.userId,
    category,
    "axa",
    conventionDecisionSchema.parse({
      revision: dossier.current!.revision,
      decision: "reviewed",
      documentRevision: dossier.current!.documentRevision,
      reason: "Examen isolé",
      scope: "Périmètre de test",
      coverage: "category",
      validUntil: later(48),
      originalChecked: true,
      memberCovered: true,
      validFrom: later(-24),
    }),
    key(),
  );
}
async function practice(person: PartnerActor, languageCodes: string[], cantons: string[]) {
  const current = await repository.practice(person, person.userId);
  await repository.declarePractice(
    person,
    person.userId,
    {
      revision: current.current?.revision ?? 0,
      professionalRevision: current.professionalRevision,
      languageCodes: professionalLanguageSchema.array().parse(languageCodes),
      cantons: swissCantonSchema.array().parse(cantons),
      confirmed: true,
    },
    key(),
  );
}
async function availability(
  person: PartnerActor,
  modes: ("phone" | "video" | "office" | "home")[],
  periods: { kind: "available" | "absent"; startsAt: string; endsAt: string }[] = [],
) {
  const current = await repository.availability(person, person.userId);
  await repository.declareAvailability(
    person,
    person.userId,
    {
      revision: current.current?.revision ?? 0,
      professionalRevision: current.professionalRevision,
      modes,
      timezone: "Europe/Zurich",
      periods,
      confirmed: true,
    },
    key(),
  );
}
async function capacity(person: PartnerActor, position: "open" | "case_by_case" | "unavailable") {
  const dossier = await repository.capacity(person, person.userId);
  await repository.declareCapacity(
    person,
    person.userId,
    capacityInputSchema.parse({
      revision: dossier.current?.revision ?? 0,
      professionalRevision: dossier.professionalRevision,
      action: "declare",
      position,
      validUntil: later(48),
      confirmed: true,
    }),
    key(),
  );
}
// A complete, validated professional: competence, convention, French in Geneva, home visits.
async function eligible(name: string, category: Category) {
  const person = await professional(name, category);
  await competence(person, category);
  await convention(person, name, category);
  await practice(person, ["fr"], ["GE"]);
  await availability(
    person,
    ["home"],
    [{ kind: "available", startsAt: later(24), endsAt: later(72) }],
  );
  return person;
}
async function request(owner: PartnerActor, category: Category) {
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
      email: "client@matching.test",
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
  const current = await repository.advicePreferences(owner, lead.id);
  await repository.confirmAdvicePreferences(
    owner,
    lead.id,
    advicePreferencesInputSchema.parse({
      revision: current.revision,
      scopeRevision: current.scopeRevision,
      profileRevision: current.profileRevision,
      languageCode: "fr",
      mode: "home",
      canton: "GE",
      confirmed: true,
    }),
    key(),
  );
  return repository.detail(owner, lead.id);
}
async function assign(lead: LeadDetail, responsibleId: string, matchingBasis?: string) {
  const current = await repository.detail(admin, lead.id);
  return repository.command(
    admin,
    lead.id,
    {
      action: "assign",
      revision: current.revision,
      responsibleId,
      reason: "Choix documenté dans un test isolé",
      ...(matchingBasis ? { matchingBasis } : {}),
    },
    key(),
  );
}
async function overdue(leadId: string) {
  await database.pool.query(
    "update partner_leads set notified_at=now()-interval '29 hours',acceptance_due_at=now()-interval '25 hours',first_action_due_at=now()-interval '5 hours',continuity_checked_at=null where id=$1",
    [leadId],
  );
}
async function responsible(leadId: string) {
  return (
    await database.pool.query<{ responsible_id: string | null; assignment: string }>(
      "select responsible_id,assignment from partner_leads where id=$1",
      [leadId],
    )
  ).rows[0]!;
}

it("ranks validated declarations, explains each candidate and counts exclusions", async () => {
  const owner = { ...(await actor()), wallet: true };
  const alice = await eligible("Alice Isolée", "vehicle");
  await capacity(alice, "open");
  const bruno = await professional("Bruno Isolé", "vehicle");
  await competence(bruno, "vehicle", "limited");
  await convention(bruno, "Bruno Isolé", "vehicle");
  await practice(bruno, ["fr"], ["GE"]);
  await availability(bruno, ["home"]);
  await capacity(bruno, "case_by_case");
  const noCompetence = await professional("Chloé Isolée", "vehicle");
  await convention(noCompetence, "Chloé Isolée", "vehicle");
  const noConvention = await professional("David Isolé", "vehicle");
  await competence(noConvention, "vehicle");
  const otherLanguage = await eligible("Emma Isolée", "vehicle");
  await practice(otherLanguage, ["de"], ["GE"]);
  const absent = await eligible("Fabien Isolé", "vehicle");
  await availability(
    absent,
    ["home"],
    [{ kind: "absent", startsAt: later(-1), endsAt: later(24) }],
  );
  const unavailable = await eligible("Gaëlle Isolée", "vehicle");
  await capacity(unavailable, "unavailable");
  const referent = await professional("Romain Isolé", "vehicle");
  await competence(referent, "vehicle");
  await convention(referent, "Romain Isolé", "vehicle");
  // A referent can only be chosen among people the client already accepted on another need.
  const earlier = await request(owner, "vehicle");
  const assigned = await assign(earlier, referent.userId);
  await repository.command(
    referent,
    earlier.id,
    { action: "accept", revision: assigned.revision },
    key(),
  );
  const lead = await request(owner, "vehicle");
  const profile = await repository.referentProfile(owner, "self", "vehicle");
  await repository.updateReferent(
    owner,
    "self",
    "vehicle",
    {
      revision: profile.current.revision,
      profileRevision: profile.profileRevision,
      advisorId: referent.userId,
      confirmed: true,
    },
    key(),
  );

  const matching = await repository.leadMatching(admin, lead.id);
  expect(matching.preferences).toMatchObject({ status: "confirmed", languageCode: "fr" });
  expect(matching.candidates.map((c) => c.name)).toEqual([
    "Romain Isolé",
    "Alice Isolée",
    "Bruno Isolé",
  ]);
  expect(matching.excluded).toEqual([
    { reason: "competence", count: 1 },
    { reason: "convention", count: 1 },
    { reason: "language", count: 1 },
    { reason: "absence", count: 1 },
    { reason: "capacity", count: 1 },
  ]);
  expect(matching.recommendation).toBe("candidate");
  const [first, second, third] = matching.candidates;
  // The client's own choice comes first, even with criteria still to confirm.
  expect(first).toMatchObject({
    referent: true,
    relationship: true,
    language: "unknown",
    availability: "undeclared",
  });
  expect(first!.caveats).toEqual(
    expect.arrayContaining(["language_unknown", "availability_undeclared", "conflicts_unchecked"]),
  );
  expect(second).toMatchObject({
    rank: 2,
    competence: "category",
    convention: "category",
    language: "matches",
    region: "matches",
    mode: "matches",
    availability: "upcoming",
    capacity: "open",
  });
  expect(second!.reasons).toEqual(
    expect.arrayContaining(["language", "region", "mode", "availability", "capacity_open"]),
  );
  expect(second!.caveats).toEqual(["conflicts_unchecked"]);
  expect(third).toMatchObject({ competence: "limited", availability: "none_upcoming" });
  expect(third!.caveats).toContain("competence_limited");
  // No private free text: only statuses and keys reach the projection.
  expect(JSON.stringify(matching)).not.toContain("Examen isolé");
  expect(JSON.stringify(matching)).not.toContain("Compétence déclarée");

  await expect(repository.leadMatching(alice, lead.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await expect(repository.leadMatching(owner, lead.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  void bruno;
});

it("records the human decision and its deviation, and refuses a stale ranking", async () => {
  const owner = { ...(await actor()), wallet: true };
  const first = await eligible("Hugo Isolé", "household");
  await capacity(first, "open");
  const second = await eligible("Inès Isolée", "household");
  const lead = await request(owner, "household");
  const matching = await repository.leadMatching(admin, lead.id);
  expect(matching.candidates.map((c) => c.userId)).toEqual([first.userId, second.userId]);

  await assign(lead, second.userId, matching.basis);
  let decisions = (await repository.leadMatching(admin, lead.id)).decisions;
  expect(decisions[0]).toMatchObject({
    kind: "manual",
    chosenUserId: second.userId,
    chosenRank: 2,
    deviation: true,
    reason: "Choix documenté dans un test isolé",
  });

  const stale = await repository.leadMatching(admin, lead.id);
  expect(stale.candidates.map((c) => c.userId)).toEqual([first.userId]);
  expect(stale.excluded).toEqual([{ reason: "previous", count: 1 }]);
  // The basis follows the ranking result: an unchanged ranking stays valid, a changed one does not.
  await practice(first, ["fr", "it"], ["GE"]);
  expect((await repository.leadMatching(admin, lead.id)).basis).toBe(stale.basis);
  await capacity(first, "case_by_case");
  await expect(assign(lead, first.userId, stale.basis)).rejects.toMatchObject({
    code: "PARTNER_CONFLICT",
  });
  const fresh = await repository.leadMatching(admin, lead.id);
  await assign(lead, first.userId, fresh.basis);
  decisions = (await repository.leadMatching(admin, lead.id)).decisions;
  expect(decisions[0]).toMatchObject({
    chosenUserId: first.userId,
    chosenRank: 1,
    deviation: false,
  });
  expect(decisions).toHaveLength(2);
  await expect(
    database.pool.query("update partner_matching_decisions set reason='Réécrit' where lead_id=$1", [
      lead.id,
    ]),
  ).rejects.toMatchObject({ code: "23514" });
});

it("proposes automatically to the next eligible person within the bound, then hands over to CoverView", async () => {
  const owner = { ...(await actor()), wallet: true };
  const initial = await eligible("Jade Isolée", "legal");
  await capacity(initial, "open");
  const next = await eligible("Kevin Isolé", "legal");
  await capacity(next, "case_by_case");
  await eligible("Léa Isolée", "legal");
  const lead = await request(owner, "legal");
  await assign(lead, initial.userId);

  await overdue(lead.id);
  await processPartnerContinuity(database.pool);
  expect(await responsible(lead.id)).toEqual({
    responsible_id: next.userId,
    assignment: "proposed",
  });
  const decisions = (await repository.leadMatching(admin, lead.id)).decisions;
  expect(decisions[0]).toMatchObject({
    kind: "automatic",
    chosenUserId: next.userId,
    deviation: false,
  });
  expect(
    (
      await database.pool.query(
        "select 1 from partner_events where lead_id=$1 and kind='lead.reassigned_automatically' and subject_id=$2",
        [lead.id, initial.userId],
      )
    ).rowCount,
  ).toBe(1);

  // Default bound: one automatic proposal since the last human decision, then CoverView.
  await overdue(lead.id);
  await processPartnerContinuity(database.pool);
  expect(await responsible(lead.id)).toEqual({ responsible_id: null, assignment: "coverview" });
});

it("hands over directly to CoverView when the bound is zero or nobody is eligible", async () => {
  const owner = { ...(await actor()), wallet: true };
  const alone = await eligible("Marc Isolé", "business");
  const lonely = await request(owner, "business");
  await assign(lonely, alone.userId);
  await overdue(lonely.id);
  await processPartnerContinuity(database.pool);
  expect(await responsible(lonely.id)).toEqual({ responsible_id: null, assignment: "coverview" });

  const settings = await repository.continuitySettings(admin);
  await repository.updateContinuitySettings(
    admin,
    {
      revision: settings.current.revision,
      policy: { ...settings.current.policy, automaticReassignments: 0 },
      reason: "Test isolé sans proposition automatique",
    },
    key(),
  );
  const first = await eligible("Nora Isolée", "pension");
  await eligible("Olivier Isolé", "pension");
  const lead = await request(owner, "pension");
  await assign(lead, first.userId);
  await overdue(lead.id);
  await processPartnerContinuity(database.pool);
  expect(await responsible(lead.id)).toEqual({ responsible_id: null, assignment: "coverview" });
});
