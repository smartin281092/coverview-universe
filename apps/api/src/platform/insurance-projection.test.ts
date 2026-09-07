import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { type DocumentAnalysis, type DocumentSummary } from "@coverview/contracts";
import { createDatabase } from "./db/database.js";
import { createIdentityRepository } from "../modules/identity/identity.repository.js";
import { createDocumentRepository } from "../modules/document-intelligence/document.repository.js";
import { documents } from "../modules/document-intelligence/document.schema.js";
import {
  companyOverview,
  detectedInsuranceDomain,
  quotedPremium,
} from "../modules/document-intelligence/document.insurance.js";
import { documentPresentation } from "../modules/document-intelligence/document.presentation.js";
import { extractDocument } from "../modules/document-intelligence/document.extraction.js";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
function analysis(text: string, title = "Police d’assurance automobile"): DocumentAnalysis {
  return {
    category: "insurance",
    classification: "insurance_policy",
    title,
    evidence: null,
    fields: [],
    pages: [{ page: 1, text, method: "isolated-test", version: "1" }],
  };
}
const policy = (number: string, amount = "100.00", currency = "CHF") =>
  `AXA\nPolice d’assurance automobile\nAssurance automobile\nPolice n° : ${number}\nDébut du contrat : 2026-01-01\nFin du contrat : 2026-12-31\nPersonne assurée : Personne de test\nPrime mensuelle : ${currency} ${amount}`;
function entry(content: DocumentAnalysis, checksum = randomUUID()) {
  const presentation = documentPresentation({
    category: "insurance",
    categoryCorrected: false,
    analysis: content,
  });
  const document: DocumentSummary = {
    id: `doc_${randomUUID()}`,
    name: "original.pdf",
    ...presentation,
    mime: "application/pdf",
    size: 100,
    checksum: digest(checksum),
    state: "ready",
    revision: 1,
    category: "insurance",
    createdAt: "2026-09-07T00:00:00.000Z",
    updatedAt: "2026-09-07T00:00:00.000Z",
    analysisRequested: true,
    failure: null,
    canRetry: false,
    canDownload: true,
  };
  return { document, analysis: content };
}
const today = new Date("2026-09-07T12:00:00Z");

it("uses content consistently, avoids address numbers as domains and leaves ambiguous insurers unknown", () => {
  expect(detectedInsuranceDomain("AXA\nAdresse : rue du Lac 3A")).toBeNull();
  expect(detectedInsuranceDomain("Prévoyance 3a et prévoyance 3b")).toBeNull();
  const content = analysis("Liechtenstein Life\nProsperity3a\nModèle d’offre", "Modèle d’offre");
  content.classification = "insurance_offer";
  const full = documentPresentation({
    category: "insurance",
    categoryCorrected: false,
    analysis: {
      ...content,
      pages: [
        ...content.pages,
        { page: 2, text: "AXA\nPrévoyance 3B", method: "test", version: "1" },
      ],
    },
  });
  expect(full.title).toBe("Prévoyance 3A · Liechtenstein Life · Offre");
  expect(full).toEqual(
    documentPresentation({ category: "insurance", categoryCorrected: false, analysis: content }),
  );
  expect(
    entry(analysis("AXA et Allianz\nPolice d’assurance automobile")).document.companyId,
  ).toBeNull();
});

it("never turns an offer, application, requested contract or misleading OCR title into an active contract", () => {
  const misleading = [
    "Demande de contrat",
    "Modèle d’offre",
    "Profil d’investisseur",
    "Contrat souhaité",
    "Exemple de contrat",
  ];
  const entries = misleading.map((heading) =>
    entry(analysis(`AXA\n${heading}\n${policy("P-100")}`)),
  );
  const result = companyOverview("axa", entries, today);
  expect(result.documents).toHaveLength(5);
  expect(result.contracts).toEqual([]);
  expect(result.stats.annualPremiumTotals).toEqual([]);
});

it("deduplicates policies, totals integer premiums per currency, and excludes unknown periods and conflicting versions", () => {
  const entries = [
    entry(analysis(policy("P-1"))),
    entry(analysis(policy("P-1"))),
    entry(analysis(policy("P-2", "19.95", "EUR"))),
    entry(analysis(policy("P-3").replace("Prime mensuelle", "Prime"))),
    entry(
      analysis(
        policy("P-4")
          .replace("Fin du contrat : 2026-12-31", "Fin du contrat : 2025-12-31")
          .replace("Début du contrat : 2026-01-01", "Début du contrat : 2025-01-01"),
      ),
    ),
  ];
  const result = companyOverview("axa", entries, today);
  expect(result.stats).toMatchObject({
    contractCount: 4,
    activeContractCount: 3,
    expiredContractCount: 1,
    premiumCoverage: { included: 2, total: 3 },
    incomplete: true,
  });
  expect(result.stats.annualPremiumTotals).toEqual([
    { currency: "CHF", amountMinor: 120000 },
    { currency: "EUR", amountMinor: 23940 },
  ]);
  expect(
    result.contracts.find((contract) => contract.policyNumber === "P-1")?.documentIds,
  ).toHaveLength(2);
  const conflicting = companyOverview(
    "axa",
    [...entries, entry(analysis(policy("P-1", "200.00")))],
    today,
  );
  expect(
    conflicting.contracts.find((contract) => contract.policyNumber === "P-1")?.premium,
  ).toBeNull();
  expect(conflicting.stats.annualPremiumTotals).toEqual([{ currency: "EUR", amountMinor: 23940 }]);
  const dates = companyOverview(
    "axa",
    [entries[0]!, entry(analysis(policy("P-1").replace("2026-12-31", "2027-12-31")))],
    today,
  );
  expect(dates.contracts[0]?.state).toBe("unknown");
  expect(dates.stats.annualPremiumTotals).toEqual([]);
  expect(quotedPremium("Prime annuelle : CHF 1’234.50")).toEqual({
    amountMinor: 123450,
    currency: "CHF",
    period: "year",
  });
  expect(quotedPremium("Capital assuré : CHF 500000.00")).toBeNull();
});

