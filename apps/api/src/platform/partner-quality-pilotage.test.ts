import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { beforeAll, afterAll, expect, it } from "vitest";
import { leadCreateInputSchema, partnerApplicationInputSchema } from "@coverview/contracts/partner";
import { createDatabase } from "./db/database.js";
import { createPartnerRepository } from "../modules/partner-workspace/partner.repository.js";
import {
  commercialTermsSchema,
  type EconomyEntryInput,
} from "@coverview/contracts/partner-economy";
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
    .withDatabase("coverview_quality_pilotage_test")
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

const note = "Preuve synthétique limitée au PostgreSQL jetable de ce test";
const at = (ms: number) => new Date(Date.now() + ms).toISOString();
async function setup() {
  const advisor = await professional(),
    owner = { ...(await actor()), wallet: true };
  return { advisor, owner, lead: await assigned(owner, advisor) };
}
async function close(lead: { id: string; revision: number }, advisor: PartnerActor) {
  return repository.command(
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
}
const response = (rating: number, callbackRequested = false) => ({
  rating,
  experience: "overall",
  positives: rating === 5 ? ["clarity"] : [],
  improvements: rating < 5 ? ["follow_up"] : [],
  comment: "",
  callbackRequested,
  confirmed: true,
});
const requestInput = (revision: number) => ({
  expectedLeadRevision: revision,
  channel: "phone",
  purposes: ["minutes"],
  notice: note,
  sourceReference: note,
  validUntil: at(86400000),
  retainUntil: at(86400000 * 2),
  confirmed: true,
});
const transcriptInput = () => ({
  expectedRevision: 0,
  occurredAt: at(0),
  sourceReference: note,
  correctionReason: "",
  segments: [
    {
      speaker: "Client isolé",
      locator: "00:10",
      text: "Préparer une comparaison des garanties demandées.",
    },
  ],
  allParticipantsAgreed: true,
  sourceReviewed: true,
});

it("invites exactly once on actual completion, persists one response and opens an atomic callback", async () => {
  const { advisor, owner, lead } = await setup();
  expect((await repository.surveys(owner, lead.id)).items).toHaveLength(0);
  await close(lead, advisor);
  const survey = (await repository.surveys(owner, lead.id)).items[0]!;
  expect(survey.canRespond).toBe(true);
  const notification = (
    await database.pool.query<{ audience: string; recipient_id: string; resolved_at: Date | null }>(
      "select * from partner_notifications where dedupe_key=$1",
      [`survey:${survey.id}`],
    )
  ).rows[0];
  expect(notification).toMatchObject({
    audience: "wallet",
    recipient_id: owner.userId,
    resolved_at: null,
  });
  const replayKey = key(),
    input = response(3, true);
  const saved = await repository.respondSurvey(owner, survey.id, input, replayKey);
  expect(saved).toMatchObject({
    canRespond: false,
    googleReviewUrl: null,
    googleStatus: "not_applicable",
  });
  expect(saved.caseId).toBeTruthy();
  expect((await repository.respondSurvey(owner, survey.id, input, replayKey)).caseId).toBe(
    saved.caseId,
  );
  await expect(
    repository.respondSurvey(owner, survey.id, response(5), key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  const quality = await repository.qualityCase(admin, saved.caseId!);
  expect(quality).toMatchObject({
    kind: "callback",
    state: "open",
    revision: 0,
    accountableUnit: "coverview",
  });
  expect((await repository.qualityQueue(advisor, {}, lead.id)).items).toHaveLength(0);
  await expect(
    database.pool.query("update partner_survey_responses set response=$2 where survey_id=$1", [
      survey.id,
      response(5),
    ]),
  ).rejects.toMatchObject({ code: "23514" });
  await database.pool.query("update partner_leads set updated_at=now() where id=$1", [lead.id]);
  expect((await repository.surveys(owner, lead.id)).items).toHaveLength(1);
});

it("keeps quality notes private, replies unresolved and closure verified with optimistic revisions", async () => {
  const { advisor, owner, lead } = await setup();
  const c = await repository.createQualityCase(
    advisor,
    lead.id,
    { kind: "complaint", summary: note, priority: "high", sharedWithClient: true, confirmed: true },
    key(),
  );
  const action = {
    expectedRevision: 0,
    action: "take_charge",
    note,
    nextAction: "Vérifier la source",
    dueAt: at(86400000),
    sharedWithClient: false,
    sharedWithAuthor: false,
    verified: false,
  };
  await repository.actQualityCase(admin, c.id, action, key());
  const privateView = await repository.qualityCase(owner, c.id);
  expect(privateView.history).toHaveLength(0);
  expect(privateView).toMatchObject({ nextAction: "", dueAt: null, assignedTo: null });
  const reply = await repository.replyQualityCase(
    owner,
    c.id,
    { expectedRevision: 1, note },
    key(),
  );
  expect(reply).toMatchObject({ state: "in_progress", revision: 2 });
  expect(
    (
      await database.pool.query<{ resolved_at: Date | null }>(
        "select resolved_at from partner_notifications where dedupe_key=$1",
        [`quality:${c.id}`],
      )
    ).rows[0]!.resolved_at,
  ).toBeNull();
  await expect(repository.actQualityCase(admin, c.id, action, key())).rejects.toMatchObject({
    code: "PARTNER_CONFLICT",
  });
  const closed = await repository.actQualityCase(
    admin,
    c.id,
    {
      ...action,
      expectedRevision: 2,
      action: "close",
      verified: true,
      nextAction: "",
      dueAt: null,
      sharedWithClient: true,
      sharedWithAuthor: true,
    },
    key(),
  );
  expect(closed).toMatchObject({ state: "closed", revision: 3 });
  expect((await repository.qualityCase(owner, c.id)).history.map((h) => h.action)).toEqual([
    "close",
    "reply",
  ]);
  await expect(
    repository.replyQualityCase(owner, c.id, { expectedRevision: 3, note }, key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
});

it("requires prior recording consent and exact latest source for a real follow-up task, then masks withdrawal", async () => {
  const { advisor, owner, lead } = await setup();
  const initial = await repository.communications(owner, lead.id, {});
  expect(initial.preferences.channels).toBeNull();
  await repository.updateCommunicationPreferences(
    owner,
    lead.id,
    { expectedRevision: 0, channels: ["wallet", "phone"], note: "", confirmed: true },
    key(),
  );
  const request = await repository.requestRecording(
    advisor,
    lead.id,
    requestInput(lead.revision),
    key(),
  );
  expect(request.state).toBe("requested");
  await expect(
    repository.saveTranscript(advisor, request.id, transcriptInput(), key()),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  await repository.decideRecording(
    owner,
    request.id,
    { expectedRevision: 0, decision: "allow", confirmed: true },
    key(),
  );
  const input = transcriptInput();
  const saved = await repository.saveTranscript(advisor, request.id, input, key());
  const version = saved.transcripts[0]!;
  const corrected = await repository.saveTranscript(
    advisor,
    request.id,
    { ...input, expectedRevision: 1, correctionReason: note },
    key(),
  );
  await expect(
    repository.createTranscriptTask(
      advisor,
      request.id,
      {
        versionId: version.id,
        segmentIndex: 0,
        quote: "comparaison",
        title: "Préparer la comparaison",
        dueAt: at(86400000),
        verified: true,
      },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  const followup = await repository.createTranscriptTask(
    advisor,
    request.id,
    {
      versionId: corrected.transcripts[0]!.id,
      segmentIndex: 0,
      quote: "comparaison",
      title: "Préparer la comparaison",
      dueAt: at(86400000),
      verified: true,
    },
    key(),
  );
  expect(followup.tasks).toHaveLength(1);
  expect(
    (
      await database.pool.query(
        "select lead_id,responsible_id,description from partner_tasks where id=$1",
        [followup.tasks[0]!.id],
      )
    ).rows[0],
  ).toEqual({ lead_id: lead.id, responsible_id: advisor.userId, description: "" });
  expect(
    (
      await database.pool.query<{ n: number }>(
        "select count(*)::int n from partner_transcript_accesses where request_id=$1",
        [request.id],
      )
    ).rows[0]!.n,
  ).toBeGreaterThan(0);
  await repository.decideRecording(
    owner,
    request.id,
    { expectedRevision: 1, decision: "withdraw", confirmed: true },
    key(),
  );
  expect(await repository.recording(advisor, request.id)).toMatchObject({
    state: "withdrawn",
    transcripts: [],
    tasks: [],
    canTranscribe: false,
  });
  await expect(
    database.pool.query("delete from partner_recording_decisions where request_id=$1", [
      request.id,
    ]),
  ).rejects.toMatchObject({ code: "23514" });
});

it("invalidates former consent permanently when professional rights change and return", async () => {
  const { advisor, owner, lead } = await setup();
  const request = await repository.requestRecording(
    advisor,
    lead.id,
    requestInput(lead.revision),
    key(),
  );
  await repository.decideRecording(
    owner,
    request.id,
    { expectedRevision: 0, decision: "allow", confirmed: true },
    key(),
  );
  await database.pool.query(
    "update partner_members set review_due_at=now()+interval '2 days' where user_id=$1",
    [advisor.userId],
  );
  await database.pool.query("update partner_members set review_due_at=null where user_id=$1", [
    advisor.userId,
  ]);
  expect(await repository.recording(advisor, request.id)).toMatchObject({
    state: "context_changed",
    canTranscribe: false,
    transcripts: [],
  });
  await expect(
    database.pool.query("update partner_recording_requests set invalidated_at=null where id=$1", [
      request.id,
    ]),
  ).rejects.toMatchObject({ code: "23514" });
});

it("computes source-grain activity, denominators and filtered sources without granting another portfolio", async () => {
  const { advisor, owner, lead } = await setup();
  const outsider = await professional();
  await assigned({ ...(await actor()), wallet: true }, outsider);
  await repository.recordCommunication(
    advisor,
    lead.id,
    {
      expectedLeadRevision: lead.revision,
      channel: "phone",
      occurredAt: at(0),
      outcome: "reached",
      summary: note,
      sourceReference: note,
      nextAction: "Préparer la comparaison",
      dueAt: at(86400000),
      confirmed: true,
    },
    key(),
  );
  const query = { from: at(-86400000), to: at(86400000), scope: "self" };
  const stats = await repository.pilotage(advisor, query);
  const metric = (name: string) => stats.measures.find((m) => m.metric === name)!;
  expect(stats.leadCount).toBe(1);
  expect(metric("new_leads").value).toBe(1);
  expect(metric("contacts")).toMatchObject({ value: 1, population: 1 });
  expect(metric("contact_rate")).toMatchObject({ value: 100, numerator: 1, denominator: 1 });
  expect(metric("satisfaction")).toMatchObject({
    value: null,
    status: "no_observations",
    canInspect: false,
  });
  // The conclusion catalogue is active: signatures count native receipts only, here none.
  expect(metric("verified_signatures")).toMatchObject({ value: 0, status: "available" });
  expect(
    (await repository.pilotageSources(advisor, { ...query, metric: "contacts" })).items.map(
      (s) => s.leadId,
    ),
  ).toEqual([lead.id]);
  expect((await repository.pilotage(advisor, { ...query, source: "Absent" })).leadCount).toBe(0);
  await expect(
    repository.pilotage(advisor, { ...query, scope: "individual", members: outsider.userId }),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  await expect(repository.pilotage(owner, query)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  expect((await repository.pilotageOptions(advisor)).people.map((p) => p.id)).toEqual([
    advisor.userId,
  ]);
  expect((await repository.pilotage(admin, { ...query, scope: "network" })).network).not.toBeNull();
});

it("versions goals against the same measures, protects imposed goals and keeps missing results unknown", async () => {
  const { advisor } = await setup();
  const input = {
    expectedRevision: 0,
    title: "Dossiers de la période",
    metric: "new_leads",
    scope: { kind: "self", organizationId: null, userIds: [] },
    filters: {},
    from: at(-86400000),
    to: at(86400000),
    target: 2,
    direction: "at_least",
    state: "active",
    reason: note,
    confirmed: true,
  };
  const goal = await repository.saveGoal(advisor, null, input, key());
  expect(goal).toMatchObject({ gap: -1, progressPercent: 50, attained: false, canEdit: true });
  const second = await repository.saveGoal(
    advisor,
    goal.id,
    { ...input, expectedRevision: 1, target: 1 },
    key(),
  );
  expect(second).toMatchObject({ progressPercent: 100, attained: true });
  expect(second.history.map((h) => h.revision)).toEqual([2, 1]);
  await expect(
    repository.saveGoal(advisor, goal.id, { ...input, expectedRevision: 1 }, key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  const imposed = await repository.saveGoal(
    admin,
    null,
    {
      ...input,
      // No comparable verified premium yet: progress stays unknown instead of zero.
      metric: "proposed_savings",
      scope: { kind: "individual", organizationId: null, userIds: [advisor.userId] },
    },
    key(),
  );
  expect(await repository.goal(advisor, imposed.id)).toMatchObject({
    canEdit: false,
    progressPercent: null,
    attained: null,
    gap: null,
  });
  await expect(
    repository.saveGoal(advisor, imposed.id, { ...input, expectedRevision: 1 }, key()),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  expect((await repository.goals(advisor, {})).items).toHaveLength(2);
  await expect(
    database.pool.query("update partner_goal_versions set input=input where goal_id=$1", [goal.id]),
  ).rejects.toMatchObject({ code: "23514" });
});

it("does not revive evidence after a profile owner transfer and return", async () => {
  const advisor = await professional(),
    owner = { ...(await actor()), wallet: true },
    other = { ...(await actor()), wallet: true },
    profileId = key();
  await database.pool.query(
    "insert into managed_profiles(id,user_id,kind,display_name) values($1,$2,'person','Profil isolé')",
    [profileId, owner.userId],
  );
  let lead = await assigned(owner, advisor, profileId);
  await repository.updateCommunicationPreferences(
    owner,
    lead.id,
    { expectedRevision: 0, channels: ["phone"], note: "", confirmed: true },
    key(),
  );
  const request = await repository.requestRecording(
    advisor,
    lead.id,
    requestInput(lead.revision),
    key(),
  );
  await repository.decideRecording(
    owner,
    request.id,
    { expectedRevision: 0, decision: "allow", confirmed: true },
    key(),
  );
  const c = await repository.createQualityCase(
    advisor,
    lead.id,
    {
      kind: "verification",
      summary: note,
      priority: "normal",
      sharedWithClient: true,
      confirmed: true,
    },
    key(),
  );
  lead = await close(lead, advisor);
  const survey = (await repository.surveys(owner, lead.id)).items[0]!;
  await database.pool.query("update managed_profiles set user_id=$2 where id=$1", [
    profileId,
    other.userId,
  ]);
  await expect(repository.survey(other, survey.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  await database.pool.query("update managed_profiles set user_id=$2 where id=$1", [
    profileId,
    owner.userId,
  ]);
  expect((await repository.surveys(owner, lead.id)).items).toHaveLength(0);
  expect((await repository.communications(owner, lead.id, {})).preferences.channels).toBeNull();
  expect(await repository.recording(owner, request.id)).toMatchObject({
    state: "context_changed",
    transcripts: [],
  });
  await expect(repository.qualityCase(owner, c.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  expect(await repository.qualityCase(admin, c.id)).toMatchObject({ canShareWithClient: false });
});

it("serializes competing survey responses without duplicate response or case", async () => {
  const { advisor, owner, lead } = await setup();
  await close(lead, advisor);
  const survey = (await repository.surveys(owner, lead.id)).items[0]!;
  const outcomes = await Promise.allSettled([
    repository.respondSurvey(owner, survey.id, response(2, true), key()),
    repository.respondSurvey(owner, survey.id, response(4), key()),
  ]);
  expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(
    (
      await database.pool.query<{ n: number }>(
        "select count(*)::int n from partner_survey_responses where survey_id=$1",
        [survey.id],
      )
    ).rows[0]!.n,
  ).toBe(1);
  expect(
    (
      await database.pool.query<{ n: number }>(
        "select count(*)::int n from partner_quality_cases where survey_id=$1",
        [survey.id],
      )
    ).rows[0]!.n,
  ).toBe(1);
});

it("keeps a five-star response positive-only and distinguishes an unconfigured review destination", async () => {
  const { advisor, owner, lead } = await setup();
  await close(lead, advisor);
  const survey = (await repository.surveys(owner, lead.id)).items[0]!;
  const saved = await repository.respondSurvey(owner, survey.id, response(5), key());
  expect(saved).toMatchObject({
    googleStatus: "not_configured",
    googleReviewUrl: null,
    caseId: null,
  });
  expect((await repository.qualityQueue(owner, {}, lead.id)).items).toHaveLength(0);
});

it("revalidates sessions and Admin MFA before quality and pilotage access", async () => {
  const { advisor, owner, lead } = await setup(),
    expiredAdmin = await actor(true);
  const c = await repository.createQualityCase(
    owner,
    lead.id,
    {
      kind: "complaint",
      summary: note,
      priority: "normal",
      sharedWithClient: true,
      confirmed: true,
    },
    key(),
  );
  await database.pool.query(
    "update identity_sessions set mfa_verified_at=now()-interval '25 hours' where id=$1",
    [expiredAdmin.id],
  );
  await expect(repository.qualityCase(expiredAdmin, c.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await expect(
    repository.pilotage(expiredAdmin, { from: at(-86400000), to: at(86400000), scope: "network" }),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
    advisor.id,
  ]);
  await expect(repository.pilotageOptions(advisor)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
});

it("shows each authorized commission share, precise weighted cents and dated receipts with no manager financial grant", async () => {
  const { advisor: supplier, owner, lead } = await setup(),
    receiver = await professional();
  const terms = commercialTermsSchema.parse({
    categories: ["vehicle"],
    companies: ["axa"],
    validFrom: at(-1000),
    validUntil: at(86400000),
    supplier: { model: "success", rateBps: 2000, trigger: "commission_received" },
    currency: "CHF",
    basis: note,
    deductions: [],
    coverviewRateBps: 1000,
    contributors: [],
    collector: "coverview",
    reserveTerms: note,
    clawbackTerms: note,
    paymentTerms: note,
    validityCriteria: note,
    disputeDays: 30,
    replacementRefundTerms: note,
    sourceReference: note,
    branchRules: note,
    caps: note,
    taxTreatment: note,
    bonusTerms: note,
  });
  const condition = await repository.createCommercialCondition(
    supplier,
    { terms, confirmed: true },
    key(),
  );
  await repository.reviewCommercialCondition(
    admin,
    condition.id,
    { decision: "approve", reason: note, validationReference: note },
    key(),
  );
  const market = await repository.publishMarket(
    supplier,
    lead.id,
    {
      leadRevision: lead.revision,
      conditionId: condition.id,
      language: "fr",
      canton: "GE",
      modes: ["video"],
      reason: "specialist",
      qualification: "contacted",
      steps: ["contact"],
      constraints: [],
      expiresAt: at(120000),
      publicationConfirmed: true,
    },
    key(),
  );
  const reserved = await repository.reserveMarket(
    supplier,
    market.publication.id,
    {
      targetId: receiver.userId,
      conditionId: condition.id,
      mission: {
        mode: "co_advice",
        access: "contribute",
        communication: "client_direct",
        scope: note,
        responsibilities: note,
        powers: note,
        limitations: note,
        validUntil: at(86400000),
      },
      expiresAt: at(60000),
      reason: note,
      termsAccepted: true,
      suitabilityReviewed: true,
    },
    key(),
  );
  const reservation = reserved.reservations[0]!;
  await repository.decideMarketMandate(
    owner,
    reservation.id,
    { decision: "accept", reason: note, confirmed: true },
    key(),
  );
  const agreement = await repository.decideMarket(
    receiver,
    reservation.id,
    { decision: "accept", reason: note, confirmed: true },
    key(),
  );
  // Minimal documentary rows for the economic projection only, in the disposable database.
  // Their date excludes them from the document-comparison cohort; no signature is inferred.
  const file = key(),
    offer = key(),
    policy = key();
  await database.pool.query(
    "insert into files(id,user_id,name,mime,declared_mime,size,checksum,object_key,state,category) values($1,$2,'Fixture isolée.pdf','application/pdf','application/pdf',10,$3,$4,'ready','insurance')",
    [file, owner.userId, "a".repeat(64), key()],
  );
  await database.pool.query(
    "insert into partner_offers(id,lead_id,document_id,data,version,family_id) values($1,$2,$3,'{}',1,$1)",
    [offer, lead.id, file],
  );
  await database.pool.query(
    "insert into partner_final_policies(id,lead_id,offer_id,document_id,fingerprint,source_snapshot,confirmed_by,created_at) values($1,$2,$3,$4,$5,$6,$7,now()-interval '10 days')",
    [
      policy,
      lead.id,
      offer,
      file,
      "a".repeat(64),
      { candidate: { facts: { companyId: "axa" } } },
      owner.userId,
    ],
  );
  let financial = await repository.createEconomyCase(
    admin,
    {
      agreementId: agreement.id,
      stream: "contract_commission",
      finalPolicyId: policy,
      companyId: "axa",
      reference: note,
      scopeReference: note,
      confirmed: true,
    },
    key(),
  );
  const post = async (entry: EconomyEntryInput) => {
    financial = await repository.recordEconomy(
      admin,
      financial.id,
      { revision: financial.revision, entry, evidenceChecked: true },
      key(),
    );
  };
  const proof = { reference: note, occurredAt: at(-1000) };
  await post({
    kind: "estimate",
    minimumMinor: 10001,
    maximumMinor: 20001,
    probabilityBps: 3333,
    assumptions: note,
    proof,
  });
  const query = { from: at(-86400000), to: at(86400000), scope: "self" };
  const before = await repository.pilotage(receiver, query);
  expect(before.measures.find((m) => m.metric === "received_commission")).toMatchObject({
    value: null,
    status: "source_unavailable",
  });
  expect(before.measures.find((m) => m.metric === "pipeline_minimum")).toMatchObject({
    value: 7001,
  });
  expect(before.measures.find((m) => m.metric === "weighted_pipeline_minimum")).toMatchObject({
    value: 2334,
  });
  await post({ kind: "confirm", grossMinor: 10003, deductions: [], triggerReference: note, proof });
  await post({
    kind: "receive",
    grossMinor: 10003,
    deductions: [],
    statementReference: note,
    settlementReference: key(),
    proof,
  });
  const own = await repository.pilotage(receiver, query),
    share = financial.balances.find((b) => b.beneficiary === receiver.userId)!;
  expect(own.measures.find((m) => m.metric === "received_commission")).toMatchObject({
    value: share.receivedMinor,
  });
  expect(own.measures.find((m) => m.metric === "available_commission")).toMatchObject({
    value: share.availableMinor,
  });
  expect(own.measures.find((m) => m.metric === "coverview_revenue")).toMatchObject({
    value: null,
    status: "restricted",
  });
  await post({ kind: "pay", beneficiary: receiver.userId, amountMinor: 1000, proof });
  await post({ kind: "clawback", beneficiary: receiver.userId, amountMinor: 500, proof });
  const paid = await repository.pilotage(receiver, query);
  expect(paid.measures.find((m) => m.metric === "paid_commission")).toMatchObject({ value: 1000 });
  expect(paid.measures.find((m) => m.metric === "clawback_commission")).toMatchObject({
    value: 500,
  });
  const after = await repository.pilotage(receiver, { ...query, from: at(0) });
  expect(after.measures.find((m) => m.metric === "received_commission")).toMatchObject({
    value: 0,
  });
  const network = await repository.pilotage(admin, { ...query, scope: "network" });
  expect(network.measures.find((m) => m.metric === "coverview_revenue")).toMatchObject({
    value: 1000,
  });
  // C6c: the network overview shows the same CoverView receipts, per branch too, and never
  // a profitability without recorded costs.
  const overview = await repository.adminOverview(admin, { from: query.from, to: query.to });
  expect(overview.coverview).toMatchObject({
    revenue: { metric: "coverview_revenue", value: 1000, status: "available" },
    costs: "unrecorded",
  });
  expect(overview.coverview.branches.find((b) => b.category === "vehicle")).toMatchObject({
    value: 1000,
    status: "available",
  });
  expect(overview.coverview.branches.find((b) => b.category === "health")).toMatchObject({
    value: null,
    status: "no_observations",
  });
  const branch = await repository.adminOverview(admin, {
    from: query.from,
    to: query.to,
    category: "health",
  });
  expect(branch.coverview).toMatchObject({ revenue: { value: null }, branches: [] });
  const member = (await repository.context(supplier)).application!;
  await repository.review(
    admin,
    supplier.userId,
    {
      revision: member.revision,
      state: "approved",
      roles: ["advisor", "manager"],
      reason: note,
      reviewDueAt: null,
      organizationState: "approved",
    },
    key(),
  );
  const org = await repository.pilotage(supplier, {
    ...query,
    scope: "organization",
    organizationId: member.organizationId,
  });
  expect(org.measures.find((m) => m.metric === "received_commission")).toMatchObject({
    value: null,
    status: "restricted",
  });
});
