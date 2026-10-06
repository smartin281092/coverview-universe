import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, expect, it } from "vitest";
import { leadCreateInputSchema, partnerApplicationInputSchema } from "@coverview/contracts/partner";
import { createDatabase } from "./db/database.js";
import { createPartnerRepository } from "../modules/partner-workspace/partner.repository.js";
import { createDataRightsOperations } from "../modules/partner-workspace/partner.data-rights.js";
import type { PartnerActor } from "../modules/partner-workspace/partner.policy.js";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let repository: ReturnType<typeof createPartnerRepository>;
let admin: PartnerActor;
const key = () => randomUUID();
const later = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();
const note = "Échange consigné dans un test isolé";
const unknown = { contact: "unknown", appointment: "unknown", documents: "unknown" } as const;

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_confirmations_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  await migrate(database.db, {
    migrationsFolder: fileURLToPath(new URL("../../drizzle/", import.meta.url)),
  });
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
    [value.userId, key(), `${key()}@confirmations.test`],
  );
  await database.pool.query("insert into identity_profiles(id,user_id) values($1,$2)", [
    key(),
    value.userId,
  ]);
  await database.pool.query(
    "insert into identity_sessions(id,user_id,workos_session_id,token_hash,device,expires_at,mfa_verified_at) values($1,$2,$3,$4,'Isolated confirmations',now()+interval '1 hour',now()-interval '1 second')",
    [value.id, value.userId, key(), createHash("sha256").update(key()).digest("hex")],
  );
  if (administrator)
    await database.pool.query(
      "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated test')",
      [key(), value.userId],
    );
  return value;
}
async function professional(name: string) {
  const person = await actor();
  await repository.apply(
    person,
    partnerApplicationInputSchema.parse({
      name,
      organization: `Cabinet ${name}`,
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
      reason: "Validation dans un test isolé",
      reviewDueAt: null,
      organizationState: "approved",
    },
    key(),
  );
  return person;
}
// A client's request, assigned to and accepted by the advisor.
async function request(owner: PartnerActor, advisor: PartnerActor) {
  const lead = await repository.create(
    owner,
    leadCreateInputSchema.parse({
      title: "Assurance véhicule",
      category: "vehicle",
      object: "Voiture",
      context: "Contexte isolé",
      clientUserId: owner.userId,
      clientProfileId: null,
      clientName: "Client isolé",
      email: "client@confirmations.test",
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
  const routed = await repository.command(
    admin,
    lead.id,
    { action: "assign", revision: lead.revision, responsibleId: advisor.userId, reason: "Test" },
    key(),
  );
  return repository.command(
    advisor,
    lead.id,
    { action: "accept", revision: routed.revision },
    key(),
  );
}
async function closeWithoutContract(advisor: PartnerActor, leadId: string) {
  const current = await repository.detail(advisor, leadId);
  return repository.command(
    advisor,
    leadId,
    {
      action: "close",
      revision: current.revision,
      result: "client_refusal",
      reason: "client_refusal",
      comment: "Le client renonce.",
    },
    key(),
  );
}
const verifications = async (leadId: string) =>
  (
    await database.pool.query<{ id: string; kind: string; priority: string; audience: string }>(
      "select id,kind,priority,audience from partner_quality_cases where lead_id=$1 order by created_at",
      [leadId],
    )
  ).rows;

it("opens a verification, never a complaint, when the client reports a contract the request does not declare", async () => {
  const owner = { ...(await actor()), wallet: true };
  const advisor = await professional("Alex Conseiller");
  const lead = await request(owner, advisor);
  await closeWithoutContract(advisor, lead.id);

  // The factual answers travel with the five-star survey, apart from the rating.
  const survey = (await repository.surveys(owner, lead.id)).items[0]!;
  await repository.respondSurvey(
    owner,
    survey.id,
    {
      rating: 5,
      experience: "advisor",
      positives: ["advice"],
      improvements: [],
      comment: "",
      callbackRequested: false,
      facts: {
        ...unknown,
        contact: "yes",
        contract: "yes",
        insurer: "Assureur cité",
        signedOn: "2026-09-30",
      },
      confirmed: true,
    },
    key(),
  );
  const stored = (
    await database.pool.query<{ response: Record<string, unknown> }>(
      "select response from partner_survey_responses where survey_id=$1",
      [survey.id],
    )
  ).rows[0]!.response;
  expect(stored).not.toHaveProperty("facts");
  const [verification] = await verifications(lead.id);
  expect(verification).toMatchObject({
    kind: "verification",
    priority: "high",
    audience: "coverview",
  });

  // The client reads their statement, never the declared state or whether a verification followed.
  const own = await repository.walletConfirmations(owner, lead.id);
  expect(own.items).toEqual([expect.objectContaining({ channel: "survey", comment: "" })]);
  expect(JSON.stringify(own)).not.toContain("contract_undeclared");
  expect(JSON.stringify(own)).not.toContain("declared");
  // The internal verification stays out of the client's quality list, which still loads.
  const mine = await repository.qualityQueue(owner, { state: "all" }, lead.id);
  expect(mine.items.map((item) => item.id)).not.toContain(verification!.id);
  await expect(repository.qualityCase(owner, verification!.id)).rejects.toMatchObject({
    statusCode: 404,
  });

  // CoverView sees the difference, in its queue of possibly undeclared contracts.
  const queue = await repository.qualityQueue(admin, {
    state: "open",
    reason: "undeclared_contract",
  });
  expect(queue.items.map((item) => item.id)).toContain(verification!.id);
  expect(queue.undeclaredContracts).toBeGreaterThanOrEqual(1);
  const read = await repository.qualityCase(admin, verification!.id);
  expect(read.confirmations[0]).toMatchObject({
    channel: "survey",
    discrepancies: ["contract_undeclared"],
    declared: { contract: false, contact: false },
    facts: { contract: "yes", insurer: "Assureur cité", signedOn: "2026-09-30" },
  });
  expect(read.canRequestReconciliation).toBe(true);

  // No sanction and no money: no complaint in the evaluation, no financial record.
  expect((await repository.evaluation(admin, advisor.userId)).operational.complaints).toBe(0);
  expect((await database.pool.query("select 1 from partner_economy_cases")).rowCount).toBe(0);

  // A later statement joins the open verification instead of opening another one.
  await repository.confirmFromWallet(
    owner,
    lead.id,
    {
      facts: { ...unknown, contract: "yes" },
      comment: "J'ai signé chez cet assureur.",
      confirmed: true,
    },
    key(),
  );
  expect(await verifications(lead.id)).toHaveLength(1);
  expect((await repository.qualityCase(admin, verification!.id)).confirmations).toHaveLength(2);
  // Bounded: three statements a day from Wallet.
  for (let index = 0; index < 2; index += 1)
    await repository.confirmFromWallet(
      owner,
      lead.id,
      { facts: { ...unknown, contract: "unknown" }, comment: "", confirmed: true },
      key(),
    );
  await expect(
    repository.confirmFromWallet(
      owner,
      lead.id,
      { facts: { ...unknown, contract: "unknown" }, comment: "", confirmed: true },
      key(),
    ),
  ).rejects.toMatchObject({ statusCode: 429 });

  // The client's export holds their own statements, never the declared state or the differences.
  const copy = await createDataRightsOperations(database.pool, repository).walletExport(owner);
  const exported = copy.requests.find((item) => item.lead.id === lead.id);
  expect(exported?.confirmations?.items.map((item) => item.channel).sort()).toEqual([
    "survey",
    "wallet",
    "wallet",
    "wallet",
  ]);
  expect(JSON.stringify(exported?.confirmations)).not.toContain("declared");
});

it("asks the professional concerned to reconcile, who answers CoverView only, and closes with an outcome", async () => {
  const owner = { ...(await actor()), wallet: true };
  const advisor = await professional("Bea Conseillère");
  const outsider = await professional("Oscar Autre");
  const lead = await request(owner, advisor);
  await closeWithoutContract(advisor, lead.id);
  await repository.confirmFromWallet(
    owner,
    lead.id,
    {
      facts: { ...unknown, contract: "yes" },
      comment: "Commentaire privé du client",
      confirmed: true,
    },
    key(),
  );
  const [verification] = await verifications(lead.id);
  const id = verification!.id;
  let current = await repository.qualityCase(admin, id);
  const ask = (professionalId: string) =>
    repository.actQualityCase(
      admin,
      id,
      {
        expectedRevision: current.revision,
        action: "request_reconciliation",
        note: "Merci de confirmer l'état déclaré de cette demande.",
        nextAction: "Lire la réponse du conseiller",
        dueAt: later(72),
        sharedWithClient: false,
        verified: false,
        professionalId,
      },
      key(),
    );
  await expect(ask(outsider.userId)).rejects.toMatchObject({ code: "PARTNER_INVALID_ASSIGNEE" });
  current = await ask(advisor.userId);
  expect(current.reconciliation?.professionalId).toBe(advisor.userId);
  const asked = await database.pool.query(
    "select 1 from partner_notifications where recipient_id=$1 and kind='quality.reconciliation' and resolved_at is null",
    [advisor.userId],
  );
  expect(asked.rowCount).toBe(1);

  // The professional reads the facts and the request, never the client's comment.
  const seen = await repository.qualityCase(advisor, id);
  expect(seen.confirmations[0]?.discrepancies).toEqual(["contract_undeclared"]);
  expect(JSON.stringify(seen)).not.toContain("Commentaire privé du client");
  expect(seen.history.map((entry) => entry.action)).toContain("request_reconciliation");
  await expect(repository.qualityCase(outsider, id)).rejects.toMatchObject({ statusCode: 404 });
  const answered = await repository.replyQualityCase(
    advisor,
    id,
    { expectedRevision: seen.revision, note: "Aucun contrat conclu par notre cabinet." },
    key(),
  );
  expect(answered.history[0]).toMatchObject({
    action: "reply",
    sharedWithClient: false,
    sharedWithProfessional: true,
  });
  // The verification is CoverView's: the client never reads it, nor this answer.
  await expect(repository.qualityCase(owner, id)).rejects.toMatchObject({ statusCode: 404 });
  expect(
    (
      await database.pool.query(
        "select 1 from partner_notifications where recipient_id=$1 and kind='quality.reconciliation' and resolved_at is null",
        [advisor.userId],
      )
    ).rowCount,
  ).toBe(0);

  // A verification of a client statement closes with an outcome, and nothing else follows.
  current = await repository.qualityCase(admin, id);
  const close = (outcome?: "confirmed" | "unfounded" | "inconclusive") =>
    repository.actQualityCase(
      admin,
      id,
      {
        expectedRevision: current.revision,
        action: "close",
        note: "Vérification terminée avec les deux parties.",
        nextAction: "",
        dueAt: null,
        sharedWithClient: false,
        verified: true,
        ...(outcome ? { outcome } : {}),
      },
      key(),
    );
  await expect(close()).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  const closed = await close("unfounded");
  expect(closed).toMatchObject({ state: "closed", outcome: "unfounded" });
  expect((await repository.evaluation(admin, advisor.userId)).operational.complaints).toBe(0);
});

it("records a CoverView quality call and verifies a contact the client does not confirm", async () => {
  const owner = { ...(await actor()), wallet: true };
  const advisor = await professional("Cleo Conseillère");
  let lead = await request(owner, advisor);
  lead = await repository.command(
    advisor,
    lead.id,
    {
      action: "contact",
      revision: lead.revision,
      outcome: "reached",
      note: "Premier contact consigné",
      nextAction: "Préparer l'analyse",
      dueAt: later(48),
    },
    key(),
  );
  const call = (occurredAt: string, by = admin) =>
    repository.recordQualityContact(
      by,
      lead.id,
      {
        channel: "call",
        facts: { ...unknown, contact: "no", contract: "unknown" },
        note,
        occurredAt,
        confirmed: true,
      },
      key(),
    );
  await expect(call(later(-1), advisor)).rejects.toMatchObject({ statusCode: 403 });
  await expect(call(later(1))).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  const recorded = await call(new Date().toISOString());
  expect(recorded).toMatchObject({
    channel: "call",
    declared: { contact: true },
    discrepancies: ["contact_unconfirmed"],
  });
  const [verification] = await verifications(lead.id);
  expect(verification).toMatchObject({ kind: "verification", audience: "coverview" });
  // CoverView's own contacts are not shown to the client as their statements.
  expect((await repository.walletConfirmations(owner, lead.id)).items).toEqual([]);
  expect((await repository.leadConfirmations(admin, lead.id)).items).toHaveLength(1);
  // In the export, CoverView's record of the call belongs to the complete access only.
  const copy = await createDataRightsOperations(database.pool, repository).walletExport(owner);
  const exported = copy.requests.find((item) => item.lead.id === lead.id);
  expect(exported?.confirmations?.items).toEqual([]);
  expect(exported?.internal).toBeNull();
  // The evidence is written once.
  await expect(
    database.pool.query(
      "update partner_client_confirmations set comment='Réécrit' where lead_id=$1",
      [lead.id],
    ),
  ).rejects.toMatchObject({ code: "23514" });
});

it("replays a repeated statement and joins simultaneous statements into one verification", async () => {
  const owner = { ...(await actor()), wallet: true };
  const advisor = await professional("Gil Conseiller");
  const lead = await request(owner, advisor);
  await closeWithoutContract(advisor, lead.id);
  const statement = {
    facts: { ...unknown, contract: "yes" as const },
    comment: "",
    confirmed: true as const,
  };
  const statements = async () =>
    (
      await database.pool.query<{ count: number }>(
        "select count(*)::int count from partner_client_confirmations where lead_id=$1",
        [lead.id],
      )
    ).rows[0]!.count;
  // The same key replays the first statement without recording it twice.
  const replayed = key();
  await repository.confirmFromWallet(owner, lead.id, statement, replayed);
  await repository.confirmFromWallet(owner, lead.id, statement, replayed);
  expect(await statements()).toBe(1);
  // Two statements at the same time: both are kept, one verification follows them.
  await Promise.all([
    repository.confirmFromWallet(owner, lead.id, statement, key()),
    repository.confirmFromWallet(owner, lead.id, statement, key()),
  ]);
  expect(await statements()).toBe(3);
  expect(await verifications(lead.id)).toHaveLength(1);
});
