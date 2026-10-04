import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createDatabase } from "./db/database.js";
import {
  leadCreateInputSchema,
  conventionDeclarationSchema,
  conventionDecisionSchema,
  type ConventionDossier,
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
const proofInput = (
  revision = 0,
  subjectName = "Intervenant isolé",
  subjectOrganization = "Organisation isolée",
) =>
  conventionDeclarationSchema.parse({
    revision,
    professionalRevision: 1,
    subjectName,
    subjectOrganization,
    declaration: "Convention véhicule déclarée, justificatif synthétique isolé",
    confirmed: true,
    file: {
      name: "Convention.pdf",
      mime: "application/pdf",
      size: proofBytes.length,
      checksum: createHash("sha256").update(proofBytes).digest("hex"),
    },
  });
function proofDecision(
  dossier: ConventionDossier,
  decision: "reviewed" | "needs_information" | "rejected" | "withdrawn" = "reviewed",
) {
  return conventionDecisionSchema.parse({
    revision: dossier.current!.revision,
    decision,
    documentRevision: dossier.current!.documentRevision,
    reason: "Examen documentaire synthétique dans PostgreSQL isolé",
    scope: decision === "reviewed" ? "Assurance véhicule, périmètre de test" : "",
    coverage: decision === "reviewed" ? "category" : null,
    validUntil: decision === "reviewed" ? new Date(Date.now() + 86400000).toISOString() : null,
    originalChecked: true,
    memberCovered: decision === "reviewed",
    validFrom: decision === "reviewed" ? new Date(Date.now() - 86400000).toISOString() : null,
  });
}
async function preparedProof(person: PartnerActor) {
  let dossier = await repository.declareConvention(
    person,
    person.userId,
    "vehicle",
    "axa",
    proofInput(),
    key(),
  );
  await repository.completeConventionUpload(
    person,
    person.userId,
    "vehicle",
    "axa",
    dossier.current!.id,
    "application/pdf",
  );
  // Isolated scanner result, never a claim about a real certificate or provider.
  await database.pool.query(
    "update files set state='ready',scan_version='isolated-antivirus',revision=revision+1 where id=$1",
    [dossier.current!.documentId],
  );
  dossier = await repository.convention(person, person.userId, "vehicle", "axa");
  return dossier;
}

it("allows private convention declarations before approval, without client documents, advice rights or cross-member access", async () => {
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
    input = proofInput(0, "Candidat isolé");
  const [first, replay] = await Promise.all([
    repository.declareConvention(candidate, candidate.userId, "vehicle", "axa", input, attempt),
    repository.declareConvention(candidate, candidate.userId, "vehicle", "axa", input, attempt),
  ]);
  expect(replay).toEqual(first);
  expect(first.summary.status).toBe("submitted");
  expect(first.current!.canDownload).toBe(false);
  expect(first.history).toHaveLength(1);
  expect((await repository.context(candidate)).operational).toBe(false);
  for (const stranger of [neighbor, { ...candidate, wallet: true }]) {
    await expect(
      repository.convention(stranger, candidate.userId, "vehicle", "axa"),
    ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
    await expect(
      repository.conventionSource(
        stranger,
        candidate.userId,
        "vehicle",
        "axa",
        first.current!.id,
        true,
      ),
    ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  }
  await expect(
    repository.declareConvention(administrator, candidate.userId, "vehicle", "axa", input, key()),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  await expect(
    repository.declareConvention(candidate, candidate.userId, "health", "axa", input, key()),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  await expect(
    repository.declareConvention(
      candidate,
      candidate.userId,
      "vehicle",
      "axa",
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
  expect((await files.original(candidate.userId, docId)).purpose).toBe("partner_convention");
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
  await repository.completeConventionUpload(
    candidate,
    candidate.userId,
    "vehicle",
    "axa",
    first.current!.id,
    "application/pdf",
  );
  expect((await files.original(candidate.userId, docId)).analysisRequested).toBe(false);
  expect(
    (await database.pool.query("select id from document_outbox where document_id=$1", [docId]))
      .rowCount,
  ).toBe(1);
});

it("never substitutes a reviewed convention for the unknown exact company and solution of a Lead and leaves all Lead rights and clocks intact", async () => {
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
    repository.decideConvention(
      professional,
      professional.userId,
      "vehicle",
      "axa",
      decision,
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  await expect(
    repository.decideConvention(
      administrator,
      professional.userId,
      "vehicle",
      "axa",
      { ...decision, validUntil: new Date(Date.now() - 1000).toISOString() },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_DOCUMENT" });
  expect(conventionDecisionSchema.safeParse({ ...decision, originalChecked: false }).success).toBe(
    false,
  );
  await database.pool.query("update files set revision=revision+1 where id=$1", [
    dossier.current!.documentId,
  ]);
  await expect(
    repository.decideConvention(
      administrator,
      professional.userId,
      "vehicle",
      "axa",
      decision,
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  dossier = await repository.convention(administrator, professional.userId, "vehicle", "axa");
  const reviewed = await repository.decideConvention(
    administrator,
    professional.userId,
    "vehicle",
    "axa",
    proofDecision(dossier),
    key(),
  );
  expect(reviewed.summary.status).toBe("reviewed");
  const continuity = (await repository.detail(owner, lead.id)).referentContinuity!;
  expect(continuity.competence).toMatchObject({ status: "missing" });
  expect(continuity.missingChecks).toEqual([
    "competence",
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
  dossier = await repository.decideConvention(
    administrator,
    professional.userId,
    "vehicle",
    "axa",
    { ...proofDecision(reviewed), coverage: "limited" },
    key(),
  );
  expect((await repository.detail(owner, lead.id)).referentContinuity!.competence!.status).toBe(
    "missing",
  );
  expect((await repository.detail(owner, lead.id)).referentContinuity!.missingChecks).toContain(
    "conventions",
  );
  await database.pool.query(
    "update partner_convention_decisions set created_at=now()-interval '3 days',valid_from=now()-interval '2 days',valid_until=now()-interval '1 day' where id=$1",
    [dossier.current!.id],
  );
  expect(
    (await repository.convention(professional, professional.userId, "vehicle", "axa")).summary
      .status,
  ).toBe("expired");
  const withdrawn = await repository.decideConvention(
    professional,
    professional.userId,
    "vehicle",
    "axa",
    proofDecision(dossier, "withdrawn"),
    key(),
  );
  expect(withdrawn.summary.status).toBe("withdrawn");
  expect(withdrawn.history).toHaveLength(4);
  await expect(
    repository.decideConvention(
      administrator,
      professional.userId,
      "vehicle",
      "axa",
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
    repository.decideConvention(administrator, person.userId, "vehicle", "axa", decision, key()),
    repository.decideConvention(reviewer, person.userId, "vehicle", "axa", decision, key()),
  ]);
  expect(race.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(race.find((r) => r.status === "rejected")).toMatchObject({
    reason: { code: "PARTNER_CONFLICT" },
  });
  let dossier = await repository.convention(person, person.userId, "vehicle", "axa");
  expect(dossier.summary.status).toBe("reviewed");
  await database.pool.query("update files set state='quarantined' where id=$1", [
    initial.current!.documentId,
  ]);
  expect(
    (await repository.convention(person, person.userId, "vehicle", "axa")).summary.status,
  ).toBe("unavailable");
  await expect(
    repository.conventionSource(
      administrator,
      person.userId,
      "vehicle",
      "axa",
      initial.current!.id,
    ),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_DOCUMENT" });
  await database.pool.query("update files set state='ready' where id=$1", [
    initial.current!.documentId,
  ]);
  for (let n = 0; n < 19; n++)
    dossier = await repository.decideConvention(
      administrator,
      person.userId,
      "vehicle",
      "axa",
      proofDecision(dossier, "needs_information"),
      key(),
    );
  dossier = await repository.declareConvention(
    person,
    person.userId,
    "vehicle",
    "axa",
    proofInput(dossier.current!.revision),
    key(),
  );
  expect(dossier.summary.status).toBe("submitted");
  expect(dossier.current!.documentId).toBe(initial.current!.documentId);
  expect(dossier.history).toHaveLength(20);
  const older = await repository.convention(
    person,
    person.userId,
    "vehicle",
    "axa",
    dossier.nextBeforeRevision!,
  );
  expect(older.history).toHaveLength(2);
  expect(older.history.at(-1)!.decision).toBe("submitted");
  const approved = await repository.decideConvention(
    administrator,
    person.userId,
    "vehicle",
    "axa",
    proofDecision(dossier),
    key(),
  );
  const oldOrganization = (await repository.context(person)).application!.organizationId;
  await database.pool.query("update partner_members set organization_id=$2 where user_id=$1", [
    person.userId,
    (await repository.context(neighbor)).application!.organizationId,
  ]);
  expect(
    (await repository.convention(person, person.userId, "vehicle", "axa")).summary.status,
  ).toBe("unavailable");
  expect((await repository.convention(person, person.userId, "vehicle", "axa")).canReview).toBe(
    false,
  );
  await database.pool.query("update partner_members set organization_id=$2 where user_id=$1", [
    person.userId,
    oldOrganization,
  ]);
  await database.pool.query(
    "update partner_members set application=jsonb_set(application,'{categories}','[\"health\"]'::jsonb) where user_id=$1",
    [person.userId],
  );
  expect(
    (await repository.convention(person, person.userId, "vehicle", "axa")).summary.status,
  ).toBe("unavailable");
  await database.pool.query("update identity_sessions set mfa_verified_at=null where id=$1", [
    reviewer.id,
  ]);
  await expect(
    repository.convention(reviewer, person.userId, "vehicle", "axa"),
  ).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
    person.id,
  ]);
  await expect(
    repository.convention(person, person.userId, "vehicle", "axa"),
  ).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  expect(approved.history.some((row) => row.decision === "reviewed")).toBe(true);
});

it("checks exact professional bytes and current session before and after storage without starting AI or sharing to Wallet", async () => {
  const person = await actor();
  await approve(person);
  const dossier = await repository.declareConvention(
      person,
      person.userId,
      "vehicle",
      "axa",
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
    await repository.conventionSource(person, person.userId, "vehicle", "axa", record.id, true);
  };
  const confirm = (mime: string) =>
    repository.completeConventionUpload(person, person.userId, "vehicle", "axa", record.id, mime);
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
    repository.decideConvention(
      member,
      member.userId,
      "vehicle",
      "axa",
      proofDecision(dossier),
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  const disabled = createPartnerRepository(database.pool, false);
  const masked = await disabled.convention(administrator, member.userId, "vehicle", "axa");
  expect(masked).toMatchObject({
    documentsAvailable: false,
    canDeclare: false,
    canReview: false,
    canWithdraw: true,
  });
  expect(masked.current!.canDownload).toBe(false);
  expect(masked.history.every((row) => !row.canDownload)).toBe(true);
  for (const operation of [
    () => disabled.declareConvention(member, member.userId, "vehicle", "axa", proofInput(1), key()),
    () =>
      disabled.decideConvention(
        administrator,
        member.userId,
        "vehicle",
        "axa",
        proofDecision(dossier),
        key(),
      ),
    () => disabled.conventionSource(member, member.userId, "vehicle", "axa", dossier.current!.id),
    () =>
      disabled.completeConventionUpload(
        member,
        member.userId,
        "vehicle",
        "axa",
        dossier.current!.id,
        "application/pdf",
      ),
    () =>
      disabled.retryConventionUpload(
        member,
        member.userId,
        "vehicle",
        "axa",
        dossier.current!.id,
        dossier.current!.documentRevision,
        key(),
      ),
  ])
    await expect(async () => operation()).rejects.toMatchObject({ code: "PARTNER_UNAVAILABLE" });
  const attempt = key(),
    input = proofDecision(dossier, "withdrawn");
  const withdrawn = await disabled.decideConvention(
    member,
    member.userId,
    "vehicle",
    "axa",
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
  expect(
    await disabled.decideConvention(member, member.userId, "vehicle", "axa", input, attempt),
  ).toEqual(withdrawn);
});

it("keeps company scopes independent, requires membership coverage and dates, and preserves historical originals after replacement", async () => {
  const person = await actor();
  await approve(person);
  const initial = await preparedProof(person);
  for (const invalid of [
    { memberCovered: false },
    { validFrom: null },
    { validFrom: new Date(Date.now() + 2 * 86400000).toISOString() },
  ])
    expect(
      conventionDecisionSchema.safeParse({ ...proofDecision(initial), ...invalid }).success,
    ).toBe(false);
  const scheduled = await repository.decideConvention(
    administrator,
    person.userId,
    "vehicle",
    "axa",
    {
      ...proofDecision(initial),
      validFrom: new Date(Date.now() + 3600000).toISOString(),
    },
    key(),
  );
  expect(scheduled.summary.status).toBe("scheduled");
  expect(scheduled.current!.memberCovered).toBe(true);
  expect(
    (await repository.convention(person, person.userId, "vehicle", "css")).summary.status,
  ).toBe("missing");
  await expect(
    repository.conventionSource(person, person.userId, "vehicle", "css", initial.current!.id),
  ).rejects.toMatchObject({ code: "PARTNER_NOT_FOUND" });
  expect((await repository.competence(person, person.userId, "vehicle")).summary.status).toBe(
    "missing",
  );
  const sameKey = key();
  const css = await repository.declareConvention(
    person,
    person.userId,
    "vehicle",
    "css",
    proofInput(),
    sameKey,
  );
  expect(css.current!.documentId).toBe(initial.current!.documentId);
  expect(css.current!.revision).toBe(1);
  expect((await repository.convention(person, person.userId, "vehicle", "axa")).current!.id).toBe(
    scheduled.current!.id,
  );
  await expect(
    repository.declareConvention(person, person.userId, "vehicle", "axa", proofInput(), sameKey),
  ).rejects.toMatchObject({ code: "PARTNER_IDEMPOTENCY_REUSED" });
  await expect(
    database.pool.query("update partner_convention_decisions set company_id='css' where id=$1", [
      scheduled.current!.id,
    ]),
  ).rejects.toMatchObject({ code: "23503" });
  await expect(
    database.pool.query(
      "update partner_convention_decisions set member_covered=false where id=$1",
      [scheduled.current!.id],
    ),
  ).rejects.toMatchObject({ code: "23514" });
  const changed = proofInput(scheduled.current!.revision);
  changed.file.checksum = createHash("sha256")
    .update("A different isolated original")
    .digest("hex");
  const replaced = await repository.declareConvention(
    person,
    person.userId,
    "vehicle",
    "axa",
    changed,
    key(),
  );
  expect(replaced.summary.status).toBe("submitted");
  expect(replaced.current!.documentId).not.toBe(initial.current!.documentId);
  expect(
    replaced.history.some((record) => record.id === scheduled.current!.id && record.canDownload),
  ).toBe(true);
  await expect(
    repository.conventionSource(person, person.userId, "vehicle", "axa", initial.current!.id, true),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  expect(
    (
      await repository.conventionSource(
        administrator,
        person.userId,
        "vehicle",
        "axa",
        initial.current!.id,
      )
    ).documentId,
  ).toBe(initial.current!.documentId);
  await repository.completeConventionUpload(
    person,
    person.userId,
    "vehicle",
    "axa",
    replaced.current!.id,
    "application/pdf",
  );
  await database.pool.query("update files set state='failed',revision=revision+1 where id=$1", [
    replaced.current!.documentId,
  ]);
  const failed = await repository.convention(person, person.userId, "vehicle", "axa");
  const attempt = key();
  const retried = await repository.retryConventionUpload(
    person,
    person.userId,
    "vehicle",
    "axa",
    failed.current!.id,
    failed.current!.documentRevision,
    attempt,
  );
  expect(retried.current!.documentState).toBe("queued");
  expect(
    await repository.retryConventionUpload(
      person,
      person.userId,
      "vehicle",
      "axa",
      failed.current!.id,
      failed.current!.documentRevision,
      attempt,
    ),
  ).toEqual(retried);
  const file = await createDocumentRepository(database.db).original(
    person.userId,
    failed.current!.documentId,
  );
  expect(file.analysisRequested).toBe(false);
});

it("invalidates the current convention when an application changes its named parties without changing the organization id", async () => {
  const person = await actor();
  await approve(person);
  const original = await preparedProof(person);
  const reviewed = await repository.decideConvention(
    administrator,
    person.userId,
    "vehicle",
    "axa",
    proofDecision(original),
    key(),
  );
  const previous = (await repository.context(person)).application!;
  await repository.review(
    administrator,
    person.userId,
    {
      revision: previous.revision,
      state: "needs_information",
      roles: [],
      reason: "Compléter les parties déclarées",
      reviewDueAt: null,
    },
    key(),
  );
  await repository.apply(
    person,
    {
      name: "Nouveau nom déclaré",
      organization: "Autre organisation déclarée",
      phone: "",
      roles: ["advisor"],
      categories: ["vehicle"],
      languages: "fr",
      regions: "Genève",
      qualifications: "Déclaration isolée",
    },
    key(),
  );
  expect((await repository.context(person)).application!.organizationId).toBe(
    previous.organizationId,
  );
  const current = await repository.convention(person, person.userId, "vehicle", "axa");
  expect(current.summary.status).toBe("unavailable");
  expect(current.canReview).toBe(false);
  expect(current.current!.declaredName).toBe(previous.name);
  expect(current.current!.declaredOrganization).toBe(previous.organization);
  await expect(
    repository.decideConvention(
      administrator,
      person.userId,
      "vehicle",
      "axa",
      proofDecision(current),
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  expect(
    (
      await repository.conventionSource(
        person,
        person.userId,
        "vehicle",
        "axa",
        reviewed.current!.id,
      )
    ).documentId,
  ).toBe(original.current!.documentId);
  await expect(
    repository.declareConvention(
      person,
      person.userId,
      "vehicle",
      "axa",
      proofInput(current.current!.revision),
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  const replacement = await repository.declareConvention(
    person,
    person.userId,
    "vehicle",
    "axa",
    {
      ...proofInput(current.current!.revision, current.name, current.organization),
      professionalRevision: current.professionalRevision,
    },
    key(),
  );
  expect(replacement.current!.declaredOrganization).toBe("Autre organisation déclarée");
  await repository.review(
    administrator,
    person.userId,
    {
      revision: (await repository.context(person)).application!.revision,
      state: "needs_information",
      roles: [],
      reason: "Compléter le nom déclaré",
      reviewDueAt: null,
    },
    key(),
  );
  await repository.apply(
    person,
    {
      name: "Encore un nom",
      organization: "Autre organisation déclarée",
      phone: "",
      roles: ["advisor"],
      categories: ["vehicle"],
      languages: "fr",
      regions: "Genève",
      qualifications: "Déclaration isolée",
    },
    key(),
  );
  await expect(
    repository.completeConventionUpload(
      person,
      person.userId,
      "vehicle",
      "axa",
      replacement.current!.id,
      "application/pdf",
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
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
    // Host and Docker clocks can differ slightly; this synthetic MFA is deliberately in the past.
    await database.pool.query("update identity_sessions set mfa_verified_at=$2 where id=$1", [
      session.id,
      new Date(Date.now() - 1000),
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
