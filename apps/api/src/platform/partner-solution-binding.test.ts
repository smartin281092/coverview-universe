import { cp, mkdir, mkdtemp, readFile, writeFile, copyFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { beforeAll, afterAll, expect, it } from "vitest";
import {
  solutionBindingInputSchema,
  solutionBindingDossierSchema,
  type SolutionBindingDossier,
  type SolutionBindingInput,
  leadCreateInputSchema,
  partnerApplicationInputSchema,
  leadOfferInputSchema,
} from "@coverview/contracts/partner";
import { createDatabase } from "./db/database.js";
import { createPartnerRepository } from "../modules/partner-workspace/partner.repository.js";
import type { PartnerActor } from "../modules/partner-workspace/partner.policy.js";
import { createManagedProfileRepository } from "../modules/profiles/profiles.repository.js";
import { createAdminProfileTransferRepository } from "./admin-profile-transfer.repository.js";
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
    .withDatabase("coverview_solution_binding_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  // The incoming journal is protected. Assemble the pending additive migration only in this
  // ignored test catalogue; the normal deployment catalogue deliberately remains untouched.
  const local = resolve(".planning-local");
  await mkdir(local, { recursive: true });
  const migrationsFolder = await mkdtemp(join(local, "solution-binding-test-"));
  await cp(fileURLToPath(new URL("../../drizzle/", import.meta.url)), migrationsFolder, {
    recursive: true,
  });
  const entrySchema = z.object({
    idx: z.number(),
    version: z.string(),
    when: z.number(),
    tag: z.string(),
    breakpoints: z.boolean(),
  });
  const journal = z
    .object({ entries: z.array(entrySchema) })
    .passthrough()
    .parse(JSON.parse(await readFile(join(migrationsFolder, "meta/_journal.json"), "utf8")));
  for (const name of [
    "0049_partner_need_capacity",
    "0050_partner_need_conflicts",
    "0051_partner_need_expertise",
    "0052_partner_solution_binding",
  ]) {
    const pending = fileURLToPath(new URL("../../drizzle-pending/" + name + "/", import.meta.url));
    const entry = entrySchema.parse(
      JSON.parse(await readFile(join(pending, "entry.json"), "utf8")),
    );
    expect(entry.idx).toBe(journal.entries.at(-1)!.idx + 1);
    journal.entries.push(entry);
    await copyFile(join(pending, "migration.sql"), join(migrationsFolder, entry.tag + ".sql"));
    await copyFile(
      join(pending, "snapshot.json"),
      join(migrationsFolder, "meta/" + String(entry.idx).padStart(4, "0") + "_snapshot.json"),
    );
  }
  await writeFile(join(migrationsFolder, "meta/_journal.json"), JSON.stringify(journal));
  await migrate(database.db, { migrationsFolder });
  await migrate(database.db, { migrationsFolder });
  repository = createPartnerRepository(database.pool);
  admin = await actor(true);
});
afterAll(async () => {
  if (database) await database.pool.end();
  if (container) await container.stop();
});

async function offered(
  owner: PartnerActor,
  advisor: PartnerActor,
  profileId: string | null = null,
) {
  let lead = await assigned(owner, advisor, profileId);
  const documentId = `doc_${key()}`;
  await database.pool.query(
    "insert into files(id,user_id,name,mime,declared_mime,size,checksum,object_key,state,category,purpose,scan_version) values($1,$2,'Offre isolée.pdf','application/pdf','application/pdf',10,$3,$4,'ready','insurance','lead_offer','isolated-scan')",
    [documentId, advisor.userId, createHash("sha256").update(key()).digest("hex"), key()],
  );
  await database.pool.query("update files set analysis=$2 where id=$1", [
    documentId,
    JSON.stringify({
      category: "insurance",
      evidence: null,
      fields: [],
      pages: [
        {
          page: 1,
          text: "AXA Assurances SA. Produit Mobilité. Variante Plus. Version 2026. Mention répétée. Mention répétée.",
          method: "isolated",
          version: "test",
        },
      ],
    }),
  ]);
  const offer = leadOfferInputSchema.parse({
    documentId,
    sourceFingerprint: (await repository.extraction(advisor, lead.id, documentId))
      .sourceFingerprint,
    company: "AXA",
    product: "Véhicule isolé",
    reference: "Test isolé",
    annualPremiumMinor: 100000,
    currency: "CHF",
    validUntil: new Date(Date.now() + 86400000).toISOString(),
    effectiveDate: null,
    features: [],
    summary: "",
    limitations: "Aucune offre réelle",
    replacesId: null,
  });
  lead = await repository.command(
    advisor,
    lead.id,
    { action: "offer", revision: lead.revision, offer },
    key(),
  );
  const offerId = lead.offers[0]!.id;
  lead = await repository.command(
    advisor,
    lead.id,
    { action: "offer_review", revision: lead.revision, offerId },
    key(),
  );
  return { lead, offerId, documentId, offer };
}

