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
const later = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_wallet_offers_test")
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
    [value.userId, key(), `${key()}@wallet-offers.test`],
  );
  await database.pool.query("insert into identity_profiles(id,user_id) values($1,$2)", [
    key(),
    value.userId,
  ]);
  await database.pool.query(
    "insert into identity_sessions(id,user_id,workos_session_id,token_hash,device,expires_at,mfa_verified_at) values($1,$2,$3,$4,'Isolated wallet offers',now()+interval '1 hour',now()-interval '1 second')",
    [value.id, value.userId, key(), sha256(key())],
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
      reason: "Test isolé",
      reviewDueAt: null,
      organizationState: "approved",
    },
    key(),
  );
  return person;
}
const revision = async (who: PartnerActor, id: string) =>
  (await repository.detail(who, id)).revision;
async function assign(lead: { id: string }, responsible: PartnerActor) {
  const routed = await repository.command(
    admin,
    lead.id,
    {
      action: "assign",
      revision: await revision(admin, lead.id),
      responsibleId: responsible.userId,
      reason: "Test",
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
async function request(owner: PartnerActor, responsible: PartnerActor) {
  const lead = await repository.create(
    owner,
    leadCreateInputSchema.parse({
      title: "Comparaison d'assurance véhicule",
      category: "vehicle",
      object: "Voiture",
      context: "Offres isolées",
      clientUserId: owner.userId,
      clientProfileId: null,
      clientName: "Personne isolée",
      email: "client@wallet-offers.test",
      phone: "",
      language: "fr",
      source: "Test",
      transmissionAuthorized: true,
      priority: "normal",
      draft: false,
      nextAction: "Comparer",
      dueAt: later(24),
    }),
    key(),
  );
  return assign(lead, responsible);
}
async function published(lead: LeadDetail, responsible: PartnerActor, company: string) {
  const documentId = `doc_${key()}`;
  const quote = "Parking CHF 2000 par événement";
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
        pages: [{ page: 1, text: quote, method: "isolated", version: "test" }],
      }),
    ],
  );
  const created = await repository.command(
    responsible,
    lead.id,
    {
      action: "offer",
      revision: await revision(responsible, lead.id),
      offer: leadOfferInputSchema.parse({
        documentId,
        sourceFingerprint: (await repository.extraction(responsible, lead.id, documentId))
          .sourceFingerprint,
        company,
        product: "Auto",
        reference: "",
        annualPremiumMinor: 128000,
        currency: "CHF",
        validUntil: later(24),
        effectiveDate: null,
        features: [
          {
            key: "parking",
            category: "parking",
            label: "Parking",
            value: "CHF 2000",
            conditions: "",
            coverage: "unknown",
            origin: "extracted",
            verification: "verified",
            source: quote,
            sourcePage: 1,
            limit: { value: 200000, unit: "chf", period: "event" },
          },
        ],
        summary: "",
        limitations: "",
        replacesId: null,
      }),
    },
    key(),
  );
  const offerId = created.offers.find((offer) => offer.company === company && offer.active)!.id;
  for (const action of ["offer_review", "offer_publish"] as const)
    await repository.command(
      responsible,
      lead.id,
      { action, revision: await revision(responsible, lead.id), offerId },
      key(),
    );
  return offerId;
}
// A document of the client's own space.

it("lists the offers published to the client, request by request, and keeps the subject of each request", async () => {
  const owner = { ...(await actor()), wallet: true };
  const stranger = { ...(await actor()), wallet: true };
  const advisor = await professional("Gaëlle Conseillère");
  const lead = await request(owner, advisor);
  const axa = await published(lead, advisor, "AXA");
  const zurich = await published(lead, advisor, "Zurich");
  await repository.command(
    advisor,
    lead.id,
    {
      action: "offer_withdraw",
      revision: await revision(advisor, lead.id),
      offerId: zurich,
      reason: "Offre retirée dans un test isolé",
    },
    key(),
  );
  // A claim from Wallet: no category step, "other", and the subject kept on the request.
  const claim = await repository.create(
    owner,
    leadCreateInputSchema.parse({
      title: "Sinistre",
      requestKind: "claim",
      category: "other",
      object: "",
      context: "Dégât des eaux dans la cuisine.",
      clientUserId: owner.userId,
      clientProfileId: null,
      clientName: "Personne isolée",
      email: "client@wallet-offers.test",
      phone: "",
      language: "fr",
      source: "Wallet",
      transmissionAuthorized: true,
      priority: "normal",
      draft: false,
      nextAction: "",
      dueAt: null,
    }),
    key(),
  );
  expect(claim.requestKind).toBe("claim");
  expect((await repository.detail(advisor, lead.id)).requestKind).toBe("new_insurance");

  const offers = await repository.walletOffers(owner, {});
  expect(offers.truncated).toBe(false);
  expect(offers.items).toHaveLength(1);
  expect(offers.items[0]!.lead).toMatchObject({
    id: lead.id,
    requestKind: "new_insurance",
    category: "vehicle",
    object: "Voiture",
  });
  // The withdrawn version is gone; the published one carries its document.
  expect(offers.items[0]!.offers.map((offer) => offer.id)).toEqual([axa]);
  expect(offers.items[0]!.offers[0]).toMatchObject({
    company: "AXA",
    canDownload: true,
    companyId: "axa",
    sourceMime: "application/pdf",
  });
  // A logo needs a recognised company: an unknown name keeps its text only.
  const withdrawn = (await repository.detail(advisor, lead.id)).offers.find(
    (offer) => offer.id === zurich,
  );
  expect(withdrawn?.company).toBe("Zurich");
  expect(withdrawn?.companyId).toBeUndefined();
  expect((await repository.walletOffers(owner, { clientProfileId: "self" })).items).toHaveLength(1);
  expect((await repository.walletOffers(stranger, {})).items).toEqual([]);
  await expect(repository.walletOffers(advisor, {})).rejects.toMatchObject({ statusCode: 403 });
});
