import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { beforeAll, afterAll, expect, it } from "vitest";
import {
  solutionEvidenceSchema,
  solutionEvidenceQuerySchema,
  leadCreateInputSchema,
  partnerApplicationInputSchema,
  conventionDeclarationSchema,
  conventionDecisionSchema,
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
    .withDatabase("coverview_solution_evidence_test")
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

async function offered(owner: PartnerActor, advisor: PartnerActor) {
  let lead = await assigned(owner, advisor);
  const documentId = `doc_${key()}`;
  await database.pool.query(
    "insert into files(id,user_id,name,mime,declared_mime,size,checksum,object_key,state,category,purpose,scan_version) values($1,$2,'Offre isolée.pdf','application/pdf','application/pdf',10,$3,$4,'ready','insurance','lead_offer','isolated-scan')",
    [documentId, advisor.userId, createHash("sha256").update(key()).digest("hex"), key()],
  );
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
const read = (advisor: PartnerActor, leadId: string, offerId: string) =>
  repository.solutionEvidence(advisor, leadId, offerId, { companyId: "axa" });

it("leaves name matching unconfirmed and missing sources explicit, without pending migrations or side effects", async () => {
  const owner = { ...(await actor()), wallet: true },
    advisor = await professional();
  const { lead, offerId } = await offered(owner, advisor);
  const before = (
    await database.pool.query("select row_to_json(l) value from partner_leads l where id=$1", [
      lead.id,
    ])
  ).rows;
  const eventsBefore = (
    await database.pool.query("select id from partner_events where lead_id=$1 order by id", [
      lead.id,
    ])
  ).rows;
  const tables = (
    await database.pool.query<{
      expertise: string | null;
      capacity: string | null;
      conflicts: string | null;
    }>(
      "select to_regclass('partner_need_expertise_reviews') expertise,to_regclass('partner_need_capacity_decisions') capacity,to_regclass('partner_need_conflict_reviews') conflicts",
    )
  ).rows[0];
  expect(tables).toEqual({ expertise: null, capacity: null, conflicts: null });
  const empty = await repository.solutionEvidence(advisor, lead.id, offerId);
  expect(solutionEvidenceSchema.safeParse(empty).success).toBe(true);
  expect(empty).toMatchObject({
    companyId: null,
    companyMatch: "unconfirmed",
    convention: null,
    assessment: "human_review_required",
    offer: {
      id: offerId,
      version: 1,
      company: "AXA",
      sourceStatus: "current",
      validity: "unexpired",
    },
  });
  const chosen = await read(advisor, lead.id, offerId);
  expect(chosen).toMatchObject({
    companyId: "axa",
    companyMatch: "unconfirmed",
    convention: { current: null, summary: { status: "missing" }, sourceStatus: "missing" },
  });
  expect(chosen.remainingChecks).toHaveLength(5);
  for (const privateField of [
    "documentId",
    "sourceFingerprint",
    "checksum",
    "reviewedBy",
    "source_snapshot",
    "canChoose",
    "canCompare",
  ])
    expect(chosen.offer).not.toHaveProperty(privateField);
  expect(
    (
      await database.pool.query("select row_to_json(l) value from partner_leads l where id=$1", [
        lead.id,
      ])
    ).rows,
  ).toEqual(before);
  expect(
    (
      await database.pool.query("select id from partner_events where lead_id=$1 order by id", [
        lead.id,
      ])
    ).rows,
  ).toEqual(eventsBefore);
  for (const bad of [
    { advisorId: advisor.userId },
    { companyId: "AXA" },
    { companyId: "unknown" },
    { companyId: "axa", confirmed: true },
  ])
    expect(solutionEvidenceQuerySchema.safeParse(bad).success).toBe(false);
});

it("separates exact offer versions and Leads even for the same owner and category", async () => {
  const owner = { ...(await actor()), wallet: true },
    advisor = await professional();
  const first = await offered(owner, advisor),
    second = await offered(owner, advisor);
  await expect(read(advisor, first.lead.id, second.offerId)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  const next = await repository.command(
    advisor,
    first.lead.id,
    {
      action: "offer",
      revision: first.lead.revision,
      offer: { ...first.offer, replacesId: first.offerId, product: "Variante suivante" },
    },
    key(),
  );
  const newer = next.offers.find((o) => o.active)!;
  expect((await read(advisor, first.lead.id, first.offerId)).offer).toMatchObject({
    id: first.offerId,
    active: false,
    state: "replaced",
    version: 1,
    product: "Véhicule isolé",
  });
  expect((await read(advisor, first.lead.id, newer.id)).offer).toMatchObject({
    id: newer.id,
    active: true,
    version: 2,
    product: "Variante suivante",
  });
  await repository.command(
    advisor,
    next.id,
    {
      action: "offer_withdraw",
      revision: next.revision,
      offerId: newer.id,
      reason: "Retrait de test",
    },
    key(),
  );
  expect((await read(advisor, next.id, newer.id)).offer).toMatchObject({
    active: false,
    state: "cancelled",
  });
});

it("exposes the latest limited convention and document revisions without a distribution verdict or private file id", async () => {
  const owner = { ...(await actor()), wallet: true },
    advisor = await professional(),
    item = await offered(owner, advisor);
  const { value, documentId } = await proof(advisor, "limited");
  const result = await read(advisor, item.lead.id, item.offerId);
  expect(result.convention).toMatchObject({
    summary: { status: "limited" },
    sourceStatus: "available",
    reviewedDocumentRevision: value.current!.documentRevision,
    current: {
      id: value.current!.id,
      coverage: "limited",
      memberCovered: true,
      professionalScope: "current",
    },
  });
  expect(result.convention!.current).not.toHaveProperty("documentId");
  expect(result.convention!.current).not.toHaveProperty("canDownload");
  expect(JSON.stringify(result)).not.toContain(documentId);
  expect(result.companyMatch).toBe("unconfirmed");
  expect(result.remainingChecks).toContain("distribution_rights");
  expect(
    (await repository.solutionEvidence(advisor, item.lead.id, item.offerId, { companyId: "css" }))
      .convention?.summary.status,
  ).toBe("missing");
});

it("keeps future, expired, replaced and withdrawn conventions distinct without reviving old positives", async () => {
  const owner = { ...(await actor()), wallet: true },
    advisor = await professional(),
    item = await offered(owner, advisor);
  let { value } = await proof(advisor);
  await database.pool.query(
    "update partner_convention_decisions set valid_from=now()+interval '1 hour' where id=$1",
    [value.current!.id],
  );
  expect((await read(advisor, item.lead.id, item.offerId)).convention?.summary.status).toBe(
    "scheduled",
  );
  await database.pool.query(
    "update partner_convention_decisions set created_at=now()-interval '3 days',valid_from=now()-interval '2 days',valid_until=now()-interval '1 day' where id=$1",
    [value.current!.id],
  );
  expect((await read(advisor, item.lead.id, item.offerId)).convention?.summary.status).toBe(
    "expired",
  );
  ({ value } = await proof(advisor));
  value = await repository.decideConvention(
    advisor,
    advisor.userId,
    "vehicle",
    "axa",
    conventionDecisionSchema.parse({
      revision: value.current!.revision,
      documentRevision: value.current!.documentRevision,
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
  const withdrawn = await read(advisor, item.lead.id, item.offerId);
  expect(withdrawn.convention).toMatchObject({
    summary: { status: "withdrawn" },
    current: { id: value.current!.id, decision: "withdrawn" },
  });
  const member = (await repository.context(advisor)).application!;
  await repository.declareConvention(
    advisor,
    advisor.userId,
    "vehicle",
    "axa",
    conventionDeclarationSchema.parse({
      revision: value.current!.revision,
      professionalRevision: member.professionalRevision,
      subjectName: member.name,
      subjectOrganization: member.organization,
      declaration: "Nouvelle déclaration non examinée",
      confirmed: true,
      file: { name: "Nouveau.pdf", mime: "application/pdf", size: 12, checksum: "b".repeat(64) },
    }),
    key(),
  );
  expect((await read(advisor, item.lead.id, item.offerId)).convention).toMatchObject({
    summary: { status: "submitted" },
    current: { decision: "submitted" },
    sourceStatus: "unavailable",
  });
});

it("invalidates changed sources and professional round trips while keeping document safety separate", async () => {
  const owner = { ...(await actor()), wallet: true },
    advisor = await professional(),
    item = await offered(owner, advisor),
    p = await proof(advisor);
  await database.pool.query("update files set revision=revision+1 where id=$1", [p.documentId]);
  expect((await read(advisor, item.lead.id, item.offerId)).convention).toMatchObject({
    summary: { status: "unavailable" },
    sourceStatus: "changed",
  });
  await database.pool.query(
    "update files set state='quarantined',revision=revision+1 where id=$1",
    [p.documentId],
  );
  expect((await read(advisor, item.lead.id, item.offerId)).convention?.sourceStatus).toBe(
    "unavailable",
  );
  await proof(advisor);
  await database.pool.query(
    "update partner_members set application=jsonb_set(application,'{name}','\"Autre nom\"') where user_id=$1",
    [advisor.userId],
  );
  await database.pool.query(
    "update partner_members set application=jsonb_set(application,'{name}','\"Conseiller isolé\"') where user_id=$1",
    [advisor.userId],
  );
  expect((await read(advisor, item.lead.id, item.offerId)).convention).toMatchObject({
    summary: { status: "unavailable" },
    current: { professionalScope: "changed" },
  });
});

it("distinguishes changed, unavailable, unbound, expired and disabled offer sources", async () => {
  const owner = { ...(await actor()), wallet: true },
    advisor = await professional(),
    item = await offered(owner, advisor);
  await database.pool.query("update files set generation=generation+1 where id=$1", [
    item.documentId,
  ]);
  expect((await read(advisor, item.lead.id, item.offerId)).offer.sourceStatus).toBe("changed");
  await database.pool.query("update files set state='quarantined' where id=$1", [item.documentId]);
  expect((await read(advisor, item.lead.id, item.offerId)).offer).toMatchObject({
    sourceStatus: "unavailable",
    canDownload: false,
  });
  await database.pool.query("update files set state='ready' where id=$1", [item.documentId]);
  await database.pool.query(
    "update partner_offers set source_snapshot=null,data=jsonb_set(data,'{validUntil}',$2::jsonb) where id=$1",
    [item.offerId, JSON.stringify(new Date(Date.now() - 86400000).toISOString())],
  );
  expect((await read(advisor, item.lead.id, item.offerId)).offer).toMatchObject({
    sourceStatus: "unbound",
    validity: "expired",
  });
  await proof(advisor);
  const disabled = await createPartnerRepository(database.pool, false).solutionEvidence(
    advisor,
    item.lead.id,
    item.offerId,
    { companyId: "axa" },
  );
  expect(disabled.offer).toMatchObject({ sourceStatus: "disabled", canDownload: false });
  expect(disabled.convention?.sourceStatus).toBe("disabled");
});

it("requires personal current advice access and shows only each contributors own convention", async () => {
  const owner = { ...(await actor()), wallet: true },
    advisor = await professional(),
    neighbor = await professional(),
    item = await offered(owner, advisor);
  await proof(advisor);
  for (const reader of [owner, admin, neighbor])
    await expect(read(reader, item.lead.id, item.offerId)).rejects.toMatchObject({
      code: reader === neighbor ? "PARTNER_NOT_FOUND" : "PARTNER_ACCESS_DENIED",
    });
  await database.pool.query(
    "update partner_members set organization_id=(select organization_id from partner_members where user_id=$2),roles=$3::jsonb where user_id=$1",
    [neighbor.userId, advisor.userId, JSON.stringify(["advisor", "manager"])],
  );
  await expect(read(neighbor, item.lead.id, item.offerId)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await database.pool.query(
    "insert into partner_contributors(id,lead_id,user_id,access_scope,can_edit,can_contact) values($1,$2,$3,'advice',false,false)",
    [key(), item.lead.id, neighbor.userId],
  );
  expect(await read(neighbor, item.lead.id, item.offerId)).toMatchObject({
    advisorId: neighbor.userId,
    convention: { current: null, summary: { status: "missing" } },
  });
  await database.pool.query(
    "update partner_contributors set revoked_at=now() where lead_id=$1 and user_id=$2",
    [item.lead.id, neighbor.userId],
  );
  await expect(read(neighbor, item.lead.id, item.offerId)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
});

it("reauthorizes repeated reads after session, MFA and administrative permission changes", async () => {
  const owner = { ...(await actor()), wallet: true },
    advisor = await professional(),
    item = await offered(owner, advisor);
  await database.pool.query(
    "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated solution test')",
    [key(), advisor.userId],
  );
  const privileged = { ...advisor, administrator: true };
  await read(privileged, item.lead.id, item.offerId);
  await database.pool.query(
    "update identity_sessions set mfa_verified_at=now()-interval '2 days' where id=$1",
    [advisor.id],
  );
  await expect(read(privileged, item.lead.id, item.offerId)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await database.pool.query(
    "update identity_sessions set mfa_verified_at=now()-interval '1 second' where id=$1",
    [advisor.id],
  );
  await database.pool.query(
    "update identity_admin_permissions set revoked_at=now() where user_id=$1",
    [advisor.userId],
  );
  await expect(read(privileged, item.lead.id, item.offerId)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await read(advisor, item.lead.id, item.offerId);
  await database.pool.query("update identity_sessions set expires_at=now() where id=$1", [
    advisor.id,
  ]);
  await expect(read(advisor, item.lead.id, item.offerId)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
});

it("rereads changed needs and keeps the clients change request visible without changing other controls", async () => {
  const owner = { ...(await actor()), wallet: true },
    advisor = await professional(),
    item = await offered(owner, advisor);
  const first = await read(advisor, item.lead.id, item.offerId);
  const before = await repository.advisorAssessment(advisor, item.lead.id);
  await database.pool.query(
    "update partner_leads set title='Nouveau besoin',object='Autre objet',details=jsonb_set(details,'{context}','\"Contexte modifié\"') where id=$1",
    [item.lead.id],
  );
  await repository.command(
    owner,
    item.lead.id,
    {
      action: "client_interlocutor",
      revision: item.lead.revision,
      reason: "Changement demandé par le client",
    },
    key(),
  );
  const result = await read(advisor, item.lead.id, item.offerId);
  expect(result.scope).toMatchObject({
    title: "Nouveau besoin",
    object: "Autre objet",
    context: "Contexte modifié",
  });
  expect(result.scopeRevision).toBeGreaterThan(first.scopeRevision);
  expect(result.changeRequested).toBe(true);
  expect((await repository.advisorAssessment(advisor, item.lead.id)).remainingChecks).toEqual(
    before.remainingChecks,
  );
});

it.each(["category", "organization", "member", "activity", "closed lead"])(
  "denies the solution read after %s changes",
  async (change) => {
    const owner = { ...(await actor()), wallet: true },
      advisor = await professional(),
      item = await offered(owner, advisor);
    await read(advisor, item.lead.id, item.offerId);
    if (change === "category")
      await database.pool.query(
        "update partner_members set application=jsonb_set(application,'{categories}','[\"health\"]') where user_id=$1",
        [advisor.userId],
      );
    if (change === "organization")
      await database.pool.query(
        "update partner_organizations set state='suspended' where id=(select organization_id from partner_members where user_id=$1)",
        [advisor.userId],
      );
    if (change === "member")
      await database.pool.query("update partner_members set state='suspended' where user_id=$1", [
        advisor.userId,
      ]);
    if (change === "activity")
      await database.pool.query(
        "update partner_members set roles='[\"referrer\"]' where user_id=$1",
        [advisor.userId],
      );
    if (change === "closed lead")
      await repository.command(
        advisor,
        item.lead.id,
        {
          action: "close",
          revision: item.lead.revision,
          result: "lost",
          reason: "current_suitable",
          comment: "Contrat actuel adapté",
        },
        key(),
      );
    await expect(read(advisor, item.lead.id, item.offerId)).rejects.toMatchObject({
      code: "PARTNER_ACCESS_DENIED",
    });
  },
);

it.each(["session", "mfa", "membership"])(
  "rejects %s expiry after waiting on a real profile lock",
  async (expiryKind) => {
    const owner = { ...(await actor()), wallet: true },
      advisor = await professional(),
      item = await offered(owner, advisor);
    const expiry = new Date(Date.now() + 2500);
    const reader = { ...advisor, administrator: expiryKind === "mfa" };
    if (expiryKind === "session")
      await database.pool.query("update identity_sessions set expires_at=$2 where id=$1", [
        advisor.id,
        expiry,
      ]);
    if (expiryKind === "membership")
      await database.pool.query("update partner_members set review_due_at=$2 where user_id=$1", [
        advisor.userId,
        expiry,
      ]);
    if (expiryKind === "mfa") {
      await database.pool.query(
        "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated expiry test')",
        [key(), advisor.userId],
      );
      await database.pool.query("update identity_sessions set mfa_verified_at=$2 where id=$1", [
        advisor.id,
        new Date(expiry.getTime() - 86400000),
      ]);
    }
    const blocker = await database.pool.connect();
    let pending: Promise<unknown> | undefined;
    try {
      await blocker.query("begin");
      await blocker.query("select id from identity_profiles where user_id=$1 for update", [
        owner.userId,
      ]);
      pending = read(reader, item.lead.id, item.offerId).then(
        () => {
          throw new Error("Expired access returned private solution evidence");
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
      await expect.poll(() => Date.now() >= expiry.getTime(), { timeout: 5000 }).toBe(true);
      await blocker.query("commit");
      await pending;
    } finally {
      await blocker.query("rollback");
      blocker.release();
      if (pending) await pending;
    }
  },
);

it("keeps need, offer and convention at one instant during a real profile lock then observes expiry and quarantine on reread", async () => {
  const owner = { ...(await actor()), wallet: true },
    advisor = await professional(),
    item = await offered(owner, advisor),
    p = await proof(advisor);
  const expiry = new Date(Date.now() + 2500);
  await database.pool.query("update partner_convention_decisions set valid_until=$2 where id=$1", [
    p.value.current!.id,
    expiry,
  ]);
  await database.pool.query(
    "update partner_offers set data=jsonb_set(data,'{validUntil}',$2::jsonb) where id=$1",
    [item.offerId, JSON.stringify(expiry.toISOString())],
  );
  const blocker = await database.pool.connect();
  let pending: ReturnType<typeof read> | undefined;
  try {
    await blocker.query("begin");
    await blocker.query("select id from identity_profiles where user_id=$1 for update", [
      owner.userId,
    ]);
    pending = read(advisor, item.lead.id, item.offerId);
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
    expect(snapshot.offer).toMatchObject({ sourceStatus: "current", validity: "unexpired" });
    expect(snapshot.convention).toMatchObject({
      summary: { status: "reviewed" },
      sourceStatus: "available",
    });
    const current = await read(advisor, item.lead.id, item.offerId);
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