const read = (advisor: PartnerActor, leadId: string, offerId: string, before?: number) =>
  repository.solutionBinding(advisor, leadId, offerId, before);
function command(
  dossier: SolutionBindingDossier,
  overrides: Partial<SolutionBindingInput> = {},
): SolutionBindingInput {
  return solutionBindingInputSchema.parse({
    revision: dossier.revision,
    scopeFingerprint: dossier.scopeFingerprint,
    action: "record",
    companyId: "axa",
    mentions: {
      company: { page: 1, quote: "AXA Assurances SA" },
      legalParty: null,
      product: { page: 1, quote: "Produit Mobilité" },
      variant: null,
      productVersion: null,
    },
    reason: "Association personnelle synthétique sans preuve fournisseur",
    validUntil: new Date(Date.now() + 3600000).toISOString(),
    confirmed: true,
    ...overrides,
  });
}
const save = (
  who: PartnerActor,
  value: SolutionBindingDossier,
  input = command(value),
  idempotency = key(),
) => repository.recordSolutionBinding(who, value.leadId, value.offer.id, input, idempotency);

async function scenario() {
  const owner = { ...(await actor()), wallet: true },
    advisor = await professional();
  const item = await offered(owner, advisor);
  return { owner, advisor, ...item, dossier: await read(advisor, item.lead.id, item.offerId) };
}
async function effects(leadId: string) {
  const tables = [
    "partner_leads",
    "partner_offers",
    "partner_tasks",
    "partner_notifications",
    "partner_appointments",
  ];
  return Promise.all(
    tables.map(
      async (table) =>
        (
          await database.pool.query<{ value: unknown }>(
            `select to_jsonb(t) value from ${table} t where ${table === "partner_leads" ? "id" : "lead_id"}=$1 order by id`,
            [leadId],
          )
        ).rows,
    ),
  );
}
it("records an exact personal documentary association, stores coordinates only and leaves adjacent controls unchanged", async () => {
  const { advisor, lead, dossier } = await scenario();
  expect(dossier).toMatchObject({
    status: "missing",
    canRecord: true,
    revision: 0,
    history: [],
    legalIdentity: "unverified",
    productIdentity: "unverified",
  });
  const before = await effects(lead.id),
    assessment = await repository.advisorAssessment(advisor, lead.id);
  const result = solutionBindingDossierSchema.parse(await save(advisor, dossier));
  expect(result).toMatchObject({
    status: "recorded",
    revision: 1,
    assessment: "human_review_required",
    legalIdentity: "unverified",
    productIdentity: "unverified",
    current: {
      companyId: "axa",
      mentionsAvailable: true,
      mentions: {
        company: { page: 1, quote: "AXA Assurances SA" },
        legalParty: null,
        product: { page: 1, quote: "Produit Mobilité" },
        variant: null,
        productVersion: null,
      },
    },
  });
  const rows = await database.pool.query<{
    mentions: { company: unknown };
    source_reference: unknown;
  }>("select mentions,source_reference from partner_solution_bindings where lead_id=$1", [lead.id]);
  expect(rows.rows[0]!.mentions.company).toEqual({ page: 1, start: 0, end: 17 });
  expect(JSON.stringify(rows.rows)).not.toContain("AXA");
  expect(await effects(lead.id)).toEqual(before);
  expect((await repository.advisorAssessment(advisor, lead.id)).remainingChecks).toEqual(
    assessment.remainingChecks,
  );
});
it("preserves unknown mentions and never infers a company from the offer label", async () => {
  const { advisor, dossier } = await scenario();
  const unknown = {
    company: null,
    legalParty: null,
    product: null,
    variant: null,
    productVersion: null,
  };
  expect(
    await save(advisor, dossier, command(dossier, { companyId: null, mentions: unknown })),
  ).toMatchObject({
    current: { companyId: null, mentions: unknown },
    legalIdentity: "unverified",
    productIdentity: "unverified",
  });
  expect(
    solutionBindingInputSchema.safeParse(command(dossier, { companyId: null, mentions: unknown }))
      .success,
  ).toBe(true);
  expect(
    solutionBindingInputSchema.safeParse({ ...command(dossier), mentions: unknown }).success,
  ).toBe(false);
  expect(
    solutionBindingInputSchema.safeParse({ ...command(dossier), advisorId: advisor.userId })
      .success,
  ).toBe(false);
  expect(
    solutionBindingInputSchema.safeParse({ ...command(dossier), confirmed: false }).success,
  ).toBe(false);
});
it.each(["Invented company", "Mention répétée", "wrong page"])(
  "rejects a nonunique or absent source passage: %s",
  async (quote) => {
    const { advisor, dossier } = await scenario();
    await expect(
      save(
        advisor,
        dossier,
        command(dossier, {
          mentions: {
            ...command(dossier).mentions!,
            company: {
              page: quote === "wrong page" ? 2 : 1,
              quote: quote === "wrong page" ? "AXA Assurances SA" : quote,
            },
          },
        }),
      ),
    ).rejects.toMatchObject({ code: "PARTNER_INVALID_DOCUMENT" });
    expect((await read(advisor, dossier.leadId, dossier.offer.id)).revision).toBe(0);
  },
);
it("enforces personal audience for Wallet, unrelated advisors, managers and unassigned administrators on reads and writes", async () => {
  const { owner, advisor, dossier } = await scenario(),
    other = await professional();
  await database.pool.query(
    'update partner_members set organization_id=(select organization_id from partner_members where user_id=$2),roles=\'["advisor","manager"]\' where user_id=$1',
    [other.userId, advisor.userId],
  );
  for (const person of [owner, other, admin]) {
    await expect(read(person, dossier.leadId, dossier.offer.id)).rejects.toMatchObject({
      code: "PARTNER_ACCESS_DENIED",
    });
    await expect(save(person, dossier)).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  }
  await database.pool.query(
    "insert into partner_contributors(id,lead_id,user_id,access_scope,can_edit,can_contact) values($1,$2,$3,'advice',false,false)",
    [key(), dossier.leadId, other.userId],
  );
  const own = await read(other, dossier.leadId, dossier.offer.id);
  await save(other, own);
  expect((await read(advisor, dossier.leadId, dossier.offer.id)).status).toBe("missing");
  await database.pool.query(
    "update partner_contributors set revoked_at=now() where lead_id=$1 and user_id=$2",
    [dossier.leadId, other.userId],
  );
  await expect(read(other, dossier.leadId, dossier.offer.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
});
it("isolates multiple Leads and exact offer versions", async () => {
  const { owner, advisor, dossier } = await scenario(),
    second = await offered(owner, advisor);
  await save(advisor, dossier);
  expect((await read(advisor, second.lead.id, second.offerId)).status).toBe("missing");
  await expect(read(advisor, second.lead.id, dossier.offer.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  await expect(
    repository.recordSolutionBinding(
      advisor,
      second.lead.id,
      second.offerId,
      command(dossier),
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
});
it.each(["state", "revision", "generation", "analysis"])(
  "requires reexamination and hides passages after source %s changes",
  async (change) => {
    const { advisor, dossier, documentId } = await scenario();
    await save(advisor, dossier);
    if (change === "state")
      await database.pool.query(
        "update files set state='quarantined',revision=revision+1 where id=$1",
        [documentId],
      );
    if (change === "revision")
      await database.pool.query("update files set revision=revision+1 where id=$1", [documentId]);
    if (change === "generation")
      await database.pool.query(
        "update files set generation=generation+1,revision=revision+1 where id=$1",
        [documentId],
      );
    if (change === "analysis")
      await database.pool.query(
        "update files set analysis=jsonb_set(analysis,'{pages,0,text}','\"Autre texte\"'),revision=revision+1 where id=$1",
        [documentId],
      );
    const stale = await read(advisor, dossier.leadId, dossier.offer.id);
    expect(stale).toMatchObject({
      status: "review_required",
      current: { mentions: null, mentionsAvailable: false },
    });
    if (change === "state") {
      await database.pool.query("update files set state='ready',revision=revision+1 where id=$1", [
        documentId,
      ]);
      expect(await read(advisor, dossier.leadId, dossier.offer.id)).toMatchObject({
        status: "review_required",
        current: { mentionsAvailable: false },
      });
    }
  },
);
it("refuses a disabled or unbound documentary source", async () => {
  const { advisor, dossier } = await scenario(),
    disabled = createPartnerRepository(database.pool, false);
  const value = await disabled.solutionBinding(advisor, dossier.leadId, dossier.offer.id);
  expect(value.canRecord).toBe(false);
  await expect(
    disabled.recordSolutionBinding(
      advisor,
      dossier.leadId,
      dossier.offer.id,
      command(value),
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  await database.pool.query("update partner_offers set source_snapshot=null where id=$1", [
    dossier.offer.id,
  ]);
  expect(await read(advisor, dossier.leadId, dossier.offer.id)).toMatchObject({
    canRecord: false,
    source: null,
  });
});
it("never revives an association after a need round trip and allows a new explicit version", async () => {
  const { advisor, dossier } = await scenario();
  await save(advisor, dossier);
  for (const title of ["Besoin modifié", dossier.scope.title])
    await database.pool.query("update partner_leads set title=$2 where id=$1", [
      dossier.leadId,
      title,
    ]);
  const stale = await read(advisor, dossier.leadId, dossier.offer.id);
  expect(stale.status).toBe("review_required");
  expect(stale.scopeFingerprint).not.toBe(dossier.scopeFingerprint);
  expect(await save(advisor, stale)).toMatchObject({ status: "recorded", revision: 2 });
});
it("blocks a new association after a client request while preserving withdrawal and other assessments", async () => {
  const { owner, advisor, dossier, lead } = await scenario();
  await save(advisor, dossier);
  await repository.command(
    owner,
    lead.id,
    { action: "client_interlocutor", revision: lead.revision, reason: "Demande privée du client" },
    key(),
  );
  const current = await read(advisor, lead.id, dossier.offer.id);
  expect(current).toMatchObject({
    changeRequested: true,
    canRecord: false,
    canWithdraw: true,
    status: "review_required",
  });
  await expect(save(advisor, current)).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  const withdrawn = await save(
    advisor,
    current,
    command(current, { action: "withdraw", companyId: null, mentions: null, validUntil: null }),
  );
  expect(withdrawn).toMatchObject({
    status: "withdrawn",
    canWithdraw: false,
    revision: 2,
    current: { mentions: null },
  });
});
it("caps expiry by the exact offer and refuses a past personal expiry", async () => {
  const { advisor, dossier } = await scenario();
  for (const validUntil of [
    new Date(Date.now() - 1000).toISOString(),
    new Date(Date.parse(dossier.offer.validUntil!) + 1000).toISOString(),
  ])
    await expect(save(advisor, dossier, command(dossier, { validUntil }))).rejects.toMatchObject({
      code: "PARTNER_ACTION_REQUIRED",
    });
  await save(advisor, dossier);
  await database.pool.query(
    "update partner_solution_bindings set created_at=now()-interval '2 seconds',valid_until=now()-interval '1 second' where offer_id=$1",
    [dossier.offer.id],
  );
  expect((await read(advisor, dossier.leadId, dossier.offer.id)).status).toBe("expired");
});
it("replays the same concurrent command once and rejects competing revisions and key reuse", async () => {
  const { advisor, dossier } = await scenario(),
    input = command(dossier),
    id = key();
  const results = await Promise.all([
    save(advisor, dossier, input, id),
    save(advisor, dossier, input, id),
  ]);
  expect(results.map((x) => x.revision)).toEqual([1, 1]);
  await expect(save(advisor, dossier)).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  await expect(
    save(advisor, dossier, { ...input, reason: "Autre motif de confirmation documentaire" }, id),
  ).rejects.toMatchObject({ code: "PARTNER_IDEMPOTENCY_REUSED" });
  const current = results[0];
  const competing = await Promise.allSettled([save(advisor, current), save(advisor, current)]);
  expect(competing.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  expect(competing.filter((x) => x.status === "rejected")).toHaveLength(1);
  await database.pool.query("update identity_sessions set expires_at=now() where id=$1", [
    advisor.id,
  ]);
  await expect(save(advisor, dossier, input, id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
});
it("paginates immutable personal history without treating older versions as current", async () => {
  const { advisor, dossier } = await scenario();
  let current = dossier;
  for (let i = 0; i < 22; i++) current = await save(advisor, current);
  expect(current).toMatchObject({ revision: 22, nextBeforeRevision: 3 });
  expect(current.history).toHaveLength(20);
  const older = await read(advisor, dossier.leadId, dossier.offer.id, current.nextBeforeRevision!);
  expect(older.history.map((x) => x.revision)).toEqual([2, 1]);
  expect(older.current?.revision).toBe(22);
  await expect(read(advisor, dossier.leadId, dossier.offer.id, 0)).rejects.toBeDefined();
});
it.each(["category", "organization", "member", "activity"])(
  "denies reads and writes after %s changes",
  async (change) => {
    const { advisor, dossier } = await scenario();
    if (change === "category")
      await database.pool.query(
        "update partner_members set application=jsonb_set(application,'{categories}','[\"health\"]') where user_id=$1",
        [advisor.userId],
      );
    if (change === "organization")
      await database.pool.query(
        "update partner_organizations set state='suspended' where id=(select organization_id from partner_members where user_id=$1)",
        [advisor.userId],
      );
    if (change === "member")
      await database.pool.query("update partner_members set state='suspended' where user_id=$1", [
        advisor.userId,
      ]);
    if (change === "activity")
      await database.pool.query(
        "update partner_members set roles='[\"referrer\"]' where user_id=$1",
        [advisor.userId],
      );
    await expect(read(advisor, dossier.leadId, dossier.offer.id)).rejects.toMatchObject({
      code: "PARTNER_ACCESS_DENIED",
    });
    await expect(save(advisor, dossier)).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  },
);
it.each(["session", "mfa", "membership", "personal"])(
  "rejects %s expiry after waiting on the original file lock",
  async (kind) => {
    const { advisor, dossier, documentId } = await scenario(),
      expiryAt = new Date(Date.now() + 2500),
      writer = { ...advisor, administrator: kind === "mfa" };
    if (kind === "session")
      await database.pool.query("update identity_sessions set expires_at=$2 where id=$1", [
        advisor.id,
        expiryAt,
      ]);
    if (kind === "membership")
      await database.pool.query("update partner_members set review_due_at=$2 where user_id=$1", [
        advisor.userId,
        expiryAt,
      ]);
    if (kind === "mfa") {
      await database.pool.query(
        "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated expiry')",
        [key(), advisor.userId],
      );
      await database.pool.query("update identity_sessions set mfa_verified_at=$2 where id=$1", [
        advisor.id,
        new Date(expiryAt.getTime() - 86400000),
      ]);
    }
    const current = await read(writer, dossier.leadId, dossier.offer.id),
      input = command(current, kind === "personal" ? { validUntil: expiryAt.toISOString() } : {}),
      blocker = await database.pool.connect();
    let pending: Promise<unknown> | undefined;
    try {
      await blocker.query("begin");
      await blocker.query("select id from files where id=$1 for update", [documentId]);
      pending = save(writer, current, input).then(
        () => {
          throw new Error("Expired write succeeded");
        },
        (cause: unknown) =>
          expect(cause).toMatchObject({
            code: kind === "personal" ? "PARTNER_ACTION_REQUIRED" : "PARTNER_ACCESS_DENIED",
          }),
      );
      await expect
        .poll(
          async () =>
            (
              await database.pool.query(
                "select pid from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%files%for share%' and pid<>pg_backend_pid() limit 1",
              )
            ).rowCount,
          { timeout: 5000 },
        )
        .toBe(1);
      await expect.poll(() => Date.now() >= expiryAt.getTime(), { timeout: 5000 }).toBe(true);
      await blocker.query("commit");
      await pending;
      expect(
        (
          await database.pool.query("select id from partner_solution_bindings where offer_id=$1", [
            dossier.offer.id,
          ])
        ).rowCount,
      ).toBe(0);
    } finally {
      await blocker.query("rollback");
      blocker.release();
      if (pending) await pending;
    }
  },
);
it("rechecks a changed document after a real lock wait before writing anything", async () => {
  const { advisor, dossier, documentId } = await scenario(),
    blocker = await database.pool.connect();
  let pending: Promise<unknown> | undefined;
  try {
    await blocker.query("begin");
    await blocker.query("select id from files where id=$1 for update", [documentId]);
    pending = save(advisor, dossier).then(
      () => {
        throw new Error("Stale write succeeded");
      },
      (cause: unknown) => expect(cause).toMatchObject({ code: "PARTNER_CONFLICT" }),
    );
    await expect
      .poll(
        async () =>
          (
            await database.pool.query(
              "select pid from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%files%for share%' and pid<>pg_backend_pid() limit 1",
            )
          ).rowCount,
        { timeout: 5000 },
      )
      .toBe(1);
    await blocker.query("update files set revision=revision+1,state='quarantined' where id=$1", [
      documentId,
    ]);
    await blocker.query("commit");
    await pending;
    expect(
      (
        await database.pool.query("select id from partner_solution_bindings where offer_id=$1", [
          dossier.offer.id,
        ])
      ).rowCount,
    ).toBe(0);
  } finally {
    await blocker.query("rollback");
    blocker.release();
    if (pending) await pending;
  }
});

it("exposes at most the selected current source page and masks it after quarantine", async () => {
  const { advisor, dossier, documentId } = await scenario();
  expect(dossier.sourcePages).toEqual([1]);
  expect(dossier.sourcePage?.text).toContain("AXA Assurances SA");
  expect(
    (await repository.solutionBinding(advisor, dossier.leadId, dossier.offer.id, undefined, 2))
      .sourcePage,
  ).toBeNull();
  await expect(
    repository.solutionBinding(advisor, dossier.leadId, dossier.offer.id, undefined, 21),
  ).rejects.toBeDefined();
  await database.pool.query(
    "update files set state='quarantined',revision=revision+1 where id=$1",
    [documentId],
  );
  expect(await read(advisor, dossier.leadId, dossier.offer.id)).toMatchObject({
    sourcePages: [],
    sourcePage: null,
  });
});
it("rolls back the association and idempotency marker if its private audit fails", async () => {
  const { advisor, dossier } = await scenario(),
    trigger = "isolated_binding_" + key().replaceAll("-", ""),
    attempt = key();
  await database.pool.query(
    "create function " +
      trigger +
      "() returns trigger language plpgsql as $$ begin if NEW.kind='solution_binding.recorded.v1' then raise exception 'Isolated binding audit failure'; end if; return NEW; end $$",
  );
  await database.pool.query(
    "create trigger " +
      trigger +
      " before insert on partner_events for each row execute function " +
      trigger +
      "()",
  );
  try {
    await expect(save(advisor, dossier, command(dossier), attempt)).rejects.toThrow(
      "Isolated binding audit failure",
    );
    expect((await read(advisor, dossier.leadId, dossier.offer.id)).current).toBeNull();
    expect(
      (
        await database.pool.query("select id from partner_commands where user_id=$1 and key=$2", [
          advisor.userId,
          attempt,
        ])
      ).rowCount,
    ).toBe(0);
  } finally {
    await database.pool.query("drop trigger " + trigger + " on partner_events");
    await database.pool.query("drop function " + trigger + "()");
  }
  const recorded = await save(advisor, dossier);
  const event = (
    await database.pool.query(
      "select lead_id,audience,text from partner_events where actor_id=$1 and kind='solution_binding.recorded.v1'",
      [advisor.userId],
    )
  ).rows;
  expect(event).toEqual([{ lead_id: null, audience: "private", text: "" }]);
  for (const patch of [
    "revision=0",
    "scope_fingerprint='bad'",
    "reason='short'",
    "company_id='invented'",
    "mentions=null",
  ])
    await expect(
      database.pool.query("update partner_solution_bindings set " + patch + " where offer_id=$1", [
        recorded.offer.id,
      ]),
    ).rejects.toMatchObject({ code: "23514" });
});
it("invalidates professional and canonical ownership round trips and hides history after subject relinking", async () => {
  const owner = { ...(await actor()), wallet: true },
    destination = await actor(),
    advisor = await professional(),
    profiles = createManagedProfileRepository(database.db),
    transfers = createAdminProfileTransferRepository(database.db);
  const profile = await profiles.create(
      owner,
      { kind: "person", displayName: "Sujet documentaire isolé" },
      key(),
    ),
    item = await offered(owner, advisor, profile.id),
    dossier = await read(advisor, item.lead.id, item.offerId);
  await save(advisor, dossier);
  for (const name of ["Autre nom", "Conseiller isolé"])
    await database.pool.query(
      "update partner_members set application=jsonb_set(application,'{name}',$2::jsonb) where user_id=$1",
      [advisor.userId, JSON.stringify(name)],
    );
  let current = await read(advisor, item.lead.id, item.offerId);
  expect(current.status).toBe("review_required");
  await save(advisor, current);
  const moved = await transfers.transfer(
    { id: admin.id, userId: owner.userId, administratorUserId: admin.userId },
    profile.id,
    { revision: profile.revision, destinationUserId: destination.userId },
    key(),
  );
  await transfers.transfer(
    { id: admin.id, userId: destination.userId, administratorUserId: admin.userId },
    profile.id,
    { revision: moved.revision, destinationUserId: owner.userId },
    key(),
  );
  current = await read(advisor, item.lead.id, item.offerId);
  expect(current.status).toBe("review_required");
  const other = await profiles.create(owner, { kind: "person", displayName: "Autre sujet" }, key());
  await database.pool.query("update partner_leads set client_profile_id=$2 where id=$1", [
    item.lead.id,
    other.id,
  ]);
  expect(await read(advisor, item.lead.id, item.offerId)).toMatchObject({
    status: "missing",
    current: null,
    history: [],
    revision: 2,
  });
});
it("does not expose personal bindings or source passages to Wallet summaries and ordinary Lead views", async () => {
  const { advisor, owner, dossier } = await scenario();
  await save(advisor, dossier);
  const visible = JSON.stringify([
    await repository.detail(owner, dossier.leadId),
    await repository.detail(advisor, dossier.leadId),
    await repository.referentAssessment(owner, dossier.leadId, true),
  ]);
  expect(visible).not.toContain("Association personnelle synthétique sans preuve fournisseur");
  expect(visible).not.toContain("AXA Assurances SA");
  expect(visible).not.toContain("solution_binding.recorded.v1");
});

it.each(["replacement", "withdrawal"])("requires reexamination after offer %s", async (kind) => {
  const { advisor, dossier, offer } = await scenario();
  await save(advisor, dossier);
  const lead = await repository.detail(advisor, dossier.leadId);
  const changed = await repository.command(
    advisor,
    lead.id,
    kind === "replacement"
      ? {
          action: "offer",
          revision: lead.revision,
          offer: { ...offer, replacesId: dossier.offer.id },
        }
      : {
          action: "offer_withdraw",
          revision: lead.revision,
          offerId: dossier.offer.id,
          reason: "Retrait documentaire explicite",
        },
    key(),
  );
  expect(await read(advisor, lead.id, dossier.offer.id)).toMatchObject({
    canRecord: false,
    status: "review_required",
  });
  if (kind === "replacement")
    expect(
      (await read(advisor, lead.id, changed.offers.find((o) => o.id !== dossier.offer.id)!.id))
        .status,
    ).toBe("missing");
});
it.each(["session", "mfa", "membership"])(
  "denies a GET after %s expires during a real canonical profile wait",
  async (kind) => {
    const { owner, advisor, dossier } = await scenario(),
      expires = new Date(Date.now() + 2500),
      reader = { ...advisor, administrator: kind === "mfa" };
    if (kind === "session")
      await database.pool.query("update identity_sessions set expires_at=$2 where id=$1", [
        advisor.id,
        expires,
      ]);
    if (kind === "membership")
      await database.pool.query("update partner_members set review_due_at=$2 where user_id=$1", [
        advisor.userId,
        expires,
      ]);
    if (kind === "mfa") {
      await database.pool.query(
        "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated read expiry')",
        [key(), advisor.userId],
      );
      await database.pool.query("update identity_sessions set mfa_verified_at=$2 where id=$1", [
        advisor.id,
        new Date(expires.getTime() - 86400000),
      ]);
    }
    const blocker = await database.pool.connect();
    let pending: Promise<unknown> | undefined;
    try {
      await blocker.query("begin");
      await blocker.query("select id from identity_profiles where user_id=$1 for update", [
        owner.userId,
      ]);
      pending = read(reader, dossier.leadId, dossier.offer.id).then(
        () => {
          throw new Error("Expired read returned a source");
        },
        (cause: unknown) => expect(cause).toMatchObject({ code: "PARTNER_ACCESS_DENIED" }),
      );
      await expect
        .poll(
          async () =>
            (
              await database.pool.query(
                "select pid from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%identity_profiles%' and pid<>pg_backend_pid() limit 1",
              )
            ).rowCount,
          { timeout: 5000 },
        )
        .toBe(1);
      await expect.poll(() => Date.now() >= expires.getTime(), { timeout: 5000 }).toBe(true);
      await blocker.query("commit");
      await pending;
    } finally {
      await blocker.query("rollback");
      blocker.release();
      if (pending) await pending;
    }
  },
);
