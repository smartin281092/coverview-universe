import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { beforeAll, afterAll, expect, it } from "vitest";
import {
  solutionBindingInputSchema,
  solutionClausesInputSchema,
  distributionReviewInputSchema,
  distributionReviewDossierSchema,
  type DistributionReviewDossier,
  type DistributionReviewInput,
  type SolutionClausesDossier,
  type SolutionClausesInput,
  conventionDeclarationSchema,
  conventionDecisionSchema,
  type SolutionBindingDossier,
  type SolutionBindingInput,
  leadCreateInputSchema,
  partnerApplicationInputSchema,
  leadOfferInputSchema,
} from "@coverview/contracts/partner";
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
    .withDatabase("coverview_distribution_test")
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

async function offered(
  owner: PartnerActor,
  advisor: PartnerActor,
  profileId: string | null = null,
) {
  let lead = await assigned(owner, advisor, profileId);
  const documentId = `doc_${key()}`;
  await database.pool.query(
    "insert into files(id,user_id,name,mime,declared_mime,size,checksum,object_key,state,category,purpose,scan_version) values($1,$2,'Offre isolée.pdf','application/pdf','application/pdf',10,$3,$4,'ready','insurance','lead_offer','isolated-scan')",
    [documentId, advisor.userId, createHash("sha256").update(key()).digest("hex"), key()],
  );
  await database.pool.query("update files set analysis=$2 where id=$1", [
    documentId,
    JSON.stringify({
      category: "insurance",
      evidence: null,
      fields: [],
      pages: [
        {
          page: 1,
          text: "AXA Assurances SA. Produit Mobilité. Variante Plus. Version 2026. Mention répétée. Mention répétée.",
          method: "isolated",
          version: "test",
        },
      ],
    }),
  ]);
  const offer = leadOfferInputSchema.parse({
    documentId,
    sourceFingerprint: (await repository.extraction(advisor, lead.id, documentId))
      .sourceFingerprint,
    company: "AXA",
    product: "Véhicule isolé",
    reference: "Test isolé",
    annualPremiumMinor: 100000,
    currency: "CHF",
    validUntil: new Date(Date.now() + 86400000).toISOString(),
    effectiveDate: null,
    features: [],
    summary: "",
    limitations: "Aucune offre réelle",
    replacesId: null,
  });
  lead = await repository.command(
    advisor,
    lead.id,
    { action: "offer", revision: lead.revision, offer },
    key(),
  );
  const offerId = lead.offers[0]!.id;
  lead = await repository.command(
    advisor,
    lead.id,
    { action: "offer_review", revision: lead.revision, offerId },
    key(),
  );
  return { lead, offerId, documentId, offer };
}

const read = (advisor: PartnerActor, leadId: string, offerId: string, before?: number) =>
  repository.solutionBinding(advisor, leadId, offerId, before);
function command(
  dossier: SolutionBindingDossier,
  overrides: Partial<SolutionBindingInput> = {},
): SolutionBindingInput {
  return solutionBindingInputSchema.parse({
    revision: dossier.revision,
    scopeFingerprint: dossier.scopeFingerprint,
    action: "record",
    companyId: "axa",
    mentions: {
      company: { page: 1, quote: "AXA Assurances SA" },
      legalParty: null,
      product: { page: 1, quote: "Produit Mobilité" },
      variant: null,
      productVersion: null,
    },
    reason: "Association personnelle synthétique sans preuve fournisseur",
    validUntil: new Date(Date.now() + 3600000).toISOString(),
    confirmed: true,
    ...overrides,
  });
}
const save = (
  who: PartnerActor,
  value: SolutionBindingDossier,
  input = command(value),
  idempotency = key(),
) => repository.recordSolutionBinding(who, value.leadId, value.offer.id, input, idempotency);

async function scenario() {
  const owner = { ...(await actor()), wallet: true },
    advisor = await professional();
  const item = await offered(owner, advisor);
  return { owner, advisor, ...item, dossier: await read(advisor, item.lead.id, item.offerId) };
}
async function effects(leadId: string) {
  const tables = [
    "partner_leads",
    "partner_offers",
    "partner_tasks",
    "partner_notifications",
    "partner_appointments",
  ];
  return Promise.all(
    tables.map(
      async (table) =>
        (
          await database.pool.query<{ value: unknown }>(
            `select to_jsonb(t) value from ${table} t where ${table === "partner_leads" ? "id" : "lead_id"}=$1 order by id`,
            [leadId],
          )
        ).rows,
    ),
  );
}

