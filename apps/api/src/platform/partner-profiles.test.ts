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
} from "@coverview/contracts/partner";
import { createDatabase } from "./db/database.js";
import { createPartnerRepository } from "../modules/partner-workspace/partner.repository.js";
import { processPartnerContinuity } from "../modules/partner-workspace/partner.continuity.js";
import type { PartnerActor } from "../modules/partner-workspace/partner.policy.js";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let repository: ReturnType<typeof createPartnerRepository>;
let admin: PartnerActor;
const key = () => randomUUID();
const later = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();
const presentation =
  "Conseillère en assurance véhicule, j'accompagne les familles genevoises dans leurs choix.";

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_profiles_test")
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
    [value.userId, key(), `${key()}@profiles.test`],
  );
  await database.pool.query("insert into identity_profiles(id,user_id) values($1,$2)", [
    key(),
    value.userId,
  ]);
  await database.pool.query(
    "insert into identity_sessions(id,user_id,workos_session_id,token_hash,device,expires_at,mfa_verified_at) values($1,$2,$3,$4,'Isolated profiles',now()+interval '1 hour',now()-interval '1 second')",
    [value.id, value.userId, key(), createHash("sha256").update(key()).digest("hex")],
  );
  if (administrator)
    await database.pool.query(
      "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated test')",
      [key(), value.userId],
    );
  return value;
}
async function professional(name: string, roles: ("advisor" | "referrer")[] = ["advisor"]) {
  const person = await actor();
  await repository.apply(
    person,
    partnerApplicationInputSchema.parse({
      name,
      organization: "Organisation isolée",
      phone: "",
      roles,
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
      roles,
      reason: "Test isolé",
      reviewDueAt: null,
      organizationState: "approved",
    },
    key(),
  );
  return person;
}
async function competence(person: PartnerActor) {
  const current = await repository.competence(person, person.userId, "vehicle");
  const dossier = await repository.declareCompetence(
    person,
    person.userId,
    "vehicle",
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
    "vehicle",
    dossier.current!.id,
    "application/pdf",
  );
  await database.pool.query(
    "update files set state='ready',scan_version='isolated',revision=revision+1 where id=$1",
    [dossier.current!.documentId],
  );
  const reviewed = await repository.competence(person, person.userId, "vehicle");
  await repository.decideCompetence(
    admin,
    person.userId,
    "vehicle",
    competenceDecisionSchema.parse({
      revision: reviewed.current!.revision,
      decision: "reviewed",
      reason: "Examen isolé",
      scope: "Périmètre de test",
      coverage: "category",
      validUntil: later(48),
      documentRevision: reviewed.current!.documentRevision,
      originalChecked: true,
    }),
    key(),
  );
}
// A referrer transmits a contact only: linking to an existing Wallet is never its decision.
async function request(creator: PartnerActor, owner: PartnerActor | null) {
  return repository.create(
    creator,
    leadCreateInputSchema.parse({
      title: "Besoin isolé",
      category: "vehicle",
      object: "Voiture",
      context: "Contexte isolé",
      clientUserId: owner?.userId ?? null,
      clientProfileId: null,
      clientName: "Personne isolée",
      email: "client@profiles.test",
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
async function assign(lead: { id: string }, advisor: PartnerActor) {
  const current = await repository.detail(admin, lead.id);
  const assigned = await repository.command(
    admin,
    lead.id,
    {
      action: "assign",
      revision: current.revision,
      responsibleId: advisor.userId,
      reason: "Choix documenté dans un test isolé",
    },
    key(),
  );
  return repository.command(
    advisor,
    lead.id,
    { action: "accept", revision: assigned.revision },
    key(),
  );
}
async function served(owner: PartnerActor, advisor: PartnerActor, rating: number) {
  const lead = await assign(await request(owner, owner), advisor);
  const closed = await repository.command(
    advisor,
    lead.id,
    {
      action: "close",
      revision: lead.revision,
      result: "resolved_without_contract",
      reason: "current_suitable",
      comment: "Clôture isolée",
    },
    key(),
  );
  const survey = (await repository.surveys(owner, closed.id)).items[0]!;
  await repository.respondSurvey(
    owner,
    survey.id,
    {
      rating,
      experience: "overall",
      positives: rating === 5 ? ["clarity"] : [],
      improvements: rating < 5 ? ["follow_up"] : [],
      comment: "",
      callbackRequested: false,
      confirmed: true,
    },
    key(),
  );
  return { lead: closed, surveyId: survey.id };
}
async function submitted(advisor: PartnerActor, text = presentation) {
  const dossier = await repository.profileDossier(advisor, advisor.userId);
  return repository.submitProfile(
    advisor,
    advisor.userId,
    { revision: dossier.current?.revision ?? 0, presentation: text, confirmed: true },
    key(),
  );
}
async function decide(advisor: PartnerActor, decision: "published" | "rejected") {
  const dossier = await repository.profileDossier(admin, advisor.userId);
  return repository.reviewProfile(
    admin,
    advisor.userId,
    { revision: dossier.current!.revision, decision, reason: "Examen éditorial isolé" },
    key(),
  );
}

it("publishes a reviewed profile with derived sources to its permitted audiences only", async () => {
  const advisor = await professional("Alice Publiée");
  await competence(advisor);
  const owner = { ...(await actor()), wallet: true },
    stranger = { ...(await actor()), wallet: true },
    colleague = await professional("Bruno Collègue");
  await assign(await request(owner, owner), advisor);

  await submitted(advisor);
  expect((await repository.profileQueue(admin)).items.map((i) => i.userId)).toContain(
    advisor.userId,
  );
  await expect(repository.publicProfile(colleague, advisor.userId)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  await expect(
    repository.reviewProfile(
      advisor,
      advisor.userId,
      { revision: 1, decision: "published", reason: "Auto-validation" },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  const reviewed = await decide(advisor, "published");
  expect(reviewed.published).toMatchObject({
    presentation,
    specialties: ["vehicle"],
    rating: { status: "insufficient", count: 0, minimum: 5 },
  });
  for (const viewer of [admin, colleague, owner])
    expect((await repository.publicProfile(viewer, advisor.userId)).name).toBe("Alice Publiée");
  await expect(repository.publicProfile(stranger, advisor.userId)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });

  // A new version waits for review; the previous publication stays visible meanwhile.
  await submitted(advisor, `${presentation} Disponible aussi en visioconférence.`);
  expect((await repository.publicProfile(colleague, advisor.userId)).presentation).toBe(
    presentation,
  );
  await decide(advisor, "rejected");
  expect((await repository.publicProfile(colleague, advisor.userId)).presentation).toBe(
    presentation,
  );
  await repository.withdrawProfile(advisor, advisor.userId, "Je retire mon profil public", key());
  await expect(repository.publicProfile(colleague, advisor.userId)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  await expect(
    database.pool.query("update partner_profile_versions set presentation='Réécrit'"),
  ).rejects.toMatchObject({ code: "23514" });
});

it("rates client experience prudently, keeps attribution after a transfer and honours accepted contests", async () => {
  const advisor = await professional("Chloé Évaluée"),
    other = await professional("David Autre");
  await competence(advisor);
  await submitted(advisor);
  await decide(advisor, "published");
  const owner = { ...(await actor()), wallet: true };
  const first = await served(owner, advisor, 5);
  for (const rating of [4, 5, 5]) await served(owner, advisor, rating);
  let evaluation = await repository.evaluation(advisor, advisor.userId);
  expect(evaluation.clientExperience.rating).toMatchObject({ status: "insufficient", count: 4 });
  expect(evaluation.clientExperience.rating.average).toBeNull();
  const last = await served(owner, advisor, 3);
  evaluation = await repository.evaluation(advisor, advisor.userId);
  expect(evaluation.clientExperience.rating).toMatchObject({
    status: "available",
    count: 5,
    average: 4.4,
  });
  expect(evaluation.clientExperience.distribution).toEqual([0, 0, 1, 1, 3]);
  expect((await repository.publicProfile(owner, advisor.userId)).rating.average).toBe(4.4);

  // A reopened need served by someone else does not move the survey given about the advisor.
  const current = await repository.detail(admin, first.lead.id);
  await repository.command(
    admin,
    first.lead.id,
    {
      action: "reopen",
      revision: current.revision,
      reason: "Suite tardive isolée",
      nextAction: "Reprendre le dossier",
      dueAt: later(24),
    },
    key(),
  );
  await assign(first.lead, other);
  expect((await repository.evaluation(admin, advisor.userId)).clientExperience.rating.count).toBe(
    5,
  );

  await expect(repository.evaluation(other, advisor.userId)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await expect(repository.evaluation(owner, advisor.userId)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  const contested = await repository.contestEvaluation(
    advisor,
    advisor.userId,
    {
      subjectKind: "survey",
      subjectId: last.surveyId,
      reason: "Ce dossier a été traité par un collègue pendant mon absence.",
      confirmed: true,
    },
    key(),
  );
  expect(contested.contests[0]).toMatchObject({ status: "pending" });
  await expect(
    repository.contestEvaluation(
      other,
      advisor.userId,
      {
        subjectKind: "survey",
        subjectId: first.surveyId,
        reason: "Tentative sur le dossier d'un autre conseiller.",
        confirmed: true,
      },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  const queue = await repository.contestQueue(admin);
  const pending = queue.items.find((c) => c.subjectId === last.surveyId)!;
  const decided = await repository.decideContest(
    admin,
    pending.id,
    { decision: "accepted", reason: "Absence vérifiée sur la période" },
    key(),
  );
  expect(decided.clientExperience.rating).toMatchObject({ status: "insufficient", count: 4 });
  await expect(
    repository.decideContest(
      admin,
      pending.id,
      { decision: "rejected", reason: "Seconde décision" },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
});

it("counts assignments without missed deadlines and evaluates referrers for CoverView only", async () => {
  const advisor = await professional("Emma Suivie");
  const referrer = await professional("Fabien Apporteur", ["referrer"]);
  const lead = await assign(await request(referrer, null), advisor);
  let evaluation = await repository.evaluation(advisor, advisor.userId);
  expect(evaluation.operational).toMatchObject({ assigned: 1, onTime: 1, onTimeRate: 100 });
  expect(evaluation.economic).toEqual({ cases: 0, disputed: 0, clawbacks: 0 });
  await database.pool.query(
    "update partner_leads set notified_at=now()-interval '29 hours',acceptance_due_at=now()-interval '25 hours',first_action_due_at=now()-interval '5 hours',first_useful_at=null,continuity_checked_at=null where id=$1",
    [lead.id],
  );
  await processPartnerContinuity(database.pool);
  evaluation = await repository.evaluation(advisor, advisor.userId);
  expect(evaluation.operational).toMatchObject({ assigned: 1, onTime: 0, onTimeRate: 0 });

  const duplicate = await request(referrer, null);
  const draft = await repository.detail(admin, duplicate.id);
  await repository.command(
    admin,
    duplicate.id,
    {
      action: "close",
      revision: draft.revision,
      result: "duplicate",
      reason: "other",
      comment: "Doublon isolé",
    },
    key(),
  );
  const referred = await repository.referrerEvaluation(admin, referrer.userId);
  expect(referred).toMatchObject({ created: 2, authorized: 2, duplicates: 1, invalid: 0 });
  await expect(repository.referrerEvaluation(advisor, referrer.userId)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
});
