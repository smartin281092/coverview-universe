import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { beforeAll, afterAll, expect, it } from "vitest";
import {
  solutionBindingInputSchema,
  solutionClausesInputSchema,
  solutionClausesDossierSchema,
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
    .withDatabase("coverview_solution_clauses_test")
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
it("records bounded human transcriptions against exact references without AI, business effects or a distribution conclusion", async () => {
  const { advisor, owner, value, convention } = await ready();
  const before = await effects(value.leadId);
  const checks = (await repository.advisorAssessment(advisor, value.leadId)).remainingChecks;
  const recorded = await write(advisor, value);
  expect(solutionClausesDossierSchema.parse(recorded)).toMatchObject({
    status: "recorded",
    assessment: "human_review_required",
    legalIdentity: "unverified",
    productIdentity: "unverified",
    current: {
      revision: 1,
      method: "human_transcription",
      clausesAvailable: true,
      bindingRevision: 1,
      conventionReference: {
        decisionId: convention.value.current!.id,
        revision: convention.value.current!.revision,
        documentRevision: convention.value.current!.documentRevision,
      },
      clauses: {
        exclusions: null,
        distribution: null,
        parties: { page: 1, locator: "Article 1 — parties" },
      },
    },
  });
  expect(
    (
      await database.pool.query("select analysis_requested,analysis from files where id=$1", [
        convention.documentId,
      ])
    ).rows[0],
  ).toEqual({ analysis_requested: false, analysis: null });
  const events = (
    await database.pool.query(
      "select lead_id,audience,text from partner_events where actor_id=$1 and kind='solution_clauses.recorded.v1'",
      [advisor.userId],
    )
  ).rows;
  expect(events).toEqual([{ lead_id: null, audience: "private", text: "" }]);
  expect(await effects(value.leadId)).toEqual(before);
  expect((await repository.advisorAssessment(advisor, value.leadId)).remainingChecks).toEqual(
    checks,
  );
  const publicViews = JSON.stringify([
    await repository.detail(owner, value.leadId),
    await repository.detail(advisor, value.leadId),
  ]);
  expect(publicViews).not.toContain("Passage transcrit synthétique");
  expect(JSON.stringify(recorded)).not.toContain(convention.documentId);
  expect(
    (
      await repository.boundSolutionEvidence(advisor, value.leadId, value.offer.id, {
        companyId: "axa",
      })
    ).clauseEvidence,
  ).toBe("not_structured");
});
it("rejects empty, unconfirmed, unbounded and injected transcriptions", async () => {
  const { value } = await ready(),
    valid = transcribe(value);
  for (const invalid of [
    { ...valid, originalChecked: false },
    { ...valid, confirmed: false },
    { ...valid, advisorId: "foreign" },
    { ...valid, clauses: Object.fromEntries(Object.keys(valid.clauses!).map((k) => [k, null])) },
    ...[{ page: 0 }, { page: 10000 }, { locator: "" }, { quote: "x".repeat(1001) }].map(
      (patch) => ({
        ...valid,
        clauses: { ...valid.clauses, parties: { ...valid.clauses!.parties, ...patch } },
      }),
    ),
  ])
    expect(solutionClausesInputSchema.safeParse(invalid).success).toBe(false);
});
it("requires a current human company association and does not infer one from labels", async () => {
  const { advisor, lead, offerId, dossier } = await scenario();
  await proof(advisor);
  let value = await clauses(advisor, lead.id, offerId);
  expect(value.canRecord).toBe(false);
  await expect(write(advisor, value)).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  await save(advisor, dossier, command(dossier, { companyId: null }));
  value = await clauses(advisor, lead.id, offerId);
  expect(value.canRecord).toBe(false);
  const next = await read(advisor, lead.id, offerId);
  await save(advisor, next);
  expect((await clauses(advisor, lead.id, offerId, "baloise")).canRecord).toBe(false);
  expect((await clauses(advisor, lead.id, offerId)).canRecord).toBe(true);
});
it.each(["wallet", "neighbor", "administrator", "manager"])(
  "refuses %s outside the personal mandate",
  async (kind) => {
    const { owner, advisor, value } = await ready();
    await write(advisor, value);
    const who = kind === "wallet" ? owner : kind === "administrator" ? admin : await professional();
    if (kind === "manager") {
      const org = (await repository.context(advisor)).application!.organizationId;
      await database.pool.query(
        'update partner_members set organization_id=$2,roles=\'["advisor","manager"]\' where user_id=$1',
        [who.userId, org],
      );
    }
    await expect(clauses(who, value.leadId, value.offer.id)).rejects.toBeDefined();
    await expect(write(who, value)).rejects.toBeDefined();
  },
);
it("isolates a contributor's sources and revokes reads and replay with the mandate", async () => {
  const { advisor, value } = await ready(),
    other = await professional();
  await database.pool.query(
    "insert into partner_contributors(id,lead_id,user_id,access_scope,can_edit,can_contact) values($1,$2,$3,'advice',true,true)",
    [key(), value.leadId, other.userId],
  );
  expect(await clauses(other, value.leadId, value.offer.id)).toMatchObject({
    advisorId: other.userId,
    canRecord: false,
    current: null,
    history: [],
  });
  const input = transcribe(value),
    token = key();
  await write(advisor, value, input, token);
  await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
    advisor.id,
  ]);
  await expect(write(advisor, value, input, token)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await database.pool.query(
    "update partner_contributors set revoked_at=now() where lead_id=$1 and user_id=$2",
    [value.leadId, other.userId],
  );
  await expect(clauses(other, value.leadId, value.offer.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
});
it.each([
  "file_revision",
  "quarantine",
  "offer_revision",
  "need_round_trip",
  "professional_round_trip",
  "binding_replaced",
  "convention_replaced",
  "withdrawn",
  "expired",
  "client_request",
])("invalidates passages after %s and does not restore them by replay", async (kind) => {
  const { advisor, owner, value, convention, documentId } = await ready(),
    token = key(),
    input = transcribe(value);
  await write(advisor, value, input, token);
  if (kind === "file_revision")
    await database.pool.query("update files set revision=revision+1 where id=$1", [
      convention.documentId,
    ]);
  if (kind === "quarantine")
    await database.pool.query(
      "update files set state='quarantined',revision=revision+1 where id=$1",
      [convention.documentId],
    );
  if (kind === "offer_revision")
    await database.pool.query("update files set revision=revision+1 where id=$1", [documentId]);
  if (kind === "need_round_trip")
    for (const title of ["Autre besoin", value.scope.title])
      await database.pool.query("update partner_leads set title=$2 where id=$1", [
        value.leadId,
        title,
      ]);
  if (kind === "professional_round_trip")
    for (const name of ["Autre nom", "Conseiller isolé"])
      await database.pool.query(
        "update partner_members set application=jsonb_set(application,'{name}',$2::jsonb) where user_id=$1",
        [advisor.userId, JSON.stringify(name)],
      );
  if (kind === "binding_replaced")
    await save(advisor, await read(advisor, value.leadId, value.offer.id));
  if (kind === "convention_replaced") await proof(advisor);
  if (kind === "withdrawn")
    await repository.decideConvention(
      advisor,
      advisor.userId,
      "vehicle",
      "axa",
      conventionDecisionSchema.parse({
        revision: convention.value.current!.revision,
        documentRevision: convention.value.current!.documentRevision,
        decision: "withdrawn",
        reason: "Retrait personnel isolé",
        scope: "",
        coverage: null,
        validFrom: null,
        validUntil: null,
        memberCovered: false,
        originalChecked: false,
      }),
      key(),
    );
  if (kind === "expired")
    await database.pool.query(
      "update partner_convention_decisions set created_at=now()-interval '2 hours',valid_from=now()-interval '1 day',valid_until=now()-interval '1 hour' where id=$1",
      [convention.value.current!.id],
    );
  if (kind === "client_request") {
    const lead = await repository.detail(owner, value.leadId);
    await repository.command(
      owner,
      value.leadId,
      {
        action: "client_interlocutor",
        revision: lead.revision,
        reason: "Autre interlocuteur demandé",
      },
      key(),
    );
  }
  const result = await clauses(advisor, value.leadId, value.offer.id);
  expect(result).toMatchObject({
    status: "review_required",
    current: { clausesAvailable: false, clauses: null },
    history: [{ clauses: null }],
  });
  expect(await write(advisor, value, input, token)).toMatchObject({
    revision: 1,
    status: "review_required",
    current: { clauses: null },
  });
  await expect(write(advisor, value, input)).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
});
it("supports expiry, withdrawal, replacement, bounded history and replay without resurrection", async () => {
  const { advisor, value } = await ready(),
    input = transcribe(value),
    token = key();
  await write(advisor, value, input, token);
  expect((await write(advisor, value, input, token)).revision).toBe(1);
  await expect(
    write(advisor, value, { ...input, reason: "Autre motif personnel" }, token),
  ).rejects.toMatchObject({ code: "PARTNER_IDEMPOTENCY_REUSED" });
  await database.pool.query(
    "update partner_solution_clauses set created_at=now()-interval '2 hours',valid_until=now()-interval '1 hour' where offer_id=$1",
    [value.offer.id],
  );
  let current = await clauses(advisor, value.leadId, value.offer.id);
  expect(current.status).toBe("expired");
  current = await write(
    advisor,
    current,
    transcribe(current, {
      action: "withdraw",
      clauses: null,
      validUntil: null,
      originalChecked: false,
    }),
  );
  expect(current).toMatchObject({ status: "withdrawn", current: { clauses: null, revision: 2 } });
  expect(await write(advisor, value, input, token)).toMatchObject({
    status: "withdrawn",
    revision: 2,
  });
  for (let i = 0; i < 20; i++) current = await write(advisor, current);
  expect(current.history).toHaveLength(20);
  const older = await clauses(
    advisor,
    value.leadId,
    value.offer.id,
    "axa",
    current.nextBeforeRevision!,
  );
  expect(older.history).toHaveLength(2);
  expect(older.current?.revision).toBe(22);
  expect(older.revision).toBe(22);
});
it("bounds the deadline by source validity and serializes same and distinct idempotency keys", async () => {
  const { advisor, value } = await ready();
  await expect(
    write(
      advisor,
      value,
      transcribe(value, {
        validUntil: new Date(Date.parse(value.maxValidUntil!) + 1).toISOString(),
      }),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  const token = key(),
    input = transcribe(value);
  const identical = await Promise.all([
    write(advisor, value, input, token),
    write(advisor, value, input, token),
  ]);
  expect(identical.map((v) => v.revision)).toEqual([1, 1]);
  const current = identical[0],
    next = transcribe(current);
  const distinct = await Promise.allSettled([
    write(advisor, current, next),
    write(advisor, current, next),
  ]);
  expect(distinct.filter((v) => v.status === "fulfilled")).toHaveLength(1);
  expect(distinct.filter((v) => v.status === "rejected")).toHaveLength(1);
});
it("keeps multiple Leads and subjects isolated and refuses an offer from another Lead", async () => {
  const { owner, advisor, value } = await ready();
  await write(advisor, value);
  const other = await offered(owner, advisor);
  expect(await clauses(advisor, other.lead.id, other.offerId)).toMatchObject({
    current: null,
    history: [],
    revision: 0,
  });
  await expect(clauses(advisor, other.lead.id, value.offer.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  const newOwner = await actor();
  await database.pool.query("update partner_leads set client_user_id=$2 where id=$1", [
    value.leadId,
    newOwner.userId,
  ]);
  expect(await clauses(advisor, value.leadId, value.offer.id)).toMatchObject({
    status: "missing",
    current: null,
    history: [],
    revision: 1,
  });
});
it("masks sources when documents are disabled and rolls back audit failure atomically", async () => {
  const { advisor, value } = await ready();
  const disabled = createPartnerRepository(database.pool, false);
  expect(
    await disabled.solutionClauses(advisor, value.leadId, value.offer.id, "axa"),
  ).toMatchObject({ canRecord: false, convention: { sourceStatus: "disabled" } });
  const trigger = `clauses_failure_${key().replaceAll("-", "")}`;
  await database.pool.query(
    `create function ${trigger}() returns trigger language plpgsql as $$ begin if new.kind='solution_clauses.recorded.v1' then raise exception 'Isolated audit failure'; end if; return new; end $$`,
  );
  await database.pool.query(
    `create trigger ${trigger} before insert on partner_events for each row execute function ${trigger}()`,
  );
  try {
    await expect(write(advisor, value)).rejects.toBeDefined();
    expect(
      (
        await database.pool.query("select id from partner_solution_clauses where offer_id=$1", [
          value.offer.id,
        ])
      ).rowCount,
    ).toBe(0);
  } finally {
    await database.pool.query(`drop trigger ${trigger} on partner_events`);
    await database.pool.query(`drop function ${trigger}()`);
  }
});

it.each(["session", "mfa", "membership", "source", "deadline"])(
  "revalidates %s after a real convention-original lock wait",
  async (kind) => {
    const { advisor, value, convention } = await ready(),
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
      const input = transcribe(
        value,
        kind === "deadline" ? { validUntil: expires.toISOString() } : {},
      );
      pending = write(who, value, input).then(
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
          await database.pool.query("select id from partner_solution_clauses where offer_id=$1", [
            value.offer.id,
          ])
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
      pending = clauses(reader, dossier.leadId, dossier.offer.id).then(
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
