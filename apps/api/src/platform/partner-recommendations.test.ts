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
const rationale = "Meilleure couverture parking pour un prix proche du contrat actuel.";

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_recommendations_test")
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
    [value.userId, key(), `${key()}@recommendations.test`],
  );
  await database.pool.query("insert into identity_profiles(id,user_id) values($1,$2)", [
    key(),
    value.userId,
  ]);
  await database.pool.query(
    "insert into identity_sessions(id,user_id,workos_session_id,token_hash,device,expires_at,mfa_verified_at) values($1,$2,$3,$4,'Isolated recommendations',now()+interval '1 hour',now()-interval '1 second')",
    [value.id, value.userId, key(), sha256(key())],
  );
  if (administrator)
    await database.pool.query(
      "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated test')",
      [key(), value.userId],
    );
  return value;
}
async function professional(roles: ("advisor" | "referrer")[] = ["advisor"]) {
  const person = await actor();
  await repository.apply(
    person,
    partnerApplicationInputSchema.parse({
      name: "Claire Conseillère",
      organization: "Organisation isolée",
      phone: "",
      roles,
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
      roles,
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
      context: "Recommandation isolée",
      clientUserId: owner.userId,
      clientProfileId: null,
      clientName: "Personne isolée",
      email: "client@recommendations.test",
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
const revision = async (actor: PartnerActor, id: string) =>
  (await repository.detail(actor, id)).revision;
async function published(
  lead: LeadDetail,
  responsible: PartnerActor,
  company: string,
  francs: number,
) {
  const documentId = `doc_${key()}`;
  const quote = `Parking CHF ${francs} par événement`;
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
        validUntil: new Date(Date.now() + 86400000).toISOString(),
        effectiveDate: null,
        features: [
          {
            key: "parking",
            category: "parking",
            label: "Parking",
            value: `CHF ${francs}`,
            conditions: "",
            coverage: "unknown",
            origin: "extracted",
            verification: "verified",
            source: quote,
            sourcePage: 1,
            limit: { value: francs * 100, unit: "chf", period: "event" },
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

it("publishes a validated recommendation distinct from the orientation and marks it to review on change", async () => {
  const owner = { ...(await actor()), wallet: true },
    responsible = await professional(),
    colleague = await professional();
  const lead = await assigned(owner, responsible);
  const axa = await published(lead, responsible, "AXA", 5000);
  const zurich = await published(lead, responsible, "Zurich", 2000);

  const dossier = await repository.recommendations(responsible, lead.id);
  expect(dossier).toMatchObject({ canRecommend: true, current: null, history: [] });
  expect(dossier.orientation).toMatchObject({ kind: "offers_only", suggestion: null });
  expect(
    dossier.choices.map((choice) => [choice.offerId ?? choice.kind, choice.deviation]),
  ).toEqual([
    [zurich, false],
    [axa, false],
    ["keep_current", false],
    ["none", false],
  ]);
  await expect(repository.recommendations(owner, lead.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  // Without contact and advice rights on this request, a member cannot recommend.
  await expect(
    repository.recommend(
      colleague,
      lead.id,
      {
        kind: "offer",
        offerId: axa,
        rationale,
        attention: "",
        deviationReason: null,
        basis: dossier.basis,
      },
      key(),
    ),
  ).rejects.toThrow(/^PARTNER_(ACCESS_DENIED|NOT_FOUND)$/u);

  const retry = key();
  const input = {
    kind: "offer" as const,
    offerId: axa,
    rationale,
    attention: "Franchise identique.",
    deviationReason: null,
    basis: dossier.basis,
  };
  const saved = await repository.recommend(responsible, lead.id, input, retry);
  expect(saved.current).toMatchObject({
    version: 1,
    kind: "offer",
    offerId: axa,
    company: "AXA",
    status: "current",
    deviation: false,
    deviationReason: null,
    orientationKind: "offers_only",
    author: "Claire Conseillère (Organisation isolée)",
  });
  // An exact retry replays the same recommendation; the orientation is recomputed at each read.
  const replay = await repository.recommend(responsible, lead.id, input, retry);
  expect(replay.history).toEqual(saved.history);
  expect(
    (
      await database.pool.query(
        "select recipient_id,action from partner_notifications where lead_id=$1 and kind='recommendation.published'",
        [lead.id],
      )
    ).rows,
  ).toEqual([{ recipient_id: owner.userId, action: "review_offer" }]);
  const wallet = await repository.detail(owner, lead.id);
  expect(wallet.recommendation).toMatchObject({ kind: "offer", company: "AXA", status: "current" });
  expect(wallet.offerOrientation).toMatchObject({ kind: "offers_only" });

  // A new published version changes the basis: the recommendation is to review everywhere.
  await published(lead, responsible, "Helvetia", 3000);
  expect((await repository.recommendations(responsible, lead.id)).current!.status).toBe(
    "to_review",
  );
  expect((await repository.detail(owner, lead.id)).recommendation!.status).toBe("to_review");
  await expect(repository.recommend(responsible, lead.id, input, key())).rejects.toMatchObject({
    code: "PARTNER_CONFLICT",
  });
  await expect(
    database.pool.query(
      "update partner_offer_recommendations set rationale=rationale||'.' where lead_id=$1",
      [lead.id],
    ),
  ).rejects.toMatchObject({ code: "23514" });
});

it("requires a reason to recommend while the orientation is insufficient, and hides it from Wallet", async () => {
  const owner = { ...(await actor()), wallet: true },
    responsible = await professional();
  const lead = await assigned(owner, responsible);
  const axa = await published(lead, responsible, "AXA", 5000);
  const zurich = await published(lead, responsible, "Zurich", 2000);
  // Past its validity, Zurich can no longer be compared: the orientation becomes insufficient.
  await database.pool.query(
    "update partner_offers set data=jsonb_set(data,'{validUntil}',to_jsonb($2::text)) where id=$1",
    [zurich, new Date(Date.now() - 3600000).toISOString()],
  );
  const dossier = await repository.recommendations(responsible, lead.id);
  expect(dossier.orientation.kind).toBe("insufficient");
  expect(
    dossier.choices.map((choice) => [choice.offerId ?? choice.kind, choice.deviation]),
  ).toEqual([
    [axa, true],
    ["keep_current", true],
    ["none", false],
  ]);
  const base = { rationale, attention: "", basis: dossier.basis };
  await expect(
    repository.recommend(
      responsible,
      lead.id,
      {
        ...base,
        kind: "offer",
        offerId: zurich,
        deviationReason: "Motif détaillé mais offre échue.",
      },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_OFFER_NOT_READY" });
  await expect(
    repository.recommend(
      responsible,
      lead.id,
      { ...base, kind: "offer", offerId: axa, deviationReason: null },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  const reason = "Le client a confirmé par téléphone que la nouvelle offre lui convient.";
  const saved = await repository.recommend(
    responsible,
    lead.id,
    { ...base, kind: "offer", offerId: axa, deviationReason: reason },
    key(),
  );
  expect(saved.current).toMatchObject({
    deviation: true,
    deviationReason: reason,
    orientationKind: "insufficient",
  });
  expect((await repository.detail(owner, lead.id)).recommendation).toMatchObject({
    deviation: false,
    deviationReason: null,
  });
  const none = await repository.recommend(
    responsible,
    lead.id,
    {
      ...base,
      kind: "none",
      offerId: null,
      deviationReason: "Ce motif ne doit pas être conservé ici.",
    },
    key(),
  );
  expect(none.current).toMatchObject({
    version: 2,
    kind: "none",
    deviation: false,
    deviationReason: null,
  });
  expect(none.history.map((item) => item.version)).toEqual([2, 1]);
});

it("asks the responsible to complete an analysis that cannot conclude, then resolves it", async () => {
  const owner = { ...(await actor()), wallet: true },
    responsible = await professional();
  const lead = await assigned(owner, responsible);
  const notice = async () =>
    (
      await database.pool.query<Record<string, unknown>>(
        "select recipient_id,action,resolved_at is null open from partner_notifications where lead_id=$1 and kind='analysis.incomplete'",
        [lead.id],
      )
    ).rows;
  await published(lead, responsible, "AXA", 5000);
  const zurich = await published(lead, responsible, "Zurich", 2000);
  expect(await notice()).toEqual([]);
  // A changed original makes Zurich incomparable: the next offer command opens the notice.
  await database.pool.query(
    "update files set analysis=jsonb_set(analysis,'{pages,0,text}','\"Texte réanalysé\"'),revision=revision+1 where id=(select data->>'documentId' from partner_offers where id=$1)",
    [zurich],
  );
  await published(lead, responsible, "Helvetia", 3000);
  expect(await notice()).toEqual([
    { recipient_id: responsible.userId, action: "review_offer", open: true },
  ]);
  await repository.command(
    responsible,
    lead.id,
    {
      action: "offer_withdraw",
      revision: await revision(responsible, lead.id),
      offerId: zurich,
      reason: "Original réanalysé, à remplacer",
    },
    key(),
  );
  expect(await notice()).toEqual([
    { recipient_id: responsible.userId, action: "review_offer", open: false },
  ]);
});