async function proof(advisor: PartnerActor, coverage: "category" | "limited" = "category") {
  const member = (await repository.context(advisor)).application!;
  const previous = await repository.convention(advisor, advisor.userId, "vehicle", "axa");
  let value = await repository.declareConvention(
    advisor,
    advisor.userId,
    "vehicle",
    "axa",
    conventionDeclarationSchema.parse({
      revision: previous.current?.revision ?? 0,
      professionalRevision: member.professionalRevision,
      subjectName: member.name,
      subjectOrganization: member.organization,
      declaration: "Convention synthétique, sans validation externe",
      confirmed: true,
      file: {
        name: "Convention isolée.pdf",
        mime: "application/pdf",
        size: 10,
        checksum: createHash("sha256").update(key()).digest("hex"),
      },
    }),
    key(),
  );
  const documentId = value.current!.documentId;
  await repository.completeConventionUpload(
    advisor,
    advisor.userId,
    "vehicle",
    "axa",
    value.current!.id,
    "application/pdf",
  );
  await database.pool.query(
    "update files set state='ready',scan_version='isolated-scan',revision=revision+1 where id=$1",
    [documentId],
  );
  value = await repository.convention(advisor, advisor.userId, "vehicle", "axa");
  value = await repository.decideConvention(
    admin,
    advisor.userId,
    "vehicle",
    "axa",
    conventionDecisionSchema.parse({
      revision: value.current!.revision,
      documentRevision: value.current!.documentRevision,
      decision: "reviewed",
      reason: "Examen synthétique isolé",
      scope: "Seulement le périmètre du document",
      coverage,
      validFrom: new Date(Date.now() - 86400000).toISOString(),
      validUntil: new Date(Date.now() + 86400000).toISOString(),
      originalChecked: true,
      memberCovered: true,
    }),
    key(),
  );
  return { value, documentId };
}

const clauses = (
  who: PartnerActor,
  leadId: string,
  offerId: string,
  companyId = "axa",
  before?: number,
) => repository.solutionClauses(who, leadId, offerId, companyId, before);
function transcribe(value: SolutionClausesDossier, changes: Partial<SolutionClausesInput> = {}) {
  return solutionClausesInputSchema.parse({
    revision: value.revision,
    scopeFingerprint: value.scopeFingerprint,
    action: "record",
    clauses: {
      parties: {
        page: 1,
        locator: "Article 1 — parties",
        quote: "Passage transcrit synthétique, jamais vérifié automatiquement",
      },
      distribution: null,
      product: null,
      limitations: null,
      exclusions: null,
      dates: null,
    },
    reason: "Lecture humaine isolée dont les limites restent à examiner",
    validUntil: new Date(Date.now() + 1800000).toISOString(),
    confirmed: true,
    originalChecked: true,
    ...changes,
  });
}
const write = (
  who: PartnerActor,
  value: SolutionClausesDossier,
  input = transcribe(value),
  idempotency = key(),
) =>
  repository.recordSolutionClauses(
    who,
    value.leadId,
    value.offer.id,
    value.companyId,
    input,
    idempotency,
  );
async function ready() {
  const item = await scenario();
  await save(item.advisor, item.dossier);
  const convention = await proof(item.advisor);
  return { ...item, convention, value: await clauses(item.advisor, item.lead.id, item.offerId) };
}

const review = (
  who: PartnerActor,
  leadId: string,
  offerId: string,
  company = "axa",
  before?: number,
) => repository.distributionReview(who, leadId, offerId, company, before);
function decide(value: DistributionReviewDossier, patch: Partial<DistributionReviewInput> = {}) {
  return distributionReviewInputSchema.parse({
    revision: value.revision,
    scopeFingerprint: value.scopeFingerprint,
    action: "record",
    review: {
      position: "needs_information",
      aspects: ["parties", "product"],
      examinedScope: "Distribution personnelle du produit de cette version exacte",
      limitations: "Identités non vérifiées ; lecture partielle sans preuve externe",
      nextStep: "Vérifier les parties et demander les annexes du produit exact",
    },
    reason:
      "Le passage parties ne permet pas de relier le produit exact aux parties de la convention",
    validUntil: new Date(Date.now() + 600000).toISOString(),
    confirmed: true,
    originalsChecked: true,
    transcriptionChecked: true,
    ...patch,
  });
}
const record = (
  who: PartnerActor,
  value: DistributionReviewDossier,
  input = decide(value),
  token = key(),
) =>
  repository.recordDistributionReview(
    who,
    value.source.leadId,
    value.source.offer.id,
    value.source.companyId,
    input,
    token,
  );
