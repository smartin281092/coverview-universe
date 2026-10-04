import { cp, mkdir, mkdtemp, readFile, writeFile, copyFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { beforeAll, afterAll, expect, it } from "vitest";
import {
  solutionBindingInputSchema,
  boundSolutionEvidenceSchema,
  solutionEvidenceVersionQuerySchema,
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
    .withDatabase("coverview_bound_solution_evidence_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  // The incoming journal is protected. Assemble the pending additive migration only in this
  // ignored test catalogue; the normal deployment catalogue deliberately remains untouched.
  const local = resolve(".planning-local");
  await mkdir(local, { recursive: true });
  const migrationsFolder = await mkdtemp(join(local, "bound-solution-evidence-test-"));
  await cp(fileURLToPath(new URL("../../drizzle/", import.meta.url)), migrationsFolder, {
    recursive: true,
  });
  const entrySchema = z.object({
    idx: z.number(),
    version: z.string(),
    when: z.number(),
    tag: z.string(),
    breakpoints: z.boolean(),
  });
  const journal = z
    .object({ entries: z.array(entrySchema) })
    .passthrough()
    .parse(JSON.parse(await readFile(join(migrationsFolder, "meta/_journal.json"), "utf8")));
  for (const name of [
    "0049_partner_need_capacity",
    "0050_partner_need_conflicts",
    "0051_partner_need_expertise",
    "0052_partner_solution_binding",
  ]) {
    const pending = fileURLToPath(new URL("../../drizzle-pending/" + name + "/", import.meta.url));
    const entry = entrySchema.parse(
      JSON.parse(await readFile(join(pending, "entry.json"), "utf8")),
    );
    expect(entry.idx).toBe(journal.entries.at(-1)!.idx + 1);
    journal.entries.push(entry);
    await copyFile(join(pending, "migration.sql"), join(migrationsFolder, entry.tag + ".sql"));
    await copyFile(
      join(pending, "snapshot.json"),
      join(migrationsFolder, "meta/" + String(entry.idx).padStart(4, "0") + "_snapshot.json"),
    );
  }
  await writeFile(join(migrationsFolder, "meta/_journal.json"), JSON.stringify(journal));
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

const joint = (who: PartnerActor, leadId: string, offerId: string) =>
  repository.boundSolutionEvidence(who, leadId, offerId, { companyId: "axa" });

it("keeps company selection empty despite a recorded association, with no business effects", async () => {
  const { advisor, dossier, lead, offerId, owner } = await scenario();
  await save(advisor, dossier);
  const before = await effects(lead.id);
  const events = (await database.pool.query("select * from partner_events order by id")).rows;
  const assessment = await repository.advisorAssessment(advisor, lead.id);
  const result = await repository.boundSolutionEvidence(advisor, lead.id, offerId);
  expect(boundSolutionEvidenceSchema.parse(result)).toMatchObject({
    version: 2,
    companyId: null,
    selection: "not_selected",
    convention: null,
    companyMatch: "unconfirmed",
    legalIdentity: "unverified",
    productIdentity: "unverified",
    clauseEvidence: "not_structured",
    assessment: "human_review_required",
    binding: { status: "recorded", current: { companyId: "axa", revision: 1 } },
  });
  expect(await effects(lead.id)).toEqual(before);
  expect((await database.pool.query("select * from partner_events order by id")).rows).toEqual(
    events,
  );
  expect((await repository.advisorAssessment(advisor, lead.id)).remainingChecks).toEqual(
    assessment.remainingChecks,
  );
  const visible = JSON.stringify(await repository.detail(owner, lead.id));
  expect(visible).not.toContain("Association personnelle synthétique");
  expect(visible).not.toContain("binding");
  const legacy = await repository.solutionEvidence(advisor, lead.id, offerId, { companyId: "axa" });
  expect(legacy.version).toBe(1);
  expect(legacy).not.toHaveProperty("binding");
});

it("joins only a human association with exact current convention and limits its projection", async () => {
  const { advisor, dossier, lead, offerId } = await scenario();
  await save(advisor, dossier);
  const p = await proof(advisor, "limited");
  const value = await joint(advisor, lead.id, offerId);
  expect(value).toMatchObject({
    selection: "human_match",
    companyMatch: "unconfirmed",
    assessment: "human_review_required",
    binding: {
      current: { mentions: { company: { page: 1, quote: "AXA Assurances SA" }, legalParty: null } },
    },
    convention: {
      current: { id: p.value.current!.id, revision: p.value.current!.revision },
      summary: { status: "limited" },
      sourceStatus: "available",
    },
  });
  expect(value.remainingChecks).toEqual([
    "company_identity",
    "product_scope",
    "client_admission",
    "distribution_rights",
    "economic_agreement",
  ]);
  expect(value.binding.current).not.toHaveProperty("source");
  expect(value.binding.current).not.toHaveProperty("scope");
  expect(value.binding).not.toHaveProperty("history");
  expect(value).not.toHaveProperty("sourcePage");
  expect(value.convention?.current).not.toHaveProperty("documentId");
  expect(JSON.stringify(value)).not.toContain("object_key");
  expect(JSON.stringify(value)).not.toContain("Mention répétée");
});

it("does not infer matching from free names and distinguishes missing and different human choices", async () => {
  const { advisor, dossier, lead, offerId } = await scenario();
  await proof(advisor);
  expect(await joint(advisor, lead.id, offerId)).toMatchObject({
    selection: "no_current_binding",
    binding: { status: "missing", current: null },
    convention: { summary: { status: "reviewed" } },
  });
  await save(advisor, dossier);
  const value = await repository.boundSolutionEvidence(advisor, lead.id, offerId, {
    companyId: "allianz",
  });
  expect(value).toMatchObject({
    selection: "different_company",
    companyId: "allianz",
    binding: { current: { companyId: "axa" } },
    convention: { summary: { status: "missing" } },
  });
});

it("preserves explicit unknown mentions and no directory identity", async () => {
  const { advisor, dossier, lead, offerId } = await scenario();
  await save(
    advisor,
    dossier,
    command(dossier, {
      companyId: null,
      mentions: {
        company: null,
        legalParty: null,
        product: null,
        variant: null,
        productVersion: null,
      },
    }),
  );
  expect(await joint(advisor, lead.id, offerId)).toMatchObject({
    selection: "binding_without_company",
    binding: {
      status: "recorded",
      current: { companyId: null, mentions: { company: null, product: null } },
    },
  });
});

it("never restores an older association after withdrawal or an exact original command replay", async () => {
  const { advisor, dossier, lead, offerId } = await scenario(),
    input = command(dossier),
    attempt = key();
  const recorded = await save(advisor, dossier, input, attempt);
  await save(
    advisor,
    recorded,
    command(recorded, { action: "withdraw", companyId: null, mentions: null, validUntil: null }),
  );
  await save(advisor, dossier, input, attempt);
  expect(await joint(advisor, lead.id, offerId)).toMatchObject({
    selection: "no_current_binding",
    binding: { status: "withdrawn", revision: 2, current: null },
  });
  expect((await read(advisor, lead.id, offerId)).history).toHaveLength(2);
});

it.each(["expiry", "need_round_trip", "file_revision", "quarantine", "unbound", "client_request"])(
  "suppresses all current association details after %s",
  async (kind) => {
    const { advisor, owner, dossier, lead, offerId, documentId } = await scenario();
    await save(advisor, dossier);
    if (kind === "expiry")
      await database.pool.query(
        "update partner_solution_bindings set created_at=now()-interval '2 days',valid_until=now()-interval '1 day' where offer_id=$1",
        [offerId],
      );
    if (kind === "need_round_trip")
      for (const title of ["Besoin changé", lead.title])
        await database.pool.query("update partner_leads set title=$2 where id=$1", [
          lead.id,
          title,
        ]);
    if (kind === "file_revision")
      await database.pool.query("update files set revision=revision+1 where id=$1", [documentId]);
    if (kind === "quarantine") {
      await database.pool.query(
        "update files set state='quarantined',revision=revision+1 where id=$1",
        [documentId],
      );
      expect((await joint(advisor, lead.id, offerId)).binding.current).toBeNull();
      await database.pool.query("update files set state='ready',revision=revision+1 where id=$1", [
        documentId,
      ]);
    }
    if (kind === "unbound")
      await database.pool.query("update partner_offers set source_snapshot=null where id=$1", [
        offerId,
      ]);
    if (kind === "client_request")
      await repository.command(
        owner,
        lead.id,
        {
          action: "client_interlocutor",
          revision: lead.revision,
          reason: "Interlocuteur à changer",
        },
        key(),
      );
    const value = await joint(advisor, lead.id, offerId);
    expect(value).toMatchObject({ selection: "no_current_binding", binding: { current: null } });
    expect(value.binding.status).toBe(kind === "expiry" ? "expired" : "review_required");
    expect(JSON.stringify(value)).not.toContain("Association personnelle synthétique");
    expect(JSON.stringify(value)).not.toContain("Produit Mobilité");
  },
);

it.each([
  "scheduled",
  "expired",
  "withdrawn",
  "replacement",
  "changed",
  "quarantined",
  "scope_round_trip",
])("keeps the latest convention %s explicit without granting distribution", async (kind) => {
  const { advisor, dossier, lead, offerId } = await scenario();
  await save(advisor, dossier);
  const p = await proof(advisor);
  if (kind === "scheduled")
    await database.pool.query(
      "update partner_convention_decisions set valid_from=now()+interval '1 hour' where id=$1",
      [p.value.current!.id],
    );
  if (kind === "expired")
    await database.pool.query(
      "update partner_convention_decisions set created_at=now()-interval '3 days',valid_from=now()-interval '2 days',valid_until=now()-interval '1 day' where id=$1",
      [p.value.current!.id],
    );
  if (kind === "withdrawn")
    await repository.decideConvention(
      advisor,
      advisor.userId,
      "vehicle",
      "axa",
      conventionDecisionSchema.parse({
        revision: p.value.current!.revision,
        decision: "withdrawn",
        reason: "Retrait personnel isolé",
        documentRevision: p.value.current!.documentRevision,
        scope: "",
        coverage: null,
        validFrom: null,
        validUntil: null,
        memberCovered: false,
        originalChecked: false,
      }),
      key(),
    );
  if (kind === "replacement") {
    const member = (await repository.context(advisor)).application!;
    await repository.declareConvention(
      advisor,
      advisor.userId,
      "vehicle",
      "axa",
      conventionDeclarationSchema.parse({
        revision: p.value.current!.revision,
        professionalRevision: member.professionalRevision,
        subjectName: member.name,
        subjectOrganization: member.organization,
        declaration: "Nouvelle déclaration non examinée",
        confirmed: true,
        file: {
          name: "Nouvelle.pdf",
          mime: "application/pdf",
          size: 10,
          checksum: createHash("sha256").update(key()).digest("hex"),
        },
      }),
      key(),
    );
  }
  if (kind === "changed" || kind === "quarantined")
    await database.pool.query("update files set revision=revision+1,state=$2 where id=$1", [
      p.documentId,
      kind === "quarantined" ? "quarantined" : "ready",
    ]);
  if (kind === "scope_round_trip")
    for (const name of ["Autre nom", "Conseiller isolé"])
      await database.pool.query(
        "update partner_members set application=jsonb_set(application,'{name}',$2::jsonb) where user_id=$1",
        [advisor.userId, JSON.stringify(name)],
      );
  const value = await joint(advisor, lead.id, offerId);
  expect(value.convention?.summary.status).toBe(
    kind === "replacement"
      ? "submitted"
      : ["changed", "quarantined", "scope_round_trip"].includes(kind)
        ? "unavailable"
        : kind,
  );
  expect(value.assessment).toBe("human_review_required");
  expect(value.remainingChecks).toContain("distribution_rights");
  if (kind === "scope_round_trip") expect(value.binding.current).toBeNull();
  else expect(value.selection).toBe("human_match");
});

it("masks document-dependent association when disabled, while keeping convention source explicitly disabled", async () => {
  const { advisor, dossier, lead, offerId } = await scenario();
  await save(advisor, dossier);
  await proof(advisor);
  const disabled = createPartnerRepository(database.pool, false);
  expect(
    await disabled.boundSolutionEvidence(advisor, lead.id, offerId, { companyId: "axa" }),
  ).toMatchObject({
    offer: { sourceStatus: "disabled", canDownload: false },
    binding: { current: null, status: "review_required" },
    selection: "no_current_binding",
    convention: { sourceStatus: "disabled" },
  });
});

it("enforces personal access and gives contributors only their own binding and convention", async () => {
  const { owner, advisor, dossier, lead, offerId } = await scenario(),
    other = await professional();
  await save(advisor, dossier);
  await proof(advisor);
  await database.pool.query(
    'update partner_members set organization_id=(select organization_id from partner_members where user_id=$2),roles=\'["advisor","manager"]\' where user_id=$1',
    [other.userId, advisor.userId],
  );
  for (const person of [owner, other, admin])
    await expect(joint(person, lead.id, offerId)).rejects.toMatchObject({
      code: "PARTNER_ACCESS_DENIED",
    });
  await database.pool.query(
    "insert into partner_contributors(id,lead_id,user_id,access_scope,can_edit,can_contact) values($1,$2,$3,'advice',false,false)",
    [key(), lead.id, other.userId],
  );
  expect(await joint(other, lead.id, offerId)).toMatchObject({
    advisorId: other.userId,
    binding: { status: "missing", current: null },
    convention: { summary: { status: "missing" } },
  });
  await database.pool.query(
    "update partner_contributors set revoked_at=now() where lead_id=$1 and user_id=$2",
    [lead.id, other.userId],
  );
  await expect(joint(other, lead.id, offerId)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
});

it("isolates multiple Leads and exact versions after replacement", async () => {
  const { owner, advisor, dossier, lead, offerId, offer } = await scenario();
  await save(advisor, dossier);
  await proof(advisor);
  const second = await offered(owner, advisor);
  expect((await joint(advisor, second.lead.id, second.offerId)).binding.current).toBeNull();
  await expect(joint(advisor, second.lead.id, offerId)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  const changed = await repository.command(
    advisor,
    lead.id,
    { action: "offer", revision: lead.revision, offer: { ...offer, replacesId: offerId } },
    key(),
  );
  expect(await joint(advisor, lead.id, offerId)).toMatchObject({
    binding: { status: "review_required", current: null },
  });
  expect(
    (await joint(advisor, lead.id, changed.offers.find((o) => o.id !== offerId)!.id)).binding
      .status,
  ).toBe("missing");
});

it("rejects unsupported versions and identity injection in both contracts and repository", async () => {
  const { advisor, lead, offerId } = await scenario();
  for (const input of [
    { version: "3" },
    { advisorId: advisor.userId },
    { companyId: "AXA" },
    { version: "2", sourcePage: 1 },
  ])
    expect(solutionEvidenceVersionQuerySchema.safeParse(input).success).toBe(false);
  expect(solutionEvidenceVersionQuerySchema.parse({})).toEqual({});
  expect(solutionEvidenceVersionQuerySchema.parse({ version: "2", companyId: "axa" })).toEqual({
    version: "2",
    companyId: "axa",
  });
  await expect(
    repository.boundSolutionEvidence(
      advisor,
      lead.id,
      offerId,
      JSON.parse('{"advisorId":"foreign"}') as { companyId: "axa" },
    ),
  ).rejects.toBeDefined();
});

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
      pending = joint(reader, dossier.leadId, dossier.offer.id).then(
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

it("keeps association, need, offer and convention at one instant during a real profile lock then observes expiry and quarantine on reread", async () => {
  const owner = { ...(await actor()), wallet: true },
    advisor = await professional(),
    item = await offered(owner, advisor),
    p = await proof(advisor);
  await save(advisor, await read(advisor, item.lead.id, item.offerId));
  const expiry = new Date(Date.now() + 2500);
  await database.pool.query("update partner_convention_decisions set valid_until=$2 where id=$1", [
    p.value.current!.id,
    expiry,
  ]);
  await database.pool.query(
    "update partner_offers set data=jsonb_set(data,'{validUntil}',$2::jsonb) where id=$1",
    [item.offerId, JSON.stringify(expiry.toISOString())],
  );
  await database.pool.query(
    "update partner_solution_bindings set valid_until=$2 where offer_id=$1",
    [item.offerId, expiry],
  );
  const blocker = await database.pool.connect();
  let pending: ReturnType<typeof joint> | undefined;
  try {
    await blocker.query("begin");
    await blocker.query("select id from identity_profiles where user_id=$1 for update", [
      owner.userId,
    ]);
    pending = joint(advisor, item.lead.id, item.offerId);
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
    await database.pool.query(
      "update files set state='quarantined',revision=revision+1 where id=any($1::text[])",
      [[item.documentId, p.documentId]],
    );
    await expect.poll(() => Date.now() >= expiry.getTime(), { timeout: 5000 }).toBe(true);
    await blocker.query("commit");
    const snapshot = await pending;
    expect(Date.parse(snapshot.assessedAt)).toBeLessThan(expiry.getTime());
    expect(snapshot.binding.status).toBe("recorded");
    expect(snapshot.selection).toBe("human_match");
    expect(snapshot.offer).toMatchObject({ sourceStatus: "current", validity: "unexpired" });
    expect(snapshot.convention).toMatchObject({
      summary: { status: "reviewed" },
      sourceStatus: "available",
    });
    const current = await joint(advisor, item.lead.id, item.offerId);
    expect(current.binding.current).toBeNull();
    expect(current.selection).toBe("no_current_binding");
    expect(current.offer).toMatchObject({ sourceStatus: "unavailable", validity: "expired" });
    expect(current.convention).toMatchObject({
      summary: { status: "expired" },
      sourceStatus: "unavailable",
    });
  } finally {
    await blocker.query("rollback");
    blocker.release();
    if (pending) await pending;
  }
});
