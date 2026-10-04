import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createDatabase } from "../../platform/db/database.js";
import {
  leadCreateInputSchema,
  leadOfferInputSchema,
  leadListQuerySchema,
  type LeadCommand,
  type LeadDetail,
} from "@coverview/contracts/partner";
import { createPartnerRepository } from "./partner.repository.js";
import type { PartnerActor } from "./partner.policy.js";
import { processPartnerContinuity } from "./partner.continuity.js";
import { attributionDeadlines, defaultContinuityPolicy } from "./partner.settings.js";
import { partnerContinuityUpdateSchema } from "@coverview/contracts/partner";
import { collaborationTermsSchema } from "@coverview/contracts/partner";
import { createAdminProfileTransferRepository } from "../../platform/admin-profile-transfer.repository.js";
import { leadCommandSchema } from "@coverview/contracts/partner";
import { finalPolicyFields, type FinalPolicyReview } from "@coverview/contracts/partner";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let repository: ReturnType<typeof createPartnerRepository>;
let administrator: PartnerActor,
  advisor: PartnerActor,
  neighbor: PartnerActor,
  referrer: PartnerActor,
  client: PartnerActor;
const key = () => randomUUID();

it("stores an explicit category referent without assigning other Leads, granting access or moving deadlines", async () => {
  const owner = { ...(await actor()), wallet: true },
    responsible = await actor(),
    other = await actor();
  await approve(responsible);
  await approve(other);
  const a = await assignedLead(responsible, { ...input(), clientUserId: owner.userId });
  const b = await assignedLead(other, {
    ...input(),
    clientUserId: owner.userId,
    object: "Autre véhicule",
  });
  const before = (
    await database.pool.query("select * from partner_leads where id=any($1::text[]) order by id", [
      [a.id, b.id],
    ])
  ).rows;
  const notifications = (
    await database.pool.query(
      "select * from partner_notifications where lead_id=any($1::text[]) order by id",
      [[a.id, b.id]],
    )
  ).rows;
  const choices = await repository.referentProfile(owner, "self", "vehicle");
  expect(choices.current.status).toBe("unset");
  expect(choices.candidates.map((x) => x.id).sort()).toEqual(
    [responsible.userId, other.userId].sort(),
  );
  expect((await repository.referentProfile(owner, "self", "health")).candidates).toEqual([]);
  const change = {
      revision: 0,
      profileRevision: 0,
      advisorId: responsible.userId,
      confirmed: true as const,
    },
    attempt = key();
  const [first, replay] = await Promise.all([
    repository.updateReferent(owner, "self", "vehicle", change, attempt),
    repository.updateReferent(owner, "self", "vehicle", change, attempt),
  ]);
  expect(first).toEqual(replay);
  expect(first.current).toMatchObject({
    revision: 1,
    status: "chosen",
    advisor: { id: responsible.userId },
  });
  expect(first.history).toHaveLength(1);
  const continuity = (await repository.detail(other, b.id)).referentContinuity!;
  expect(continuity).toMatchObject({
    status: "human_review",
    suggestion: { id: responsible.userId },
  });
  expect(continuity.missingChecks).toContain("availability");
  expect(continuity.missingChecks).toContain("conventions");
  await expect(repository.detail(responsible, b.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  for (const denied of [responsible, administrator, { ...administrator, wallet: true }]) {
    await expect(repository.referentProfile(denied, "self", "vehicle")).rejects.toMatchObject({
      code: "PARTNER_ACCESS_DENIED",
    });
    await expect(
      repository.updateReferent(denied, "self", "vehicle", change, key()),
    ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  }
  await expect(
    repository.updateReferent(
      owner,
      "self",
      "vehicle",
      { ...change, advisorId: other.userId },
      attempt,
    ),
  ).rejects.toMatchObject({ code: "PARTNER_IDEMPOTENCY_REUSED" });
  await expect(
    repository.updateReferent(
      owner,
      "self",
      "vehicle",
      { ...change, revision: 1, advisorId: neighbor.userId },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  await expect(
    repository.updateReferent(owner, "self", "health", change, key()),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  expect(
    (
      await database.pool.query(
        "select * from partner_leads where id=any($1::text[]) order by id",
        [[a.id, b.id]],
      )
    ).rows,
  ).toEqual(before);
  expect(
    (
      await database.pool.query(
        "select * from partner_notifications where lead_id=any($1::text[]) order by id",
        [[a.id, b.id]],
      )
    ).rows,
  ).toEqual(notifications);
  const race = await Promise.allSettled([
    repository.updateReferent(
      owner,
      "self",
      "vehicle",
      { revision: 1, profileRevision: 0, advisorId: other.userId, confirmed: true },
      key(),
    ),
    repository.updateReferent(
      owner,
      "self",
      "vehicle",
      { revision: 1, profileRevision: 0, advisorId: null, confirmed: true },
      key(),
    ),
  ]);
  expect(race.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  expect(race.find((x) => x.status === "rejected")).toMatchObject({
    reason: { code: "PARTNER_CONFLICT" },
  });
  const cleared = await repository.updateReferent(
    owner,
    "self",
    "vehicle",
    { revision: 2, profileRevision: 0, advisorId: null, confirmed: true },
    key(),
  );
  expect(cleared.current.status).toBe("coverview");
  expect(cleared.history).toHaveLength(3);
  expect((await repository.detail(owner, b.id)).referentContinuity?.suggestion).toBeNull();
});

it("keeps canonical profile history through transfers but requires new confirmation even after a transfer back", async () => {
  const owner = { ...(await actor()), wallet: true },
    destination = { ...(await actor()), wallet: true },
    responsible = await actor();
  await approve(responsible);
  const profileId = `prf_${key()}`,
    secondProfile = `prf_${key()}`;
  for (const id of [profileId, secondProfile])
    await database.pool.query(
      "insert into managed_profiles(id,user_id,kind,display_name) values($1,$2,'person','Profil isolé')",
      [id, owner.userId],
    );
  const lead = await assignedLead(responsible, {
    ...input(),
    clientUserId: owner.userId,
    clientProfileId: profileId,
  });
  const change = {
      revision: 0,
      profileRevision: 0,
      advisorId: responsible.userId,
      confirmed: true as const,
    },
    attempt = key();
  await repository.updateReferent(owner, profileId, "vehicle", change, attempt);
  expect((await repository.referentProfile(owner, secondProfile, "vehicle")).current.status).toBe(
    "unset",
  );
  expect((await repository.referentProfile(owner, "self", "vehicle")).current.status).toBe("unset");
  await expect(repository.referentProfile(destination, profileId, "vehicle")).rejects.toMatchObject(
    { code: "PARTNER_NOT_FOUND" },
  );
  const transfers = createAdminProfileTransferRepository(database.db);
  await transfers.transfer(
    { id: administrator.id, userId: owner.userId, administratorUserId: administrator.userId },
    profileId,
    { destinationUserId: destination.userId, revision: 0 },
    key(),
  );
  await expect(
    repository.updateReferent(owner, profileId, "vehicle", change, attempt),
  ).rejects.toMatchObject({ code: "PARTNER_NOT_FOUND" });
  await expect(repository.referentProfile(owner, profileId, "vehicle")).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  const moved = await repository.referentProfile(destination, profileId, "vehicle");
  expect(moved.current).toMatchObject({
    status: "confirmation_required",
    advisor: { id: responsible.userId },
  });
  expect(moved.history[0]?.currentOwnerConfirmation).toBe(false);
  expect((await repository.detail(destination, lead.id)).referentContinuity?.suggestion).toBeNull();
  await transfers.transfer(
    { id: administrator.id, userId: destination.userId, administratorUserId: administrator.userId },
    profileId,
    { destinationUserId: owner.userId, revision: 1 },
    key(),
  );
  expect((await repository.referentProfile(owner, profileId, "vehicle")).current.status).toBe(
    "confirmation_required",
  );
  const renewed = { ...change, revision: 1, profileRevision: 2 },
    renewedKey = key();
  await expect(
    repository.updateReferent(
      owner,
      profileId,
      "vehicle",
      { ...renewed, profileRevision: 0 },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  expect(
    (await repository.updateReferent(owner, profileId, "vehicle", renewed, renewedKey)).current
      .status,
  ).toBe("chosen");
  await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
    owner.id,
  ]);
  await expect(
    repository.updateReferent(owner, profileId, "vehicle", renewed, renewedKey),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  await expect(repository.referentProfile(owner, profileId, "vehicle")).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
});

it("does not turn declared skills into matching and respects a client change request, suspension and closure", async () => {
  const owner = { ...(await actor()), wallet: true },
    responsible = await actor();
  await approve(responsible);
  let lead = await assignedLead(responsible, { ...input(), clientUserId: owner.userId });
  await repository.updateReferent(
    owner,
    "self",
    "vehicle",
    { revision: 0, profileRevision: 0, advisorId: responsible.userId, confirmed: true },
    key(),
  );
  lead = await command(owner, lead, {
    action: "client_interlocutor",
    reason: "Je souhaite un autre interlocuteur pour cette demande.",
  });
  expect(lead.referentContinuity).toMatchObject({
    status: "client_change_requested",
    suggestion: null,
  });
  const open = (await repository.notifications(administrator, { status: "open" })).items.find(
    (n) => n.leadId === lead.id && n.kind === "interlocutor_request",
  )!;
  await repository.readNotification(administrator, open.id, key());
  expect((await repository.detail(owner, lead.id)).referentContinuity?.status).toBe(
    "client_change_requested",
  );
  const membership = (await repository.context(responsible)).application!;
  await repository.review(
    administrator,
    responsible.userId,
    {
      revision: membership.revision,
      state: "suspended",
      organizationState: "approved",
      roles: ["advisor"],
      reason: "Habilitation à réexaminer",
      reviewDueAt: null,
    },
    key(),
  );
  expect((await repository.referentProfile(owner, "self", "vehicle")).current.status).toBe(
    "unavailable",
  );
  await expect(
    repository.updateReferent(
      owner,
      "self",
      "vehicle",
      { revision: 1, profileRevision: 0, advisorId: responsible.userId, confirmed: true },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  lead = await repository.detail(administrator, lead.id);
  lead = await command(administrator, lead, {
    action: "close",
    result: "resolved_without_contract",
    reason: "current_suitable",
    comment: "Solution actuelle conservée après revue.",
  });
  expect(lead.referentContinuity).toMatchObject({ status: "closed", suggestion: null });
  await repository.updateReferent(
    owner,
    "self",
    "vehicle",
    { revision: 1, profileRevision: 0, advisorId: null, confirmed: true },
    key(),
  );
  expect((await repository.detail(owner, lead.id)).stage).toBe("completed");
});

it("paginates immutable category history and enforces confirmation and SQL subject integrity", async () => {
  const owner = { ...(await actor()), wallet: true };
  expect(() =>
    repository.updateReferent(
      owner,
      "self",
      "vehicle",
      { revision: 0, profileRevision: 0, advisorId: null, confirmed: false as unknown as true },
      key(),
    ),
  ).toThrow();
  for (let revision = 0; revision < 22; revision++)
    await repository.updateReferent(
      owner,
      "self",
      "vehicle",
      { revision, profileRevision: 0, advisorId: null, confirmed: true },
      key(),
    );
  const first = await repository.referentProfile(owner, "self", "vehicle");
  expect(first.history).toHaveLength(20);
  const last = await repository.referentProfile(
    owner,
    "self",
    "vehicle",
    first.nextBeforeRevision!,
  );
  expect(last.history.map((x) => x.revision)).toEqual([2, 1]);
  expect(last.current.revision).toBe(22);
  expect(last.nextBeforeRevision).toBeNull();
  await expect(
    database.pool.query(
      `insert into partner_referent_selections(id,subject_id,self_user_id,subject_revision,category,revision,confirmed_by) values($1,'profile:wrong',$2,0,'vehicle',1,$2)`,
      [key(), owner.userId],
    ),
  ).rejects.toMatchObject({ code: "23514" });
  expect((await repository.referentProfile(owner, "self", "health")).history).toEqual([]);
});

it("keeps each import durable and private, deduplicates exact content and never groups by name", async () => {
  const responsible = await actor();
  await approve(responsible);
  const lead = await assignedLead(responsible);
  const source = {
    name: "Proposition.pdf",
    mime: "application/pdf",
    size: 10,
    checksum: createHash("sha256").update(key()).digest("hex"),
  };
  const request = { revision: lead.revision, analysisRequested: true as const, source };
  const replayKey = key();
  const receipts = await Promise.all([
    repository.prepareOfferImport(responsible, lead.id, request, replayKey),
    repository.prepareOfferImport(responsible, lead.id, request, replayKey),
    repository.prepareOfferImport(responsible, lead.id, request, key()),
  ]);
  expect(new Set(receipts.map((r) => r.item.id)).size).toBe(1);
  expect(receipts[0].item).toMatchObject({
    state: "pending",
    canUpload: true,
    canPrepare: false,
    canDownload: false,
    offerId: null,
  });
  const second = await repository.prepareOfferImport(
    responsible,
    lead.id,
    {
      ...request,
      revision: receipts[0].leadRevision,
      source: { ...source, checksum: createHash("sha256").update(key()).digest("hex") },
    },
    key(),
  );
  expect(second.item.id).not.toBe(receipts[0].item.id);
  const same = await repository.prepareOfferImport(
    responsible,
    lead.id,
    { ...request, source: { ...source, name: "Nom différent.pdf" } },
    key(),
  );
  expect(same.item.id).toBe(receipts[0].item.id);
  const all = await repository.offerImports(responsible, lead.id);
  expect(all.items).toHaveLength(2);
  expect(
    (await database.pool.query("select id from files where user_id=$1", [responsible.userId]))
      .rowCount,
  ).toBe(2);
  expect(
    (
      await database.pool.query("select id from document_outbox where document_id=$1", [
        same.item.documentId,
      ])
    ).rowCount,
  ).toBe(0);
  for (const forbidden of [neighbor, referrer, client]) {
    await expect(repository.offerImports(forbidden, lead.id)).rejects.toBeDefined();
    await expect(
      repository.prepareOfferImport(forbidden, lead.id, request, key()),
    ).rejects.toBeDefined();
    await expect(
      repository.importSource(forbidden, lead.id, same.item.id, true),
    ).rejects.toBeDefined();
  }
  await expect(
    repository.prepareOfferImport(
      responsible,
      lead.id,
      { ...request, source: { ...source, name: "Autre.pdf" } },
      replayKey,
    ),
  ).rejects.toMatchObject({ code: "PARTNER_IDEMPOTENCY_REUSED" });
  await expect(
    repository.prepareOfferImport(
      responsible,
      lead.id,
      { ...request, source: { ...source, checksum: "f".repeat(64) } },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  const after = await repository.detail(responsible, lead.id);
  expect(after.offers).toHaveLength(0);
  expect(after.stage).toBe(lead.stage);
  expect(after.firstUsefulAt).toBe(lead.firstUsefulAt);
  expect(after.events.filter((e) => e.kind === "offer.import_started")).toHaveLength(2);
  expect(
    (await repository.detail(client, lead.id)).events.some(
      (e) => e.kind === "offer.import_started",
    ),
  ).toBe(false);
  await expect(
    command(administrator, after, {
      action: "edit",
      lead: { ...input(), object: "Autre véhicule" },
    }),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_TRANSITION" });
});

it("retries one imported document atomically while retaining partial results, quarantine and exact offer confirmation", async () => {
  const responsible = await actor();
  await approve(responsible);
  let lead = await assignedLead(responsible);
  const prepare = async () => {
    const result = await repository.prepareOfferImport(
      responsible,
      lead.id,
      {
        revision: lead.revision,
        analysisRequested: true,
        source: {
          name: "Offre.pdf",
          mime: "application/pdf",
          size: 10,
          checksum: createHash("sha256").update(key()).digest("hex"),
        },
      },
      key(),
    );
    lead = await repository.detail(responsible, lead.id);
    return result.item;
  };
  const [a, b] = [await prepare(), await prepare()];
  await Promise.all([
    repository.completeImportUpload(responsible, lead.id, a.id, "application/pdf"),
    repository.completeImportUpload(responsible, lead.id, a.id, "application/pdf"),
  ]);
  expect(
    (
      await database.pool.query("select id from document_outbox where document_id=$1", [
        a.documentId,
      ])
    ).rowCount,
  ).toBe(1);
  await database.pool.query(
    "update files set state='failed',scan_version='isolated',failure='ai_quota_exhausted' where id=$1",
    [a.documentId],
  );
  await database.pool.query(
    "update files set state='quarantined',failure='infected',analysis=$2 where id=$1",
    [b.documentId, JSON.stringify({ secret: "must stay private" })],
  );
  let rows = await repository.offerImports(responsible, lead.id);
  expect(rows.items.find((i) => i.id === a.id)).toMatchObject({
    canRetry: true,
    canPrepare: true,
    analysis: "absent",
  });
  expect(rows.items.find((i) => i.id === b.id)).toMatchObject({
    canRetry: false,
    canPrepare: false,
    canDownload: false,
    analysis: "unavailable",
  });
  const blocked = await repository.extraction(responsible, lead.id, b.documentId);
  expect(blocked).toMatchObject({
    sourceFingerprint: null,
    company: null,
    product: null,
    annualPremiumMinor: null,
  });
  await expect(repository.importSource(responsible, lead.id, b.id)).rejects.toMatchObject({
    code: "PARTNER_INVALID_DOCUMENT",
  });
  await expect(
    repository.retryOfferImport(
      responsible,
      lead.id,
      b.id,
      { revision: b.revision, analysisRequested: true },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_TRANSITION" });
  const failed = rows.items.find((i) => i.id === a.id)!;
  const retryKey = key(),
    retry = { revision: failed.revision, analysisRequested: true as const };
  await Promise.all([
    repository.retryOfferImport(responsible, lead.id, a.id, retry, retryKey),
    repository.retryOfferImport(responsible, lead.id, a.id, retry, retryKey),
  ]);
  expect(
    (
      await database.pool.query("select id from document_outbox where document_id=$1", [
        a.documentId,
      ])
    ).rowCount,
  ).toBe(2);
  await database.pool.query("update files set state='failed' where id=$1", [a.documentId]);
  const source = await repository.extraction(responsible, lead.id, a.documentId);
  const offer = {
    documentId: a.documentId,
    sourceFingerprint: source.sourceFingerprint!,
    company: "Compagnie isolée",
    product: "Produit isolé",
    reference: "",
    annualPremiumMinor: null,
    currency: "CHF" as const,
    validUntil: null,
    effectiveDate: null,
    features: [],
    summary: "",
    limitations: "",
    replacesId: null,
  };
  await expect(
    command(responsible, lead, {
      action: "offer",
      offer: { ...offer, sourceFingerprint: "0".repeat(64) },
    }),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  const offerKey = key(),
    payload = { action: "offer" as const, revision: lead.revision, offer };
  lead = await repository.command(responsible, lead.id, payload, offerKey);
  await repository.command(responsible, lead.id, payload, offerKey);
  await expect(command(responsible, lead, { action: "offer", offer })).rejects.toMatchObject({
    code: "PARTNER_CONFLICT",
  });
  rows = await repository.offerImports(responsible, lead.id);
  expect(rows.items.find((i) => i.id === a.id)).toMatchObject({
    canPrepare: false,
    canRetry: false,
    offerId: lead.offers[0]!.id,
  });
  expect(rows.items.find((i) => i.id === b.id)?.state).toBe("quarantined");
  expect(lead.offers).toHaveLength(1);
  expect(lead.offers[0]?.publishedAt).toBeNull();
  expect((await repository.detail(client, lead.id)).offers).toHaveLength(0);
});

it("resumes imports after assignment transfer, denies former and revoked actors and paginates every original", async () => {
  const responsible = await actor(),
    replacement = await actor();
  await approve(responsible);
  await approve(replacement);
  let lead = await assignedLead(responsible);
  let receipt!: Awaited<ReturnType<typeof repository.prepareOfferImport>>;
  const request = {
    revision: lead.revision,
    analysisRequested: true as const,
    source: {
      name: "Original.pdf",
      mime: "application/pdf",
      size: 10,
      checksum: createHash("sha256").update(key()).digest("hex"),
    },
  };
  const replayKey = key();
  receipt = await repository.prepareOfferImport(responsible, lead.id, request, replayKey);
  for (let i = 0; i < 20; i++) {
    const result = await repository.prepareOfferImport(
      responsible,
      lead.id,
      {
        ...request,
        revision: receipt.leadRevision,
        source: { ...request.source, checksum: createHash("sha256").update(key()).digest("hex") },
      },
      key(),
    );
    receipt = { ...result, item: receipt.item };
  }
  const first = await repository.offerImports(responsible, lead.id);
  const next = await repository.offerImports(responsible, lead.id, first.nextCursor!);
  expect(first.items).toHaveLength(20);
  expect(next.items).toHaveLength(1);
  expect(next.nextCursor).toBeNull();
  expect(new Set([...first.items, ...next.items].map((i) => i.id)).size).toBe(21);
  lead = await command(administrator, await repository.detail(administrator, lead.id), {
    action: "assign",
    responsibleId: replacement.userId,
    reason: "Reprise des originaux en attente",
  });
  for (const read of [
    () => repository.offerImports(responsible, lead.id),
    () => repository.prepareOfferImport(responsible, lead.id, request, replayKey),
    () => repository.completeImportUpload(responsible, lead.id, receipt.item.id, "application/pdf"),
  ])
    await expect(read()).rejects.toBeDefined();
  expect(await repository.importSource(replacement, lead.id, receipt.item.id, true)).toEqual({
    userId: responsible.userId,
    documentId: receipt.item.documentId,
  });
  await repository.completeImportUpload(replacement, lead.id, receipt.item.id, "application/pdf");
  await database.pool.query("update files set state='failed',scan_version='isolated' where id=$1", [
    receipt.item.documentId,
  ]);
  const extracted = await repository.extraction(replacement, lead.id, receipt.item.documentId);
  expect(extracted.sourceFingerprint).toMatch(/^[a-f0-9]{64}$/u);
  await Promise.all([
    repository.importSourceConsulted(replacement, lead.id, receipt.item.id),
    repository.importSourceConsulted(replacement, lead.id, receipt.item.id),
  ]);
  expect(
    (await repository.detail(replacement, lead.id)).events.filter(
      (e) => e.kind === "offer.import_viewed",
    ),
  ).toHaveLength(1);
  await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
    replacement.id,
  ]);
  await expect(repository.offerImports(replacement, lead.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await expect(
    repository.extraction(replacement, lead.id, receipt.item.documentId),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
});

async function policyDocument(owner: PartnerActor, profileId: string | null = null, offer = false) {
  const documentId = `doc_${key()}`;
  const text =
    "Police automobile\nAXA\nPrime mensuelle : CHF 100\nCollision incluse\nParking exclu\nFranchise CHF 500\nProtection pneus exclue";
  const source = {
    page: 1,
    text: "Prime mensuelle : CHF 100",
    method: "isolated",
    version: "test-v1",
    confidence: 1,
    box: null,
  };
  const analysis = {
    category: "insurance",
    title: "Police automobile",
    classification: "insurance_policy",
    evidence: null,
    fields: [],
    pages: [{ page: 1, text, method: "isolated", version: "test-v1" }],
    insurance: {
      companyId: "axa",
      companySource: { ...source, text: "AXA" },
      domain: "motor",
      domainSource: { ...source, text: "Police automobile" },
      policyNumber: { value: key(), source: { ...source, text: "Police automobile" } },
      insuredSubject: { value: "Véhicule A", source: { ...source, text: "Police automobile" } },
      startsOn: { value: "2026-01-01", source },
      endsOn: { value: "2026-12-31", source },
      premium: { amountMinor: 10000, currency: "CHF", period: "month", source },
    },
  };
  await database.pool.query(
    "insert into files(id,user_id,managed_profile_id,name,mime,declared_mime,size,checksum,object_key,state,category,scan_version,analysis,purpose) values($1,$2,$3,'Police isolée.pdf','application/pdf','application/pdf',10,$4,$5,'ready','insurance','isolated-scan',$6,$7)",
    [
      documentId,
      owner.userId,
      profileId,
      createHash("sha256").update(documentId).digest("hex"),
      key(),
      JSON.stringify(analysis),
      offer ? "lead_offer" : null,
    ],
  );
  return documentId;
}
async function linkContract(owner: PartnerActor, lead: LeadDetail, documentId: string) {
  const candidate = (await repository.contractCandidates(owner, lead.id)).items.find(
    (item) => item.documentId === documentId,
  )!;
  return command(owner, lead, {
    action: "contract_link",
    documentId,
    fingerprint: candidate.fingerprint,
    sameObjectConfirmed: true,
    sharingConfirmed: true,
  });
}

async function decisionOffers(
  owner = client,
  responsible = advisor,
  profileId: string | null = null,
) {
  let lead = await assignedLead(responsible, {
    ...input(),
    clientUserId: owner.userId,
    clientProfileId: profileId,
  });
  for (const product of ["Véhicule A", "Véhicule B"]) {
    const documentId = await policyDocument(responsible, null, true);
    lead = await command(responsible, lead, {
      action: "offer",
      offer: {
        documentId,
        sourceFingerprint: (await repository.extraction(responsible, lead.id, documentId))
          .sourceFingerprint!,
        company: "Compagnie isolée",
        product,
        reference: "",
        annualPremiumMinor: 120000,
        currency: "CHF",
        validUntil: due(),
        effectiveDate: null,
        features: [],
        summary: "",
        limitations: "",
        replacesId: null,
      },
    });
    const offerId = lead.offers.find((o) => o.product === product)!.id;
    lead = await command(responsible, lead, { action: "offer_review", offerId });
    lead = await command(responsible, lead, { action: "offer_publish", offerId });
  }
  return lead;
}

async function finalPolicyInput(
  owner: PartnerActor,
  lead: LeadDetail,
  documentId: string,
  offerId = lead.offers[0]!.id,
): Promise<LeadCommand> {
  const candidate = (await repository.contractCandidates(owner, lead.id)).items.find(
    (item) => item.documentId === documentId,
  )!;
  return {
    action: "final_policy_link",
    revision: lead.revision,
    offerId,
    documentId,
    fingerprint: candidate.fingerprint,
    sameObjectConfirmed: true,
    sharingConfirmed: true,
    receivedPolicyConfirmed: true,
  };
}
const policyChecks = (): FinalPolicyReview["checks"] =>
  finalPolicyFields.map((field) => ({
    field,
    result: "same",
    note: "Concordance contrôlée dans les deux sources isolées",
    offerSource: { page: 1, quote: "Prime mensuelle : CHF 100" },
    policySource: { page: 1, quote: "Prime mensuelle : CHF 100" },
  }));

it("links only the owner's received final policy to an exact published version without inferring a signature or closing the case", async () => {
  const owner = { ...(await actor()), wallet: true };
  const responsible = await actor();
  await approve(responsible);
  let lead = await decisionOffers(owner, responsible);
  const existing = await policyDocument(owner);
  lead = await linkContract(owner, lead, existing);
  const before = await repository.detail(responsible, lead.id);
  const documentId = await policyDocument(owner);
  const request = await finalPolicyInput(owner, lead, documentId);
  const replayKey = key();
  expect(leadCommandSchema.safeParse({ ...request, sharingConfirmed: false }).success).toBe(false);
  for (const denied of [responsible, neighbor, referrer, client])
    await expect(repository.command(denied, lead.id, request, key())).rejects.toBeDefined();
  const otherDocument = await policyDocument(client);
  await expect(
    repository.command(
      owner,
      lead.id,
      { ...request, documentId: otherDocument } as LeadCommand,
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_DOCUMENT" });
  await expect(
    repository.command(owner, lead.id, { ...request, offerId: "missing" } as LeadCommand, key()),
  ).rejects.toMatchObject({ code: "PARTNER_NOT_FOUND" });
  await Promise.all([
    repository.command(owner, lead.id, request, replayKey),
    repository.command(owner, lead.id, request, replayKey),
  ]);
  lead = await repository.detail(responsible, lead.id);
  const result = (await repository.finalPolicies(responsible, lead.id)).items[0]!;
  expect(result).toMatchObject({
    documentId,
    active: true,
    status: "available",
    reviewState: "to_verify",
    canReview: true,
    offer: { id: before.offers[0]!.id, version: 1 },
    signatureEvidence: "missing",
    insurerAcceptanceEvidence: "missing",
    premium: {
      offerAnnualMinor: 120000,
      policyAnnualMinor: 120000,
      factor: 12,
      differenceMinor: 0,
    },
  });
  expect((await repository.finalPolicies(owner, lead.id)).items[0]?.canReview).toBe(false);
  expect(lead).toMatchObject({
    stage: before.stage,
    result: before.result,
    dueAt: before.dueAt,
    nextAction: before.nextAction,
    firstUsefulAt: before.firstUsefulAt,
    currentContract: { referenceId: before.currentContract!.referenceId, documentId: existing },
  });
  expect(lead.events.filter((e) => e.kind === "policy.linked")).toHaveLength(1);
  expect(lead.events.find((e) => e.kind === "policy.linked")).toMatchObject({
    offer: { id: result.offer.id, version: 1 },
  });
  expect(
    (
      await database.pool.query<{ retained_at: Date | null }>(
        "select retained_at from files where id=$1",
        [documentId],
      )
    ).rows[0]!.retained_at,
  ).not.toBeNull();
  for (const denied of [neighbor, referrer, client]) {
    await expect(repository.finalPolicies(denied, lead.id)).rejects.toBeDefined();
    await expect(repository.finalPolicySource(denied, lead.id, result.id)).rejects.toBeDefined();
  }
  await Promise.all([
    repository.finalPolicySource(responsible, lead.id, result.id, true),
    repository.finalPolicySource(responsible, lead.id, result.id, true),
  ]);
  expect(
    (await repository.detail(responsible, lead.id)).events.filter(
      (e) => e.kind === "policy.viewed",
    ),
  ).toHaveLength(1);
  const notification = (await repository.notifications(responsible, { status: "open" })).items.find(
    (n) => n.leadId === lead.id && n.kind === "policy_review",
  )!;
  expect(notification).toMatchObject({
    offer: { id: result.offer.id, version: 1 },
    action: "review_policy",
  });
  await repository.readNotification(responsible, notification.id, key());
  lead = await command(responsible, lead, {
    action: "contact",
    outcome: "reached",
    note: "Suivi confirmé",
    nextAction: "Contrôler la police",
    dueAt: due(),
  });
  expect(
    (await repository.notifications(responsible, { status: "open" })).items.some(
      (n) => n.id === notification.id,
    ),
  ).toBe(true);
  // An original cannot be shared as a final policy of another affair at the same time.
  const second = await decisionOffers(owner, responsible);
  await expect(
    repository.command(owner, second.id, await finalPolicyInput(owner, second, documentId), key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
});

it("versions sourced final-policy checks, exposes monetary differences, retains the old offer and revokes withdrawn evidence", async () => {
  const owner = { ...(await actor()), wallet: true },
    responsible = await actor();
  await approve(responsible);
  let lead = await decisionOffers(owner, responsible);
  const documentId = await policyDocument(owner);
  lead = await repository.command(
    owner,
    lead.id,
    await finalPolicyInput(owner, lead, documentId),
    key(),
  );
  const policy = (await repository.finalPolicies(responsible, lead.id)).items[0]!;
  const checks = policyChecks();
  const review: LeadCommand = {
    action: "final_policy_review",
    revision: lead.revision,
    review: { policyId: policy.id, checks },
  };
  await expect(repository.command(owner, lead.id, review, key())).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await expect(
    repository.command(
      responsible,
      lead.id,
      {
        ...review,
        review: {
          policyId: policy.id,
          checks: [{ ...checks[0]!, policySource: { page: 1, quote: "Passage absent" } }],
        },
      },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_DOCUMENT" });
  const reviewKey = key();
  await Promise.all([
    repository.command(responsible, lead.id, review, reviewKey),
    repository.command(responsible, lead.id, review, reviewKey),
  ]);
  lead = await repository.detail(responsible, lead.id);
  expect((await repository.finalPolicies(owner, lead.id)).items[0]).toMatchObject({
    reviewState: "checked",
    review: { version: 1 },
    signatureEvidence: "missing",
    insurerAcceptanceEvidence: "missing",
  });
  lead = await command(responsible, lead, {
    action: "final_policy_review",
    review: {
      policyId: policy.id,
      checks: checks.map((c) =>
        c.field === "coverage"
          ? { ...c, result: "difference", note: "Différence explicitement constatée" }
          : c,
      ),
    },
  });
  expect((await repository.finalPolicies(owner, lead.id)).items[0]).toMatchObject({
    reviewState: "differences",
    review: { version: 2 },
  });
  expect(
    (
      await database.pool.query(
        "select version from partner_final_policy_reviews where policy_id=$1 order by version",
        [policy.id],
      )
    ).rows,
  ).toEqual([{ version: 1 }, { version: 2 }]);
  expect(
    (await repository.notifications(owner, { status: "all" })).items.filter(
      (n) => n.leadId === lead.id && n.kind === "policy.reviewed",
    ),
  ).toHaveLength(2);
  const originalOffer = lead.offers.find((o) => o.id === policy.offer.id)!;
  lead = await command(responsible, lead, {
    action: "offer",
    offer: { ...leadOfferInputSchema.strip().parse(originalOffer), replacesId: originalOffer.id },
  });
  const newer = lead.offers.find(
    (o) => o.id !== originalOffer.id && o.product === originalOffer.product,
  )!;
  lead = await command(responsible, lead, { action: "offer_review", offerId: newer.id });
  lead = await command(responsible, lead, { action: "offer_publish", offerId: newer.id });
  expect((await repository.finalPolicies(owner, lead.id)).items[0]).toMatchObject({
    offer: { id: originalOffer.id, version: 1, active: false },
    review: { version: 2 },
  });
  // A different premium cannot be hidden by checks marked concordant.
  const higher = await policyDocument(owner);
  await database.pool.query(
    "update files set analysis=jsonb_set(analysis,'{insurance,premium,amountMinor}','11000') where id=$1",
    [higher],
  );
  lead = await repository.command(
    owner,
    lead.id,
    await finalPolicyInput(owner, lead, higher, originalOffer.id),
    key(),
  );
  const replacement = (await repository.finalPolicies(owner, lead.id)).items[0]!;
  expect(replacement).toMatchObject({
    reviewState: "differences",
    premium: { policyAnnualMinor: 132000, differenceMinor: 12000 },
  });
  lead = await command(responsible, lead, {
    action: "final_policy_review",
    review: { policyId: replacement.id, checks },
  });
  expect((await repository.finalPolicies(owner, lead.id)).items[0]?.reviewState).toBe(
    "differences",
  );
  expect(
    (await repository.finalPolicies(owner, lead.id)).items.find((p) => p.id === policy.id),
  ).toMatchObject({ status: "withdrawn", source: null, review: null, canDownload: false });
  await expect(repository.finalPolicySource(responsible, lead.id, policy.id)).rejects.toMatchObject(
    { code: "PARTNER_NOT_FOUND" },
  );
  await expect(
    command(responsible, lead, {
      action: "final_policy_review",
      review: { policyId: policy.id, checks },
    }),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  lead = await command(owner, lead, { action: "final_policy_unlink", policyId: replacement.id });
  await expect(repository.finalPolicySource(owner, lead.id, replacement.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  expect(
    (await repository.notifications(responsible, { status: "open" })).items.some(
      (n) => n.leadId === lead.id && n.kind === "policy_review",
    ),
  ).toBe(false);
  expect(
    (
      await database.pool.query<{ n: number }>(
        "select count(*)::int n from partner_final_policy_reviews where policy_id=$1",
        [policy.id],
      )
    ).rows[0]!.n,
  ).toBe(2);
  expect(
    (
      await database.pool.query<{ deleted_at: Date | null }>(
        "select deleted_at from files where id=$1",
        [higher],
      )
    ).rows[0]!.deleted_at,
  ).toBeNull();
});

it("rechecks final-policy ownership, reassignment, source mutations and session revocation including idempotent replay", async () => {
  const owner = { ...(await actor()), wallet: true },
    destination = { ...(await actor()), wallet: true };
  const responsible = await actor(),
    successor = await actor();
  await approve(responsible);
  await approve(successor);
  const profileId = `prf_${key()}`;
  await database.pool.query(
    "insert into managed_profiles(id,user_id,kind,display_name) values($1,$2,'person','Personne isolée')",
    [profileId, owner.userId],
  );
  let lead = await decisionOffers(owner, responsible, profileId);
  const documentId = await policyDocument(owner, profileId);
  const selfDocument = await policyDocument(owner);
  const request = await finalPolicyInput(owner, lead, documentId),
    replayKey = key();
  await expect(
    repository.command(
      owner,
      lead.id,
      { ...request, documentId: selfDocument } as LeadCommand,
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_DOCUMENT" });
  const racing = await Promise.allSettled([
    repository.command(owner, lead.id, request, replayKey),
    repository.command(owner, lead.id, request, key()),
  ]);
  expect(racing.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(racing.find((r) => r.status === "rejected")).toMatchObject({
    reason: { code: "PARTNER_CONFLICT" },
  });
  // Use the accepted command's key for the ownership replay check below.
  const stored = (
    await database.pool.query<{ key: string }>(
      "select key from partner_commands where target_id=$1 and user_id=$2 order by created_at desc limit 1",
      [lead.id, owner.userId],
    )
  ).rows[0]!;
  lead = await repository.detail(responsible, lead.id);
  let policy = (await repository.finalPolicies(responsible, lead.id)).items[0]!;
  const review: LeadCommand = {
      action: "final_policy_review",
      revision: lead.revision,
      review: { policyId: policy.id, checks: policyChecks() },
    },
    reviewKey = key();
  lead = await repository.command(responsible, lead.id, review, reviewKey);
  await createAdminProfileTransferRepository(database.db).transfer(
    { id: administrator.id, userId: owner.userId, administratorUserId: administrator.userId },
    profileId,
    { destinationUserId: destination.userId, revision: 0 },
    key(),
  );
  await expect(repository.command(owner, lead.id, request, stored.key)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  await expect(repository.finalPolicySource(owner, lead.id, policy.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  expect((await repository.finalPolicies(destination, lead.id)).items[0]).toMatchObject({
    status: "available",
    reviewState: "checked",
  });
  expect(await repository.finalPolicySource(destination, lead.id, policy.id)).toBe(documentId);
  lead = await command(administrator, lead, {
    action: "assign",
    responsibleId: successor.userId,
    reason: "Continuité de la police",
  });
  await expect(repository.command(responsible, lead.id, review, reviewKey)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  await expect(repository.finalPolicySource(responsible, lead.id, policy.id)).rejects.toMatchObject(
    { code: "PARTNER_NOT_FOUND" },
  );
  expect(
    (await repository.notifications(successor, { status: "open" })).items.some(
      (n) => n.leadId === lead.id && n.kind === "policy_review",
    ),
  ).toBe(true);
  await database.pool.query("update files set generation=generation+1 where id=$1", [documentId]);
  policy = (await repository.finalPolicies(successor, lead.id)).items[0]!;
  expect(policy).toMatchObject({
    status: "source_changed",
    reviewState: "invalidated",
    review: null,
    source: null,
    canDownload: false,
    canReview: false,
  });
  await expect(
    command(successor, lead, { action: "final_policy_review", review: review.review }),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  await expect(repository.finalPolicySource(destination, lead.id, policy.id)).rejects.toMatchObject(
    { code: "PARTNER_NOT_FOUND" },
  );
  lead = await repository.command(
    destination,
    lead.id,
    await finalPolicyInput(destination, lead, documentId, policy.offer.id),
    key(),
  );
  policy = (await repository.finalPolicies(successor, lead.id)).items[0]!;
  await database.pool.query("update files set generation=generation+1 where id=$1", [
    lead.offers.find((o) => o.id === policy.offer.id)!.documentId,
  ]);
  expect((await repository.finalPolicies(successor, lead.id)).items[0]).toMatchObject({
    status: "available",
    reviewState: "invalidated",
    review: null,
    canReview: false,
    premium: { differenceMinor: null },
  });
  await database.pool.query("update files set state='quarantined' where id=$1", [documentId]);
  expect((await repository.finalPolicies(successor, lead.id)).items[0]).toMatchObject({
    status: "unavailable",
    source: null,
    canDownload: false,
  });
  await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
    successor.id,
  ]);
  await expect(repository.finalPolicies(successor, lead.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
});

it("paginates final-policy history without losing an older active original or exposing another Lead", async () => {
  const owner = { ...(await actor()), wallet: true },
    responsible = await actor();
  await approve(responsible);
  let lead = await decisionOffers(owner, responsible);
  const firstOffer = lead.offers[0]!.id,
    secondOffer = lead.offers[1]!.id;
  const original = await policyDocument(owner);
  lead = await repository.command(
    owner,
    lead.id,
    await finalPolicyInput(owner, lead, original, firstOffer),
    key(),
  );
  const firstPolicy = (await repository.finalPolicies(owner, lead.id)).items[0]!;
  for (let index = 0; index < 21; index++) {
    const documentId = await policyDocument(owner);
    lead = await repository.command(
      owner,
      lead.id,
      await finalPolicyInput(owner, lead, documentId, secondOffer),
      key(),
    );
  }
  const first = await repository.finalPolicies(owner, lead.id);
  expect(first.items).toHaveLength(20);
  expect(first.items.some((p) => p.id === firstPolicy.id)).toBe(false);
  const second = await repository.finalPolicies(owner, lead.id, first.nextCursor!);
  expect(second.items).toHaveLength(2);
  expect(second.nextCursor).toBeNull();
  expect(new Set([...first.items, ...second.items].map((p) => p.id)).size).toBe(22);
  expect(await repository.finalPolicySource(responsible, lead.id, firstPolicy.id)).toBe(original);
  const other = await decisionOffers(owner, responsible);
  await expect(repository.finalPolicies(owner, other.id, first.nextCursor!)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  await expect(repository.finalPolicySource(owner, other.id, firstPolicy.id)).rejects.toMatchObject(
    { code: "PARTNER_NOT_FOUND" },
  );
  await expect(
    database.pool.query(
      "insert into partner_final_policies(id,lead_id,offer_id,document_id,fingerprint,source_snapshot,confirmed_by,active,withdrawn_at) values($1,$2,$3,$4,$5,'{}',$6,false,now())",
      [key(), other.id, firstOffer, original, "a".repeat(64), owner.userId],
    ),
  ).rejects.toMatchObject({ code: "23503" });
});

it("requires a refusal reason and resolves only the chosen offer version's notification", async () => {
  let lead = await decisionOffers();
  const a = lead.offers[0]!,
    b = lead.offers[1]!;
  await expect(
    command(client, lead, {
      action: "client_choice",
      choice: "refuse",
      offerId: a.id,
      text: "   ",
    }),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  const before = {
    firstUsefulAt: lead.firstUsefulAt,
    dueAt: lead.dueAt,
    nextAction: lead.nextAction,
  };
  const refusal: LeadCommand = {
    action: "client_choice",
    choice: "refuse",
    offerId: a.id,
    text: "Franchise inadaptée",
    revision: lead.revision,
  };
  const refusalKey = key();
  await Promise.all([
    repository.command(client, lead.id, refusal, refusalKey),
    repository.command(client, lead.id, refusal, refusalKey),
  ]);
  lead = await repository.detail(advisor, lead.id);
  expect(lead).toMatchObject({ ...before, stage: "client_decision", result: null });
  expect(lead.events.filter((e) => e.kind === "client.refuse")).toHaveLength(1);
  expect(lead.events.find((e) => e.kind === "client.refuse")).toMatchObject({
    subjectId: a.id,
    text: "Franchise inadaptée",
  });
  expect(lead.offers.find((o) => o.id === a.id)).toMatchObject({
    state: "refused",
    canChoose: false,
    canDownload: true,
  });
  expect(lead.offers.find((o) => o.id === b.id)).toMatchObject({
    state: "published",
    canChoose: true,
  });
  const open = (await repository.notifications(client, { status: "open" })).items.filter(
    (n) => n.leadId === lead.id,
  );
  expect(open.filter((n) => n.kind === "offer.published")).toHaveLength(1);
  const responses = (await repository.notifications(advisor, { status: "open" })).items.filter(
    (n) => n.leadId === lead.id && n.kind === "client_response",
  );
  expect(responses).toHaveLength(1);
  expect(responses[0]).toMatchObject({
    eventKind: "client.refuse",
    offer: { id: a.id, version: a.version, product: a.product },
    action: "review_response",
  });
  expect(lead.events.find((e) => e.kind === "client.refuse")).toMatchObject({
    responsePending: true,
    offer: { id: a.id, version: a.version },
  });
  await repository.readNotification(advisor, responses[0]!.id, key());
  expect(
    (await repository.notifications(advisor, { status: "open" })).items.some(
      (n) => n.id === responses[0]!.id,
    ),
  ).toBe(true);
  await expect(
    repository.command(client, lead.id, { ...refusal, text: "Autre motif" }, refusalKey),
  ).rejects.toMatchObject({ code: "PARTNER_IDEMPOTENCY_REUSED" });
});

it("keeps questions actionable when another offer is published and preserves alternatives awaiting a decision", async () => {
  let lead = await decisionOffers();
  const a = lead.offers[0]!,
    b = lead.offers[1]!;
  lead = await command(client, lead, {
    action: "client_choice",
    choice: "question",
    offerId: a.id,
    text: "Quelle franchise ?",
  });
  expect(
    (await repository.notifications(client, { status: "open" })).items.filter(
      (n) => n.leadId === lead.id && n.kind === "offer.published",
    ),
  ).toHaveLength(2);
  lead = await command(advisor, lead, {
    action: "offer",
    offer: {
      ...leadOfferInputSchema.strip().parse(b),
      replacesId: b.id,
      product: "Alternative actualisée",
    },
  });
  const replacement = lead.offers.find((o) => o.product === "Alternative actualisée")!;
  lead = await command(advisor, lead, { action: "offer_review", offerId: replacement.id });
  lead = await command(advisor, lead, { action: "offer_publish", offerId: replacement.id });
  expect(
    (await repository.notifications(advisor, { status: "open" })).items.filter(
      (n) => n.leadId === lead.id && n.kind === "client_response",
    ),
  ).toHaveLength(1);
  lead = await command(client, lead, {
    action: "client_choice",
    choice: "modification",
    offerId: replacement.id,
    text: "Réduire la franchise",
  });
  lead = await command(advisor, lead, {
    action: "contact",
    outcome: "attempted",
    note: "Appel sans réponse",
    nextAction: "Attendre le retour",
    dueAt: due(),
  });
  expect(
    (await repository.detail(advisor, lead.id)).events.filter((e) => e.responsePending),
  ).toHaveLength(2);
  lead = await command(advisor, lead, {
    action: "contact",
    outcome: "reached",
    note: "Question expliquée et modification discutée",
    nextAction: "Préparer la proposition demandée",
    dueAt: due(),
  });
  expect(lead.events.filter((e) => e.responsePending)).toHaveLength(0);
  expect(
    (await repository.notifications(advisor, { status: "open" })).items.filter(
      (n) => n.leadId === lead.id && n.kind === "client_response",
    ),
  ).toHaveLength(0);
});

it("serializes refusal against selection and rechecks exact sources, transfers and revoked sessions on replay", async () => {
  const responsible = await actor(),
    successor = await actor();
  const owner = { ...(await actor()), wallet: true },
    destination = { ...(await actor()), wallet: true };
  await approve(responsible);
  await approve(successor);
  const profileId = `prf_${key()}`;
  await database.pool.query(
    "insert into managed_profiles(id,user_id,kind,display_name) values($1,$2,'person','Personne isolée')",
    [profileId, owner.userId],
  );
  let lead = await decisionOffers(owner, responsible, profileId);
  const a = lead.offers[0]!,
    b = lead.offers[1]!;
  const decide = (
    offerId: string,
    choice: "select" | "refuse" | "question" | "modification",
  ): LeadCommand => ({
    action: "client_choice",
    revision: lead.revision,
    offerId,
    choice,
    text: "Demande précise",
  });
  await database.pool.query("update files set generation=generation+1 where id=$1", [a.documentId]);
  for (const choice of ["select", "refuse", "question", "modification"] as const)
    await expect(
      repository.command(owner, lead.id, decide(a.id, choice), key()),
    ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  lead = await command(responsible, lead, {
    action: "offer_withdraw",
    offerId: b.id,
    reason: "Retrait de cette version",
  });
  await expect(
    repository.command(owner, lead.id, decide(b.id, "refuse"), key()),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_TRANSITION" });
  const replacement = {
    ...leadOfferInputSchema.strip().parse(a),
    replacesId: a.id,
    sourceFingerprint: (await repository.extraction(responsible, lead.id, a.documentId))
      .sourceFingerprint!,
  };
  lead = await command(responsible, lead, { action: "offer", offer: replacement });
  const current = lead.offers.find((o) => o.active)!;
  lead = await command(responsible, lead, { action: "offer_review", offerId: current.id });
  lead = await command(responsible, lead, { action: "offer_publish", offerId: current.id });
  await expect(
    repository.command(owner, lead.id, decide(a.id, "refuse"), key()),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_TRANSITION" });
  await expect(
    repository.command(destination, lead.id, decide(current.id, "refuse"), key()),
  ).rejects.toMatchObject({ code: "PARTNER_NOT_FOUND" });
  await expect(
    repository.command(responsible, lead.id, decide(current.id, "refuse"), key()),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  const racing = await Promise.allSettled([
    repository.command(owner, lead.id, decide(current.id, "refuse"), key()),
    repository.command(owner, lead.id, decide(current.id, "select"), key()),
  ]);
  expect(racing.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(racing.find((r) => r.status === "rejected")).toMatchObject({
    reason: { code: "PARTNER_CONFLICT" },
  });
  lead = await repository.detail(responsible, lead.id);
  expect(
    lead.events.filter((e) => ["client.select", "client.refuse"].includes(e.kind)),
  ).toHaveLength(1);
  lead = await command(administrator, lead, {
    action: "assign",
    responsibleId: successor.userId,
    reason: "Continuité du suivi",
  });
  const transferred = (await repository.notifications(successor, { status: "open" })).items.find(
    (n) => n.leadId === lead.id && n.kind === "client_response",
  )!;
  expect(transferred).toMatchObject({
    offer: { id: current.id, version: 2 },
    action: "review_response",
  });
  await expect(
    repository.readNotification(responsible, transferred.id, key()),
  ).rejects.toMatchObject({ code: "PARTNER_NOT_FOUND" });
  // The former owner cannot replay a successful decision after the canonical profile transfer.
  const preference: LeadCommand = {
    action: "client_choice",
    choice: "keep_current",
    text: "Je préfère conserver",
    revision: lead.revision,
  };
  const preferenceKey = key();
  lead = await repository.command(owner, lead.id, preference, preferenceKey);
  await createAdminProfileTransferRepository(database.db).transfer(
    { id: administrator.id, userId: owner.userId, administratorUserId: administrator.userId },
    profileId,
    { destinationUserId: destination.userId, revision: 0 },
    key(),
  );
  await expect(repository.command(owner, lead.id, preference, preferenceKey)).rejects.toMatchObject(
    { code: "PARTNER_NOT_FOUND" },
  );
  const inheritedNotifications = (
    await repository.notifications(destination, { status: "all" })
  ).items.filter((n) => n.leadId === lead.id && n.kind === "offer.published");
  expect(inheritedNotifications).toHaveLength(3);
  expect(
    (await repository.notifications(owner, { status: "all" })).items.some(
      (n) => n.leadId === lead.id,
    ),
  ).toBe(false);
  await expect(
    repository.readNotification(owner, inheritedNotifications[0]!.id, key()),
  ).rejects.toMatchObject({ code: "PARTNER_NOT_FOUND" });
  expect(
    (await repository.detail(destination, lead.id)).events.find(
      (e) => e.kind === "client.keep_current",
    ),
  ).toMatchObject({ text: "Je préfère conserver", responsePending: true });
  const afterTransfer: LeadCommand = {
    ...preference,
    revision: lead.revision,
    text: "Préférence du propriétaire actuel",
  };
  const afterTransferKey = key();
  await repository.command(destination, lead.id, afterTransfer, afterTransferKey);
  await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
    destination.id,
  ]);
  await expect(
    repository.command(destination, lead.id, afterTransfer, afterTransferKey),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  expect((await repository.detail(successor, lead.id)).stage).toBe("client_decision");
});

it("shares only an explicitly confirmed exact profile original, serializes references and preserves idempotency", async () => {
  const owner = { ...(await actor()), wallet: true },
    other = { ...(await actor()), wallet: true };
  let lead = await repository.create(owner, { ...input(), clientUserId: owner.userId }, key());
  const doc = await policyDocument(owner),
    doc2 = await policyDocument(owner),
    foreign = await policyDocument(other);
  const quote = await policyDocument(owner, null, true);
  const candidates = await repository.contractCandidates(owner, lead.id);
  expect(candidates.items.map((item) => item.documentId).sort()).toEqual([doc, doc2].sort());
  expect(candidates.items.some((item) => [foreign, quote].includes(item.documentId))).toBe(false);
  expect(lead.currentContract).toBeNull(); // No arbitrary reference even with the same object/category.
  await expect(repository.contractCandidates(administrator, lead.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await expect(repository.contractCandidates(other, lead.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  const candidate = candidates.items.find((item) => item.documentId === doc)!;
  const inputCommand = {
    action: "contract_link" as const,
    revision: lead.revision,
    documentId: doc,
    fingerprint: candidate.fingerprint,
    sameObjectConfirmed: true as const,
    sharingConfirmed: true as const,
  };
  expect(() => leadCommandSchema.parse({ ...inputCommand, sharingConfirmed: false })).toThrow();
  await expect(
    repository.command(owner, lead.id, { ...inputCommand, documentId: foreign }, key()),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_DOCUMENT" });
  await expect(
    repository.command(owner, lead.id, { ...inputCommand, fingerprint: "f".repeat(64) }, key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  const idempotencyKey = key();
  const results = await Promise.all([
    repository.command(owner, lead.id, inputCommand, idempotencyKey),
    repository.command(owner, lead.id, inputCommand, idempotencyKey),
  ]);
  expect(results[0].currentContract?.referenceId).toBe(results[1].currentContract?.referenceId);
  lead = results[0];
  expect(
    (
      await database.pool.query("select id from partner_contract_references where lead_id=$1", [
        lead.id,
      ])
    ).rowCount,
  ).toBe(1);
  expect(lead.events.filter((item) => item.kind === "contract.linked")).toHaveLength(1);
  const second = candidates.items.find((item) => item.documentId === doc2)!;
  const races = await Promise.allSettled([
    command(owner, lead, {
      action: "contract_unlink",
      referenceId: lead.currentContract!.referenceId,
    }),
    command(owner, lead, { ...inputCommand, documentId: doc2, fingerprint: second.fingerprint }),
  ]);
  expect(races.filter((value) => value.status === "fulfilled")).toHaveLength(1);
  await expect(
    command(administrator, await repository.detail(administrator, lead.id), {
      action: "edit",
      lead: { ...input(), clientUserId: owner.userId, object: "Véhicule B" },
    }),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_TRANSITION" });
  expect(
    (
      await database.pool.query<{ retained_at: Date }>(
        "select retained_at from files where id=$1",
        [doc],
      )
    ).rows[0]?.retained_at,
  ).toBeInstanceOf(Date);
});

it("compares verified gains AND losses, keeps missing and uncertain values distinct, and invalidates changed sources", async () => {
  const owner = { ...(await actor()), wallet: true },
    adviser = await actor();
  await approve(adviser);
  let lead = await assignedLead(adviser, { ...input(), clientUserId: owner.userId });
  const documentId = await policyDocument(owner),
    offerDocument = await policyDocument(adviser, null, true);
  lead = await linkContract(owner, lead, documentId);
  const referenceId = lead.currentContract!.referenceId;
  const features = [
    {
      key: "collision",
      label: "Collision",
      value: "Incluse",
      conditions: "Franchise CHF 500",
      exclusions: "Selon les conditions",
      coverage: "included" as const,
      verification: "verified" as const,
      page: 1,
      quote: "Collision incluse",
    },
    {
      key: "parking",
      label: "Parking",
      value: "Exclu",
      conditions: "",
      exclusions: "",
      coverage: "excluded" as const,
      verification: "verified" as const,
      page: 1,
      quote: "Parking exclu",
    },
    {
      key: "deductible",
      label: "Franchise",
      value: "CHF 500",
      conditions: "",
      exclusions: "",
      coverage: "unknown" as const,
      verification: "to_verify" as const,
      page: 1,
      quote: "Franchise CHF 500",
    },
    {
      key: "other",
      label: "Protection pneus",
      value: "Exclue",
      conditions: "",
      exclusions: "",
      coverage: "excluded" as const,
      verification: "verified" as const,
      page: 1,
      quote: "Protection pneus exclue",
    },
  ];
  await expect(
    command(adviser, lead, {
      action: "contract_review",
      review: {
        referenceId,
        premiumVerified: true,
        features: [{ ...features[0]!, quote: "Citation inventée" }],
      },
    }),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_DOCUMENT" });
  lead = await command(adviser, lead, {
    action: "contract_review",
    review: { referenceId, premiumVerified: true, features },
  });
  const offer = {
    documentId: offerDocument,
    company: "Compagnie isolée",
    product: "Proposition isolée",
    reference: "",
    annualPremiumMinor: 110000,
    currency: "CHF" as const,
    validUntil: due(),
    effectiveDate: null,
    summary: "",
    limitations: "À contrôler",
    replacesId: null,
    features: [
      {
        key: "collision",
        label: "Collision",
        value: "Exclue",
        conditions: "Franchise différente",
        exclusions: "Collision",
        coverage: "excluded" as const,
        source: "Collision incluse",
        sourcePage: 1,
        origin: "manual" as const,
        verification: "verified" as const,
      },
      {
        key: "parking",
        label: "Parking",
        value: "Incluse",
        conditions: "Plafond à comparer",
        exclusions: "",
        coverage: "included" as const,
        source: "Parking exclu",
        sourcePage: 1,
        origin: "manual" as const,
        verification: "verified" as const,
      },
      {
        key: "deductible",
        label: "Franchise",
        value: "CHF 500",
        conditions: "",
        source: "Franchise CHF 500",
        origin: "manual" as const,
        verification: "verified" as const,
      },
      {
        key: "assistance",
        label: "Assistance",
        value: "",
        conditions: "",
        source: "",
        origin: "missing" as const,
        verification: "missing" as const,
      },
      {
        key: "other",
        label: "Protection du conducteur",
        value: "Incluse",
        conditions: "",
        exclusions: "",
        coverage: "included" as const,
        source: "Protection conducteur incluse",
        sourcePage: 1,
        origin: "manual" as const,
        verification: "verified" as const,
      },
    ],
  };
  // The alternative source explicitly records the opposite coverages.
  await database.pool.query(
    "update files set analysis=jsonb_set(analysis,'{pages,0,text}',to_jsonb($2::text)) where id=$1",
    [
      offerDocument,
      "Offre automobile\nCollision exclue\nParking inclus\nFranchise CHF 500\nProtection conducteur incluse",
    ],
  );
  offer.features[0]!.source = "Collision exclue";
  offer.features[1]!.source = "Parking inclus";
  lead = await command(adviser, lead, {
    action: "offer",
    offer: {
      ...offer,
      sourceFingerprint: (await repository.extraction(adviser, lead.id, offerDocument))
        .sourceFingerprint!,
    },
  });
  const offerId = lead.offers[0]!.id;
  expect(lead.comparisons[0]?.annualDifferenceMinor).toBeNull();
  lead = await command(adviser, lead, { action: "offer_review", offerId });
  lead = await command(adviser, lead, { action: "offer_publish", offerId });
  const wallet = await repository.detail(owner, lead.id);
  expect(wallet.comparisons[0]).toMatchObject({
    currentAnnualMinor: 120000,
    annualFactor: 12,
    annualDifferenceMinor: -10000,
    premiumStatus: "calculated",
  });
  expect(wallet.comparisons[0]!.rows.map((row) => [row.key, row.change])).toEqual([
    ["collision", "loss"],
    ["parking", "gain"],
    ["deductible", "to_verify"],
    ["other:protection pneus", "missing"],
    ["assistance", "missing"],
    ["other:protection du conducteur", "missing"],
  ]);
  expect(wallet.comparisons[0]!.rows[0]?.proposed?.exclusions).toBe("Collision");
  // A published offer can expire before its state is materialized by any maintenance work.
  await database.pool.query(
    "update partner_offers set data=jsonb_set(data,'{validUntil}',to_jsonb($2::text)) where id=$1",
    [offerId, new Date(Date.now() - 60_000).toISOString()],
  );
  const expired = (await repository.detail(owner, lead.id)).comparisons[0]!;
  expect(expired.annualDifferenceMinor).toBeNull();
  expect(expired.rows.some((row) => row.change === "gain" || row.change === "loss")).toBe(false);
  await database.pool.query(
    "update partner_offers set data=jsonb_set(data,'{validUntil}',to_jsonb($2::text)) where id=$1",
    [offerId, offer.validUntil],
  );
  await repository.sourceConsulted(owner, lead.id, null);
  await repository.sourceConsulted(owner, lead.id, null);
  expect(
    (await repository.detail(owner, lead.id)).events.filter(
      (item) => item.kind === "document.viewed",
    ),
  ).toHaveLength(1);
  await database.pool.query("update files set generation=generation+1 where id=$1", [documentId]);
  lead = await repository.detail(adviser, lead.id);
  expect(lead.currentContract).toMatchObject({
    status: "source_changed",
    source: null,
    features: [],
  });
  expect(lead.comparisons[0]?.annualDifferenceMinor).toBeNull();
  await expect(
    command(adviser, lead, {
      action: "contract_review",
      review: { referenceId, premiumVerified: true, features },
    }),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  await expect(repository.sourceConsulted(owner, lead.id, null)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  lead = await linkContract(owner, lead, documentId);
  expect(lead.currentContract?.referenceId).not.toBe(referenceId);
  expect(lead.currentContract?.reviewVersion).toBe(0);
  expect(
    (
      await database.pool.query("select id from partner_contract_reviews where reference_id=$1", [
        referenceId,
      ])
    ).rowCount,
  ).toBe(1);
  lead = await command(owner, lead, { action: "client_choice", choice: "keep_current", text: "" });
  expect(lead.stage).toBe("client_decision");
  expect(lead.result).toBeNull();
  lead = await command(owner, lead, {
    action: "contract_unlink",
    referenceId: lead.currentContract!.referenceId,
  });
  expect(lead.currentContract).toBeNull();
  expect((await repository.detail(adviser, lead.id)).comparisons).toEqual([]);
});

it("keeps the canonical source through a real profile transfer and revokes former owner, neighbor and suspended adviser access", async () => {
  const owner = { ...(await actor()), wallet: true },
    destination = { ...(await actor()), wallet: true };
  const adviser = await actor(),
    replacement = await actor();
  await approve(adviser);
  await approve(replacement);
  const profileId = `prf_${key()}`;
  await database.pool.query(
    "insert into managed_profiles(id,user_id,kind,display_name) values($1,$2,'person','Personne isolée')",
    [profileId, owner.userId],
  );
  let lead = await assignedLead(adviser, {
    ...input(),
    clientUserId: owner.userId,
    clientProfileId: profileId,
  });
  const documentId = await policyDocument(owner, profileId),
    ownSelf = await policyDocument(owner);
  expect(
    (await repository.contractCandidates(owner, lead.id)).items.map((item) => item.documentId),
  ).toEqual([documentId]);
  const candidate = (await repository.contractCandidates(owner, lead.id)).items[0]!;
  const request = {
    action: "contract_link" as const,
    revision: lead.revision,
    documentId,
    fingerprint: candidate.fingerprint,
    sameObjectConfirmed: true as const,
    sharingConfirmed: true as const,
  };
  const replayKey = key();
  await expect(
    repository.command(owner, lead.id, { ...request, documentId: ownSelf }, key()),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_DOCUMENT" });
  lead = await repository.command(owner, lead.id, request, replayKey);
  const reference = lead.currentContract!.referenceId;
  await createAdminProfileTransferRepository(database.db).transfer(
    { id: administrator.id, userId: owner.userId, administratorUserId: administrator.userId },
    profileId,
    { destinationUserId: destination.userId, revision: 0 },
    key(),
  );
  expect((await repository.detail(destination, lead.id)).currentContract).toMatchObject({
    referenceId: reference,
    documentId,
    status: "available",
  });
  await expect(repository.command(owner, lead.id, request, replayKey)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  await expect(repository.contractCandidates(owner, lead.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  await expect(repository.sourceConsulted(owner, lead.id, null)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  await expect(repository.detail(replacement, lead.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  lead = await command(administrator, await repository.detail(administrator, lead.id), {
    action: "assign",
    responsibleId: replacement.userId,
    reason: "Transfert de suivi",
  });
  await expect(repository.sourceConsulted(adviser, lead.id, null)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  expect((await repository.detail(replacement, lead.id)).currentContract?.referenceId).toBe(
    reference,
  );
  await database.pool.query("update files set state='quarantined' where id=$1", [documentId]);
  expect((await repository.detail(destination, lead.id)).currentContract?.status).toBe(
    "unavailable",
  );
  await expect(repository.sourceConsulted(replacement, lead.id, null)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
    destination.id,
  ]);
  await expect(repository.contractCandidates(destination, lead.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
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
const list = leadListQuerySchema.parse({ view: "all" });
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
  const migrationsFolder = fileURLToPath(new URL("../../../drizzle/", import.meta.url));
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

const collaborationTerms = (
  targetId: string,
  mode: "co_advice" | "one_off" | "transfer" = "co_advice",
) =>
  collaborationTermsSchema.parse({
    targetId,
    mode,
    access: "contribute",
    communication: "client_direct",
    scope: "Ce Lead véhicule uniquement, pièces et offres du dossier hors notes privées.",
    responsibilities: "Analyser les garanties et préparer une comparaison sourcée.",
    reason: "Compétence complémentaire vérifiée",
    economicNote: "Aucun nouvel accord de rémunération. Droits antérieurs préservés.",
    existingRightsPreserved: true,
    transmissionConfirmed: true,
  });

it("requires explicit acceptance for co-advice, limits commands and preserves the referent and clock", async () => {
  const owner = await actor(),
    specialist = await actor(),
    outsider = await actor();
  await approve(owner);
  await approve(specialist);
  await approve(outsider);
  let lead = await assignedLead(owner);
  const initial = lead;
  lead = await command(owner, lead, {
    action: "note",
    text: "Note privée du référent",
    audience: "private",
  });
  lead = await command(owner, lead, {
    action: "collaboration_propose",
    terms: { ...collaborationTerms(specialist.userId), communication: "referent_only" },
  });
  const proposal = lead.collaborations[0]!;
  await expect(repository.detail(specialist, lead.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  expect((await repository.collaborations(outsider)).items).toHaveLength(0);
  expect((await repository.collaborations(specialist)).items[0]?.canOpenLead).toBe(false);
  const invite = (await repository.notifications(specialist, { status: "open" })).items.find(
    (n) => n.collaborationId === proposal.id,
  )!;
  expect(invite.title).toBe("");
  await repository.readNotification(specialist, invite.id, key());
  expect(
    (await repository.notifications(specialist, { status: "open" })).items.find(
      (n) => n.id === invite.id,
    )?.resolvedAt,
  ).toBeNull();
  await expect(
    repository.respondCollaboration(
      outsider,
      proposal.id,
      { revision: 0, decision: "accept", reason: "Accord" },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_NOT_FOUND" });
  const response = {
      revision: 0,
      decision: "accept" as const,
      reason: "Mission et limites acceptées",
    },
    acceptanceKey = key();
  await repository.respondCollaboration(specialist, proposal.id, response, acceptanceKey);
  await repository.respondCollaboration(specialist, proposal.id, response, acceptanceKey);
  lead = await repository.detail(specialist, lead.id);
  expect(lead.responsibleId).toBe(owner.userId);
  expect([lead.notifiedAt, lead.firstActionDueAt, lead.acceptanceDueAt]).toEqual([
    initial.notifiedAt,
    initial.firstActionDueAt,
    initial.acceptanceDueAt,
  ]);
  expect(lead.events.some((e) => e.text === "Note privée du référent")).toBe(false);
  expect(lead.email).toBeNull();
  expect(lead.allowedActions).not.toContain("contact");
  expect(
    (await repository.notifications(client, { status: "all" })).items.filter(
      (n) => n.leadId === lead.id && n.kind === "collaboration.accepted",
    ),
  ).toHaveLength(1);
  await expect(
    command(administrator, lead, {
      action: "edit",
      lead: { ...input(), object: "Un autre véhicule" },
    }),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_TRANSITION" });
  await expect(
    command(specialist, lead, { action: "offer_publish", offerId: "offer_forbidden" }),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  await expect(
    command(specialist, lead, {
      action: "contact",
      outcome: "reached",
      note: "Contact",
      nextAction: "Continuer",
      dueAt: due(),
    }),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  await expect(
    command(specialist, lead, { action: "note", text: "Message au client", audience: "client" }),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  await expect(
    command(specialist, lead, {
      action: "collaboration_propose",
      terms: collaborationTerms(outsider.userId),
    }),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  lead = await command(specialist, lead, {
    action: "task",
    task: {
      responsibleId: specialist.userId,
      title: "Comparer",
      description: "Périmètre convenu",
      dueAt: due(),
      priority: "normal",
      reminderAt: null,
    },
  });
  const current = (await repository.collaborations(specialist)).items.find(
    (c) => c.id === proposal.id,
  )!;
  await repository.respondCollaboration(
    specialist,
    proposal.id,
    { revision: current.revision, decision: "end", reason: "Mission terminée" },
    key(),
  );
  await expect(repository.detail(specialist, lead.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  expect((await repository.detail(owner, lead.id)).tasks[0]?.responsibleId).toBe(owner.userId);
  expect(
    (await repository.respondCollaboration(specialist, proposal.id, response, acceptanceKey))
      .canOpenLead,
  ).toBe(false);
});

it("hands over only after acceptance, retains dated waits and work, and keeps a referral limited to progress", async () => {
  const owner = await actor(),
    recipient = await actor(),
    alternative = await actor();
  await approve(owner);
  await approve(recipient);
  await approve(alternative);
  let lead = await assignedLead(owner);
  lead = await command(owner, lead, {
    action: "task",
    task: {
      responsibleId: owner.userId,
      title: "Suivre le dossier",
      description: "Engagement existant",
      dueAt: due(),
      priority: "normal",
      reminderAt: null,
    },
  });
  lead = await command(owner, lead, {
    action: "appointment",
    appointment: {
      advisorId: owner.userId,
      startsAt: due(),
      durationMinutes: 30,
      mode: "phone",
      location: "Téléphone convenu",
      timezone: "Europe/Zurich",
    },
  });
  lead = await command(owner, lead, {
    action: "wait",
    waiting: { reason: "Pièce attendue du client", until: due() },
  });
  lead = await command(owner, lead, {
    action: "collaboration_propose",
    terms: collaborationTerms(recipient.userId, "one_off"),
  });
  lead = await command(owner, lead, {
    action: "collaboration_propose",
    terms: collaborationTerms(alternative.userId, "transfer"),
  });
  const before = lead,
    first = lead.collaborations.find((c) => c.terms.targetId === recipient.userId)!,
    second = lead.collaborations.find((c) => c.terms.targetId === alternative.userId)!;
  await repository.respondCollaboration(
    recipient,
    first.id,
    { revision: 0, decision: "accept", reason: "Reprise convenue" },
    key(),
  );
  await expect(
    repository.respondCollaboration(
      alternative,
      second.id,
      { revision: 0, decision: "accept", reason: "Reprise" },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  lead = await repository.detail(recipient, lead.id);
  expect(lead.responsibleId).toBe(recipient.userId);
  expect([lead.notifiedAt, lead.firstActionDueAt, lead.firstUsefulAt, lead.waiting]).toEqual([
    before.notifiedAt,
    before.firstActionDueAt,
    before.firstUsefulAt,
    before.waiting,
  ]);
  expect(lead.tasks[0]?.responsibleId).toBe(recipient.userId);
  expect(lead.appointments[0]?.state).toBe("cancelled");
  const progress = await repository.detail(owner, lead.id);
  expect(progress.access).toBe("progress");
  expect(progress.tasks).toHaveLength(0);
  expect(progress.offers).toHaveLength(0);
  expect(progress.email).toBeNull();
  await expect(
    command(owner, progress, { action: "note", audience: "assigned", text: "Interdit" }),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  expect(
    (await repository.notifications(owner, { status: "all" })).items.some(
      (n) => n.collaborationId === first.id && n.kind === "collaboration.accepted",
    ),
  ).toBe(true);
  const wallet = await repository.detail(client, lead.id);
  await command(client, wallet, {
    action: "client_interlocutor",
    reason: "Je souhaite un autre interlocuteur",
  });
  expect(
    (await repository.notifications(administrator, { status: "open" })).items.some(
      (n) => n.leadId === lead.id && n.kind === "interlocutor_request",
    ),
  ).toBe(true);
  expect((await repository.detail(recipient, lead.id)).responsibleId).toBe(recipient.userId);
});

it("revokes an active co-advisor and cancels their future commitments without removing history", async () => {
  const owner = await actor(),
    specialist = await actor();
  await approve(owner);
  await approve(specialist);
  let lead = await assignedLead(owner);
  lead = await command(owner, lead, {
    action: "collaboration_propose",
    terms: collaborationTerms(specialist.userId),
  });
  const invitation = lead.collaborations[0]!;
  await repository.respondCollaboration(
    specialist,
    invitation.id,
    { revision: 0, decision: "accept", reason: "Mission acceptée" },
    key(),
  );
  lead = await repository.detail(specialist, lead.id);
  lead = await command(specialist, lead, {
    action: "appointment",
    appointment: {
      advisorId: specialist.userId,
      startsAt: due(),
      durationMinutes: 30,
      mode: "phone",
      location: "Téléphone",
      timezone: "Europe/Zurich",
    },
  });
  const member = (await repository.context(specialist)).application!;
  await repository.review(
    administrator,
    specialist.userId,
    {
      revision: member.revision,
      state: "suspended",
      roles: [],
      reason: "Retrait de l'habilitation",
      reviewDueAt: null,
    },
    key(),
  );
  await expect(repository.detail(specialist, lead.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  lead = await repository.detail(owner, lead.id);
  expect(lead.appointments[0]?.state).toBe("cancelled");
  expect(lead.collaborations[0]?.state).toBe("ended");
  expect((await repository.notifications(specialist, { status: "all" })).items).toHaveLength(0);
  expect(lead.responsibleId).toBe(owner.userId);
});

it("serializes competing transfers and keeps read-only co-advice and declined invitations restricted", async () => {
  const owner = await actor(),
    first = await actor(),
    second = await actor();
  await approve(owner);
  await approve(first);
  await approve(second);
  let lead = await assignedLead(owner);
  lead = await command(owner, lead, {
    action: "collaboration_propose",
    terms: { ...collaborationTerms(first.userId), access: "read" },
  });
  const read = lead.collaborations[0]!;
  await repository.respondCollaboration(
    first,
    read.id,
    { revision: 0, decision: "accept", reason: "Lecture seule acceptée" },
    key(),
  );
  let projection = await repository.detail(first, lead.id);
  expect(projection.canEdit).toBe(false);
  await expect(
    command(first, projection, { action: "note", text: "Interdit", audience: "assigned" }),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  await repository.respondCollaboration(
    first,
    read.id,
    { revision: 1, decision: "end", reason: "Lecture terminée" },
    key(),
  );
  lead = await repository.detail(owner, lead.id);
  lead = await command(owner, lead, {
    action: "collaboration_propose",
    terms: collaborationTerms(first.userId, "transfer"),
  });
  const declined = lead.collaborations.find((c) => c.state === "proposed")!;
  await repository.respondCollaboration(
    first,
    declined.id,
    { revision: 0, decision: "decline", reason: "Indisponible" },
    key(),
  );
  await expect(repository.detail(first, lead.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  lead = await repository.detail(owner, lead.id);
  lead = await command(owner, lead, {
    action: "collaboration_propose",
    terms: collaborationTerms(first.userId, "transfer"),
  });
  lead = await command(owner, lead, {
    action: "collaboration_propose",
    terms: collaborationTerms(second.userId, "transfer"),
  });
  const proposals = lead.collaborations.filter((c) => c.state === "proposed");
  const responses = await Promise.allSettled(
    proposals.map((c) =>
      repository.respondCollaboration(
        c.terms.targetId === first.userId ? first : second,
        c.id,
        { revision: 0, decision: "accept", reason: "Reprise acceptée" },
        key(),
      ),
    ),
  );
  expect(responses.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(responses.filter((r) => r.status === "rejected")).toHaveLength(1);
  projection = await repository.detail(administrator, lead.id);
  expect([first.userId, second.userId]).toContain(projection.responsibleId);
  await expect(repository.detail(owner, lead.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  expect(
    (await repository.collaborations(owner)).items.some(
      (c) => c.state === "accepted" && !c.canOpenLead,
    ),
  ).toBe(true);
  expect(projection.notifiedAt).toBe(lead.notifiedAt);
  expect(projection.firstActionDueAt).toBe(lead.firstActionDueAt);
});

it("delivers assignment atomically, keeps read actions open and rechecks notification access after transfer", async () => {
  await expect(
    database.pool.query(
      "insert into partner_events(id,kind,audience,text) values($1,'lead.continuity_escalated','client','')",
      [key()],
    ),
  ).rejects.toMatchObject({ code: "23514" });
  const responsible = await actor();
  await approve(responsible);
  let lead = await repository.create(administrator, input(), key());
  lead = await command(administrator, lead, {
    action: "assign",
    responsibleId: responsible.userId,
    reason: "Conseil autorisé",
  });
  const inbox = await repository.notifications(responsible, { status: "open" });
  const notification = inbox.items.find((n) => n.leadId === lead.id && n.kind === "assignment")!;
  expect(notification.createdAt).toBe(lead.notifiedAt);
  expect(notification.resolvedAt).toBeNull();
  const readKey = key();
  await repository.readNotification(responsible, notification.id, readKey);
  await repository.readNotification(responsible, notification.id, readKey);
  const read = (await repository.notifications(responsible, { status: "open" })).items.find(
    (n) => n.id === notification.id,
  )!;
  expect(read.readAt).not.toBeNull();
  expect(read.resolvedAt).toBeNull();
  expect(
    (await repository.notifications(neighbor, { status: "all" })).items.some(
      (n) => n.id === notification.id,
    ),
  ).toBe(false);
  await expect(repository.readNotification(neighbor, notification.id, key())).rejects.toMatchObject(
    { code: "PARTNER_NOT_FOUND" },
  );
  const notifiedAt = lead.notifiedAt;
  lead = await command(responsible, lead, { action: "accept" });
  expect(lead.notifiedAt).toBe(notifiedAt);
  expect(
    (await repository.notifications(responsible, { status: "open" })).items.some(
      (n) => n.id === notification.id,
    ),
  ).toBe(false);
  lead = await command(administrator, lead, {
    action: "assign",
    responsibleId: neighbor.userId,
    reason: "Reprise autorisée",
  });
  await expect(
    repository.readNotification(responsible, notification.id, readKey),
  ).rejects.toMatchObject({ code: "PARTNER_NOT_FOUND" });
  expect(
    (await repository.notifications(responsible, { status: "all" })).items.some(
      (n) => n.leadId === lead.id,
    ),
  ).toBe(false);
  const wallet = (await repository.notifications(client, { status: "all" })).items.filter(
    (n) => n.leadId === lead.id,
  );
  expect(wallet.map((n) => n.kind)).toEqual(["lead.assigned", "lead.assigned"]);
  expect(wallet.every((n) => n.action === null)).toBe(true);
});

it("deduplicates reminders, honors waiting and escalates overdue follow-up once without granting a replacement", async () => {
  const responsible = await actor();
  await approve(responsible);
  let lead = await assignedLead(responsible);
  const age = async (hours: number) => {
    await database.pool.query(
      "update partner_leads set notified_at=now()-$2*interval '1 hour',first_action_due_at=now()+(24-$2)*interval '1 hour',acceptance_due_at=now()+(4-$2)*interval '1 hour',continuity_checked_at=null where id=$1",
      [lead.id, hours],
    );
  };
  await age(21);
  await Promise.all([
    processPartnerContinuity(database.pool),
    processPartnerContinuity(database.pool),
  ]);
  let inbox = (await repository.notifications(responsible, { status: "open" })).items.filter(
    (n) => n.leadId === lead.id,
  );
  expect(inbox.filter((n) => n.kind === "first_action_due")).toHaveLength(1);
  lead = await repository.detail(responsible, lead.id);
  const initial = lead.notifiedAt;
  lead = await command(responsible, lead, {
    action: "note",
    audience: "assigned",
    text: "Consultation sans action utile",
  });
  expect(lead.notifiedAt).toBe(initial);
  await age(25);
  await processPartnerContinuity(database.pool);
  lead = await repository.detail(responsible, lead.id);
  expect(lead.responsibleId).toBe(responsible.userId);
  expect(
    (await repository.notifications(administrator, { status: "open" })).items.some(
      (n) => n.leadId === lead.id && n.kind === "first_action_overdue",
    ),
  ).toBe(true);
  lead = await command(responsible, lead, {
    action: "wait",
    waiting: { reason: "Report demandé par le client", until: due() },
  });
  expect(lead.continuityDueAt).toBe(lead.waiting?.until);
  expect(
    new Date(lead.escalationDueAt!).getTime() - new Date(lead.continuityDueAt!).getTime(),
  ).toBe(4 * 3600000);
  await age(40);
  await processPartnerContinuity(database.pool);
  expect((await repository.detail(responsible, lead.id)).responsibleId).toBe(responsible.userId);
  expect(
    (await repository.notifications(responsible, { status: "open" })).items.filter(
      (n) => n.leadId === lead.id,
    ),
  ).toHaveLength(0);
  await database.pool.query(
    "update partner_leads set waiting=jsonb_build_object('reason','Réexamen prévu','until',now()-interval '1 hour'),continuity_checked_at=null where id=$1",
    [lead.id],
  );
  await processPartnerContinuity(database.pool);
  inbox = (await repository.notifications(responsible, { status: "open" })).items.filter(
    (n) => n.leadId === lead.id,
  );
  expect(inbox.some((n) => n.kind === "waiting_review")).toBe(true);
  expect((await repository.detail(responsible, lead.id)).responsibleId).toBe(responsible.userId);
  await database.pool.query(
    "update partner_leads set waiting=jsonb_build_object('reason','Réexamen prévu','until',now()-interval '5 hours'),continuity_checked_at=null where id=$1",
    [lead.id],
  );
  await Promise.all([
    processPartnerContinuity(database.pool),
    processPartnerContinuity(database.pool),
  ]);
  const escalated = await repository.detail(administrator, lead.id);
  expect(escalated.responsibleId).toBeNull();
  expect(escalated.assignment).toBe("coverview");
  expect(escalated.events.filter((e) => e.kind === "lead.continuity_escalated")).toHaveLength(1);
  expect(escalated.events.find((e) => e.kind === "lead.continuity_escalated")?.systemActor).toBe(
    "partner-continuity-v1",
  );
  await database.pool.query("update partner_leads set continuity_checked_at=null where id=$1", [
    lead.id,
  ]);
  await processPartnerContinuity(database.pool);
  expect(
    (await repository.notifications(administrator, { status: "open" })).items.filter(
      (n) => n.leadId === lead.id && n.kind === "coverview_review",
    ),
  ).toHaveLength(1);
  expect(
    (await repository.notifications(client, { status: "all" })).items.filter(
      (n) => n.leadId === lead.id && n.kind === "lead.continuity_escalated",
    ),
  ).toHaveLength(1);
  expect(
    (await repository.notifications(responsible, { status: "all" })).items.filter(
      (n) => n.leadId === lead.id,
    ),
  ).toHaveLength(0);
});

it("continues after a contact and withdraws expired advisor access with future commitments preserved for human recovery", async () => {
  const responsible = await actor();
  await approve(responsible);
  let lead = await assignedLead(responsible);
  lead = await command(responsible, lead, {
    action: "contact",
    outcome: "attempted",
    note: "Client injoignable",
    nextAction: "Rappeler au créneau convenu",
    dueAt: due(),
  });
  await database.pool.query(
    "update partner_leads set due_at=now()-interval '5 hours',continuity_checked_at=null where id=$1",
    [lead.id],
  );
  await processPartnerContinuity(database.pool);
  expect((await repository.detail(administrator, lead.id)).assignment).toBe("coverview");
  let other = await assignedLead(responsible, { ...input(), object: "Deuxième objet" });
  other = await command(responsible, other, {
    action: "appointment",
    appointment: {
      advisorId: responsible.userId,
      startsAt: due(),
      durationMinutes: 30,
      mode: "phone",
      location: "Numéro convenu",
      timezone: "Europe/Zurich",
    },
  });
  await database.pool.query(
    "update partner_members set review_due_at=now()-interval '1 minute' where user_id=$1",
    [responsible.userId],
  );
  expect((await repository.notifications(responsible, { status: "all" })).items).toHaveLength(0);
  await processPartnerContinuity(database.pool);
  const expired = await repository.detail(administrator, other.id);
  expect(expired.responsibleId).toBeNull();
  expect(expired.appointments[0]?.state).toBe("cancelled");
  expect(expired.stage).toBe("appointment_needed");
  expect(expired.events.some((e) => e.kind === "lead.advisor_access_expired")).toBe(true);
});

it("isolates unapproved users, colleagues, referrers and Wallet; preserves independent Leads and idempotency", async () => {
  const unapproved = await actor();
  await expect(repository.list(unapproved, list)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  const createInput = input(),
    idempotencyKey = key();
  const [first, replayed] = await Promise.all([
    repository.create(administrator, createInput, idempotencyKey),
    repository.create(administrator, createInput, idempotencyKey),
  ]);
  expect(replayed.id).toBe(first.id);
  await expect(
    repository.create(administrator, { ...createInput, title: "Autre demande" }, idempotencyKey),
  ).rejects.toMatchObject({ code: "PARTNER_IDEMPOTENCY_REUSED" });
  const second = await repository.create(
    administrator,
    { ...createInput, object: "Véhicule B" },
    key(),
  );
  expect(first.id).not.toBe(second.id);
  const assigned = await repository.command(
    administrator,
    first.id,
    {
      action: "assign",
      revision: first.revision,
      responsibleId: advisor.userId,
      reason: "Adéquation au besoin",
    },
    key(),
  );
  await expect(repository.detail(neighbor, assigned.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  const own = await repository.detail(advisor, assigned.id);
  const note = await repository.command(
    advisor,
    own.id,
    { action: "note", revision: own.revision, text: "Note privée", audience: "private" },
    key(),
  );
  expect(
    (await repository.detail(administrator, note.id)).events.some((e) => e.text === "Note privée"),
  ).toBe(false);
  const wallet = await repository.detail(client, note.id);
  expect(wallet.events.some((e) => e.text === "Note privée")).toBe(false);
  expect(wallet.email).toBeNull();
  expect(wallet.tasks).toEqual([]);
  expect(
    (await repository.list(client, { ...list, clientProfileId: "self" })).items.map((l) => l.id),
  ).toEqual(expect.arrayContaining([first.id, second.id]));
  const referred = await repository.create(referrer, { ...input(), clientUserId: null }, key());
  expect(referred.access).toBe("progress");
  expect(referred.offers).toEqual([]);
  expect(referred.email).toBeNull();
  const draft = await repository.create(
    advisor,
    { ...input(), clientUserId: null, draft: true },
    key(),
  );
  expect(draft.notifiedAt).toBeNull();
  const outside = await repository.create(
    neighbor,
    { ...input(), clientUserId: null, category: "pension" },
    key(),
  );
  expect(outside.responsibleId).toBeNull();
  const ownDraft = await repository.create(
    referrer,
    { ...input(), clientUserId: null, draft: true },
    key(),
  );
  expect(ownDraft.availableTabs).toEqual(["overview"]);
  await expect(
    repository.command(
      referrer,
      ownDraft.id,
      {
        action: "contact",
        revision: ownDraft.revision,
        outcome: "reached",
        note: "Appel",
        nextAction: "Suite",
        dueAt: due(),
      },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  await expect(repository.list(advisor, { ...list, cursor: "bad" })).rejects.toMatchObject({
    statusCode: 400,
  });
});

it("serializes transitions and appointments, keeps the first-action clock, and records a positive resolution without a sale", async () => {
  let lead = await repository.create(administrator, input(), key());
  lead = await repository.command(
    administrator,
    lead.id,
    { action: "assign", revision: lead.revision, responsibleId: advisor.userId, reason: "Mission" },
    key(),
  );
  const notified = lead.notifiedAt;
  lead = await command(advisor, lead, { action: "accept" });
  expect(lead.notifiedAt).toBe(notified);
  expect(lead.firstUsefulAt).toBeNull();
  const edits = await Promise.allSettled([
    repository.command(
      advisor,
      lead.id,
      { action: "note", revision: lead.revision, text: "Un", audience: "assigned" },
      key(),
    ),
    repository.command(
      advisor,
      lead.id,
      { action: "note", revision: lead.revision, text: "Deux", audience: "assigned" },
      key(),
    ),
  ]);
  expect(edits.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  lead = await repository.detail(advisor, lead.id);
  await expect(
    repository.command(
      advisor,
      lead.id,
      { action: "transition", stage: "signed", revision: lead.revision },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  const startsAt = due();
  lead = await repository.command(
    advisor,
    lead.id,
    {
      action: "appointment",
      revision: lead.revision,
      appointment: {
        advisorId: advisor.userId,
        startsAt,
        durationMinutes: 60,
        mode: "phone",
        location: "Numéro convenu",
        timezone: "Europe/Zurich",
      },
    },
    key(),
  );
  expect(lead.appointments).toHaveLength(1);
  expect(lead.firstUsefulAt).not.toBeNull();
  expect(lead.notifiedAt).toBe(notified);
  await expect(
    repository.command(
      advisor,
      lead.id,
      {
        action: "appointment",
        revision: lead.revision,
        appointment: {
          advisorId: advisor.userId,
          startsAt,
          durationMinutes: 30,
          mode: "phone",
          location: "Numéro convenu",
          timezone: "Europe/Zurich",
        },
      },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_APPOINTMENT_CONFLICT" });
  lead = await repository.command(
    advisor,
    lead.id,
    {
      action: "close",
      revision: lead.revision,
      result: "lost",
      reason: "current_suitable",
      comment: "Contrat actuel adapté",
    },
    key(),
  );
  expect(lead.result).toBe("resolved_without_contract");
  expect(lead.stage).toBe("completed");
  expect(lead.appointments[0]?.state).toBe("cancelled");
});

it("rejects publication and selection after the offer source changes without rewriting its reviewed version", async () => {
  const adviser = await actor(),
    owner = { ...(await actor()), wallet: true };
  await approve(adviser);
  let lead = await assignedLead(adviser, { ...input(), clientUserId: owner.userId });
  const documentId = await policyDocument(adviser, null, true);
  const extracted = await repository.extraction(adviser, lead.id, documentId);
  const offer = {
    documentId,
    company: "Compagnie isolée",
    product: "Véhicule isolé",
    reference: "",
    annualPremiumMinor: 120000,
    currency: "CHF" as const,
    validUntil: due(),
    effectiveDate: null,
    features: [],
    summary: "",
    limitations: "",
    replacesId: null,
  };
  await expect(command(adviser, lead, { action: "offer", offer })).rejects.toMatchObject({
    code: "PARTNER_CONFLICT",
  });
  lead = await command(adviser, lead, {
    action: "offer",
    offer: { ...offer, sourceFingerprint: extracted.sourceFingerprint! },
  });
  const offerId = lead.offers[0]!.id;
  lead = await command(adviser, lead, { action: "offer_review", offerId });
  await database.pool.query("update files set generation=generation+1 where id=$1", [documentId]);
  await expect(command(adviser, lead, { action: "offer_publish", offerId })).rejects.toMatchObject({
    code: "PARTNER_CONFLICT",
  });
  const oldReview = lead.offers[0]!.reviewedAt;
  await expect(
    command(adviser, lead, {
      action: "offer",
      offer: { ...offer, replacesId: offerId, sourceFingerprint: extracted.sourceFingerprint! },
    }),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  const fresh = await repository.extraction(adviser, lead.id, documentId);
  lead = await command(adviser, lead, {
    action: "offer",
    offer: { ...offer, replacesId: offerId, sourceFingerprint: fresh.sourceFingerprint! },
  });
  const nextId = lead.offers.find((item) => item.active)!.id;
  expect(lead.offers.find((item) => item.id === offerId)?.reviewedAt).toBe(oldReview);
  await database.pool.query("update files set category_corrected=true where id=$1", [documentId]);
  await expect(
    command(adviser, lead, { action: "offer_review", offerId: nextId }),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  await database.pool.query("update files set category_corrected=false where id=$1", [documentId]);
  lead = await command(adviser, lead, { action: "offer_review", offerId: nextId });
  lead = await command(adviser, lead, { action: "offer_publish", offerId: nextId });
  const snapshot = (
    await database.pool.query<{ source_snapshot: unknown }>(
      "select source_snapshot from partner_offers where id=$1",
      [nextId],
    )
  ).rows[0]!.source_snapshot;
  await database.pool.query("update files set category_corrected=true where id=$1", [documentId]);
  const changed = await repository.detail(owner, lead.id);
  expect(changed.offers[0]).toMatchObject({
    sourceStatus: "changed",
    canCompare: false,
    canChoose: false,
    canDownload: true,
  });
  await expect(
    command(owner, changed, {
      action: "client_choice",
      choice: "select",
      offerId: nextId,
      text: "",
    }),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  expect(await repository.offerSource(owner, lead.id, nextId)).toBe(documentId);
  expect(
    (
      await database.pool.query<{ source_snapshot: unknown }>(
        "select source_snapshot from partner_offers where id=$1",
        [nextId],
      )
    ).rows[0]!.source_snapshot,
  ).toEqual(snapshot);
  await database.pool.query("update files set category_corrected=false where id=$1", [documentId]);
  await database.pool.query(
    `insert into document_field_corrections(id,user_id,document_id,generation,extraction_id,field,value,document_revision,actor)
    select $2,user_id,id,generation,'isolated-number','documentNumber','Version corrigée',1,'isolated-owner' from files where id=$1`,
    [documentId, key()],
  );
  expect((await repository.detail(owner, lead.id)).offers[0]?.sourceStatus).toBe("changed");
  await expect(
    command(owner, lead, { action: "client_choice", choice: "select", offerId: nextId, text: "" }),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  // Additive migration leaves old records unbound; never fabricate their historic source.
  await database.pool.query("update partner_offers set source_snapshot=null where id=$1", [nextId]);
  expect((await repository.detail(owner, lead.id)).offers[0]).toMatchObject({
    sourceStatus: "unbound",
    canChoose: false,
    canCompare: false,
  });
  await expect(
    command(owner, lead, { action: "client_choice", choice: "select", offerId: nextId, text: "" }),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  await database.pool.query("update files set state='quarantined' where id=$1", [documentId]);
  await expect(repository.offerSource(owner, lead.id, nextId)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  await expect(repository.sourceConsulted(owner, lead.id, nextId)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
});

it("keeps paginated published history and exact decisions through replacement, withdrawal, transfer and revocation", async () => {
  const adviser = await actor(),
    owner = { ...(await actor()), wallet: true },
    destination = { ...(await actor()), wallet: true },
    outsider = { ...(await actor()), wallet: true };
  await approve(adviser);
  const profileId = `prf_${key()}`;
  await database.pool.query(
    "insert into managed_profiles(id,user_id,kind,display_name) values($1,$2,'person','Personne isolée')",
    [profileId, owner.userId],
  );
  let lead = await assignedLead(adviser, {
    ...input(),
    clientUserId: owner.userId,
    clientProfileId: profileId,
  });
  const documentId = await policyDocument(owner, profileId);
  const offer = {
    documentId,
    sourceFingerprint: (await repository.extraction(administrator, lead.id, documentId))
      .sourceFingerprint!,
    company: "Compagnie isolée",
    product: "Offre isolée",
    reference: "",
    annualPremiumMinor: 120000,
    currency: "CHF" as const,
    validUntil: due(),
    effectiveDate: null,
    features: [],
    summary: "",
    limitations: "",
    replacesId: null,
  };
  lead = await command(administrator, lead, { action: "offer", offer });
  const first = lead.offers[0]!;
  expect((await repository.offerHistory(owner, lead.id)).items).toEqual([]);
  await expect(repository.offerSource(owner, lead.id, first.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  lead = await command(adviser, lead, { action: "offer_review", offerId: first.id });
  lead = await command(adviser, lead, { action: "offer_publish", offerId: first.id });
  const choice: LeadCommand = {
    action: "client_choice",
    choice: "select",
    offerId: first.id,
    text: "",
    revision: lead.revision,
  };
  const choiceKey = key();
  const choices = await Promise.all([
    repository.command(owner, lead.id, choice, choiceKey),
    repository.command(owner, lead.id, choice, choiceKey),
  ]);
  lead = choices[0];
  expect(lead.events.filter((entry) => entry.kind === "client.select")).toHaveLength(1);
  expect(lead.events.find((entry) => entry.kind === "client.select")?.subjectId).toBe(first.id);
  const replacements = await Promise.allSettled([
    command(adviser, lead, {
      action: "offer",
      offer: { ...offer, replacesId: first.id, annualPremiumMinor: 110000 },
    }),
    command(adviser, lead, {
      action: "offer",
      offer: { ...offer, replacesId: first.id, annualPremiumMinor: 105000 },
    }),
  ]);
  expect(replacements.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  lead = await repository.detail(adviser, lead.id);
  const second = lead.offers.find((entry) => entry.active)!;
  expect(second.updatedSinceViewed).toBe(true);
  expect((await repository.offerHistory(owner, lead.id)).items.map((entry) => entry.id)).toEqual([
    first.id,
  ]);
  await expect(repository.offerSource(owner, lead.id, second.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  expect(await repository.offerSource(owner, lead.id, first.id)).toBe(documentId);
  await expect(
    command(owner, lead, {
      action: "client_choice",
      choice: "select",
      offerId: first.id,
      text: "",
    }),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_TRANSITION" });
  lead = await command(adviser, lead, { action: "offer_review", offerId: second.id });
  lead = await command(adviser, lead, { action: "offer_publish", offerId: second.id });
  lead = await command(adviser, lead, {
    action: "offer_withdraw",
    offerId: second.id,
    reason: "Nouvelle proposition nécessaire",
  });
  const archived = (await repository.offerHistory(owner, lead.id)).items;
  expect(archived).toHaveLength(2);
  expect(
    archived.every((entry) => !entry.canChoose && !entry.canCompare && entry.canDownload),
  ).toBe(true);
  await expect(
    command(owner, lead, {
      action: "client_choice",
      choice: "select",
      offerId: second.id,
      text: "",
    }),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_TRANSITION" });
  await expect(repository.offerHistory(outsider, lead.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  await expect(repository.offerHistory(referrer, lead.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  // More than the main DTO's 100-item bound, in the isolated database only.
  await database.pool.query(
    `insert into partner_offers(id,lead_id,document_id,data,version,family_id,active,state,source_snapshot,reviewed_at,published_at)
    select 'offer_archive_'||$2||'_'||n,lead_id,document_id,data,n+2,family_id,false,'replaced',source_snapshot,reviewed_at,published_at from partner_offers cross join generate_series(1,101) n where id=$1`,
    [first.id, key()],
  );
  const page1 = await repository.offerHistory(owner, lead.id);
  expect(page1.items).toHaveLength(20);
  const items = [...page1.items];
  let cursor = page1.nextCursor;
  for (let page = 0; page < 5; page++) {
    const next = await repository.offerHistory(owner, lead.id, cursor!);
    expect(next.items).toHaveLength(page === 4 ? 3 : 20);
    items.push(...next.items);
    cursor = next.nextCursor;
  }
  expect(cursor).toBeNull();
  expect(new Set(items.map((entry) => entry.id)).size).toBe(103);
  expect(
    (await repository.detail(owner, lead.id)).offers.some((offer) => offer.id === first.id),
  ).toBe(false);
  expect(await repository.offerSource(owner, lead.id, first.id)).toBe(documentId);
  await repository.sourceConsulted(owner, lead.id, first.id);
  const foreignLead = await assignedLead(adviser, { ...input(), clientUserId: owner.userId });
  await expect(
    repository.offerHistory(owner, foreignLead.id, page1.nextCursor!),
  ).rejects.toMatchObject({ code: "PARTNER_NOT_FOUND" });
  await createAdminProfileTransferRepository(database.db).transfer(
    { id: administrator.id, userId: owner.userId, administratorUserId: administrator.userId },
    profileId,
    { destinationUserId: destination.userId, revision: 0 },
    key(),
  );
  expect(
    (await repository.offerHistory(destination, lead.id)).items.every(
      (entry) => entry.sourceStatus === "current",
    ),
  ).toBe(true);
  expect(await repository.offerSource(destination, lead.id, first.id)).toBe(documentId);
  await expect(repository.offerSource(owner, lead.id, first.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  await expect(repository.command(owner, lead.id, choice, choiceKey)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
    destination.id,
  ]);
  await expect(repository.offerHistory(destination, lead.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await expect(repository.offerSource(destination, lead.id, first.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
});

it("publishes only reviewed sources, invalidates replaced offers and removes operational rights after role withdrawal", async () => {
  let lead = await repository.create(administrator, input(), key());
  const documentId = `doc_${key()}`;
  await database.pool.query(
    "insert into files(id,user_id,name,mime,declared_mime,size,checksum,object_key,state,category,purpose,scan_version) values($1,$2,'Source isolée.pdf','application/pdf','application/pdf',10,$3,$4,'ready','insurance','lead_offer','isolated-scan')",
    [documentId, administrator.userId, "a".repeat(64), key()],
  );
  const offer = {
    documentId,
    sourceFingerprint: (await repository.extraction(administrator, lead.id, documentId))
      .sourceFingerprint!,
    company: "Compagnie isolée",
    product: "Véhicule",
    reference: "Recette",
    annualPremiumMinor: 123450,
    currency: "CHF" as const,
    validUntil: due(),
    effectiveDate: null,
    features: [],
    summary: "Données isolées pour contrôle des droits",
    limitations: "Aucune offre réelle",
    replacesId: null,
  };
  lead = await repository.command(
    administrator,
    lead.id,
    { action: "offer", revision: lead.revision, offer },
    key(),
  );
  const offerId = lead.offers[0]!.id;
  expect((await repository.detail(client, lead.id)).offers).toEqual([]);
  await expect(
    repository.command(
      administrator,
      lead.id,
      { action: "offer_publish", revision: lead.revision, offerId },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_OFFER_NOT_READY" });
  lead = await repository.command(
    administrator,
    lead.id,
    { action: "offer_review", revision: lead.revision, offerId },
    key(),
  );
  lead = await repository.command(
    administrator,
    lead.id,
    { action: "offer_publish", revision: lead.revision, offerId },
    key(),
  );
  expect((await repository.detail(client, lead.id)).offers).toHaveLength(1);
  await repository.sourceConsulted(client, lead.id, offerId);
  await repository.sourceConsulted(client, lead.id, offerId);
  expect(
    (await repository.detail(administrator, lead.id)).events.filter(
      (value) => value.kind === "document.viewed",
    ),
  ).toHaveLength(1);
  await expect(repository.sourceConsulted(neighbor, lead.id, offerId)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  lead = await repository.command(
    client,
    lead.id,
    { action: "client_choice", revision: lead.revision, choice: "select", offerId, text: "" },
    key(),
  );
  expect(lead.stage).toBe("client_decision");
  lead = await repository.command(
    administrator,
    lead.id,
    {
      action: "offer",
      revision: lead.revision,
      offer: { ...offer, replacesId: offerId, annualPremiumMinor: 123000 },
    },
    key(),
  );
  await expect(
    repository.command(
      client,
      lead.id,
      { action: "client_choice", revision: lead.revision, choice: "select", offerId, text: "" },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_TRANSITION" });
  expect((await repository.detail(client, lead.id)).offers[0]?.active).toBe(false);
  expect(lead.offers.map((o) => o.version).sort()).toEqual([1, 2]);
  const retained = await database.pool.query<{ retained_at: Date }>(
    "select retained_at from files where id=$1",
    [documentId],
  );
  expect(retained.rows[0]?.retained_at).toBeInstanceOf(Date);
  lead = await repository.command(
    administrator,
    lead.id,
    {
      action: "assign",
      revision: lead.revision,
      responsibleId: advisor.userId,
      reason: "Reprise du suivi",
    },
    key(),
  );
  const current = lead.offers.find((value) => value.active)!;
  lead = await repository.command(
    advisor,
    lead.id,
    { action: "offer", revision: lead.revision, offer: { ...offer, replacesId: current.id } },
    key(),
  );
  expect(lead.offers).toHaveLength(3);
  lead = await repository.command(
    advisor,
    lead.id,
    {
      action: "appointment",
      revision: lead.revision,
      appointment: {
        advisorId: advisor.userId,
        startsAt: due(),
        durationMinutes: 30,
        mode: "phone",
        location: "Numéro convenu",
        timezone: "Europe/Zurich",
      },
    },
    key(),
  );
  lead = await repository.command(
    advisor,
    lead.id,
    {
      action: "task",
      revision: lead.revision,
      task: {
        title: "Préparer le rendez-vous",
        description: "",
        responsibleId: advisor.userId,
        dueAt: due(),
        reminderAt: null,
        priority: "normal",
      },
    },
    key(),
  );
  const application = (await repository.context(advisor)).application!;
  await repository.review(
    administrator,
    advisor.userId,
    {
      revision: application.revision,
      state: "approved",
      roles: ["referrer"],
      reason: "Retrait de l’activité de conseil",
      reviewDueAt: null,
    },
    key(),
  );
  await expect(repository.detail(advisor, lead.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  const updated = await repository.detail(administrator, lead.id);
  expect(updated.responsibleId).toBeNull();
  expect(updated.offers).toHaveLength(3);
  expect(updated.assignment).toBe("reassign");
  expect(updated.appointments[0]?.state).toBe("cancelled");
  expect(updated.stage).toBe("appointment_needed");
  const resumed = await repository.command(
    administrator,
    updated.id,
    {
      action: "assign",
      revision: updated.revision,
      responsibleId: neighbor.userId,
      reason: "Nouvelle prise en charge",
    },
    key(),
  );
  expect(resumed.tasks[0]?.responsibleId).toBe(neighbor.userId);
});

it("versions Admin continuity settings with MFA, concurrent revisions and immutable notified deadlines", async () => {
  const responsible = await actor();
  await approve(responsible);
  let lead = await assignedLead(responsible);
  const initial = await repository.continuitySettings(administrator);
  await expect(
    database.pool.query(
      "insert into partner_continuity_policies(revision,policy,changed_by,reason) values($1,$2,$3,$4)",
      [
        initial.current.revision + 1,
        JSON.stringify({ acceptanceHours: null, calendar: {} }),
        administrator.userId,
        "Structure invalide isolée",
      ],
    ),
  ).rejects.toMatchObject({ code: "23514" });
  const input = partnerContinuityUpdateSchema.parse({
    revision: initial.current.revision,
    policy: { ...defaultContinuityPolicy, acceptanceHours: 2 },
    reason: "Organisation du suivi en recette isolée",
  });
  await expect(repository.continuitySettings(responsible)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await expect(
    repository.updateContinuitySettings(responsible, input, key()),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  const otherAdmin = await actor(true);
  await database.pool.query("update identity_sessions set mfa_verified_at=null where id=$1", [
    otherAdmin.id,
  ]);
  await expect(repository.updateContinuitySettings(otherAdmin, input, key())).rejects.toMatchObject(
    { code: "PARTNER_ACCESS_DENIED" },
  );
  await database.pool.query("update identity_sessions set mfa_verified_at=now() where id=$1", [
    otherAdmin.id,
  ]);
  const firstKey = key(),
    otherKey = key();
  const results = await Promise.allSettled([
    repository.updateContinuitySettings(administrator, input, firstKey),
    repository.updateContinuitySettings(otherAdmin, input, otherKey),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((r) => r.status === "rejected")[0]).toMatchObject({
    reason: { code: "PARTNER_CONFLICT" },
  });
  const winner = results[0].status === "fulfilled" ? administrator : otherAdmin;
  const winnerKey = winner === administrator ? firstKey : otherKey;
  const after = await repository.updateContinuitySettings(winner, input, winnerKey);
  expect(after.history).toHaveLength(initial.history.length + 1);
  expect(after.current.policy.acceptanceHours).toBe(2);
  expect(after.history[0]?.changedBy).toBe(winner.userId);
  const unchanged = await repository.detail(responsible, lead.id);
  expect(unchanged.firstActionDueAt).toBe(lead.firstActionDueAt);
  expect(unchanged.notifiedAt).toBe(lead.notifiedAt);
  const replacement = await actor();
  await approve(replacement);
  lead = await command(administrator, lead, {
    action: "assign",
    responsibleId: replacement.userId,
    reason: "Nouvelle attribution explicite",
  });
  expect(lead.continuityPolicyRevision).toBe(after.current.revision);
  expect(new Date(lead.acceptanceDueAt!).getTime() - new Date(lead.notifiedAt!).getTime()).toBe(
    2 * 3600000,
  );
  const frozenDeadline = lead.firstActionDueAt;
  lead = await command(replacement, lead, { action: "accept" });
  expect(lead.firstActionDueAt).toBe(frozenDeadline);
  expect(lead.acceptanceDueAt).toBeNull();
  await repository.updateContinuitySettings(
    administrator,
    {
      revision: after.current.revision,
      policy: defaultContinuityPolicy,
      reason: "Restaurer les règles initiales",
    },
    key(),
  );
  await expect(
    repository.updateContinuitySettings({ ...responsible, administrator: true }, input, winnerKey),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
});

it("alerts unaccepted attribution without moving first action or granting a replacement", async () => {
  const responsible = await actor();
  await approve(responsible);
  let lead = await repository.create(administrator, input(), key());
  lead = await command(administrator, lead, {
    action: "assign",
    responsibleId: responsible.userId,
    reason: "Prise en charge à accepter",
  });
  await database.pool.query(
    "update partner_leads set notified_at=now()-interval '5 hours',acceptance_due_at=now()-interval '1 hour',first_action_due_at=now()+interval '19 hours',continuity_checked_at=null where id=$1",
    [lead.id],
  );
  await processPartnerContinuity(database.pool);
  lead = await repository.detail(responsible, lead.id);
  expect(lead.alerts).toContain("acceptance_overdue");
  expect(
    (await repository.list(responsible, leadListQuerySchema.parse({ view: "overdue" }))).items.some(
      (item) => item.id === lead.id,
    ),
  ).toBe(true);
  expect((await repository.dashboard(responsible)).overdue).toBe(1);
  expect(lead.responsibleId).toBe(responsible.userId);
  expect(
    (await repository.notifications(responsible, { status: "open" })).items.some(
      (n) => n.leadId === lead.id && n.kind === "acceptance_overdue",
    ),
  ).toBe(true);
  const first = lead.firstActionDueAt;
  lead = await command(responsible, lead, { action: "accept" });
  expect(lead.firstActionDueAt).toBe(first);
  expect((await repository.dashboard(responsible)).overdue).toBe(0);
  expect(
    (await repository.notifications(responsible, { status: "open" })).items.some(
      (n) => n.leadId === lead.id && n.kind === "acceptance_overdue",
    ),
  ).toBe(false);
  expect(
    (await repository.notifications(administrator, { status: "open" })).items.some(
      (n) => n.leadId === lead.id && n.kind === "acceptance_overdue",
    ),
  ).toBe(false);
});

it("defers elapsed-hours deadlines through weekends, closures and Zurich DST with a finite cap", () => {
  const policy = {
    ...defaultContinuityPolicy,
    calendar: { ...defaultContinuityPolicy.calendar, enabled: true },
  };
  const spring = attributionDeadlines(new Date("2026-03-27T16:00:00Z"), policy);
  expect(spring.firstActionDueAt.toISOString()).toBe("2026-03-30T07:00:00.000Z");
  expect(spring.acceptanceDueAt.toISOString()).toBe("2026-03-30T07:00:00.000Z");
  const autumn = attributionDeadlines(new Date("2026-10-23T16:00:00Z"), policy);
  expect(autumn.firstActionDueAt.toISOString()).toBe("2026-10-26T08:00:00.000Z");
  const closed = attributionDeadlines(new Date("2026-10-23T16:00:00Z"), {
    ...policy,
    calendar: { ...policy.calendar, closedDates: ["2026-10-26"] },
  });
  expect(closed.firstActionDueAt.toISOString()).toBe("2026-10-27T08:00:00.000Z");
  const elapsed = attributionDeadlines(new Date("2026-03-28T16:00:00Z"), defaultContinuityPolicy);
  expect(elapsed.firstActionDueAt.toISOString()).toBe("2026-03-29T16:00:00.000Z");
  const capped = attributionDeadlines(new Date("2026-10-23T16:00:00Z"), {
    ...policy,
    calendar: {
      ...policy.calendar,
      closedDates: ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"],
    },
  });
  expect(capped.firstActionDueAt.toISOString()).toBe("2026-10-31T16:00:00.000Z");
  expect(capped.acceptanceDueAt.getTime()).toBeLessThanOrEqual(capped.firstActionDueAt.getTime());
});
