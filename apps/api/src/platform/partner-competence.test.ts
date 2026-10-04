import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createDatabase } from "./db/database.js";
import {
  leadCreateInputSchema,
  competenceDeclarationSchema,
  competenceDecisionSchema,
  type CompetenceDossier,
  type LeadDetail,
  type LeadCommand,
} from "@coverview/contracts/partner";
import { createPartnerRepository } from "../modules/partner-workspace/partner.repository.js";
import type { PartnerActor } from "../modules/partner-workspace/partner.policy.js";
import { createDocumentRepository } from "../modules/document-intelligence/document.repository.js";
import { createDocumentService } from "../modules/document-intelligence/document.service.js";
import { retainLeadSource } from "../modules/document-intelligence/document.lead-source.js";
let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let repository: ReturnType<typeof createPartnerRepository>;
let administrator: PartnerActor,
  advisor: PartnerActor,
  neighbor: PartnerActor,
  referrer: PartnerActor,
  client: PartnerActor;
const key = () => randomUUID();

const proofBytes = Buffer.from("%PDF-1.7\nIsolated professional evidence, no real qualification");
const proofInput = (revision = 0) =>
  competenceDeclarationSchema.parse({
    revision,
    professionalRevision: 1,
    declaration: "Compétence véhicule déclarée, justificatif synthétique isolé",
    confirmed: true,
    file: {
      name: "Qualification.pdf",
      mime: "application/pdf",
      size: proofBytes.length,
      checksum: createHash("sha256").update(proofBytes).digest("hex"),
    },
  });
function proofDecision(
  dossier: CompetenceDossier,
  decision: "reviewed" | "needs_information" | "rejected" | "withdrawn" = "reviewed",
) {
  return competenceDecisionSchema.parse({
    revision: dossier.current!.revision,
    decision,
    documentRevision: dossier.current!.documentRevision,
    reason: "Examen documentaire synthétique dans PostgreSQL isolé",
    scope: decision === "reviewed" ? "Assurance véhicule, périmètre de test" : "",
    coverage: decision === "reviewed" ? "category" : null,
    validUntil: decision === "reviewed" ? new Date(Date.now() + 86400000).toISOString() : null,
    originalChecked: true,
  });
}
async function preparedProof(person: PartnerActor) {
  let dossier = await repository.declareCompetence(
    person,
    person.userId,
    "vehicle",
    proofInput(),
    key(),
  );
  await repository.completeCompetenceUpload(
    person,
    person.userId,
    "vehicle",
    dossier.current!.id,
    "application/pdf",
  );
  // Isolated scanner result, never a claim about a real certificate or provider.
  await database.pool.query(
    "update files set state='ready',scan_version='isolated-antivirus',revision=revision+1 where id=$1",
    [dossier.current!.documentId],
  );
  dossier = await repository.competence(person, person.userId, "vehicle");
  return dossier;
}