it("derives expiry only from explicit coverage dates and never asserts optimization", () => {
  const result = companyOverview(
    "axa",
    [
      entry(analysis(policy("P-1").replace("2026-12-31", "2026-09-30"))),
      entry(analysis(policy("P-2").replace("Fin du contrat", "Échéance de prime"))),
      entry(analysis(policy("P-3").replace("2026-01-01", "2026-10-01"))),
    ],
    today,
  );
  expect(
    result.contracts.map(({ state, expiresSoon, optimization }) => ({
      state,
      expiresSoon,
      optimization,
    })),
  ).toEqual([
    { state: "active", expiresSoon: true, optimization: "unknown" },
    { state: "unknown", expiresSoon: false, optimization: "unknown" },
    { state: "upcoming", expiresSoon: false, optimization: "unknown" },
  ]);
});

it("keeps valid transcription when optional facts cannot be normalized and still rejects fabricated citations", async () => {
  const page = "AXA\nPolice d’assurance\nAnnual premium: CHF 120.00\nAssurance spéciale";
  const value = {
    pageCount: 1,
    category: "insurance",
    classification: "insurance_policy",
    title: "Police d’assurance",
    titleEvidence: { page: 1, text: "Police d’assurance" },
    evidence: { page: 1, text: "Police d’assurance" },
    pages: [{ page: 1, text: page }],
    fields: [],
    insurance: {
      company: { value: "axa", evidence: { page: 1, text: "AXA" } },
      domain: { value: "other", evidence: { page: 1, text: "Assurance spéciale" } },
      policyNumber: null,
      insuredSubject: null,
      startsOn: null,
      endsOn: null,
      premium: {
        amountMinor: 12000,
        currency: "CHF",
        period: "year",
        evidence: { page: 1, text: "Annual premium: CHF 120.00" },
      },
    },
  };
  const provider = {
    available: () => Promise.resolve(true),
    structured: () =>
      Promise.resolve({
        value,
        model: "isolated-test",
        inputTokens: 1,
        outputTokens: 1,
        requestId: null,
      }),
  };
  const result = await extractDocument(
    provider,
    Buffer.from("test"),
    "application/pdf",
    AbortSignal.timeout(1000),
  );
  expect(result.analysis.pages[0]?.text).toBe(page);
  expect(result.analysis.insurance).toMatchObject({
    companyId: "axa",
    domain: null,
    premium: null,
  });
  value.insurance.company.evidence.text = "AXA fabricated quote";
  await expect(
    extractDocument(provider, Buffer.from("test"), "application/pdf", AbortSignal.timeout(1000)),
  ).rejects.toMatchObject({ code: "ai_invalid_result" });
});

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_insurance_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  await migrate(database.db, {
    migrationsFolder: fileURLToPath(new URL("../../drizzle/", import.meta.url)),
  });
});
afterAll(async () => {
  if (database) await database.pool.end();
  if (container) await container.stop();
});
it("projects only the current owner's undeleted documents with the same detail/list title", async () => {
  const identity = createIdentityRepository(database.db);
  async function owner() {
    const session = await identity.createSession({
      workosUserId: `user_${randomUUID()}`,
      workosSessionId: `session_${randomUUID()}`,
      email: "insurance-owner@isolated.test",
      device: "Isolated test",
      tokenHash: digest(randomUUID()),
      expiresAt: new Date(Date.now() + 3600000),
      loginStartedAt: new Date(Date.now() - 1000),
      requestId: randomUUID(),
    });
    if (!session) throw new Error("Isolated identity unavailable");
    return session;
  }
  const actor = await owner();
  const stranger = await owner();
  const repository = createDocumentRepository(database.db);
  const doc = await repository.create(
    actor,
    {
      name: "file.pdf",
      mime: "application/pdf",
      size: 100,
      checksum: digest("private policy"),
      analysisRequested: true,
    },
    randomUUID(),
  );
  await database.db
    .update(documents)
    .set({ category: "insurance", state: "ready", analysis: analysis(policy("PRIVATE-1")) })
    .where(eq(documents.id, doc.id));
  const overview = await repository.insuranceCompany(actor.userId, "axa");
  expect(overview.documents.map((item) => item.id)).toEqual([doc.id]);
  const detail = await repository.get(actor.userId, doc.id);
  const list = await repository.list(actor.userId);
  expect(detail.title).toBe("Voiture · AXA · Contrat");
  expect(list.documents[0]?.title).toBe(detail.title);
  expect(overview.documents[0]?.title).toBe(detail.title);
  expect((await repository.insuranceCompany(stranger.userId, "axa")).documents).toEqual([]);
  expect((await repository.insuranceCompany(stranger.userId, "axa")).contracts).toEqual([]);
  expect((await repository.insuranceCompany(actor.userId, "allianz")).documents).toEqual([]);
  await expect(repository.get(stranger.userId, doc.id)).rejects.toMatchObject({ statusCode: 404 });
  await database.db
    .update(documents)
    .set({ state: "deleted", deletedAt: new Date() })
    .where(eq(documents.id, doc.id));
  expect((await repository.insuranceCompany(actor.userId, "axa")).documents).toEqual([]);
});
