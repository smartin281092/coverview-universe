import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { beforeAll, afterAll, expect, it } from "vitest";
import { leadCreateInputSchema, partnerApplicationInputSchema } from "@coverview/contracts/partner";
import { createDatabase } from "./db/database.js";
import { createPartnerRepository } from "../modules/partner-workspace/partner.repository.js";
import type { PartnerActor } from "../modules/partner-workspace/partner.policy.js";
import {
  commercialTermsSchema,
  marketPublicationSchema,
  marketReservationInputSchema,
  type CommercialTerms,
  type EconomyEntryInput,
} from "@coverview/contracts/partner-economy";
import { calculateEconomy } from "../modules/partner-workspace/partner.economy-calculation.js";
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
    .withDatabase("coverview_marketplace_economy_test")
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

const note = "Source et conditions synthétiques, uniquement dans PostgreSQL jetable";
const at = (ms: number) => new Date(Date.now() + ms).toISOString();
function terms(model: "fixed" | "success" = "success", extra: Partial<CommercialTerms> = {}) {
  return commercialTermsSchema.parse({
    categories: ["vehicle"],
    companies: ["axa"],
    validFrom: at(-1000),
    validUntil: at(86400000),
    supplier:
      model === "fixed"
        ? { model, amountMinor: 10000, payer: "receiver", trigger: "authorized_handover" }
        : { model, rateBps: 2000, trigger: "commission_received" },
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
    ...extra,
  });
}
async function setup(
  model: "fixed" | "success" = "success",
  extra: Partial<CommercialTerms> = {},
  managed = false,
) {
  const supplier = await professional(),
    receiver = await professional(),
    outsider = await professional(),
    owner = { ...(await actor()), wallet: true };
  const profileId = managed ? key() : null;
  if (profileId)
    await database.pool.query(
      "insert into managed_profiles(id,user_id,kind,display_name) values($1,$2,'person','Profil de test isolé')",
      [profileId, owner.userId],
    );
  const lead = await assigned(owner, supplier, profileId);
  const condition = await repository.createCommercialCondition(
    supplier,
    { terms: terms(model, extra), confirmed: true },
    key(),
  );
  await repository.reviewCommercialCondition(
    admin,
    condition.id,
    { decision: "approve", reason: note, validationReference: note },
    key(),
  );
  const publication = marketPublicationSchema.parse({
    leadRevision: lead.revision,
    conditionId: condition.id,
    language: "fr",
    canton: "GE",
    modes: ["video"],
    reason: "specialist",
    qualification: "contacted",
    steps: ["contact"],
    constraints: [],
    expiresAt: at(60000),
    publicationConfirmed: true,
  });
  const market = await repository.publishMarket(supplier, lead.id, publication, key());
  return {
    supplier,
    receiver,
    outsider,
    owner,
    lead,
    condition,
    publication,
    profileId,
    id: market.publication.id,
  };
}
async function reserve(
  s: Awaited<ReturnType<typeof setup>>,
  mode: "transfer" | "co_advice" = "transfer",
  expiresAt = at(30000),
  validUntil = at(86400000),
) {
  const input = marketReservationInputSchema.parse({
    targetId: s.receiver.userId,
    conditionId: s.condition.id,
    mission: {
      mode,
      access: "contribute",
      communication: "client_direct",
      scope: note,
      responsibilities: note,
      powers: note,
      limitations: note,
      validUntil,
    },
    expiresAt,
    reason: note,
    termsAccepted: true,
    suitabilityReviewed: true,
  });
  const value = await repository.reserveMarket(s.supplier, s.id, input, key());
  return { input, reservation: value.reservations[0]! };
}
async function accept(
  s: Awaited<ReturnType<typeof setup>>,
  mode: "transfer" | "co_advice" = "transfer",
) {
  const r = await reserve(s, mode);
  await repository.decideMarketMandate(
    s.owner,
    r.reservation.id,
    { decision: "accept", reason: note, confirmed: true },
    key(),
  );
  return repository.decideMarket(
    s.receiver,
    r.reservation.id,
    { decision: "accept", reason: note, confirmed: true },
    key(),
  );
}
it("limits the publication to structured facts, scopes candidates and requires the exact separate Wallet mandate", async () => {
  const s = await setup();
  const view = await repository.marketDetail(s.receiver, s.id);
  expect(view.publication.leadId).toBeNull();
  for (const secret of [
    s.lead.id,
    s.owner.userId,
    "Personne isolée",
    "client@assessment.test",
    "Besoin isolé",
  ])
    expect(JSON.stringify(view)).not.toContain(secret);
  await expect(repository.marketDetail(s.owner, s.id)).rejects.toMatchObject({ statusCode: 403 });
  await repository.applyMarket(
    s.receiver,
    s.id,
    { reason: note, suitabilityAcknowledged: true },
    key(),
  );
  expect((await repository.marketDetail(s.outsider, s.id)).applications).toHaveLength(0);
  await repository.withdrawMarketApplication(s.receiver, s.id, key());
  expect((await repository.marketDetail(s.supplier, s.id)).applications[0]!.withdrawn).toBe(true);
  const r = await reserve(s);
  await expect(
    repository.decideMarket(
      s.receiver,
      r.reservation.id,
      { decision: "accept", reason: note, confirmed: true },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  expect((await repository.marketMandates(s.owner, s.lead.id)).items[0]!.condition).toBeNull();
  await expect(
    repository.decideMarketMandate(
      { ...s.outsider, wallet: true },
      r.reservation.id,
      { decision: "accept", reason: note, confirmed: true },
      key(),
    ),
  ).rejects.toMatchObject({ statusCode: 404 });
  await repository.decideMarketMandate(
    s.owner,
    r.reservation.id,
    { decision: "accept", reason: note, confirmed: true },
    key(),
  );
  const accepted = await repository.decideMarket(
    s.receiver,
    r.reservation.id,
    { decision: "accept", reason: note, confirmed: true },
    key(),
  );
  expect(accepted.state).toBe("accepted");
  expect(accepted.agreementId).toBe(r.reservation.id);
  const raw = (
    await database.pool.query<{
      responsible_id: string;
      notification_cycle: number;
      market_valid_until: Date;
    }>(
      "select responsible_id,notification_cycle,market_valid_until from partner_leads where id=$1",
      [s.lead.id],
    )
  ).rows[0];
  expect(raw?.responsible_id).toBe(s.receiver.userId);
  expect(raw?.market_valid_until).toBeInstanceOf(Date);
  expect((await repository.economyAgreements(s.receiver)).items[0]!.leadId).toBe(s.lead.id);
  await expect(
    database.pool.query("update partner_market_reservations set reason='rewrite' where id=$1", [
      r.reservation.id,
    ]),
  ).rejects.toMatchObject({ code: "23514" });
  await expect(
    database.pool.query("delete from partner_market_mandates where reservation_id=$1", [
      r.reservation.id,
    ]),
  ).rejects.toMatchObject({ code: "23514" });
});
it("serializes concurrent reservations and preserves replay without creating another proposal", async () => {
  const s = await setup(),
    k = key();
  const input = marketReservationInputSchema.parse({
    targetId: s.receiver.userId,
    conditionId: s.condition.id,
    mission: {
      mode: "co_advice",
      access: "read",
      communication: "referent_only",
      scope: note,
      responsibilities: note,
      powers: note,
      limitations: note,
      validUntil: at(86400000),
    },
    expiresAt: at(30000),
    reason: note,
    termsAccepted: true,
    suitabilityReviewed: true,
  });
  const result = await Promise.allSettled([
    repository.reserveMarket(s.supplier, s.id, input, k),
    repository.reserveMarket(s.supplier, s.id, { ...input, targetId: s.outsider.userId }, key()),
  ]);
  expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(result.filter((r) => r.status === "rejected")[0]).toMatchObject({
    reason: { statusCode: 409 },
  });
  const replay = await repository.reserveMarket(s.supplier, s.id, input, k);
  expect(replay.reservations).toHaveLength(1);
  await expect(
    repository.reserveMarket(s.supplier, s.id, { ...input, reason: note + " altered" }, k),
  ).rejects.toMatchObject({ code: "PARTNER_IDEMPOTENCY_REUSED" });
});
it("withdraws operational authority while retaining only accepted financial rights", async () => {
  const s = await setup("fixed"),
    agreement = await accept(s);
  const financial = await repository.createEconomyCase(
    admin,
    {
      agreementId: agreement.id,
      stream: "lead_price",
      finalPolicyId: null,
      companyId: null,
      reference: note,
      scopeReference: note,
      confirmed: true,
    },
    key(),
  );
  expect(financial.confirmedMinor).toBeNull();
  expect(financial.receivedMinor).toBe(0);
  await repository.decideMarketMandate(
    s.owner,
    agreement.id,
    { decision: "withdraw", reason: note, confirmed: true },
    key(),
  );
  expect((await repository.economyAgreements(s.receiver)).items[0]!.leadId).toBeNull();
  expect((await repository.economyCase(s.receiver, financial.id)).id).toBe(financial.id);
  await expect(repository.economyCase(s.outsider, financial.id)).rejects.toMatchObject({
    statusCode: 404,
  });
  await expect(repository.economyCase(s.owner, financial.id)).rejects.toMatchObject({
    statusCode: 403,
  });
  await repository.review(
    admin,
    s.supplier.userId,
    {
      revision: (await repository.context(s.supplier)).application!.revision,
      state: "suspended",
      roles: ["advisor"],
      reason: note,
      reviewDueAt: null,
      organizationState: "approved",
    },
    key(),
  );
  expect((await repository.economyCase(s.supplier, financial.id)).canRecord).toBe(false);
  expect((await repository.economyAgreements(s.supplier)).items).toHaveLength(1);
  await database.pool.query(
    "update identity_sessions set revoked_at=clock_timestamp() where id=$1",
    [s.supplier.id],
  );
  await expect(repository.economyCase(s.supplier, financial.id)).rejects.toMatchObject({
    statusCode: 403,
  });
});
it("rejects a reservation that expires while the command waits and rolls its whole transaction back", async () => {
  const s = await setup();
  await database.pool.query(
    "create function marketplace_test_delay() returns trigger language plpgsql as $$ begin if NEW.operation='market.reserved.v1' then perform pg_sleep(0.4); end if; return NEW; end $$; create trigger marketplace_test_delay before insert on partner_commands for each row execute function marketplace_test_delay()",
  );
  try {
    await expect(reserve(s, "co_advice", at(200), at(2000))).rejects.toMatchObject({
      statusCode: 409,
    });
  } finally {
    await database.pool.query(
      "drop trigger marketplace_test_delay on partner_commands; drop function marketplace_test_delay()",
    );
  }
  expect((await repository.marketDetail(s.supplier, s.id)).reservations).toHaveLength(0);
});
it("bounds co-advice access at the mission expiry without waiting for a worker", async () => {
  const s = await setup(),
    r = await reserve(s, "co_advice", at(400), at(1200));
  await repository.decideMarketMandate(
    s.owner,
    r.reservation.id,
    { decision: "accept", reason: note, confirmed: true },
    key(),
  );
  await repository.decideMarket(
    s.receiver,
    r.reservation.id,
    { decision: "accept", reason: note, confirmed: true },
    key(),
  );
  expect((await repository.economyAgreements(s.receiver)).items[0]!.leadId).toBe(s.lead.id);
  await setTimeout(1250);
  expect((await repository.economyAgreements(s.receiver)).items[0]!.leadId).toBeNull();
  expect((await repository.marketMandates(s.owner, s.lead.id)).items[0]!.mandate).toBe("expired");
});
it("records fixed-price partial receipts, identifies overpayment and makes no CoverView lead-sale fee", async () => {
  const s = await setup("fixed"),
    agreement = await accept(s);
  let value = await repository.createEconomyCase(
    admin,
    {
      agreementId: agreement.id,
      stream: "lead_price",
      finalPolicyId: null,
      companyId: null,
      reference: note,
      scopeReference: note,
      confirmed: true,
    },
    key(),
  );
  const post = async (who: PartnerActor, entry: EconomyEntryInput) => {
    value = await repository.recordEconomy(
      who,
      value.id,
      { revision: value.revision, entry, evidenceChecked: true },
      key(),
    );
    return value;
  };
  const proof = { reference: note, occurredAt: at(-1000) };
  await post(admin, {
    kind: "estimate",
    minimumMinor: 10000,
    maximumMinor: 10000,
    probabilityBps: null,
    assumptions: note,
    proof,
  });
  expect(value.balances.every((b) => b.availableMinor === 0)).toBe(true);
  await post(admin, {
    kind: "confirm",
    grossMinor: 10000,
    deductions: [],
    triggerReference: note,
    proof,
  });
  const receive = {
    kind: "receive" as const,
    grossMinor: 6000,
    deductions: [],
    statementReference: note,
    settlementReference: "Ligne isolée A",
    proof,
  };
  await post(s.supplier, receive);
  await post(s.supplier, { ...receive, settlementReference: "Ligne isolée B" });
  expect(value.balances).toHaveLength(1);
  expect(value.balances[0]).toMatchObject({
    beneficiary: s.supplier.userId,
    receivedMinor: 12000,
    paidMinor: 12000,
    recoveryDueMinor: 2000,
    availableMinor: 0,
  });
  await expect(post(s.supplier, receive)).rejects.toMatchObject({ statusCode: 409 });
  await post(s.supplier, {
    kind: "refund",
    beneficiary: s.supplier.userId,
    amountMinor: 2000,
    proof,
  });
  expect(value.balances[0]).toMatchObject({
    recoveryDueMinor: 0,
    clawbackMinor: 0,
    recoveredMinor: 2000,
  });
  await post(admin, { kind: "clawback", beneficiary: s.supplier.userId, amountMinor: 2000, proof });
  await post(s.supplier, {
    kind: "refund",
    beneficiary: s.supplier.userId,
    amountMinor: 2000,
    proof,
  });
  expect(value.balances[0]).toMatchObject({
    recoveryDueMinor: 0,
    clawbackMinor: 2000,
    recoveredMinor: 4000,
  });
  await post(s.supplier, {
    kind: "reconcile",
    statementReference: note,
    settlementReference: note,
    expectedMinor: 10000,
    observedMinor: 10000,
    explanation: note,
    proof,
  });
  expect(value.reconciliation).toMatchObject({ differenceMinor: 0, current: true });
  await expect(
    database.pool.query("update partner_economy_entries set entry='{}' where case_id=$1", [
      value.id,
    ]),
  ).rejects.toMatchObject({ code: "23514" });
});
it("allocates cumulative net cents exactly and consumes reserves before clawback without double loss", () => {
  const t = terms(),
    proof = { reference: note, occurredAt: at(-1000) };
  const weighted = calculateEconomy(t, "supplier", "receiver", false, [
    {
      id: "estimate",
      revision: 1,
      entry: {
        kind: "estimate",
        minimumMinor: 10001,
        maximumMinor: 20001,
        probabilityBps: 3333,
        assumptions: note,
        proof,
      },
    },
  ]);
  expect(weighted.estimate).toMatchObject({
    weightedMinimumMinor: 3333,
    weightedMaximumMinor: 6666,
  });
  expect(weighted.balances.every((b) => b.availableMinor === 0)).toBe(true);
  const entries: EconomyEntryInput[] = [
    { kind: "confirm", grossMinor: 10003, deductions: [], triggerReference: note, proof },
    {
      kind: "receive",
      grossMinor: 3334,
      deductions: [],
      statementReference: note,
      settlementReference: note,
      proof,
    },
    {
      kind: "receive",
      grossMinor: 6669,
      deductions: [],
      statementReference: note,
      settlementReference: note,
      proof,
    },
    { kind: "reserve", beneficiary: "supplier", amountMinor: 500, proof },
    { kind: "pay", beneficiary: "supplier", amountMinor: 1500, proof },
    { kind: "clawback", beneficiary: "supplier", amountMinor: 500, proof },
  ];
  const result = calculateEconomy(
    t,
    "supplier",
    "receiver",
    false,
    entries.map((entry, i) => ({ id: String(i), revision: i + 1, entry })),
  );
  expect(result.balances.map((b) => b.receivedMinor).reduce((a, b) => a + b, 0)).toBe(10003);
  expect(result.balances.find((b) => b.beneficiary === "supplier")).toMatchObject({
    confirmedMinor: 2000,
    receivedMinor: 2000,
    paidMinor: 1500,
    reservedMinor: 0,
    clawbackMinor: 500,
    availableMinor: 0,
    recoveryDueMinor: 0,
  });
  const reversed = calculateEconomy(t, "supplier", "receiver", false, [
    ...entries.map((entry, i) => ({ id: String(i), revision: i + 1, entry })),
    { id: "reverse", revision: 7, entry: { kind: "reverse", entryId: "5", reason: note, proof } },
  ]);
  expect(reversed.balances.find((b) => b.beneficiary === "supplier")).toMatchObject({
    reservedMinor: 500,
    clawbackMinor: 0,
    availableMinor: 0,
    recoveryDueMinor: 0,
  });
});

async function policyFixture(s: Awaited<ReturnType<typeof setup>>) {
  // Synthetic canonical rows only in this disposable database; not signature or bank evidence.
  const file = key(),
    offer = key(),
    policy = key();
  await database.pool.query(
    "insert into files(id,user_id,name,mime,declared_mime,size,checksum,object_key,state,category) values($1,$2,'Fixture isolée.pdf','application/pdf','application/pdf',10,$3,$4,'ready','insurance')",
    [file, s.owner.userId, "a".repeat(64), key()],
  );
  await database.pool.query(
    "insert into partner_offers(id,lead_id,document_id,data,version,family_id) values($1,$2,$3,'{}',1,$1)",
    [offer, s.lead.id, file],
  );
  await database.pool.query(
    "insert into partner_final_policies(id,lead_id,offer_id,document_id,fingerprint,source_snapshot,confirmed_by) values($1,$2,$3,$4,$5,$6,$7)",
    [
      policy,
      s.lead.id,
      offer,
      file,
      "a".repeat(64),
      JSON.stringify({ candidate: { facts: { companyId: "axa" } } }),
      s.owner.userId,
    ],
  );
  return policy;
}
it("separates the collector circuits, limits contributors to their own rights and reconciles partial commissions", async () => {
  const contributor = await professional(),
    s = await setup("success", {
      collector: "receiver",
      contributors: [{ userId: contributor.userId, rateBps: 500, basisReference: note }],
      deductions: [{ code: "documented", description: note }],
    }),
    a = await accept(s, "co_advice"),
    policy = await policyFixture(s);
  let c = await repository.createEconomyCase(
    admin,
    {
      agreementId: a.id,
      stream: "contract_commission",
      finalPolicyId: policy,
      companyId: "axa",
      reference: note,
      scopeReference: note,
      confirmed: true,
    },
    key(),
  );
  const proof = { reference: note, occurredAt: at(-1000) },
    post = async (who: PartnerActor, entry: EconomyEntryInput) =>
      (c = await repository.recordEconomy(
        who,
        c.id,
        { revision: c.revision, entry, evidenceChecked: true },
        key(),
      ));
  await expect(
    post(s.receiver, {
      kind: "confirm",
      grossMinor: 11000,
      deductions: [{ code: "documented", amountMinor: 1000 }],
      triggerReference: note,
      proof,
    }),
  ).rejects.toMatchObject({ statusCode: 403 });
  await post(admin, {
    kind: "confirm",
    grossMinor: 11000,
    deductions: [{ code: "documented", amountMinor: 1000 }],
    triggerReference: note,
    proof,
  });
  const receipt = {
    kind: "receive" as const,
    grossMinor: 5500,
    deductions: [{ code: "documented", amountMinor: 500 }],
    statementReference: "Bordereau isolé collectif",
    settlementReference: "Ligne unique isolée 001",
    proof,
  };
  await expect(post(s.supplier, receipt)).rejects.toMatchObject({ statusCode: 403 });
  await post(s.receiver, receipt);
  expect(c.balances.reduce((sum, b) => sum + b.receivedMinor, 0)).toBe(5000);
  await post(admin, { kind: "reserve", beneficiary: s.supplier.userId, amountMinor: 200, proof });
  await post(s.receiver, { kind: "pay", beneficiary: s.supplier.userId, amountMinor: 800, proof });
  await post(admin, { kind: "clawback", beneficiary: s.supplier.userId, amountMinor: 400, proof });
  expect(c.balances.find((b) => b.beneficiary === s.supplier.userId)).toMatchObject({
    reservedMinor: 0,
    recoveryDueMinor: 200,
    availableMinor: 0,
  });
  await post(s.receiver, {
    kind: "recover",
    beneficiary: s.supplier.userId,
    amountMinor: 200,
    proof,
  });
  expect(c.balances.find((b) => b.beneficiary === s.supplier.userId)?.recoveryDueMinor).toBe(0);
  const own = await repository.economyCase(contributor, c.id);
  expect(own).toMatchObject({
    ownOnly: true,
    terms: null,
    finalPolicyId: null,
    canRecord: false,
    confirmedMinor: 500,
    receivedMinor: 250,
  });
  expect(own.balances).toHaveLength(1);
  expect(own.history).toHaveLength(0);
  expect((await repository.economyCases(contributor)).items).toHaveLength(1);
  expect((await repository.economyAgreements(contributor)).items).toHaveLength(0);
  const secondPolicy = await policyFixture(s),
    second = await repository.createEconomyCase(
      admin,
      {
        agreementId: a.id,
        stream: "contract_commission",
        finalPolicyId: secondPolicy,
        companyId: "axa",
        reference: note,
        scopeReference: note,
        confirmed: true,
      },
      key(),
    );
  const confirmed = await repository.recordEconomy(
    admin,
    second.id,
    {
      revision: 0,
      entry: { kind: "confirm", grossMinor: 5000, deductions: [], triggerReference: note, proof },
      evidenceChecked: true,
    },
    key(),
  );
  await expect(
    repository.recordEconomy(
      s.receiver,
      second.id,
      { revision: confirmed.revision, entry: receipt, evidenceChecked: true },
      key(),
    ),
  ).rejects.toMatchObject({ statusCode: 409 });
  const thirdPolicy = await policyFixture(s);
  await expect(
    repository.createEconomyCase(
      admin,
      {
        agreementId: a.id,
        stream: "contract_commission",
        finalPolicyId: thirdPolicy,
        companyId: "css",
        reference: note,
        scopeReference: note,
        confirmed: true,
      },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
});
it("keeps context invalidation monotone after a profile change and return", async () => {
  const s = await setup("success", {}, true),
    r = await reserve(s);
  await repository.decideMarketMandate(
    s.owner,
    r.reservation.id,
    { decision: "accept", reason: note, confirmed: true },
    key(),
  );
  await database.pool.query("update managed_profiles set revision=revision+1 where id=$1", [
    s.profileId,
  ]);
  await database.pool.query("update managed_profiles set revision=revision-1 where id=$1", [
    s.profileId,
  ]);
  expect((await repository.marketDetail(s.supplier, s.id)).reservations[0]!.state).toBe(
    "context_changed",
  );
  await expect(
    repository.decideMarket(
      s.receiver,
      r.reservation.id,
      { decision: "accept", reason: note, confirmed: true },
      key(),
    ),
  ).rejects.toMatchObject({ statusCode: 409 });
  const accepted = await setup("success", {}, true);
  await accept(accepted);
  await database.pool.query("update managed_profiles set revision=revision+1 where id=$1", [
    accepted.profileId,
  ]);
  expect((await repository.economyAgreements(accepted.receiver)).items[0]!.leadId).toBeNull();
});
it("keeps terms immutable and checks fresh MFA on financial administration", async () => {
  const s = await setup(),
    anotherAdmin = await actor(true);
  await expect(
    database.pool.query("update partner_commercial_conditions set terms='{}' where id=$1", [
      s.condition.id,
    ]),
  ).rejects.toMatchObject({ code: "23514" });
  await repository.reviewCommercialCondition(
    s.supplier,
    s.condition.id,
    { decision: "withdraw", reason: note, validationReference: note },
    key(),
  );
  await expect(reserve(s)).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  await database.pool.query(
    "update identity_sessions set mfa_verified_at=clock_timestamp()-interval '25 hours' where id=$1",
    [anotherAdmin.id],
  );
  await expect(repository.economyCases(anotherAdmin)).rejects.toMatchObject({ statusCode: 403 });
});
