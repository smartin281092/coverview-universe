import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  leadCreateInputSchema,
  leadOfferInputSchema,
  partnerApplicationInputSchema,
  type LeadDetail,
  type LeadOffer,
} from "@coverview/contracts/partner";
import { createDatabase } from "./db/database.js";
import { createPartnerRepository } from "../modules/partner-workspace/partner.repository.js";
import type { PartnerActor } from "../modules/partner-workspace/partner.policy.js";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let repository: ReturnType<typeof createPartnerRepository>;
let admin: PartnerActor;
const key = () => randomUUID();
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_comparison_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  const migrationsFolder = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  await migrate(database.db, { migrationsFolder });
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
    [value.userId, key(), `${key()}@comparison.test`],
  );
  await database.pool.query("insert into identity_profiles(id,user_id) values($1,$2)", [
    key(),
    value.userId,
  ]);
  await database.pool.query(
    "insert into identity_sessions(id,user_id,workos_session_id,token_hash,device,expires_at,mfa_verified_at) values($1,$2,$3,$4,'Isolated comparison',now()+interval '1 hour',now()-interval '1 second')",
    [value.id, value.userId, key(), sha256(key())],
  );
  if (administrator)
    await database.pool.query(
      "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated test')",
      [key(), value.userId],
    );
  return value;
}
async function advisor() {
  const person = await actor();
  await repository.apply(
    person,
    partnerApplicationInputSchema.parse({
      name: "Conseillère comparée",
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
async function assigned(owner: PartnerActor, responsible: PartnerActor) {
  const lead = await repository.create(
    owner,
    leadCreateInputSchema.parse({
      title: "Changement d'assurance véhicule",
      category: "vehicle",
      object: "Voiture",
      context: "Comparaison isolée",
      clientUserId: owner.userId,
      clientProfileId: null,
      clientName: "Personne isolée",
      email: "client@comparison.test",
      phone: "",
      language: "fr",
      source: "Test",
      transmissionAuthorized: true,
      priority: "normal",
      draft: false,
      nextAction: "Comparer",
      dueAt: new Date(Date.now() + 86400000).toISOString(),
    }),
    key(),
  );
  const routed = await repository.command(
    admin,
    lead.id,
    {
      action: "assign",
      revision: lead.revision,
      responsibleId: responsible.userId,
      reason: "Test isolé",
    },
    key(),
  );
  return repository.command(
    responsible,
    lead.id,
    { action: "accept", revision: routed.revision },
    key(),
  );
}
// An original whose single page holds the quoted passages, as the review gate requires.
async function offered(
  lead: LeadDetail,
  responsible: PartnerActor,
  company: string,
  text: string,
  features: LeadOffer["features"],
) {
  const documentId = `doc_${key()}`;
  await database.pool.query(
    "insert into files(id,user_id,name,mime,declared_mime,size,checksum,object_key,state,category,purpose,scan_version,analysis) values($1,$2,'Offre.pdf','application/pdf','application/pdf',10,$3,$4,'ready','insurance','lead_offer','isolated-scan',$5)",
    [
      documentId,
      responsible.userId,
      sha256(key()),
      key(),
      JSON.stringify({
        category: "insurance",
        evidence: null,
        fields: [],
        pages: [{ page: 1, text, method: "isolated", version: "test" }],
      }),
    ],
  );
  const current = await repository.detail(responsible, lead.id);
  const next = await repository.command(
    responsible,
    lead.id,
    {
      action: "offer",
      revision: current.revision,
      offer: leadOfferInputSchema.parse({
        documentId,
        sourceFingerprint: (await repository.extraction(responsible, lead.id, documentId))
          .sourceFingerprint,
        company,
        product: "Auto",
        reference: "",
        annualPremiumMinor: 128000,
        currency: "CHF",
        validUntil: new Date(Date.now() + 86400000).toISOString(),
        effectiveDate: null,
        features,
        summary: "",
        limitations: "",
        replacesId: null,
      }),
    },
    key(),
  );
  return next.offers.find((offer) => offer.company === company)!;
}
const review = async (responsible: PartnerActor, leadId: string, offerId: string) =>
  repository.command(
    responsible,
    leadId,
    {
      action: "offer_review",
      revision: (await repository.detail(responsible, leadId)).revision,
      offerId,
    },
    key(),
  );
const benefit = (
  value: Partial<LeadOffer["features"][number]> & { label: string; source: string },
) => ({
  key: "other",
  value: "",
  conditions: "",
  coverage: "unknown" as const,
  origin: "extracted" as const,
  verification: "verified" as const,
  sourcePage: 1,
  ...value,
});

it("compares reviewed offers by normalized category and only ranks sourced amounts", async () => {
  const owner = { ...(await actor()), wallet: true },
    responsible = await advisor();
  // A structured amount without its page cannot pass review.
  const gated = await assigned(owner, responsible);
  const unsourced = await offered(gated, responsible, "Helvetia", "Parking CHF 3'000", [
    benefit({
      label: "Parking",
      source: "Parking CHF 3'000",
      category: "parking",
      value: "CHF 3'000",
      limit: { value: 300000, unit: "chf", period: "event" },
      sourcePage: null,
    }),
  ]);
  await expect(review(responsible, gated.id, unsourced.id)).rejects.toMatchObject({
    code: "PARTNER_INVALID_DOCUMENT",
  });

  const lead = await assigned(owner, responsible);
  const axa = await offered(
    lead,
    responsible,
    "AXA",
    "Assistance mobilité incluse. Dommages de parking jusqu'à CHF 5'000 par événement.",
    [
      benefit({
        label: "Assistance mobilité",
        source: "Assistance mobilité incluse",
        category: "assistance",
        coverage: "included",
        value: "Incluse",
      }),
      benefit({
        label: "Dommages de parking",
        source: "Dommages de parking jusqu'à CHF 5'000 par événement",
        category: "parking",
        value: "CHF 5'000",
        limit: { value: 500000, unit: "chf", period: "event" },
      }),
    ],
  );
  const zurich = await offered(
    lead,
    responsible,
    "Zurich",
    "Assistance Europe incluse. Parking CHF 2'000 par sinistre.",
    [
      benefit({
        label: "Assistance Europe",
        source: "Assistance Europe incluse",
        category: "assistance",
        coverage: "included",
        value: "Incluse",
      }),
      benefit({
        label: "Parking",
        source: "Parking CHF 2'000 par sinistre",
        category: "parking",
        value: "CHF 2'000",
        limit: { value: 200000, unit: "chf", period: "event" },
      }),
    ],
  );
  await review(responsible, lead.id, axa.id);
  await review(responsible, lead.id, zurich.id);

  const detail = await repository.detail(responsible, lead.id);
  expect(detail.offers.find((offer) => offer.id === axa.id)!.features[1]).toMatchObject({
    category: "parking",
    limit: { value: 500000, unit: "chf", period: "event" },
  });
  const comparison = detail.offerComparison!;
  expect(comparison).toMatchObject({ catalog: "benefit-catalog-v1", reference: "none" });
  // Columns follow the offer cards (newest first).
  expect(comparison.columns.map((column) => [column.company, column.premiumStatus])).toEqual([
    ["Zurich", "verified"],
    ["AXA", "verified"],
  ]);
  expect(comparison.rows.map((row) => row.key)).toEqual(["parking", "assistance"]);
  const [parking, assistance] = comparison.rows;
  expect(assistance!.cells.map((cell) => cell?.label)).toEqual([
    "Assistance Europe",
    "Assistance mobilité",
  ]);
  expect(parking!.cells.map((cell) => cell?.best)).toEqual([false, true]);
  expect(parking!.cells[1]).toMatchObject({ page: 1, verification: "verified", change: null });

  // Wallet compares only what was published to it.
  expect((await repository.detail(owner, lead.id)).offerComparison!.columns).toEqual([]);
  await repository.command(
    responsible,
    lead.id,
    {
      action: "offer_publish",
      revision: (await repository.detail(responsible, lead.id)).revision,
      offerId: axa.id,
    },
    key(),
  );
  const wallet = (await repository.detail(owner, lead.id)).offerComparison!;
  expect(wallet.columns.map((column) => column.company)).toEqual(["AXA"]);
  expect(wallet.rows.map((row) => row.cells.length)).toEqual([1, 1]);
  expect(wallet.rows[0]!.cells[0]!.best).toBe(false);
});
