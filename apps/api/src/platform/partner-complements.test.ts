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
import { createDataRightsOperations } from "../modules/partner-workspace/partner.data-rights.js";
import { processPartnerContinuity } from "../modules/partner-workspace/partner.continuity.js";
import type { PartnerActor } from "../modules/partner-workspace/partner.policy.js";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let repository: ReturnType<typeof createPartnerRepository>;
let admin: PartnerActor;
const key = () => randomUUID();
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const later = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();
const message = "Merci de confirmer votre contrat actuel pour terminer la comparaison.";

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_complements_test")
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
    [value.userId, key(), `${key()}@complements.test`],
  );
  await database.pool.query("insert into identity_profiles(id,user_id) values($1,$2)", [
    key(),
    value.userId,
  ]);
  await database.pool.query(
    "insert into identity_sessions(id,user_id,workos_session_id,token_hash,device,expires_at,mfa_verified_at) values($1,$2,$3,$4,'Isolated complements',now()+interval '1 hour',now()-interval '1 second')",
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
      context: "Complément isolé",
      clientUserId: owner.userId,
      clientProfileId: null,
      clientName: "Personne isolée",
      email: "client@complements.test",
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
async function ownDocument(owner: PartnerActor, name: string) {
  const documentId = `doc_${key()}`;
  await database.pool.query(
    `insert into files(id,user_id,name,mime,declared_mime,size,checksum,object_key,state,category,scan_version,analysis)
     values($1,$2,$3,'application/pdf','application/pdf',10,$4,$5,'ready','insurance','isolated-scan',$6)`,
    [
      documentId,
      owner.userId,
      name,
      sha256(documentId),
      key(),
      JSON.stringify({
        category: "insurance",
        evidence: null,
        fields: [],
        pages: [
          { page: 1, text: "Police actuelle du client", method: "isolated", version: "test" },
        ],
      }),
    ],
  );
  return documentId;
}
const notices = async (leadId: string, kind: string) =>
  (
    await database.pool.query<{ recipient_id: string | null; action: string; open: boolean }>(
      "select recipient_id,action,resolved_at is null open from partner_notifications where lead_id=$1 and kind=$2 order by created_at",
      [leadId, kind],
    )
  ).rows;
const tick = async (leadId: string) => {
  await database.pool.query("update partner_leads set continuity_checked_at=null where id=$1", [
    leadId,
  ]);
  await processPartnerContinuity(database.pool);
};

it("reassesses the incomplete analysis in time, follows the current responsible and names its gaps", async () => {
  const owner = { ...(await actor()), wallet: true };
  const first = await professional("Aline Conseillère");
  const second = await professional("Basile Conseiller");
  const lead = await request(owner, first);
  await published(lead, first, "AXA");
  const zurich = await published(lead, first, "Zurich");
  expect(await notices(lead.id, "analysis.incomplete")).toEqual([]);

  // A changed original makes Zurich incomparable without any command: the worker sees it.
  await database.pool.query(
    "update files set analysis=jsonb_set(analysis,'{pages,0,text}','\"Texte réanalysé\"'),revision=revision+1 where id=(select data->>'documentId' from partner_offers where id=$1)",
    [zurich],
  );
  await tick(lead.id);
  expect(await notices(lead.id, "analysis.incomplete")).toEqual([
    { recipient_id: first.userId, action: "review_offer", open: true },
  ]);

  // The notice follows the request to its next responsible.
  await assign(lead, second);
  expect(await notices(lead.id, "analysis.incomplete")).toEqual([
    { recipient_id: second.userId, action: "review_offer", open: true },
  ]);
  const dossier = await repository.partnerComplements(second, lead.id);
  expect(dossier.gaps).toMatchObject({
    incomplete: true,
    referenceContract: "absent",
    contractReviewPending: false,
  });
  expect(dossier.canRequest).toBe(true);
  await expect(repository.partnerComplements(first, lead.id)).rejects.toMatchObject({
    statusCode: 404,
  });

  // Withdrawn, the incomparable offer leaves an analysis that concludes again.
  await repository.command(
    second,
    lead.id,
    {
      action: "offer_withdraw",
      revision: await revision(second, lead.id),
      offerId: zurich,
      reason: "Original réanalysé, à remplacer",
    },
    key(),
  );
  await tick(lead.id);
  expect(await notices(lead.id, "analysis.incomplete")).toEqual([
    { recipient_id: second.userId, action: "review_offer", open: false },
  ]);
});

it("asks the client a complement, who answers with a document of their space, and the professional closes it", async () => {
  const owner = { ...(await actor()), wallet: true };
  const advisor = await professional("Chloé Conseillère");
  const outsider = await professional("Denis Autre");
  const lead = await request(owner, advisor);
  const ask = (by: PartnerActor, dueAt = later(72)) =>
    repository.requestComplement(
      by,
      lead.id,
      {
        items: ["reference_contract", "documents"],
        message,
        dueAt,
        pauseFollowUp: true,
        confirmed: true,
      },
      key(),
    );
  await expect(ask(owner)).rejects.toMatchObject({ statusCode: 403 });
  await expect(ask(outsider)).rejects.toMatchObject({ statusCode: 404 });
  await expect(ask(advisor, later(0.5))).rejects.toMatchObject({
    code: "PARTNER_ACTION_REQUIRED",
  });
  const asked = await ask(advisor);
  const id = asked.items[0]!.id;
  expect(asked).toMatchObject({ canRequest: false });
  expect(asked.items[0]).toMatchObject({
    state: "open",
    items: ["reference_contract", "documents"],
    requestedBy: "Chloé Conseillère",
    canClose: true,
    canAnswer: false,
  });
  await expect(ask(advisor)).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  // The follow-up waits until the due date, through the usual waiting state.
  const detail = await repository.detail(advisor, lead.id);
  expect(Date.parse(detail.waiting!.until)).toBe(Date.parse(asked.items[0]!.dueAt));
  expect(await notices(lead.id, "complement.requested")).toEqual([
    { recipient_id: owner.userId, action: "complement", open: true },
  ]);

  // The client answers with a document of their space, kept as it is.
  const documentId = await ownDocument(owner, "Police actuelle.pdf");
  const candidate = (await repository.complementCandidates(owner, lead.id)).items.find(
    (item) => item.documentId === documentId,
  )!;
  const wallet = await repository.walletComplements(owner, lead.id);
  expect(wallet.items[0]).toMatchObject({ id, state: "open", canAnswer: true, canClose: false });
  const answer = (text: string) =>
    repository.answerComplement(
      owner,
      lead.id,
      id,
      {
        text,
        documents: [{ documentId, fingerprint: candidate.fingerprint }],
        confirmed: true,
      },
      key(),
    );
  const answered = await answer("Voici ma police actuelle.");
  expect(answered.items[0]).toMatchObject({ state: "answered", canAnswer: false });
  await expect(answer("Une seconde réponse.")).rejects.toMatchObject({
    code: "PARTNER_CONFLICT",
  });
  expect(
    (
      await database.pool.query<{ retained: boolean }>(
        "select retained_at is not null retained from files where id=$1",
        [documentId],
      )
    ).rows[0],
  ).toEqual({ retained: true });
  expect(await notices(lead.id, "complement.requested")).toEqual([
    { recipient_id: owner.userId, action: "complement", open: false },
  ]);
  expect(await notices(lead.id, "complement.answered")).toEqual([
    { recipient_id: advisor.userId, action: "review_complement", open: true },
  ]);
  const seen = await repository.partnerComplements(advisor, lead.id);
  expect(seen.items[0]!.answer).toMatchObject({
    text: "Voici ma police actuelle.",
    documents: [{ documentId, name: "Police actuelle.pdf", current: true, canDownload: true }],
  });
  expect(await repository.complementSource(advisor, lead.id, id, documentId, true)).toBe(
    documentId,
  );
  expect(
    (
      await database.pool.query(
        "select 1 from partner_events where lead_id=$1 and kind='complement.document_viewed.v1'",
        [lead.id],
      )
    ).rowCount,
  ).toBe(1);
  await expect(
    repository.complementSource(outsider, lead.id, id, documentId),
  ).rejects.toMatchObject({ statusCode: 404 });

  // Closed by the professional: "completed" only after an answer; the note stays with them.
  const close = (outcome: "completed" | "unanswered" | "withdrawn") =>
    repository.closeComplement(
      advisor,
      lead.id,
      id,
      { outcome, note: "Police reçue et comparée.", confirmed: true },
      key(),
    );
  await expect(close("withdrawn")).rejects.toMatchObject({ code: "PARTNER_INVALID_TRANSITION" });
  const closed = await close("completed");
  expect(closed).toMatchObject({ canRequest: true });
  expect(closed.items[0]).toMatchObject({
    state: "closed",
    closure: { outcome: "completed", note: "Police reçue et comparée." },
    canClose: false,
  });
  expect((await repository.walletComplements(owner, lead.id)).items[0]!.closure).toMatchObject({
    outcome: "completed",
    note: "",
  });
  expect(await notices(lead.id, "complement.answered")).toEqual([
    { recipient_id: advisor.userId, action: "review_complement", open: false },
  ]);

  // The client's copy holds the request and its answer.
  const copy = await createDataRightsOperations(database.pool, repository).walletExport(owner);
  expect(copy.requests.find((item) => item.lead.id === lead.id)?.complements?.items).toHaveLength(
    1,
  );

  // A changed document is no longer served, and the evidence is written once.
  await database.pool.query(
    "update files set analysis=jsonb_set(analysis,'{pages,0,text}','\"Autre texte\"'),revision=revision+1 where id=$1",
    [documentId],
  );
  expect(
    (await repository.partnerComplements(advisor, lead.id)).items[0]!.answer!.documents[0],
  ).toMatchObject({ current: false, canDownload: false, name: null });
  await expect(repository.complementSource(advisor, lead.id, id, documentId)).rejects.toMatchObject(
    { statusCode: 404 },
  );
  await expect(
    database.pool.query(
      "update partner_complement_answers set text='Réécrit' where request_id=$1",
      [id],
    ),
  ).rejects.toMatchObject({ code: "23514" });
});

it("closes an unanswered request only after its date, refuses a foreign answer and invalidates on a change of client", async () => {
  const owner = { ...(await actor()), wallet: true };
  const stranger = { ...(await actor()), wallet: true };
  const advisor = await professional("Emma Conseillère");
  const lead = await request(owner, advisor);
  const asked = await repository.requestComplement(
    advisor,
    lead.id,
    {
      items: ["information"],
      message,
      dueAt: later(48),
      pauseFollowUp: false,
      confirmed: true,
    },
    key(),
  );
  const id = asked.items[0]!.id;
  expect((await repository.detail(advisor, lead.id)).waiting).toBeNull();
  await expect(
    repository.answerComplement(
      stranger,
      lead.id,
      id,
      { text: "Réponse d'une autre personne.", documents: [], confirmed: true },
      key(),
    ),
  ).rejects.toMatchObject({ statusCode: 404 });
  await expect(
    database.pool.query(
      "insert into partner_complement_answers(request_id,answered_by,text,documents) values($1,$2,'Réponse directe en base','[]')",
      [id, stranger.userId],
    ),
  ).rejects.toMatchObject({ code: "23514" });
  await expect(
    repository.closeComplement(
      advisor,
      lead.id,
      id,
      { outcome: "unanswered", note: "", confirmed: true },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_TRANSITION" });

  // Another client for the request: the open request is invalidated, its notice settled.
  await database.pool.query("update partner_leads set client_user_id=$2 where id=$1", [
    lead.id,
    stranger.userId,
  ]);
  expect(
    (
      await database.pool.query(
        "select invalidated_at is not null invalid from partner_complement_requests where id=$1",
        [id],
      )
    ).rows[0],
  ).toEqual({ invalid: true });
  expect(await notices(lead.id, "complement.requested")).toEqual([
    { recipient_id: owner.userId, action: "complement", open: false },
  ]);
  expect((await repository.partnerComplements(advisor, lead.id)).items).toEqual([]);
});

it("replays a repeated request and keeps a single open request under concurrency", async () => {
  const owner = { ...(await actor()), wallet: true };
  const advisor = await professional("Fanny Conseillère");
  const input = {
    items: ["documents" as const],
    message,
    dueAt: later(48),
    pauseFollowUp: false,
    confirmed: true as const,
  };
  // The same key replays the first answer without writing a second request.
  const first = await request(owner, advisor);
  const replayed = key();
  const once = await repository.requestComplement(advisor, first.id, input, replayed);
  const again = await repository.requestComplement(advisor, first.id, input, replayed);
  expect(again.items.map((item) => item.id)).toEqual(once.items.map((item) => item.id));
  const count = async (leadId: string) =>
    (
      await database.pool.query<{ count: number }>(
        "select count(*)::int count from partner_complement_requests where lead_id=$1",
        [leadId],
      )
    ).rows[0]!.count;
  expect(await count(first.id)).toBe(1);
  // Two requests at the same time: the request lock lets one through, the other conflicts.
  const second = await request(owner, advisor);
  const results = await Promise.allSettled([
    repository.requestComplement(advisor, second.id, input, key()),
    repository.requestComplement(advisor, second.id, input, key()),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(results.find((result) => result.status === "rejected")).toMatchObject({
    reason: { code: "PARTNER_CONFLICT" },
  });
  expect(await count(second.id)).toBe(1);
});
