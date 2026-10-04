import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { beforeAll, afterAll, expect, it } from "vitest";
import {
  leadCreateInputSchema,
  partnerApplicationInputSchema,
  leadOfferInputSchema,
  finalPolicyFields,
} from "@coverview/contracts/partner";
import { createDatabase } from "./db/database.js";
import { createAdminProfileTransferRepository } from "./admin-profile-transfer.repository.js";
import { createPartnerRepository } from "../modules/partner-workspace/partner.repository.js";
import { conclusionClosureReady } from "../modules/partner-workspace/partner.conclusion-evidence.js";
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
    .withDatabase("coverview_conclusion_test")
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

it("reports native receipts with distinct signature, published-version and Lead grains under current rights", async () => {
  const s = await setup(),
    prepared = await repository.prepareConclusion(s.advisor, s.lead.id, s.prepare, key());
  const query = { from: at(-86400000), to: at(86400000), scope: "self" };
  const before = await repository.pilotage(s.advisor, query);
  expect(before.measures.find((m) => m.metric === "verified_signatures")).toMatchObject({
    value: 0,
    status: "available",
  });
  const signed = await repository.signConclusion(
    s.owner,
    prepared.id,
    signature(prepared.contentHash),
    key(),
  );
  const report = await repository.pilotage(s.advisor, query),
    metric = (name: string) => report.measures.find((m) => m.metric === name);
  expect(metric("verified_signatures")).toMatchObject({
    value: 1,
    population: 1,
    status: "available",
  });
  expect(metric("offer_signature_rate")).toMatchObject({
    value: 100,
    numerator: 1,
    denominator: 1,
  });
  expect(metric("transformation_rate")).toMatchObject({ value: 100, numerator: 1, denominator: 1 });
  expect(metric("first_signature_days")!.value).toBeGreaterThanOrEqual(0);
  const sources = await repository.pilotageSources(s.advisor, {
    ...query,
    metric: "verified_signatures",
  });
  expect(sources.items.map((i) => i.sourceId)).toEqual([signed.receipt!.id]);
  const outsider = await professional();
  expect(
    (await repository.pilotageSources(outsider, { ...query, metric: "verified_signatures" })).items,
  ).toHaveLength(0);
  await database.pool.query("update files set generation=generation+1 where id=$1", [s.documentId]);
  expect(
    (await repository.pilotage(s.advisor, query)).measures.find(
      (m) => m.metric === "verified_signatures",
    )?.value,
  ).toBe(0);
});

const note =
  "Signature tracée autorisée uniquement dans ce test isolé. Prime mensuelle : CHF 100. Acceptation et émission isolées.";