async function prepared() {
  const item = await ready();
  await write(item.advisor, item.value);
  return { ...item, dossier: await review(item.advisor, item.lead.id, item.offerId) };
}

it("records a private human position with exact references without lifting any other check or producing business effects", async () => {
  const { advisor, owner, dossier, convention } = await prepared();
  const before = await effects(dossier.source.leadId);
  const checks = (await repository.advisorAssessment(advisor, dossier.source.leadId))
    .remainingChecks;
  const result = await record(advisor, dossier);
  expect(distributionReviewDossierSchema.parse(result)).toMatchObject({
    status: "recorded",
    position: "needs_information",
    source: {
      assessment: "human_review_required",
      legalIdentity: "unverified",
      productIdentity: "unverified",
    },
    current: {
      revision: 1,
      clausesRevision: 1,
      bindingRevision: 1,
      sourcesCurrent: true,
      conventionReference: { decisionId: convention.value.current!.id },
    },
  });
  expect(result.source).not.toHaveProperty("history");
  expect(await effects(dossier.source.leadId)).toEqual(before);
  expect(
    (await repository.advisorAssessment(advisor, dossier.source.leadId)).remainingChecks,
  ).toEqual(checks);
  expect(
    (
      await repository.boundSolutionEvidence(
        advisor,
        dossier.source.leadId,
        dossier.source.offer.id,
        { companyId: "axa" },
      )
    ).clauseEvidence,
  ).toBe("not_structured");
  expect(
    (
      await database.pool.query(
        "select lead_id,audience,text from partner_events where actor_id=$1 and kind='distribution_review.recorded.v1'",
        [advisor.userId],
      )
    ).rows,
  ).toEqual([{ lead_id: null, audience: "private", text: "" }]);
  expect(
    (
      await database.pool.query("select analysis_requested,analysis from files where id=$1", [
        convention.documentId,
      ])
    ).rows[0],
  ).toEqual({ analysis_requested: false, analysis: null });
  const shared = JSON.stringify([
    await repository.detail(owner, dossier.source.leadId),
    await repository.detail(advisor, dossier.source.leadId),
  ]);
  expect(shared).not.toContain(result.current!.reason);
  expect(JSON.stringify(result)).not.toContain(convention.documentId);
});
it("refuses positive, unconfirmed, empty, duplicate, unbounded and injected positions", async () => {
  const { dossier } = await prepared(),
    valid = decide(dossier);
  for (const invalid of [
    { ...valid, confirmed: false },
    { ...valid, originalsChecked: false },
    { ...valid, transcriptionChecked: false },
    { ...valid, advisorId: "other" },
    { ...valid, review: { ...valid.review, position: "favorable" } },
    ...[
      { aspects: [] },
      { aspects: ["parties", "parties"] },
      { aspects: ["invented"] },
      { examinedScope: "" },
      { limitations: "" },
      { nextStep: "x".repeat(1001) },
    ].map((patch) => ({ ...valid, review: { ...valid.review, ...patch } })),
    { ...valid, action: "withdraw" },
  ])
    expect(distributionReviewInputSchema.safeParse(invalid).success).toBe(false);
});
it("requires current association and clauses at the explicit company and a cited aspect for a personal impossibility", async () => {
  const { advisor, value } = await ready();
  let current = await review(advisor, value.leadId, value.offer.id);
  expect(current).toMatchObject({ canRecord: false, status: "missing", position: null });
  await expect(record(advisor, current)).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  await write(advisor, value);
  current = await review(advisor, value.leadId, value.offer.id);
  const input = decide(current);
  await expect(
    record(
      advisor,
      current,
      decide(current, {
        review: { ...input.review!, position: "cannot_proceed", aspects: ["exclusions"] },
      }),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  expect(
    await record(
      advisor,
      current,
      decide(current, {
        review: { ...input.review!, position: "cannot_proceed", aspects: ["parties"] },
      }),
    ),
  ).toMatchObject({ position: "cannot_proceed" });
  const other = await review(advisor, value.leadId, value.offer.id, "baloise");
  expect(other).toMatchObject({ canRecord: false, current: null, history: [] });
  await expect(record(advisor, other)).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
});
it.each(["wallet", "neighbor", "administrator", "manager"])(
  "refuses %s outside a personal current mandate",
  async (kind) => {
    const { advisor, owner, dossier } = await prepared();
    const who = kind === "wallet" ? owner : kind === "administrator" ? admin : await professional();
    if (kind === "manager")
      await database.pool.query(
        'update partner_members set organization_id=$2,roles=\'["advisor","manager"]\' where user_id=$1',
        [who.userId, (await repository.context(advisor)).application!.organizationId],
      );
    await expect(review(who, dossier.source.leadId, dossier.source.offer.id)).rejects.toBeDefined();
    await expect(record(who, dossier)).rejects.toBeDefined();
  },
);
it("keeps contributor sources personal and denies reads and replay after revocation", async () => {
  const { advisor, dossier } = await prepared(),
    other = await professional(),
    input = decide(dossier),
    token = key();
  await database.pool.query(
    "insert into partner_contributors(id,lead_id,user_id,access_scope,can_edit,can_contact) values($1,$2,$3,'advice',true,true)",
    [key(), dossier.source.leadId, other.userId],
  );
  expect(await review(other, dossier.source.leadId, dossier.source.offer.id)).toMatchObject({
    source: { advisorId: other.userId },
    canRecord: false,
    current: null,
  });
  await record(advisor, dossier, input, token);
  await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
    advisor.id,
  ]);
  await expect(record(advisor, dossier, input, token)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await database.pool.query(
    "update partner_contributors set revoked_at=now() where lead_id=$1 and user_id=$2",
    [dossier.source.leadId, other.userId],
  );
  await expect(review(other, dossier.source.leadId, dossier.source.offer.id)).rejects.toMatchObject(
    { code: "PARTNER_NOT_FOUND" },
  );
});
it.each([
  "clauses_replaced",
  "clauses_withdrawn",
  "clauses_expired",
  "binding_replaced",
  "convention_replaced",
  "file_revision",
  "quarantine",
  "offer_revision",
  "need_round_trip",
  "professional_round_trip",
  "client_request",
])(
  "invalidates the effective position after %s and cannot resurrect it by replay",
  async (kind) => {
    const { advisor, owner, dossier, convention, documentId } = await prepared(),
      input = decide(dossier),
      token = key(),
      source = dossier.source;
    await record(advisor, dossier, input, token);
    if (kind === "clauses_replaced" || kind === "clauses_withdrawn") {
      const next = await clauses(advisor, source.leadId, source.offer.id);
      await write(
        advisor,
        next,
        transcribe(
          next,
          kind === "clauses_withdrawn"
            ? { action: "withdraw", clauses: null, validUntil: null, originalChecked: false }
            : {},
        ),
      );
    }
    if (kind === "clauses_expired")
      await database.pool.query(
        "update partner_solution_clauses set created_at=now()-interval '2 hours',valid_until=now()-interval '1 hour' where offer_id=$1",
        [source.offer.id],
      );
    if (kind === "binding_replaced")
      await save(advisor, await read(advisor, source.leadId, source.offer.id));
    if (kind === "convention_replaced") await proof(advisor);
    if (kind === "file_revision" || kind === "offer_revision")
      await database.pool.query("update files set revision=revision+1 where id=$1", [
        kind === "file_revision" ? convention.documentId : documentId,
      ]);
    if (kind === "quarantine")
      await database.pool.query(
        "update files set state='quarantined',revision=revision+1 where id=$1",
        [convention.documentId],
      );
    if (kind === "need_round_trip")
      for (const title of ["Autre besoin", source.scope.title])
        await database.pool.query("update partner_leads set title=$2 where id=$1", [
          source.leadId,
          title,
        ]);
    if (kind === "professional_round_trip")
      for (const name of ["Autre nom", "Conseiller isolé"])
        await database.pool.query(
          "update partner_members set application=jsonb_set(application,'{name}',$2::jsonb) where user_id=$1",
          [advisor.userId, JSON.stringify(name)],
        );
    if (kind === "client_request") {
      const lead = await repository.detail(owner, source.leadId);
      await repository.command(
        owner,
        source.leadId,
        { action: "client_interlocutor", revision: lead.revision, reason: "Changement demandé" },
        key(),
      );
    }
    expect(await review(advisor, source.leadId, source.offer.id)).toMatchObject({
      status: "review_required",
      position: null,
      current: { sourcesCurrent: false },
    });
    expect(await record(advisor, dossier, input, token)).toMatchObject({
      revision: 1,
      status: "review_required",
      position: null,
    });
    await expect(record(advisor, dossier, input)).rejects.toMatchObject({
      code: "PARTNER_CONFLICT",
    });
  },
);
it("bounds expiry, rejects a positive SQL value and rolls back a real audit failure", async () => {
  const { advisor, dossier } = await prepared();
  await expect(
    record(
      advisor,
      dossier,
      decide(dossier, {
        validUntil: new Date(Date.parse(dossier.maxValidUntil!) + 1).toISOString(),
      }),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  const trigger = `dist_failure_${key().replaceAll("-", "")}`;
  await database.pool.query(
    `create function ${trigger}() returns trigger language plpgsql as $$ begin if new.kind='distribution_review.recorded.v1' then raise exception 'Isolated audit failure'; end if; return new; end $$`,
  );
  await database.pool.query(
    `create trigger ${trigger} before insert on partner_events for each row execute function ${trigger}()`,
  );
  try {
    await expect(record(advisor, dossier)).rejects.toBeDefined();
    expect(
      (
        await database.pool.query("select id from partner_distribution_reviews where offer_id=$1", [
          dossier.source.offer.id,
        ])
      ).rowCount,
    ).toBe(0);
  } finally {
    await database.pool.query(`drop trigger ${trigger} on partner_events`);
    await database.pool.query(`drop function ${trigger}()`);
  }
  await record(advisor, dossier);
  await expect(
    database.pool.query(
      "update partner_distribution_reviews set review=jsonb_set(review,'{position}','\"favorable\"') where offer_id=$1",
      [dossier.source.offer.id],
    ),
  ).rejects.toMatchObject({ code: "23514" });
  const disabled = createPartnerRepository(database.pool, false);
  expect(
    await disabled.distributionReview(
      advisor,
      dossier.source.leadId,
      dossier.source.offer.id,
      "axa",
    ),
  ).toMatchObject({ canRecord: false, position: null, status: "review_required" });
});
it("serializes competing revisions and exact retries, keeps bounded history and never resurrects withdrawn or expired positions", async () => {
  const { advisor, dossier } = await prepared(),
    input = decide(dossier),
    token = key();
  const identical = await Promise.all([
    record(advisor, dossier, input, token),
    record(advisor, dossier, input, token),
  ]);
  expect(identical.map((v) => v.revision)).toEqual([1, 1]);
  await expect(
    record(advisor, dossier, { ...input, reason: "Un autre motif privé" }, token),
  ).rejects.toMatchObject({ code: "PARTNER_IDEMPOTENCY_REUSED" });
  const current = identical[0],
    next = decide(current);
  const competing = await Promise.allSettled([
    record(advisor, current, next),
    record(advisor, current, next),
  ]);
  expect(competing.filter((v) => v.status === "fulfilled")).toHaveLength(1);
  expect(competing.filter((v) => v.status === "rejected")).toHaveLength(1);
  await database.pool.query(
    "update partner_distribution_reviews set created_at=now()-interval '2 hours',valid_until=now()-interval '1 hour' where offer_id=$1",
    [dossier.source.offer.id],
  );
  let value = await review(advisor, dossier.source.leadId, dossier.source.offer.id);
  expect(value).toMatchObject({ status: "expired", position: null });
  value = await record(
    advisor,
    value,
    decide(value, {
      action: "withdraw",
      review: null,
      validUntil: null,
      originalsChecked: false,
      transcriptionChecked: false,
    }),
  );
  expect(value).toMatchObject({ status: "withdrawn", position: null });
  expect(await record(advisor, dossier, input, token)).toMatchObject({
    status: "withdrawn",
    revision: 3,
    position: null,
  });
  for (let i = 0; i < 20; i++) value = await record(advisor, value);
  expect(value.history).toHaveLength(20);
  const older = await review(
    advisor,
    dossier.source.leadId,
    dossier.source.offer.id,
    "axa",
    value.nextBeforeRevision!,
  );
  expect(older.history).toHaveLength(3);
  expect(older.current?.revision).toBe(23);
});
it("isolates multiple Leads for one client and filters historical subjects after relinking", async () => {
  const { advisor, owner, dossier } = await prepared();
  await record(advisor, dossier);
  const other = await offered(owner, advisor);
  expect(await review(advisor, other.lead.id, other.offerId)).toMatchObject({
    current: null,
    history: [],
    revision: 0,
  });
  await expect(review(advisor, other.lead.id, dossier.source.offer.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  await database.pool.query("update partner_leads set client_user_id=$2 where id=$1", [
    dossier.source.leadId,
    (await actor()).userId,
  ]);
  expect(await review(advisor, dossier.source.leadId, dossier.source.offer.id)).toMatchObject({
    current: null,
    history: [],
    revision: 1,
    position: null,
  });
});

it.each(["session", "mfa", "membership", "source", "deadline"])(
  "revalidates %s after a real convention-original lock wait",
  async (kind) => {
    const { advisor, dossier: value, convention } = await prepared(),
      expires = new Date(Date.now() + 2500),
      who = { ...advisor, administrator: kind === "mfa" };
    if (kind === "session")
      await database.pool.query("update identity_sessions set expires_at=$2 where id=$1", [
        advisor.id,
        expires,
      ]);
    if (kind === "membership")
      await database.pool.query("update partner_members set review_due_at=$2 where user_id=$1", [
        advisor.userId,
        expires,
      ]);
    if (kind === "mfa") {
      await database.pool.query(
        "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated expiry')",
        [key(), advisor.userId],
      );
      await database.pool.query("update identity_sessions set mfa_verified_at=$2 where id=$1", [
        advisor.id,
        new Date(expires.getTime() - 86400000),
      ]);
    }
    const blocker = await database.pool.connect();
    let pending: Promise<unknown> | undefined;
    try {
      await blocker.query("begin");
      await blocker.query("select id from files where id=$1 for update", [convention.documentId]);
      const input = decide(value, kind === "deadline" ? { validUntil: expires.toISOString() } : {});
      pending = record(who, value, input).then(
        () => {
          throw new Error("Stale command accepted");
        },
        (error: unknown) =>
          expect(error).toMatchObject({
            code:
              kind === "source"
                ? "PARTNER_CONFLICT"
                : kind === "deadline"
                  ? "PARTNER_ACTION_REQUIRED"
                  : "PARTNER_ACCESS_DENIED",
          }),
      );
      await expect
        .poll(
          async () =>
            (
              await database.pool.query(
                "select pid from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%files%' and pid<>pg_backend_pid() limit 1",
              )
            ).rowCount,
          { timeout: 5000 },
        )
        .toBe(1);
      if (kind === "source")
        await blocker.query("update files set revision=revision+1 where id=$1", [
          convention.documentId,
        ]);
      else await expect.poll(() => Date.now() >= expires.getTime(), { timeout: 5000 }).toBe(true);
      await blocker.query("commit");
      await pending;
      expect(
        (
          await database.pool.query(
            "select id from partner_distribution_reviews where offer_id=$1",
            [value.source.offer.id],
          )
        ).rowCount,
      ).toBe(0);
    } finally {
      await blocker.query("rollback");
      blocker.release();
      if (pending) await pending;
    }
  },
);
it.each(["session", "mfa", "membership"])(
  "denies a GET after %s expires during a real canonical profile wait",
  async (kind) => {
    const { owner, advisor, dossier } = await scenario(),
      expires = new Date(Date.now() + 2500),
      reader = { ...advisor, administrator: kind === "mfa" };
    if (kind === "session")
      await database.pool.query("update identity_sessions set expires_at=$2 where id=$1", [
        advisor.id,
        expires,
      ]);
    if (kind === "membership")
      await database.pool.query("update partner_members set review_due_at=$2 where user_id=$1", [
        advisor.userId,
        expires,
      ]);
    if (kind === "mfa") {
      await database.pool.query(
        "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated read expiry')",
        [key(), advisor.userId],
      );
      await database.pool.query("update identity_sessions set mfa_verified_at=$2 where id=$1", [
        advisor.id,
        new Date(expires.getTime() - 86400000),
      ]);
    }
    const blocker = await database.pool.connect();
    let pending: Promise<unknown> | undefined;
    try {
      await blocker.query("begin");
      await blocker.query("select id from identity_profiles where user_id=$1 for update", [
        owner.userId,
      ]);
      pending = review(reader, dossier.leadId, dossier.offer.id).then(
        () => {
          throw new Error("Expired read returned a source");
        },
        (cause: unknown) => expect(cause).toMatchObject({ code: "PARTNER_ACCESS_DENIED" }),
      );
      await expect
        .poll(
          async () =>
            (
              await database.pool.query(
                "select pid from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%identity_profiles%' and pid<>pg_backend_pid() limit 1",
              )
            ).rowCount,
          { timeout: 5000 },
        )
        .toBe(1);
      await expect.poll(() => Date.now() >= expires.getTime(), { timeout: 5000 }).toBe(true);
      await blocker.query("commit");
      await pending;
    } finally {
      await blocker.query("rollback");
      blocker.release();
      if (pending) await pending;
    }
  },
);