it("allows private competence declarations before approval, without client documents, advice rights or cross-member access", async () => {
  const candidate = await actor();
  await repository.apply(
    candidate,
    {
      name: "Candidat isolé",
      organization: "Organisation isolée",
      phone: "",
      roles: ["advisor"],
      categories: ["vehicle"],
      languages: "fr",
      regions: "Genève",
      qualifications: "Déclaration seule",
    },
    key(),
  );
  const attempt = key(),
    input = proofInput();
  const [first, replay] = await Promise.all([
    repository.declareCompetence(candidate, candidate.userId, "vehicle", input, attempt),
    repository.declareCompetence(candidate, candidate.userId, "vehicle", input, attempt),
  ]);
  expect(replay).toEqual(first);
  expect(first.summary.status).toBe("submitted");
  expect(first.current!.canDownload).toBe(false);
  expect(first.history).toHaveLength(1);
  expect((await repository.context(candidate)).operational).toBe(false);
  for (const stranger of [neighbor, { ...candidate, wallet: true }]) {
    await expect(
      repository.competence(stranger, candidate.userId, "vehicle"),
    ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
    await expect(
      repository.competenceSource(stranger, candidate.userId, "vehicle", first.current!.id, true),
    ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  }
  await expect(
    repository.declareCompetence(administrator, candidate.userId, "vehicle", input, key()),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  await expect(
    repository.declareCompetence(candidate, candidate.userId, "health", input, key()),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  await expect(
    repository.declareCompetence(
      candidate,
      candidate.userId,
      "vehicle",
      { ...input, declaration: "Changed" },
      attempt,
    ),
  ).rejects.toMatchObject({ code: "PARTNER_IDEMPOTENCY_REUSED" });
  const files = createDocumentRepository(database.db),
    docId = first.current!.documentId;
  expect((await files.list(candidate.userId, undefined, { scope: "account" })).documents).toEqual(
    [],
  );
  for (const operation of [
    () => files.get(candidate.userId, docId),
    () => files.access(candidate, docId),
    () => files.authorizeUpload(candidate, docId),
    () => files.remove(candidate, docId),
  ])
    await expect(operation()).rejects.toMatchObject({ code: "DOCUMENT_NOT_FOUND" });
  expect((await files.original(candidate.userId, docId)).purpose).toBe("partner_competence");
  const tx = await database.pool.connect();
  try {
    expect(
      await retainLeadSource(tx, docId, candidate, { userId: candidate.userId, profileId: null }),
    ).toBe(false);
  } finally {
    tx.release();
  }
  await database.pool.query("update files set updated_at=now()-interval '2 days' where id=$1", [
    docId,
  ]);
  await files.cleanup();
  expect((await files.original(candidate.userId, docId)).state).toBe("pending");
  await repository.completeCompetenceUpload(
    candidate,
    candidate.userId,
    "vehicle",
    first.current!.id,
    "application/pdf",
  );
  expect((await files.original(candidate.userId, docId)).analysisRequested).toBe(false);
  expect(
    (await database.pool.query("select id from document_outbox where document_id=$1", [docId]))
      .rowCount,
  ).toBe(1);
});

it("uses only an explicit current Admin documentary review for competence continuity and leaves all Lead rights and clocks intact", async () => {
  const professional = await actor(),
    owner = { ...(await actor()), wallet: true };
  await approve(professional);
  const lead = await assignedLead(professional, { ...input(), clientUserId: owner.userId });
  await repository.updateReferent(
    owner,
    "self",
    "vehicle",
    { revision: 0, profileRevision: 0, advisorId: professional.userId, confirmed: true },
    key(),
  );
  const before = (await database.pool.query("select * from partner_leads where id=$1", [lead.id]))
    .rows;
  const notifications = (
    await database.pool.query("select * from partner_notifications where lead_id=$1 order by id", [
      lead.id,
    ])
  ).rows;
  let dossier = await preparedProof(professional);
  const decision = proofDecision(dossier);
  await expect(
    repository.decideCompetence(professional, professional.userId, "vehicle", decision, key()),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  await expect(
    repository.decideCompetence(
      administrator,
      professional.userId,
      "vehicle",
      { ...decision, validUntil: new Date(Date.now() - 1000).toISOString() },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_DOCUMENT" });
  expect(competenceDecisionSchema.safeParse({ ...decision, originalChecked: false }).success).toBe(
    false,
  );
  await database.pool.query("update files set revision=revision+1 where id=$1", [
    dossier.current!.documentId,
  ]);
  await expect(
    repository.decideCompetence(administrator, professional.userId, "vehicle", decision, key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  dossier = await repository.competence(administrator, professional.userId, "vehicle");
  const reviewed = await repository.decideCompetence(
    administrator,
    professional.userId,
    "vehicle",
    proofDecision(dossier),
    key(),
  );
  expect(reviewed.summary.status).toBe("reviewed");
  const continuity = (await repository.detail(owner, lead.id)).referentContinuity!;
  expect(continuity.competence).toMatchObject({
    status: "reviewed",
    scope: reviewed.summary.scope,
  });
  expect(continuity.missingChecks).toEqual([
    "conventions",
    "language",
    "region",
    "availability",
    "conflicts",
    "preferences",
  ]);
  expect(JSON.stringify(continuity)).not.toContain(reviewed.current!.documentId);
  expect(JSON.stringify(continuity)).not.toContain(reviewed.current!.reason);
  expect(
    (await database.pool.query("select * from partner_leads where id=$1", [lead.id])).rows,
  ).toEqual(before);
  expect(
    (
      await database.pool.query(
        "select * from partner_notifications where lead_id=$1 order by id",
        [lead.id],
      )
    ).rows,
  ).toEqual(notifications);
  dossier = await repository.decideCompetence(
    administrator,
    professional.userId,
    "vehicle",
    { ...proofDecision(reviewed), coverage: "limited" },
    key(),
  );
  expect((await repository.detail(owner, lead.id)).referentContinuity!.competence!.status).toBe(
    "limited",
  );
  expect((await repository.detail(owner, lead.id)).referentContinuity!.missingChecks).toContain(
    "competence",
  );
  await database.pool.query(
    "update partner_competence_decisions set created_at=now()-interval '2 days',valid_until=now()-interval '1 day' where id=$1",
    [dossier.current!.id],
  );
  expect(
    (await repository.competence(professional, professional.userId, "vehicle")).summary.status,
  ).toBe("expired");
  const withdrawn = await repository.decideCompetence(
    professional,
    professional.userId,
    "vehicle",
    proofDecision(dossier, "withdrawn"),
    key(),
  );
  expect(withdrawn.summary.status).toBe("withdrawn");
  expect(withdrawn.history).toHaveLength(4);
  await expect(
    repository.decideCompetence(
      administrator,
      professional.userId,
      "vehicle",
      proofDecision(withdrawn),
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  expect(
    (
      await createDocumentRepository(database.db).original(
        professional.userId,
        withdrawn.current!.documentId,
      )
    ).retainedAt,
  ).not.toBeNull();
});

it("serializes decisions, keeps paginated evidence, reuses the canonical original and invalidates organization or source changes", async () => {
  const person = await actor(),
    reviewer = await actor(true);
  await approve(person);
  const initial = await preparedProof(person),
    decision = proofDecision(initial);
  const race = await Promise.allSettled([
    repository.decideCompetence(administrator, person.userId, "vehicle", decision, key()),
    repository.decideCompetence(reviewer, person.userId, "vehicle", decision, key()),
  ]);
  expect(race.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(race.find((r) => r.status === "rejected")).toMatchObject({
    reason: { code: "PARTNER_CONFLICT" },
  });
  let dossier = await repository.competence(person, person.userId, "vehicle");
  expect(dossier.summary.status).toBe("reviewed");
  await database.pool.query("update files set state='quarantined' where id=$1", [
    initial.current!.documentId,
  ]);
  expect((await repository.competence(person, person.userId, "vehicle")).summary.status).toBe(
    "unavailable",
  );
  await expect(
    repository.competenceSource(administrator, person.userId, "vehicle", initial.current!.id),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_DOCUMENT" });
  await database.pool.query("update files set state='ready' where id=$1", [
    initial.current!.documentId,
  ]);
  for (let n = 0; n < 19; n++)
    dossier = await repository.decideCompetence(
      administrator,
      person.userId,
      "vehicle",
      proofDecision(dossier, "needs_information"),
      key(),
    );
  dossier = await repository.declareCompetence(
    person,
    person.userId,
    "vehicle",
    proofInput(dossier.current!.revision),
    key(),
  );
  expect(dossier.summary.status).toBe("submitted");
  expect(dossier.current!.documentId).toBe(initial.current!.documentId);
  expect(dossier.history).toHaveLength(20);
  const older = await repository.competence(
    person,
    person.userId,
    "vehicle",
    dossier.nextBeforeRevision!,
  );
  expect(older.history).toHaveLength(2);
  expect(older.history.at(-1)!.decision).toBe("submitted");
  const approved = await repository.decideCompetence(
    administrator,
    person.userId,
    "vehicle",
    proofDecision(dossier),
    key(),
  );
  const oldOrganization = (await repository.context(person)).application!.organizationId;
  await database.pool.query("update partner_members set organization_id=$2 where user_id=$1", [
    person.userId,
    (await repository.context(neighbor)).application!.organizationId,
  ]);
  expect((await repository.competence(person, person.userId, "vehicle")).summary.status).toBe(
    "unavailable",
  );
  expect((await repository.competence(person, person.userId, "vehicle")).canReview).toBe(false);
  await database.pool.query("update partner_members set organization_id=$2 where user_id=$1", [
    person.userId,
    oldOrganization,
  ]);
  await database.pool.query(
    "update partner_members set application=jsonb_set(application,'{categories}','[\"health\"]'::jsonb) where user_id=$1",
    [person.userId],
  );
  expect((await repository.competence(person, person.userId, "vehicle")).summary.status).toBe(
    "unavailable",
  );
  await database.pool.query("update identity_sessions set mfa_verified_at=null where id=$1", [
    reviewer.id,
  ]);
  await expect(repository.competence(reviewer, person.userId, "vehicle")).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
    person.id,
  ]);
  await expect(repository.competence(person, person.userId, "vehicle")).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  expect(approved.history.some((row) => row.decision === "reviewed")).toBe(true);
});

it("checks exact professional bytes and current session before and after storage without starting AI or sharing to Wallet", async () => {
  const person = await actor();
  await approve(person);
  const dossier = await repository.declareCompetence(
      person,
      person.userId,
      "vehicle",
      proofInput(),
      key(),
    ),
    record = dossier.current!;
  const files = createDocumentRepository(database.db),
    stored = new Map<string, Buffer>();
  let revoke = false;
  const service = createDocumentService(files, {
    async put(objectKey, value) {
      stored.set(objectKey, value);
      if (revoke)
        await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
          person.id,
        ]);
    },
    get: (objectKey) => Promise.resolve(stored.get(objectKey)!),
    remove: (objectKey) => {
      stored.delete(objectKey);
      return Promise.resolve();
    },
    close: () => {},
  });
  const authorize = async () => {
    await repository.competenceSource(person, person.userId, "vehicle", record.id, true);
  };
  const confirm = (mime: string) =>
    repository.completeCompetenceUpload(person, person.userId, "vehicle", record.id, mime);
  await expect(
    service.uploadShared(
      person.userId,
      record.documentId,
      Buffer.from("incorrect"),
      authorize,
      confirm,
    ),
  ).rejects.toMatchObject({ code: "DOCUMENT_UPLOAD_INVALID" });
  expect(stored.size).toBe(0);
  revoke = true;
  await expect(
    service.uploadShared(person.userId, record.documentId, proofBytes, authorize, confirm),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  expect((await files.original(person.userId, record.documentId)).state).toBe("pending");
  expect(
    (
      await database.pool.query("select id from document_outbox where document_id=$1", [
        record.documentId,
      ])
    ).rowCount,
  ).toBe(0);
});

it("disables document operations without losing withdrawal or allowing a self-review", async () => {
  const member = await actor(true);
  await approve(member);
  const dossier = await preparedProof(member);
  await expect(
    repository.decideCompetence(member, member.userId, "vehicle", proofDecision(dossier), key()),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  const disabled = createPartnerRepository(database.pool, false);
  const masked = await disabled.competence(administrator, member.userId, "vehicle");
  expect(masked).toMatchObject({
    documentsAvailable: false,
    canDeclare: false,
    canReview: false,
    canWithdraw: true,
  });
  expect(masked.current!.canDownload).toBe(false);
  expect(masked.history.every((row) => !row.canDownload)).toBe(true);
  for (const operation of [
    () => disabled.declareCompetence(member, member.userId, "vehicle", proofInput(1), key()),
    () =>
      disabled.decideCompetence(
        administrator,
        member.userId,
        "vehicle",
        proofDecision(dossier),
        key(),
      ),
    () => disabled.competenceSource(member, member.userId, "vehicle", dossier.current!.id),
    () =>
      disabled.completeCompetenceUpload(
        member,
        member.userId,
        "vehicle",
        dossier.current!.id,
        "application/pdf",
      ),
    () =>
      disabled.retryCompetenceUpload(
        member,
        member.userId,
        "vehicle",
        dossier.current!.id,
        dossier.current!.documentRevision,
        key(),
      ),
  ])
    await expect(async () => operation()).rejects.toMatchObject({ code: "PARTNER_UNAVAILABLE" });
  const attempt = key(),
    input = proofDecision(dossier, "withdrawn");
  const withdrawn = await disabled.decideCompetence(
    member,
    member.userId,
    "vehicle",
    input,
    attempt,
  );
  expect(withdrawn).toMatchObject({
    documentsAvailable: false,
    canDeclare: false,
    canReview: false,
    summary: { status: "withdrawn" },
  });
  expect(withdrawn.current!.canDownload).toBe(false);
  expect(await disabled.decideCompetence(member, member.userId, "vehicle", input, attempt)).toEqual(
    withdrawn,
  );
});

it("keeps an old competence review unavailable after application parties change and return", async () => {
  const person = await actor();
  await approve(person);
  let dossier = await preparedProof(person);
  dossier = await repository.decideCompetence(
    administrator,
    person.userId,
    "vehicle",
    proofDecision(dossier),
    key(),
  );
  const original = (await repository.context(person)).application!;
  for (const name of ["Autre intervenant", original.name]) {
    const member = (await repository.context(person)).application!;
    await repository.review(
      administrator,
      person.userId,
      {
        revision: member.revision,
        state: "needs_information",
        roles: [],
        reason: "Clarification des parties",
        reviewDueAt: null,
      },
      key(),
    );
    await repository.apply(
      person,
      {
        name,
        organization: original.organization,
        phone: original.phone,
        roles: original.roles,
        categories: original.categories,
        languages: original.languages,
        regions: original.regions,
        qualifications: original.qualifications,
      },
      key(),
    );
    const current = await repository.competence(administrator, person.userId, "vehicle");
    expect(current.summary.status).toBe("unavailable");
    expect(current.canReview).toBe(false);
    expect(current.current!.id).toBe(dossier.current!.id);
    expect(current.current!.canDownload).toBe(true);
  }
});

const due = () => new Date(Date.now() + 2 * 86400000).toISOString();
const input = () =>
  leadCreateInputSchema.parse({
    title: "Demande véhicule",
    category: "vehicle",
    object: "Véhicule A",
    context: "Besoin déclaré",
    clientUserId: client.userId,
    clientProfileId: null,
    clientName: "Client isolé",
    email: "client@partner.test",
    phone: "",
    language: "fr",
    source: "Recette PostgreSQL isolée",
    transmissionAuthorized: true,
    priority: "normal",
    draft: false,
    nextAction: "Appeler",
    dueAt: due(),
  });
type WithoutRevision<T> = T extends unknown ? Omit<T, "revision"> : never;
const command = (actor: PartnerActor, lead: LeadDetail, change: WithoutRevision<LeadCommand>) =>
  repository.command(actor, lead.id, { ...change, revision: lead.revision }, key());
async function assignedLead(responsible: PartnerActor, data = input()) {
  let lead = await repository.create(administrator, data, key());
  lead = await command(administrator, lead, {
    action: "assign",
    responsibleId: responsible.userId,
    reason: "Conseiller habilité pour cette demande",
  });
  return command(responsible, lead, { action: "accept" });
}

async function actor(admin = false): Promise<PartnerActor> {
  const token = key();
  const session = { userId: `user_${key()}`, id: `session_${key()}` };
  await database.pool.query(
    "insert into identity_users(id,workos_user_id,email) values($1,$2,$3)",
    [session.userId, key(), `${key()}@partner.test`],
  );
  await database.pool.query("insert into identity_profiles(id,user_id) values($1,$2)", [
    key(),
    session.userId,
  ]);
  await database.pool.query(
    "insert into identity_sessions(id,user_id,workos_session_id,token_hash,device,expires_at) values($1,$2,$3,$4,'Isolated test',now()+interval '1 hour')",
    [session.id, session.userId, key(), createHash("sha256").update(token).digest("hex")],
  );
  if (admin) {
    await database.pool.query(
      "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated Testcontainers permission')",
      [key(), session.userId],
    );
    await database.pool.query("update identity_sessions set mfa_verified_at=now() where id=$1", [
      session.id,
    ]);
  }
  return { userId: session.userId, id: session.id, administrator: admin };
}
async function approve(
  person: PartnerActor,
  roles: ("advisor" | "referrer" | "manager")[] = ["advisor"],
) {
  await repository.apply(
    person,
    {
      name: "Intervenant isolé",
      organization: "Organisation isolée",
      phone: "",
      roles,
      categories: ["vehicle"],
      languages: "fr",
      regions: "Genève",
      qualifications: "Vérification isolée",
    },
    key(),
  );
  const pending = (await repository.context(person)).application!;
  return repository.review(
    administrator,
    person.userId,
    {
      revision: pending.revision,
      state: "approved",
      organizationState: "approved",
      roles,
      reason: "Validation de recette isolée",
      reviewDueAt: null,
    },
    key(),
  );
}
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_partner_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  const migrationsFolder = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  await migrate(database.db, { migrationsFolder });
  await migrate(database.db, { migrationsFolder });
  repository = createPartnerRepository(database.pool);
  administrator = await actor(true);
  advisor = await actor();
  neighbor = await actor();
  referrer = await actor();
  client = { ...(await actor()), wallet: true };
  await approve(advisor);
  await approve(neighbor);
  await approve(referrer, ["referrer"]);
  const org = (await repository.context(advisor)).application!.organizationId;
  await database.pool.query("update partner_members set organization_id=$2 where user_id=$1", [
    neighbor.userId,
    org,
  ]);
});
afterAll(async () => {
  if (database) await database.pool.end();
  if (container) await container.stop();
});