const at = (ms = 0) => new Date(Date.now() + ms).toISOString();
it("groups exact accessible subjects without joining names, granting access, or changing independent cycles", async () => {
  const owner = { ...(await actor()), wallet: true },
    advisor = await professional(),
    otherAdvisor = await professional();
  const a = await assigned(owner, advisor),
    b = await assigned(owner, advisor),
    hidden = await assigned(owner, otherAdvisor),
    different = await assigned({ ...(await actor()), wallet: true }, advisor);
  const candidates = await repository.leadRelationshipCandidates(advisor, a.id);
  expect(candidates.items.map((i) => i.lead.id)).toEqual([b.id]);
  expect(candidates.items.some((i) => i.lead.id === different.id || i.lead.id === hidden.id)).toBe(
    false,
  );
  const input = {
      action: "link" as const,
      sourceRevision: a.revision,
      targetRevision: b.revision,
      targetLeadId: b.id,
      kind: "related" as const,
      reason: note,
      confirmed: true as const,
      cancelOpenWork: false,
    },
    replay = key();
  await expect(repository.changeLeadRelationship(owner, a.id, input, key())).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  const linked = await repository.changeLeadRelationship(advisor, a.id, input, replay),
    item = linked.items[0]!;
  expect(item.source.stage).toBe(a.stage);
  expect(item.target.stage).toBe(b.stage);
  expect((await repository.leadRelationships(owner, b.id)).items[0]?.id).toBe(item.id);
  expect((await repository.changeLeadRelationship(advisor, a.id, input, replay)).items[0]?.id).toBe(
    item.id,
  );
  await expect(
    repository.changeLeadRelationship(
      advisor,
      a.id,
      {
        ...input,
        targetLeadId: different.id,
        targetRevision: different.revision,
        sourceRevision: item.source.revision,
      },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_CLIENT" });
  await expect(
    repository.changeLeadRelationship(
      advisor,
      a.id,
      {
        ...input,
        targetLeadId: hidden.id,
        targetRevision: hidden.revision,
        sourceRevision: item.source.revision,
      },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_NOT_FOUND" });
  const removed = await repository.changeLeadRelationship(
    advisor,
    b.id,
    {
      action: "withdraw",
      id: item.id,
      sourceRevision: item.source.revision,
      targetRevision: item.target.revision,
      reason: note,
    },
    key(),
  );
  expect(removed.items[0]?.active).toBe(false);
  expect((await repository.detail(advisor, a.id)).stage).toBe(a.stage);
  await expect(
    database.pool.query(
      "update partner_lead_relationships set withdrawn_at=null,withdrawn_by=null,withdrawal_reason=null where id=$1",
      [item.id],
    ),
  ).rejects.toMatchObject({ code: "23514" });
});
it("merges a confirmed duplicate without deleting its evidence and undoes it only with an atomic archived reopening", async () => {
  const s = await setup(),
    main = await assigned(s.owner, s.advisor);
  let duplicate = await repository.detail(s.advisor, s.lead.id);
  duplicate = await repository.command(
    s.advisor,
    duplicate.id,
    {
      action: "task",
      revision: duplicate.revision,
      task: {
        title: "Travail doublon",
        description: "",
        responsibleId: s.advisor.userId,
        dueAt: at(86400000),
        priority: "normal",
        reminderAt: null,
      },
    },
    key(),
  );
  const before = (
    await database.pool.query<{ offers: number; events: number }>(
      `select (select count(*)::int from partner_offers where lead_id=$1) offers,(select count(*)::int from partner_events where lead_id=$1) events`,
      [duplicate.id],
    )
  ).rows[0]!;
  const merged = await repository.changeLeadRelationship(
    s.advisor,
    duplicate.id,
    {
      action: "link",
      sourceRevision: duplicate.revision,
      targetRevision: main.revision,
      targetLeadId: main.id,
      kind: "duplicate",
      reason: note,
      confirmed: true,
      cancelOpenWork: true,
    },
    key(),
  );
  const item = merged.items[0]!;
  expect(item.source.stage).toBe("completed");
  expect(item.source.result).toBe("duplicate");
  expect((await repository.detail(s.advisor, duplicate.id)).tasks[0]?.state).toBe("cancelled");
  expect(item.target.stage).toBe(main.stage);
  expect(
    (await database.pool.query("select id from partner_offers where lead_id=$1", [duplicate.id]))
      .rowCount,
  ).toBe(before.offers);
  expect(
    (await database.pool.query("select id from partner_events where lead_id=$1", [duplicate.id]))
      .rowCount,
  ).toBeGreaterThan(before.events);
  await expect(
    repository.command(
      s.advisor,
      duplicate.id,
      {
        action: "reopen",
        revision: item.source.revision,
        reason: note,
        nextAction: "Nouvelle qualification",
        dueAt: at(86400000),
      },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  const withdraw = {
    action: "withdraw" as const,
    id: item.id,
    sourceRevision: item.source.revision,
    targetRevision: item.target.revision,
    reason: note,
  };
  await expect(
    repository.changeLeadRelationship(s.advisor, duplicate.id, withdraw, key()),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  expect((await repository.leadRelationships(s.advisor, duplicate.id)).items[0]?.active).toBe(true);
  const undone = await repository.changeLeadRelationship(
    s.advisor,
    duplicate.id,
    { ...withdraw, nextAction: "Requalifier séparément", dueAt: at(86400000) },
    key(),
  );
  expect(undone.items[0]?.active).toBe(false);
  expect(undone.items[0]?.source.stage).toBe("qualifying");
  expect((await repository.leadReopenings(s.owner, duplicate.id)).items[0]?.closedResult).toBe(
    "duplicate",
  );
  expect((await repository.detail(s.advisor, duplicate.id)).tasks[0]?.state).toBe("cancelled");
});
it("rejects merging signed requests and serializes reciprocal links without a cycle", async () => {
  const s = await setup(),
    main = await assigned(s.owner, s.advisor),
    prepared = await repository.prepareConclusion(s.advisor, s.lead.id, s.prepare, key());
  await repository.signConclusion(s.owner, prepared.id, signature(prepared.contentHash), key());
  const source = await repository.detail(s.advisor, s.lead.id);
  const status = await repository.leadRelationships(s.advisor, source.id);
  expect(status.assessment.canMerge).toBe(false);
  expect(status.assessment.blockers).toContain("signature");
  await expect(
    repository.changeLeadRelationship(
      s.advisor,
      source.id,
      {
        action: "link",
        sourceRevision: source.revision,
        targetRevision: main.revision,
        targetLeadId: main.id,
        kind: "duplicate",
        reason: note,
        confirmed: true,
        cancelOpenWork: true,
      },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  const a = await assigned(s.owner, s.advisor),
    b = await assigned(s.owner, s.advisor),
    base = {
      action: "link" as const,
      kind: "related" as const,
      reason: note,
      confirmed: true as const,
      cancelOpenWork: false,
    };
  const results = await Promise.allSettled([
    repository.changeLeadRelationship(
      s.advisor,
      a.id,
      { ...base, sourceRevision: a.revision, targetRevision: b.revision, targetLeadId: b.id },
      key(),
    ),
    repository.changeLeadRelationship(
      s.advisor,
      b.id,
      { ...base, sourceRevision: b.revision, targetRevision: a.revision, targetLeadId: a.id },
      key(),
    ),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(
    (await repository.leadRelationships(s.advisor, a.id)).items.filter((i) => i.active),
  ).toHaveLength(1);
});
it("reopens under current authority with immutable closure history and without reviving cancelled work or resetting clocks", async () => {
  const owner = { ...(await actor()), wallet: true },
    advisor = await professional();
  let lead = await assigned(owner, advisor);
  lead = await repository.command(
    advisor,
    lead.id,
    {
      action: "task",
      revision: lead.revision,
      task: {
        title: "Tâche isolée",
        description: "",
        responsibleId: advisor.userId,
        dueAt: at(86400000),
        priority: "normal",
        reminderAt: null,
      },
    },
    key(),
  );
  lead = await repository.command(
    advisor,
    lead.id,
    {
      action: "appointment",
      revision: lead.revision,
      appointment: {
        advisorId: advisor.userId,
        startsAt: at(86400000),
        durationMinutes: 30,
        mode: "phone",
        location: "Test",
        timezone: "Europe/Zurich",
      },
    },
    key(),
  );
  lead = await repository.command(
    advisor,
    lead.id,
    {
      action: "close",
      revision: lead.revision,
      result: "resolved_without_contract",
      reason: "current_suitable",
      comment: note,
    },
    key(),
  );
  const closedAt = lead.stageChangedAt;
  const clocks = async () =>
    (
      await database.pool.query<Record<string, unknown>>(
        `select responsible_id,assignment,notification_cycle,notified_at,first_useful_at,acceptance_due_at,first_action_due_at from partner_leads where id=$1`,
        [lead.id],
      )
    ).rows[0];
  const before = await clocks(),
    input = {
      action: "reopen" as const,
      revision: lead.revision,
      reason: note,
      nextAction: "Réexaminer la situation",
      dueAt: at(86400000),
    },
    replay = key();
  await expect(repository.command(owner, lead.id, input, key())).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await expect(
    repository.command(await professional(), lead.id, input, key()),
  ).rejects.toMatchObject({ code: "PARTNER_NOT_FOUND" });
  await expect(
    repository.command(advisor, lead.id, { ...input, dueAt: at(-1000) }, key()),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  await expect(
    database.pool.query(
      "update partner_leads set stage='qualifying',result=null,reason=null where id=$1",
      [lead.id],
    ),
  ).rejects.toMatchObject({ code: "23514" });
  lead = await repository.command(advisor, lead.id, input, replay);
  expect(lead.stage).toBe("qualifying");
  expect(lead.result).toBeNull();
  expect(lead.reason).toBeNull();
  expect(lead.nextAction).toBe(input.nextAction);
  expect(lead.tasks[0]?.state).toBe("cancelled");
  expect(lead.appointments[0]?.state).toBe("cancelled");
  expect(await clocks()).toEqual(before);
  expect((await repository.command(advisor, lead.id, input, replay)).revision).toBe(lead.revision);
  const history = await repository.leadReopenings(owner, lead.id);
  expect(history.items).toHaveLength(1);
  expect(history.items[0]).toMatchObject({
    closedAt,
    closedResult: "resolved_without_contract",
    closedReason: "current_suitable",
    reason: note,
    nextAction: input.nextAction,
  });
  await expect(
    database.pool.query("update partner_lead_reopenings set reason='Autre motif' where id=$1", [
      history.items[0]!.id,
    ]),
  ).rejects.toMatchObject({ code: "23514" });
  lead = await repository.command(
    advisor,
    lead.id,
    {
      action: "close",
      revision: lead.revision,
      result: "cancelled",
      reason: "postponed",
      comment: note,
    },
    key(),
  );
  const concurrent = await Promise.allSettled([
    repository.command(advisor, lead.id, { ...input, revision: lead.revision }, key()),
    repository.command(advisor, lead.id, { ...input, revision: lead.revision }, key()),
  ]);
  expect(concurrent.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect((await repository.leadReopenings(advisor, lead.id)).items).toHaveLength(2);
  expect(
    (await database.pool.query("select id from partner_surveys where lead_id=$1", [lead.id]))
      .rowCount,
  ).toBe(1);
  await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
    advisor.id,
  ]);
  await expect(repository.command(advisor, lead.id, input, replay)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
});
async function setup(profileId: string | null = null, providedOwner?: PartnerActor) {
  const owner = providedOwner ?? { ...(await actor()), wallet: true },
    advisor = await professional();
  let lead = await assigned(owner, advisor, profileId);
  const documentId = `doc_${key()}`;
  await database.pool.query(
    `insert into files(id,user_id,name,mime,declared_mime,size,checksum,object_key,state,category,purpose,scan_version,analysis)
    values($1,$2,'Offre isolée.pdf','application/pdf','application/pdf',10,$3,$4,'ready','insurance','lead_offer','isolated-scan',$5)`,
    [
      documentId,
      advisor.userId,
      createHash("sha256").update(documentId).digest("hex"),
      key(),
      JSON.stringify({
        category: "insurance",
        evidence: null,
        fields: [],
        pages: [{ page: 1, text: note, method: "isolated", version: "test" }],
      }),
    ],
  );
  const input = leadOfferInputSchema.parse({
    documentId,
    sourceFingerprint: (await repository.extraction(advisor, lead.id, documentId))
      .sourceFingerprint,
    company: "Compagnie de test",
    product: "Véhicule isolé",
    reference: "Test",
    annualPremiumMinor: 120000,
    currency: "CHF",
    validUntil: at(86400000),
    effectiveDate: null,
    features: [],
    summary: "",
    limitations: "Test",
    replacesId: null,
  });
  lead = await repository.command(
    advisor,
    lead.id,
    { action: "offer", revision: lead.revision, offer: input },
    key(),
  );
  const offerId = lead.offers[0]!.id;
  for (const action of ["offer_review", "offer_publish"] as const)
    lead = await repository.command(
      advisor,
      lead.id,
      { action, offerId, revision: lead.revision },
      key(),
    );
  lead = await repository.command(
    owner,
    lead.id,
    { action: "client_choice", choice: "select", offerId, text: "", revision: lead.revision },
    key(),
  );
  const prepare = {
    leadRevision: lead.revision,
    offerId,
    sourceFingerprint: input.sourceFingerprint!,
    validUntil: at(3600000),
    procedure: { page: 1, quote: note },
    explanation: note,
    reviewedApplicability: true as const,
  };
  return { owner, advisor, lead, offerId, documentId, prepare };
}
const signature = (contentHash: string, representative = false) => ({
  contentHash,
  signerName: "Personne isolée",
  place: "Genève",
  representative,
  originalRead: true as const,
  accepted: true as const,
  drawing: [
    [
      [0.1, 0.2],
      [0.3, 0.7],
      [0.8, 0.5],
    ],
  ] as [number, number][][],
});
async function correspondence(
  owner: PartnerActor,
  leadId: string,
  profileId: string | null = null,
) {
  const documentId = `doc_${key()}`;
  await database.pool.query(
    `insert into files(id,user_id,managed_profile_id,name,mime,declared_mime,size,checksum,object_key,state,category,scan_version,analysis)
    values($1,$2,$3,'Lettre isolée.pdf','application/pdf','application/pdf',10,$4,$5,'ready','correspondence','isolated-scan',$6)`,
    [
      documentId,
      owner.userId,
      profileId,
      createHash("sha256").update(documentId).digest("hex"),
      key(),
      JSON.stringify({
        category: "correspondence",
        evidence: null,
        fields: [],
        pages: [{ page: 1, text: note, method: "isolated", version: "test" }],
      }),
    ],
  );
  const candidate = (await repository.conclusionCandidates(owner, leadId)).items.find(
    (c) => c.documentId === documentId,
  )!;
  const sharing = {
    action: "share" as const,
    leadRevision: (await repository.detail(owner, leadId)).revision,
    documentId,
    fingerprint: candidate.fingerprint,
    consent: true as const,
  };
  const shared = await repository.shareConclusionCorrespondence(owner, leadId, sharing, key());
  return { documentId, candidate, item: shared.items.find((i) => i.documentId === documentId)! };
}
it("uses explicitly shared correspondence for refusal and corrects facts without erasing their signature or dependent history", async () => {
  const s = await setup(),
    prepared = await repository.prepareConclusion(s.advisor, s.lead.id, s.prepare, key());
  const signed = await repository.signConclusion(
    s.owner,
    prepared.id,
    signature(prepared.contentHash),
    key(),
  );
  const trans = await repository.actConclusion(
    s.advisor,
    prepared.id,
    {
      action: "transmitted",
      revision: 0,
      occurredAt: at(),
      reference: note,
      reason: note,
      verified: true,
    },
    key(),
  );
  const letter = await correspondence(s.owner, s.lead.id);
  expect(
    (await repository.contractCandidates(s.owner, s.lead.id)).items.some(
      (p) => p.documentId === letter.documentId,
    ),
  ).toBe(false);
  expect(
    await repository.conclusionCorrespondenceSource(s.advisor, s.lead.id, letter.item.id, true),
  ).toBe(letter.documentId);
  await expect(repository.conclusionCandidates(s.advisor, s.lead.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  const decision = {
    correspondenceId: letter.item.id,
    fingerprint: letter.candidate.fingerprint,
    source: { page: 1, quote: note },
    occurredAt: at(),
    reason: note,
    verified: true as const,
  };
  const refused = await repository.actConclusion(
    s.advisor,
    prepared.id,
    { ...decision, action: "declined", revision: 1 },
    key(),
  );
  expect(refused.state).toBe("declined");
  const correction = {
      action: "correct" as const,
      revision: 2,
      targetActionId: trans.actions[0]!.id,
      reason: note,
      verified: true as const,
    },
    retry = key();
  await expect(
    repository.actConclusion(s.owner, prepared.id, correction, key()),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  const corrected = await repository.actConclusion(s.advisor, prepared.id, correction, retry);
  expect(corrected.state).toBe("signed");
  expect(corrected.receipt?.id).toBe(signed.receipt?.id);
  expect(corrected.actions.filter((a) => a.superseded)).toHaveLength(2);
  expect((await repository.actConclusion(s.advisor, prepared.id, correction, retry)).revision).toBe(
    3,
  );
  await expect(
    repository.actConclusion(s.advisor, prepared.id, { ...correction, revision: 3 }, key()),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_TRANSITION" });
  const next = await repository.actConclusion(
    s.advisor,
    prepared.id,
    {
      action: "transmitted",
      revision: 3,
      occurredAt: at(),
      reference: note,
      reason: note,
      verified: true,
    },
    key(),
  );
  expect(next.state).toBe("transmitted");
  expect(
    (await repository.notifications(s.advisor, { status: "open" })).items.filter(
      (n) => n.kind === "conclusion.transmitted.v1",
    ),
  ).toHaveLength(1);
  const accepted = await repository.actConclusion(
    s.advisor,
    prepared.id,
    { ...decision, occurredAt: at(), action: "accepted", revision: 4 },
    key(),
  );
  expect(accepted.insurerEvidence).toBe("documented");
  await repository.shareConclusionCorrespondence(
    s.owner,
    s.lead.id,
    {
      action: "withdraw",
      leadRevision: (await repository.detail(s.owner, s.lead.id)).revision,
      id: letter.item.id,
      reason: note,
    },
    key(),
  );
  await expect(
    repository.conclusionCorrespondenceSource(s.advisor, s.lead.id, letter.item.id),
  ).rejects.toMatchObject({ code: "PARTNER_NOT_FOUND" });
  const unavailable = await repository.conclusion(s.advisor, prepared.id);
  expect(unavailable.state).toBe("review_required");
  expect(unavailable.actions.at(-1)?.input).toBeNull();
  expect(unavailable.actions.at(-1)?.canCorrect).toBe(true);
  const repaired = await repository.actConclusion(
    s.advisor,
    prepared.id,
    {
      action: "correct",
      revision: 5,
      targetActionId: accepted.actions.at(-1)!.id,
      reason: note,
      verified: true,
    },
    key(),
  );
  expect(repaired.state).toBe("transmitted");
  expect(repaired.insurerEvidence).toBe("missing");
  expect(repaired.receipt?.id).toBe(signed.receipt?.id);
  await expect(
    database.pool.query("delete from partner_conclusion_actions where conclusion_id=$1", [
      prepared.id,
    ]),
  ).rejects.toMatchObject({ code: "23514" });
  await expect(
    database.pool.query(
      "update partner_conclusion_correspondences set withdrawn_at=null where id=$1",
      [letter.item.id],
    ),
  ).rejects.toMatchObject({ code: "23514" });
});
it("does not revive shared correspondence after source edits or a managed owner transfer and return", async () => {
  const owner = { ...(await actor()), wallet: true },
    other = { ...(await actor()), wallet: true },
    profileId = `prf_${key()}`;
  await database.pool.query(
    "insert into managed_profiles(id,user_id,kind,display_name) values($1,$2,'person','Profil isolé')",
    [profileId, owner.userId],
  );
  const s = await setup(profileId, owner),
    letter = await correspondence(owner, s.lead.id, profileId);
  await expect(repository.conclusionCorrespondences(other, s.lead.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  const transfers = createAdminProfileTransferRepository(database.db),
    revision = (
      await database.pool.query<{ revision: number }>(
        "select revision from managed_profiles where id=$1",
        [profileId],
      )
    ).rows[0]!.revision;
  const moved = await transfers.transfer(
    { userId: owner.userId, id: admin.id, administratorUserId: admin.userId },
    profileId,
    { destinationUserId: other.userId, revision },
    key(),
  );
  expect((await repository.conclusionCorrespondences(other, s.lead.id)).items).toHaveLength(0);
  await transfers.transfer(
    { userId: other.userId, id: admin.id, administratorUserId: admin.userId },
    profileId,
    { destinationUserId: owner.userId, revision: moved.revision },
    key(),
  );
  expect((await repository.conclusionCorrespondences(owner, s.lead.id)).items[0]?.canDownload).toBe(
    false,
  );
  await expect(
    repository.conclusionCorrespondenceSource(owner, s.lead.id, letter.item.id),
  ).rejects.toMatchObject({ code: "PARTNER_NOT_FOUND" });
  const replacement = await repository.shareConclusionCorrespondence(
    owner,
    s.lead.id,
    {
      action: "share",
      leadRevision: (await repository.detail(owner, s.lead.id)).revision,
      documentId: letter.documentId,
      fingerprint: letter.candidate.fingerprint,
      consent: true,
    },
    key(),
  );
  const newShare = replacement.items.find((i) => i.current)!;
  await database.pool.query("update files set generation=generation+1 where id=$1", [
    letter.documentId,
  ]);
  await database.pool.query("update files set generation=generation-1 where id=$1", [
    letter.documentId,
  ]);
  expect(
    (await repository.conclusionCorrespondences(owner, s.lead.id)).items.find(
      (i) => i.id === newShare.id,
    )?.current,
  ).toBe(false);
});
async function policy(
  owner: PartnerActor,
  leadId: string,
  offerId: string,
  profileId: string | null = null,
) {
  const documentId = `doc_${key()}`,
    source = { page: 1, text: note, method: "isolated", version: "test", confidence: 1, box: null };
  const analysis = {
    category: "insurance",
    title: "Police automobile",
    classification: "insurance_policy",
    evidence: null,
    fields: [],
    pages: [{ page: 1, text: note, method: "isolated", version: "test" }],
    insurance: {
      companyId: "axa",
      companySource: source,
      domain: "motor",
      domainSource: source,
      policyNumber: { value: key(), source },
      insuredSubject: { value: "Véhicule isolé", source },
      startsOn: { value: "2026-01-01", source },
      endsOn: { value: "2026-12-31", source },
      premium: { amountMinor: 10000, currency: "CHF", period: "month", source },
    },
  };
  await database.pool.query(
    `insert into files(id,user_id,managed_profile_id,name,mime,declared_mime,size,checksum,object_key,state,category,scan_version,analysis)
    values($1,$2,$3,'Police isolée.pdf','application/pdf','application/pdf',10,$4,$5,'ready','insurance','isolated-scan',$6)`,
    [
      documentId,
      owner.userId,
      profileId,
      createHash("sha256").update(documentId).digest("hex"),
      key(),
      JSON.stringify(analysis),
    ],
  );
  const candidate = (await repository.contractCandidates(owner, leadId)).items.find(
    (c) => c.documentId === documentId,
  )!;
  const lead = await repository.detail(owner, leadId);
  await repository.command(
    owner,
    leadId,
    {
      action: "final_policy_link",
      revision: lead.revision,
      offerId,
      documentId,
      fingerprint: candidate.fingerprint,
      sameObjectConfirmed: true,
      sharingConfirmed: true,
      receivedPolicyConfirmed: true,
    },
    key(),
  );
  const item = (await repository.finalPolicies(owner, leadId)).items[0]!;
  return { item, documentId, candidate };
}
it("binds an immutable exact signature, idempotent replay and sourced insurer follow-up before contract closure", async () => {
  const s = await setup(),
    requestKey = key();
  const prepared = await repository.prepareConclusion(s.advisor, s.lead.id, s.prepare, requestKey);
  expect(
    (await repository.notifications(s.owner, { status: "open" })).items.some(
      (n) => n.kind === "conclusion.prepared.v1" && n.action === "conclusion",
    ),
  ).toBe(true);
  expect(prepared.state).toBe("awaiting_signature");
  expect(prepared.canSign).toBe(false);
  expect((await repository.conclusion(s.owner, prepared.id)).canSign).toBe(true);
  expect((await repository.prepareConclusion(s.advisor, s.lead.id, s.prepare, requestKey)).id).toBe(
    prepared.id,
  );
  const input = signature(prepared.contentHash),
    signKey = key();
  const signed = await repository.signConclusion(s.owner, prepared.id, input, signKey);
  expect(
    (await repository.notifications(s.owner, { status: "open" })).items.some(
      (n) => n.kind === "conclusion.prepared.v1",
    ),
  ).toBe(false);
  expect(
    (await repository.notifications(s.advisor, { status: "open" })).items.some(
      (n) => n.kind === "conclusion.signed.v1",
    ),
  ).toBe(true);
  expect(signed.state).toBe("signed");
  expect(signed.receipt?.drawing).toEqual(input.drawing);
  expect(signed.insurerEvidence).toBe("missing");
  expect((await repository.signConclusion(s.owner, prepared.id, input, signKey)).receipt?.id).toBe(
    signed.receipt?.id,
  );
  await expect(repository.signConclusion(s.owner, prepared.id, input, key())).rejects.toMatchObject(
    { code: "PARTNER_CONFLICT" },
  );
  await expect(
    database.pool.query(
      "update partner_offer_signatures set integrity_hash=$2 where conclusion_id=$1",
      [prepared.id, "a".repeat(64)],
    ),
  ).rejects.toMatchObject({ code: "23514" });
  await expect(
    database.pool.query("update partner_conclusions set archive='{}' where id=$1", [prepared.id]),
  ).rejects.toMatchObject({ code: "23514" });
  const transmitted = await repository.actConclusion(
    s.advisor,
    prepared.id,
    {
      action: "transmitted",
      revision: 0,
      occurredAt: at(),
      reference: note,
      reason: note,
      verified: true,
    },
    key(),
  );
  expect(transmitted.state).toBe("transmitted");
  const p = await policy(s.owner, s.lead.id, s.offerId);
  expect((await repository.finalPolicies(s.owner, s.lead.id)).items[0]?.signatureEvidence).toBe(
    "traced",
  );
  const decision = {
    revision: 1,
    policyId: p.item.id,
    fingerprint: p.candidate.fingerprint,
    source: { page: 1, quote: note },
    occurredAt: at(),
    reason: note,
    verified: true as const,
  };
  await expect(
    repository.actConclusion(
      s.advisor,
      prepared.id,
      {
        ...decision,
        action: "accepted",
        source: { page: 1, quote: "Passage absent de la source" },
      },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_DOCUMENT" });
  expect(
    (
      await repository.actConclusion(
        s.advisor,
        prepared.id,
        { ...decision, action: "accepted" },
        key(),
      )
    ).state,
  ).toBe("accepted");
  await expect(
    repository.actConclusion(
      s.advisor,
      prepared.id,
      { ...decision, revision: 2, action: "issued" },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_DOCUMENT" });
  let lead = await repository.detail(s.advisor, s.lead.id);
  lead = await repository.command(
    s.advisor,
    lead.id,
    {
      action: "final_policy_review",
      revision: lead.revision,
      review: {
        policyId: p.item.id,
        checks: finalPolicyFields.map((field) => ({
          field,
          result: "same",
          note,
          offerSource: { page: 1, quote: note },
          policySource: { page: 1, quote: note },
        })),
      },
    },
    key(),
  );
  expect(
    (
      await repository.actConclusion(
        s.advisor,
        prepared.id,
        { ...decision, revision: 2, action: "issued" },
        key(),
      )
    ).state,
  ).toBe("issued");
  lead = await repository.detail(s.advisor, lead.id);
  expect(lead.stage).toBe("contract_issued");
  expect(await conclusionClosureReady(database.pool, lead)).toBe(true);
  const original = (
    await database.pool.query<{ data: unknown }>("select data from partner_offers where id=$1", [
      s.offerId,
    ])
  ).rows[0]!.data;
  lead = await repository.command(
    s.advisor,
    lead.id,
    {
      action: "offer",
      revision: lead.revision,
      offer: { ...leadOfferInputSchema.parse(original), product: "Autre version isolée" },
    },
    key(),
  );
  const extra = lead.offers.find((o) => o.id !== s.offerId)!;
  for (const action of ["offer_review", "offer_publish"] as const)
    lead = await repository.command(
      s.advisor,
      lead.id,
      { action, offerId: extra.id, revision: lead.revision },
      key(),
    );
  lead = await repository.command(
    s.owner,
    lead.id,
    {
      action: "client_choice",
      choice: "select",
      offerId: extra.id,
      text: "",
      revision: lead.revision,
    },
    key(),
  );
  const pending = await repository.prepareConclusion(
    s.advisor,
    lead.id,
    { ...s.prepare, offerId: extra.id, leadRevision: lead.revision },
    key(),
  );
  expect(await conclusionClosureReady(database.pool, lead)).toBe(false);
  const first = await repository.conclusion(s.advisor, prepared.id);
  await repository.actConclusion(
    s.advisor,
    first.id,
    {
      action: "correct",
      revision: first.revision,
      targetActionId: first.actions.at(-1)!.id,
      reason: note,
      verified: true,
    },
    key(),
  );
  await repository.actConclusion(
    s.advisor,
    first.id,
    { ...decision, action: "issued", revision: first.revision + 1, occurredAt: at() },
    key(),
  );
  lead = await repository.detail(s.advisor, lead.id);
  expect(lead.stage).toBe("contract_issued");
  await expect(
    repository.command(
      s.advisor,
      lead.id,
      {
        action: "close",
        revision: lead.revision,
        result: "contract",
        reason: "other",
        comment: note,
      },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_TRANSITION" });
  await repository.actConclusion(
    s.advisor,
    pending.id,
    { action: "withdraw", revision: 0, reason: note },
    key(),
  );
  const beforeFinal = await repository.conclusion(s.advisor, first.id);
  await repository.actConclusion(
    s.advisor,
    first.id,
    {
      action: "correct",
      revision: beforeFinal.revision,
      targetActionId: beforeFinal.actions.at(-1)!.id,
      reason: note,
      verified: true,
    },
    key(),
  );
  await repository.actConclusion(
    s.advisor,
    first.id,
    { ...decision, action: "issued", revision: beforeFinal.revision + 1, occurredAt: at() },
    key(),
  );
  lead = await repository.detail(s.advisor, lead.id);
  const closed = await repository.command(
    s.advisor,
    lead.id,
    {
      action: "close",
      revision: lead.revision,
      result: "contract",
      reason: "other",
      comment: note,
    },
    key(),
  );
  expect(closed.stage).toBe("completed");
});
it("rejects strangers, professional signing, stale revisions, wrong originals and revoked-session replay", async () => {
  const s = await setup();
  await expect(
    repository.prepareConclusion(s.advisor, s.lead.id, { ...s.prepare, leadRevision: 0 }, key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  await expect(
    repository.prepareConclusion(
      s.advisor,
      s.lead.id,
      { ...s.prepare, procedure: { page: 1, quote: "Passage absent" } },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_DOCUMENT" });
  const prepared = await repository.prepareConclusion(s.advisor, s.lead.id, s.prepare, key());
  await expect(
    repository.conclusion({ ...(await actor()), wallet: true }, prepared.id),
  ).rejects.toMatchObject({ code: "PARTNER_NOT_FOUND" });
  await expect(
    repository.signConclusion(s.advisor, prepared.id, signature(prepared.contentHash), key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  await expect(
    repository.signConclusion(s.owner, prepared.id, signature("f".repeat(64)), key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  const signKey = key(),
    input = signature(prepared.contentHash);
  await repository.signConclusion(s.owner, prepared.id, input, signKey);
  await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
    s.owner.id,
  ]);
  await expect(
    repository.signConclusion(s.owner, prepared.id, input, signKey),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
});
it("never revives an invitation after a client changes and restores the choice", async () => {
  const s = await setup(),
    prepared = await repository.prepareConclusion(s.advisor, s.lead.id, s.prepare, key());
  let lead = await repository.detail(s.owner, s.lead.id);
  lead = await repository.command(
    s.owner,
    lead.id,
    { action: "client_choice", choice: "keep_current", text: "", revision: lead.revision },
    key(),
  );
  lead = await repository.command(
    s.owner,
    lead.id,
    {
      action: "client_choice",
      choice: "select",
      offerId: s.offerId,
      text: "",
      revision: lead.revision,
    },
    key(),
  );
  expect((await repository.conclusion(s.owner, prepared.id)).state).toBe("review_required");
  await expect(
    repository.signConclusion(s.owner, prepared.id, signature(prepared.contentHash), key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  const replacement = await repository.prepareConclusion(
    s.advisor,
    lead.id,
    { ...s.prepare, leadRevision: lead.revision },
    key(),
  );
  expect(replacement.id).not.toBe(prepared.id);
  expect((await repository.conclusion(s.owner, replacement.id)).canSign).toBe(true);
});
it("invalidates exact source changes and preserves the database signature archive", async () => {
  const s = await setup(),
    prepared = await repository.prepareConclusion(s.advisor, s.lead.id, s.prepare, key());
  await repository.signConclusion(s.owner, prepared.id, signature(prepared.contentHash), key());
  await database.pool.query("update files set generation=generation+1 where id=$1", [s.documentId]);
  const changed = await repository.conclusion(s.owner, prepared.id);
  expect(changed.state).toBe("review_required");
  expect(changed.archive).toBeNull();
  expect(changed.receipt).toBeNull();
  expect(
    (
      await database.pool.query("select id from partner_offer_signatures where conclusion_id=$1", [
        prepared.id,
      ])
    ).rowCount,
  ).toBe(1);
  await expect(
    database.pool.query("update partner_conclusions set invalidated_at=null where id=$1", [
      prepared.id,
    ]),
  ).rejects.toMatchObject({ code: "23514" });
});
it("serializes concurrent signatures into one immutable receipt", async () => {
  const s = await setup(),
    prepared = await repository.prepareConclusion(s.advisor, s.lead.id, s.prepare, key());
  const results = await Promise.allSettled([
    repository.signConclusion(s.owner, prepared.id, signature(prepared.contentHash), key()),
    repository.signConclusion(s.owner, prepared.id, signature(prepared.contentHash), key()),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(
    (
      await database.pool.query("select id from partner_offer_signatures where conclusion_id=$1", [
        prepared.id,
      ])
    ).rowCount,
  ).toBe(1);
});
it("requires the managed-profile representative and rejects transfer-and-return revival", async () => {
  const owner = { ...(await actor()), wallet: true },
    other = { ...(await actor()), wallet: true },
    profileId = key();
  await database.pool.query(
    "insert into managed_profiles(id,user_id,kind,display_name) values($1,$2,'person','Profil isolé')",
    [profileId, owner.userId],
  );
  const s = await setup(profileId, owner),
    prepared = await repository.prepareConclusion(s.advisor, s.lead.id, s.prepare, key());
  await expect(
    repository.signConclusion(owner, prepared.id, signature(prepared.contentHash), key()),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  await database.pool.query("update managed_profiles set user_id=$2 where id=$1", [
    profileId,
    other.userId,
  ]);
  await expect(repository.conclusion(other, prepared.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  expect((await repository.conclusions(other, s.lead.id)).items).toHaveLength(0);
  await database.pool.query("update managed_profiles set user_id=$2 where id=$1", [
    profileId,
    owner.userId,
  ]);
  expect((await repository.conclusion(owner, prepared.id)).canSign).toBe(false);
  await expect(
    repository.signConclusion(owner, prepared.id, signature(prepared.contentHash, true), key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
});
it("expires on the database clock and permits an explicitly renewed invitation", async () => {
  const s = await setup(),
    prepared = await repository.prepareConclusion(
      s.advisor,
      s.lead.id,
      { ...s.prepare, validUntil: at(500) },
      key(),
    );
  await new Promise((resolve) => setTimeout(resolve, 550));
  expect(
    (await repository.notifications(s.owner, { status: "open" })).items.some(
      (n) => n.kind === "conclusion.prepared.v1",
    ),
  ).toBe(false);
  expect((await repository.conclusion(s.owner, prepared.id)).state).toBe("expired");
  await expect(
    repository.signConclusion(s.owner, prepared.id, signature(prepared.contentHash), key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  const lead = await repository.detail(s.advisor, s.lead.id);
  expect(
    (
      await repository.prepareConclusion(
        s.advisor,
        lead.id,
        { ...s.prepare, leadRevision: lead.revision },
        key(),
      )
    ).id,
  ).not.toBe(prepared.id);
});
it("cannot close a previously issued dossier after the client withdraws its supporting policy", async () => {
  const s = await setup(),
    prepared = await repository.prepareConclusion(s.advisor, s.lead.id, s.prepare, key());
  await repository.signConclusion(s.owner, prepared.id, signature(prepared.contentHash), key());
  await repository.actConclusion(
    s.advisor,
    prepared.id,
    {
      action: "transmitted",
      revision: 0,
      occurredAt: at(),
      reference: note,
      reason: note,
      verified: true,
    },
    key(),
  );
  const p = await policy(s.owner, s.lead.id, s.offerId);
  const decision = {
    policyId: p.item.id,
    fingerprint: p.candidate.fingerprint,
    source: { page: 1, quote: note },
    occurredAt: at(),
    reason: note,
    verified: true as const,
  };
  await repository.actConclusion(
    s.advisor,
    prepared.id,
    { ...decision, revision: 1, action: "accepted" },
    key(),
  );
  let lead = await repository.detail(s.advisor, s.lead.id);
  await repository.command(
    s.advisor,
    lead.id,
    {
      action: "final_policy_review",
      revision: lead.revision,
      review: {
        policyId: p.item.id,
        checks: finalPolicyFields.map((field) => ({
          field,
          result: "same",
          note,
          offerSource: { page: 1, quote: note },
          policySource: { page: 1, quote: note },
        })),
      },
    },
    key(),
  );
  await repository.actConclusion(
    s.advisor,
    prepared.id,
    { ...decision, revision: 2, action: "issued" },
    key(),
  );
  lead = await repository.detail(s.owner, lead.id);
  lead = await repository.command(
    s.owner,
    lead.id,
    { action: "final_policy_unlink", policyId: p.item.id, revision: lead.revision },
    key(),
  );
  expect((await repository.conclusion(s.advisor, prepared.id)).state).toBe("review_required");
  expect(
    (await repository.conclusion(s.advisor, prepared.id)).actions
      .filter((a) => a.sourceCurrent === false)
      .every((a) => a.input === null),
  ).toBe(true);
  await expect(
    repository.command(
      s.advisor,
      lead.id,
      {
        action: "close",
        revision: lead.revision,
        result: "contract",
        reason: "other",
        comment: note,
      },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_TRANSITION" });
});
