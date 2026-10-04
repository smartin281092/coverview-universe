import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, expect, it } from "vitest";
import { leadCreateInputSchema } from "@coverview/contracts/partner";
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
    .withDatabase("coverview_contract_proposal_test")
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
    [value.userId, key(), `${key()}@proposal.test`],
  );
  await database.pool.query("insert into identity_profiles(id,user_id) values($1,$2)", [
    key(),
    value.userId,
  ]);
  await database.pool.query(
    "insert into identity_sessions(id,user_id,workos_session_id,token_hash,device,expires_at,mfa_verified_at) values($1,$2,$3,$4,'Isolated proposal',now()+interval '1 hour',now()-interval '1 second')",
    [value.id, value.userId, key(), sha256(key())],
  );
  if (administrator)
    await database.pool.query(
      "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated test')",
      [key(), value.userId],
    );
  return value;
}
// A qualified policy original of the owner's own profile, as the document analysis states it.
async function policy(owner: PartnerActor, domain: string, policyNumber: string, subject: string) {
  const documentId = `doc_${key()}`;
  const source = {
    page: 1,
    text: "Police",
    method: "isolated",
    version: "test-v1",
    confidence: 1,
    box: null,
  };
  // An issued policy heading, and each source text on its page, as the Wallet projection requires.
  const title = domain === "motor" ? "Police automobile" : "Police d'assurance ménage";
  const text = `${title}
AXA
Police ${policyNumber}
${subject}
Prime mensuelle : CHF 100`;
  const at = (quote: string) => ({ ...source, text: quote });
  const analysis = {
    category: "insurance",
    title,
    classification: "insurance_policy",
    evidence: null,
    fields: [],
    pages: [{ page: 1, text, method: "isolated", version: "test-v1" }],
    insurance: {
      companyId: "axa",
      companySource: at("AXA"),
      domain,
      domainSource: at("Police"),
      policyNumber: { value: policyNumber, source: at(`Police ${policyNumber}`) },
      insuredSubject: { value: subject, source: at(subject) },
      startsOn: { value: "2026-01-01", source: at("Police") },
      endsOn: { value: "2026-12-31", source: at("Police") },
      premium: {
        amountMinor: 10000,
        currency: "CHF",
        period: "month",
        source: at("Prime mensuelle : CHF 100"),
      },
    },
  };
  await database.pool.query(
    "insert into files(id,user_id,name,mime,declared_mime,size,checksum,object_key,state,category,scan_version,analysis) values($1,$2,'Police.pdf','application/pdf','application/pdf',10,$3,$4,'ready','insurance','isolated-scan',$5)",
    [documentId, owner.userId, sha256(documentId), key(), JSON.stringify(analysis)],
  );
  return documentId;
}
const request = (owner: PartnerActor, objectReference: string) =>
  leadCreateInputSchema.parse({
    title: "Changement d'assurance auto",
    category: "vehicle",
    object: "Voiture",
    objectReference,
    context: "Proposition isolée",
    clientUserId: owner.userId,
    clientProfileId: null,
    clientName: "Personne isolée",
    email: "client@proposal.test",
    phone: "",
    language: "fr",
    source: "Wallet",
    transmissionAuthorized: true,
    priority: "normal",
    draft: false,
    nextAction: "",
    dueAt: null,
  });

it("proposes the exact current contract to its owner, then freezes the reference once linked", async () => {
  const owner = { ...(await actor()), wallet: true };
  const tesla = await policy(owner, "motor", "POL-123456", "Tesla Model Y, GE 123456");
  const fiat = await policy(owner, "motor", "POL-999999", "Fiat 500, VD 777");
  const home = await policy(owner, "household", "MEN-42", "Ménage");
  const lead = await repository.create(owner, request(owner, "pol 123456"), key());
  expect(lead.objectReference).toBe("pol 123456");

  const candidates = await repository.contractCandidates(owner, lead.id);
  expect(candidates.proposal).toEqual({ documentId: tesla, reason: "policy_number" });
  expect([...candidates.compatible].sort()).toEqual([tesla, fiat].sort());
  expect(candidates.items.map((item) => item.documentId).at(-1)).toBe(home);
  // Without a distinctive reference, nothing is proposed.
  const vague = await repository.create(owner, request(owner, "Ma voiture"), key());
  expect((await repository.contractCandidates(owner, vague.id)).proposal).toBeNull();

  // Proposing is not confirming: the owner still confirms object and sharing.
  const chosen = candidates.items.find((item) => item.documentId === tesla)!;
  const linked = await repository.command(
    owner,
    lead.id,
    {
      action: "contract_link",
      revision: lead.revision,
      documentId: tesla,
      fingerprint: chosen.fingerprint,
      sameObjectConfirmed: true,
      sharingConfirmed: true,
    },
    key(),
  );
  expect(linked.currentContract?.documentId).toBe(tesla);
  const edited = request(owner, "VD 777");
  await expect(
    repository.command(
      admin,
      lead.id,
      {
        action: "edit",
        revision: (await repository.detail(admin, lead.id)).revision,
        lead: {
          ...edited,
          nextAction: "Comparer",
          dueAt: new Date(Date.now() + 86400000).toISOString(),
        },
      },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_TRANSITION" });
});
