import { createHash, randomUUID } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, writeFile, copyFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { beforeAll, afterAll, expect, it } from "vitest";
import { z } from "zod";
import {
  competenceDeclarationSchema,
  competenceDecisionSchema,
  capacityInputSchema,
  needExpertiseInputSchema,
  needExpertiseDossierSchema,
  type NeedExpertiseInput,
  type NeedExpertiseDossier,
  leadCreateInputSchema,
  partnerApplicationInputSchema,
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
  includeProof = true,
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
    advisor.administrator ? advisor : admin,
    lead.id,
    {
      action: "assign",
      revision: lead.revision,
      responsibleId: advisor.userId,
      reason: "Test isolé",
    },
    key(),
  );
  if (includeProof && (await repository.context(advisor)).application) await proof(advisor);
  return repository.command(advisor, lead.id, { action: "accept", revision: lead.revision }, key());
}

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_need_expertise_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  // The incoming journal is protected. Assemble the pending additive migration only in this
  // ignored test catalogue; the normal deployment catalogue deliberately remains untouched.
  const local = resolve(".planning-local");
  await mkdir(local, { recursive: true });
  const migrationsFolder = await mkdtemp(join(local, "need-expertise-test-"));
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

function command(
  dossier: NeedExpertiseDossier,
  position: NeedExpertiseInput["position"] = "expertise_confirmed_within_scope",
) {
  return needExpertiseInputSchema.parse({
    revision: dossier.revision,
    scopeFingerprint: dossier.scopeFingerprint,
    action: position ? "decide" : "withdraw",
    position,
    reviewedScope: position
      ? "Expertise et complexité du besoin examinés pour ce besoin isolé"
      : null,
    limitations: position ? "Limites examinées pour ce besoin isolé" : null,
    nextStep: position ? "Nouvelle vérification avant toute proposition précise" : null,
    reason: "Appréciation humaine privée pour cette mission isolée",
    validUntil: position ? new Date(Date.now() + 86400000).toISOString() : null,
    confirmed: true,
  });
}
async function decide(
  person: PartnerActor,
  leadId: string,
  position: NeedExpertiseInput["position"] = "expertise_confirmed_within_scope",
) {
  return repository.decideNeedExpertise(
    person,
    leadId,
    command(await repository.needExpertise(person, leadId), position),
    key(),
  );
}
async function scenario(includeProof = true) {
  const owner = { ...(await actor()), wallet: true },
    person = await professional();
  const lead = await assigned(owner, person, null, includeProof);
  return { owner, person, lead };
}
async function unchanged(leadId: string) {
  return Promise.all(
    [
      "partner_leads",
      "partner_events",
      "partner_notifications",
      "partner_appointments",
      "partner_tasks",
    ].map(
      async (table) =>
        (
          await database.pool.query<Record<string, unknown>>(
            `select * from ${table} where ${table === "partner_leads" ? "id" : "lead_id"}=$1 order by id`,
            [leadId],
          )
        ).rows,
    ),
  );
}
async function capacity(
  person: PartnerActor,
  position: "open" | "unavailable" | null = "open",
  validUntil = new Date(Date.now() + 86400000).toISOString(),
) {
  const current = await repository.capacity(person, person.userId);
  return repository.declareCapacity(
    person,
    person.userId,
    capacityInputSchema.parse({
      revision: current.current?.revision ?? 0,
      professionalRevision: current.professionalRevision,
      action: position ? "declare" : "withdraw",
      position,
      validUntil: position ? validUntil : null,
      confirmed: true,
    }),
    key(),
  );
}

async function proof(advisor: PartnerActor) {
  const current = await repository.competence(advisor, advisor.userId, "vehicle");
  if (current.current?.decision === "reviewed") return current.current.documentId;
  const dossier = await repository.declareCompetence(
    advisor,
    advisor.userId,
    "vehicle",
    competenceDeclarationSchema.parse({
      revision: current.current?.revision ?? 0,
      professionalRevision: current.professionalRevision,
      declaration: "Déclaration privée isolée",
      file: {
        name: "Preuve-privée.pdf",
        mime: "application/pdf",
        size: 20,
        checksum: createHash("sha256").update(key()).digest("hex"),
      },
      confirmed: true,
    }),
    key(),
  );
  await repository.completeCompetenceUpload(
    advisor,
    advisor.userId,
    "vehicle",
    dossier.current!.id,
    "application/pdf",
  );
  await database.pool.query(
    "update files set state='ready',scan_version='isolated',revision=revision+1 where id=$1",
    [dossier.current!.documentId],
  );
  const ready = await repository.competence(advisor, advisor.userId, "vehicle");
  await repository.decideCompetence(
    admin,
    advisor.userId,
    "vehicle",
    competenceDecisionSchema.parse({
      revision: ready.current!.revision,
      decision: "reviewed",
      reason: "Motif privé isolé",
      scope: "Catégorie véhicule",
      coverage: "category",
      validUntil: new Date(Date.now() + 172800000).toISOString(),
      documentRevision: ready.current!.documentRevision,
      originalChecked: true,
    }),
    key(),
  );
  return ready.current!.documentId;
}

async function reviewSource(
  person: PartnerActor,
  coverage: "category" | "limited",
  validUntil = new Date(Date.now() + 172800000).toISOString(),
) {
  const dossier = await repository.competence(person, person.userId, "vehicle");
  return repository.decideCompetence(
    admin,
    person.userId,
    "vehicle",
    competenceDecisionSchema.parse({
      revision: dossier.current!.revision,
      decision: "reviewed",
      reason: "Examen documentaire isolé",
      scope: "Périmètre documentaire examiné",
      coverage,
      validUntil,
      documentRevision: dossier.current!.documentRevision,
      originalChecked: true,
    }),
    key(),
  );
}

it("keeps missing and disabled evidence unknown while allowing an explicit specialist or clarification request", async () => {
  const { person, lead } = await scenario(false);
  const missing = await repository.needExpertise(person, lead.id);
  expect(missing).toMatchObject({
    canConfirmExpertise: false,
    basis: { source: null },
    competence: { sourceStatus: "missing" },
  });
  await expect(
    repository.decideNeedExpertise(person, lead.id, command(missing), key()),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  expect((await decide(person, lead.id, "specialist_required")).effectivePosition).toBe(
    "specialist_required",
  );
  await proof(person);
  expect((await repository.needExpertise(person, lead.id)).status).toBe("review_required");
  const disabled = createPartnerRepository(database.pool, false);
  const unavailable = await disabled.needExpertise(person, lead.id);
  expect(unavailable).toMatchObject({
    canConfirmExpertise: false,
    competence: { sourceStatus: "disabled" },
  });
  await expect(
    disabled.decideNeedExpertise(person, lead.id, command(unavailable), key()),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  expect(
    (
      await disabled.decideNeedExpertise(
        person,
        lead.id,
        command(unavailable, "clarification_needed"),
        key(),
      )
    ).status,
  ).toBe("recorded");
});

it("binds a limited human assessment to exact declaration and review versions, caps its expiry and preserves the general dossier", async () => {
  const { person, lead } = await scenario();
  const general = await reviewSource(person, "limited"),
    current = await repository.needExpertise(person, lead.id);
  const personalGeneral = await repository.competence(person, person.userId, "vehicle");
  expect(current).toMatchObject({
    canConfirmExpertise: true,
    competence: { summary: { status: "limited" } },
    basis: {
      source: { decisionId: general.current!.id, decisionRevision: general.current!.revision },
    },
  });
  const input = command(current),
    attempt = key();
  await expect(
    repository.decideNeedExpertise(
      person,
      lead.id,
      { ...input, validUntil: new Date(Date.now() + 259200000).toISOString() },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  const saved = await repository.decideNeedExpertise(person, lead.id, input, attempt);
  expect(saved.current?.basis.source).toEqual(current.basis.source);
  expect(saved.current?.limitations).toBe(input.limitations);
  expect(saved.current?.nextStep).toBe(input.nextStep);
  expect(saved.current?.basis.source?.declarationId).toBeTruthy();
  expect(await repository.competence(person, person.userId, "vehicle")).toEqual(personalGeneral);
  expect(JSON.stringify(saved.current)).not.toContain(general.current!.declaration);
  expect(JSON.stringify(saved.current)).not.toContain(general.current!.documentId);
  await repository.declareCompetence(
    person,
    person.userId,
    "vehicle",
    competenceDeclarationSchema.parse({
      revision: general.current!.revision,
      professionalRevision: general.professionalRevision,
      declaration: "Nouvelle déclaration isolée remplaçante",
      file: {
        name: "Remplacement.pdf",
        mime: "application/pdf",
        size: 20,
        checksum: createHash("sha256").update(key()).digest("hex"),
      },
      confirmed: true,
    }),
    key(),
  );
  const replaced = await repository.decideNeedExpertise(person, lead.id, input, attempt);
  expect(replaced).toMatchObject({
    status: "review_required",
    effectivePosition: null,
    canConfirmExpertise: false,
  });
  expect(replaced.current).toEqual(saved.current);
  expect(replaced.basis.source?.declarationId).not.toBe(saved.current?.basis.source?.declarationId);
});

it("invalidates modified or quarantined originals through a round trip and requires a new reviewed source", async () => {
  const { person, lead } = await scenario(),
    sourceId = await proof(person);
  const saved = await decide(person, lead.id);
  await database.pool.query(
    "update files set state='quarantined',revision=revision+1 where id=$1",
    [sourceId],
  );
  expect(await repository.needExpertise(person, lead.id)).toMatchObject({
    status: "review_required",
    canConfirmExpertise: false,
    effectivePosition: null,
    competence: { sourceStatus: "unavailable" },
  });
  await database.pool.query("update files set state='ready',revision=revision+1 where id=$1", [
    sourceId,
  ]);
  const changed = await repository.needExpertise(person, lead.id);
  expect(changed).toMatchObject({
    status: "review_required",
    canConfirmExpertise: false,
    competence: { sourceStatus: "changed" },
  });
  await expect(decide(person, lead.id)).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  await reviewSource(person, "category");
  expect((await repository.needExpertise(person, lead.id)).status).toBe("review_required");
  expect((await decide(person, lead.id)).revision).toBe(saved.revision + 1);
  const general = await repository.competence(person, person.userId, "vehicle");
  await repository.decideCompetence(
    person,
    person.userId,
    "vehicle",
    competenceDecisionSchema.parse({
      revision: general.current!.revision,
      decision: "withdrawn",
      reason: "Retrait documentaire isolé",
      scope: "",
      coverage: null,
      validUntil: null,
      documentRevision: general.current!.documentRevision,
      originalChecked: false,
    }),
    key(),
  );
  expect(await repository.needExpertise(person, lead.id)).toMatchObject({
    status: "review_required",
    canConfirmExpertise: false,
    effectivePosition: null,
    competence: { summary: { status: "withdrawn" } },
  });
  expect((await decide(person, lead.id, null)).status).toBe("withdrawn");
});

it("expires the precise position with its documentary source without reverting to an earlier favorable record", async () => {
  const { person, lead } = await scenario();
  await decide(person, lead.id);
  const validUntil = new Date(Date.now() + 1600).toISOString();
  await reviewSource(person, "category", validUntil);
  const current = await repository.needExpertise(person, lead.id),
    input = { ...command(current), validUntil },
    attempt = key();
  await repository.decideNeedExpertise(person, lead.id, input, attempt);
  await database.pool.query(
    "select pg_sleep(greatest(0,extract(epoch from ($1::timestamptz-clock_timestamp())))+0.02)",
    [validUntil],
  );
  expect(await repository.decideNeedExpertise(person, lead.id, input, attempt)).toMatchObject({
    status: "review_required",
    revision: 2,
    effectivePosition: null,
    canConfirmExpertise: false,
    competence: { summary: { status: "expired" } },
  });
});

it("waits for the original lock, refuses a changed source and re-evaluates expiry on an exact retry", async () => {
  const { person, lead } = await scenario(),
    sourceId = await proof(person);
  const input = command(await repository.needExpertise(person, lead.id)),
    blocker = await database.pool.connect();
  let pending: Promise<unknown> | undefined;
  const wait = async () => {
    await expect
      .poll(
        async () =>
          (
            await database.pool.query(
              "select pid from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%for share of f%' and pid<>pg_backend_pid() limit 1",
            )
          ).rowCount,
        { timeout: 5000 },
      )
      .toBe(1);
  };
  try {
    await blocker.query("begin");
    await blocker.query("select id from files where id=$1 for update", [sourceId]);
    pending = repository
      .decideNeedExpertise(person, lead.id, input, key())
      .catch((error: unknown) => error);
    await wait();
    await blocker.query("update files set state='quarantined',revision=revision+1 where id=$1", [
      sourceId,
    ]);
    await blocker.query("commit");
    expect(await pending).toMatchObject({ code: "PARTNER_CONFLICT" });
    expect((await repository.needExpertise(person, lead.id)).current).toBeNull();
    await database.pool.query("update files set state='ready',revision=revision+1 where id=$1", [
      sourceId,
    ]);
    await reviewSource(person, "category");
    const retry = {
        ...command(await repository.needExpertise(person, lead.id)),
        validUntil: new Date(Date.now() + 1600).toISOString(),
      },
      attempt = key();
    await repository.decideNeedExpertise(person, lead.id, retry, attempt);
    await blocker.query("begin");
    await blocker.query("select id from files where id=$1 for update", [sourceId]);
    pending = repository.decideNeedExpertise(person, lead.id, retry, attempt);
    await wait();
    await blocker.query(
      "select pg_sleep(greatest(0,extract(epoch from ($1::timestamptz-clock_timestamp())))+0.02)",
      [retry.validUntil],
    );
    await blocker.query("commit");
    expect(await pending).toMatchObject({
      status: "expired",
      effectivePosition: null,
      revision: 1,
    });
    const sessionUntil = new Date(Date.now() + 1600).toISOString();
    await database.pool.query("update identity_sessions set expires_at=$2 where id=$1", [
      person.id,
      sessionUntil,
    ]);
    await blocker.query("begin");
    await blocker.query("select id from files where id=$1 for update", [sourceId]);
    pending = repository
      .decideNeedExpertise(person, lead.id, retry, attempt)
      .catch((error: unknown) => error);
    await wait();
    await blocker.query(
      "select pg_sleep(greatest(0,extract(epoch from ($1::timestamptz-clock_timestamp())))+0.02)",
      [sessionUntil],
    );
    await blocker.query("commit");
    expect(await pending).toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  } finally {
    await blocker.query("rollback");
    blocker.release();
    if (pending) await pending;
  }
});

it("records only explicit personal decisions per need, preserving all Lead effects, global statements and shared audiences", async () => {
  const { person, owner, lead } = await scenario(),
    second = await assigned(owner, person);
  await capacity(person);
  const before = await unchanged(lead.id),
    global = (await repository.capacity(person, person.userId)).current;
  const first = await repository.needExpertise(person, lead.id);
  expect(first).toMatchObject({
    status: "missing",
    effectivePosition: null,
    current: null,
    history: [],
    revision: 0,
  });
  expect(first).not.toHaveProperty("assessment");
  for (const position of [
    "expertise_confirmed_within_scope",
    "specialist_required",
    "clarification_needed",
  ] as const) {
    const result = await decide(person, lead.id, position);
    expect(needExpertiseDossierSchema.parse(result)).toMatchObject({
      status: "recorded",
      effectivePosition: position,
    });
    expect(
      (await repository.advisorAssessment(person, lead.id, true)).remainingChecks,
    ).toHaveLength(6);
    expect((await repository.needCapacity(person, lead.id)).current).toBeNull();
    expect(result.current?.reviewedScope).toContain("Expertise et complexité du besoin");
    expect(await unchanged(lead.id)).toEqual(before);
  }
  expect((await repository.needExpertise(person, second.id)).current).toBeNull();
  expect((await repository.capacity(person, person.userId)).current).toEqual(global);
  for (const value of [
    await repository.detail(owner, lead.id),
    await repository.detail(admin, lead.id),
    await repository.referentAssessment(owner, lead.id, true),
  ]) {
    expect(JSON.stringify(value)).not.toContain("Appréciation humaine privée");
    expect(value).not.toHaveProperty("effectivePosition");
  }
  expect(
    (
      await database.pool.query(
        "select kind,audience,text,lead_id from partner_events where actor_id=$1 and kind='need_expertise.decided.v1'",
        [person.userId],
      )
    ).rows,
  ).toEqual(
    Array.from({ length: 3 }, () => ({
      kind: "need_expertise.decided.v1",
      audience: "private",
      text: "",
      lead_id: null,
    })),
  );
});

it("expires without writes, rejects past dates, withdraws and reconfirms without reviving an exact retry", async () => {
  const { person, lead } = await scenario(),
    idempotencyKey = key();
  const input = {
    ...command(await repository.needExpertise(person, lead.id)),
    validUntil: new Date(Date.now() + 1200).toISOString(),
  };
  expect(
    (await repository.decideNeedExpertise(person, lead.id, input, idempotencyKey)).status,
  ).toBe("recorded");
  await database.pool.query(
    "select pg_sleep(greatest(0,extract(epoch from ($1::timestamptz-clock_timestamp())))+0.02)",
    [input.validUntil],
  );
  const expired = await repository.decideNeedExpertise(person, lead.id, input, idempotencyKey);
  expect(expired).toMatchObject({ status: "expired", effectivePosition: null, revision: 1 });
  await expect(
    repository.decideNeedExpertise(
      person,
      lead.id,
      { ...command(expired), validUntil: input.validUntil },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  const withdrawn = await decide(person, lead.id, null);
  expect(withdrawn).toMatchObject({
    status: "withdrawn",
    effectivePosition: null,
    revision: 2,
    current: { position: null, validUntil: null },
  });
  expect(
    (await repository.decideNeedExpertise(person, lead.id, input, idempotencyKey)).status,
  ).toBe("withdrawn");
  await expect(decide(person, lead.id, null)).rejects.toMatchObject({
    code: "PARTNER_ACTION_REQUIRED",
  });
  expect((await decide(person, lead.id)).revision).toBe(3);
});

it("serializes two decisions, reprojects same-key retries, rejects divergent content and paginates independent current state", async () => {
  const { person, lead } = await scenario(),
    input = command(await repository.needExpertise(person, lead.id)),
    attempt = key();
  const same = await Promise.all([
    repository.decideNeedExpertise(person, lead.id, input, attempt),
    repository.decideNeedExpertise(person, lead.id, input, attempt),
  ]);
  expect(same.map((value) => value.revision)).toEqual([1, 1]);
  await expect(
    repository.decideNeedExpertise(
      person,
      lead.id,
      { ...input, reason: "Autre contenu privé" },
      attempt,
    ),
  ).rejects.toMatchObject({ code: "PARTNER_IDEMPOTENCY_REUSED" });
  const next = command(same[1]);
  const competing = await Promise.allSettled([
    repository.decideNeedExpertise(person, lead.id, next, key()),
    repository.decideNeedExpertise(
      person,
      lead.id,
      { ...next, position: "specialist_required" },
      key(),
    ),
  ]);
  expect(competing.filter((value) => value.status === "fulfilled")).toHaveLength(1);
  expect(competing.find((value) => value.status === "rejected")).toMatchObject({
    reason: { code: "PARTNER_CONFLICT" },
  });
  for (let index = 0; index < 21; index++) await decide(person, lead.id, "clarification_needed");
  const latest = await repository.needExpertise(person, lead.id),
    older = await repository.needExpertise(person, lead.id, latest.nextBeforeRevision!);
  expect(latest.history).toHaveLength(20);
  expect(older.history).toHaveLength(3);
  expect(older.current).toEqual(latest.current);
  expect(older.nextBeforeRevision).toBeNull();
  expect(new Set([...latest.history, ...older.history].map((value) => value.revision)).size).toBe(
    23,
  );
  expect((await repository.decideNeedExpertise(person, lead.id, input, attempt)).revision).toBe(23);
});

it("requires review after changed and restored need/professional scopes, preserving old records and refusing stale forms", async () => {
  const { person, lead } = await scenario();
  const original = await decide(person, lead.id),
    pending = command(original);
  await database.pool.query("update partner_leads set title='Besoin modifié' where id=$1", [
    lead.id,
  ]);
  await database.pool.query("update partner_leads set title=$2 where id=$1", [lead.id, lead.title]);
  expect(await repository.needExpertise(person, lead.id)).toMatchObject({
    status: "review_required",
    effectivePosition: null,
    current: original.current,
  });
  await expect(
    repository.decideNeedExpertise(person, lead.id, pending, key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  const second = await decide(person, lead.id);
  await database.pool.query(
    "update partner_members set application=jsonb_set(application,'{name}','\"Autre nom\"') where user_id=$1",
    [person.userId],
  );
  await database.pool.query(
    "update partner_members set application=jsonb_set(application,'{name}','\"Conseiller isolé\"') where user_id=$1",
    [person.userId],
  );
  expect(await repository.needExpertise(person, lead.id)).toMatchObject({
    status: "review_required",
    effectivePosition: null,
  });
  expect((await repository.needExpertise(person, lead.id)).current).toEqual(second.current);
  await expect(decide(person, lead.id)).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  expect((await decide(person, lead.id, "clarification_needed")).status).toBe("recorded");
});

it("never infers an expertise position from capacity, availability or another Lead", async () => {
  const { person, owner, lead } = await scenario();
  await capacity(person, "unavailable");
  expect((await repository.needExpertise(person, lead.id)).status).toBe("missing");
  const reviewed = await decide(person, lead.id, "specialist_required");
  await assigned(owner, person);
  await capacity(person, "open");
  const availability = await repository.availability(person, person.userId);
  await repository.declareAvailability(
    person,
    person.userId,
    {
      revision: 0,
      professionalRevision: availability.professionalRevision,
      modes: ["phone"],
      periods: [],
      timezone: "Europe/Zurich",
      confirmed: true,
    },
    key(),
  );
  expect(await repository.needExpertise(person, lead.id)).toMatchObject({
    status: "recorded",
    effectivePosition: "specialist_required",
    current: reviewed.current,
  });
  expect((await repository.needCapacity(person, lead.id)).current).toBeNull();
});

it("keeps preferences and client choices authoritative, blocking positive decisions on open change requests", async () => {
  const { person, owner, lead } = await scenario();
  await decide(person, lead.id);
  const advice = await repository.advicePreferences(owner, lead.id);
  await repository.confirmAdvicePreferences(
    owner,
    lead.id,
    {
      revision: advice.revision,
      profileRevision: advice.profileRevision!,
      scopeRevision: advice.scopeRevision,
      languageCode: "fr",
      mode: "phone",
      canton: null,
      confirmed: true,
    },
    key(),
  );
  expect((await repository.needExpertise(person, lead.id)).status).toBe("review_required");
  await decide(person, lead.id);
  for (const [revision, advisorId] of [
    [0, person.userId],
    [1, null],
    [2, person.userId],
  ] as const)
    await repository.updateReferent(
      owner,
      "self",
      "vehicle",
      { revision, profileRevision: 0, advisorId, confirmed: true },
      key(),
    );
  expect((await repository.needExpertise(person, lead.id)).status).toBe("review_required");
  const before = await decide(person, lead.id),
    stale = command(before);
  await repository.command(
    owner,
    lead.id,
    {
      action: "client_interlocutor",
      revision: (await repository.detail(owner, lead.id)).revision,
      reason: "Changement souhaité",
    },
    key(),
  );
  const current = await repository.needExpertise(person, lead.id),
    effects = await unchanged(lead.id);
  expect(current).toMatchObject({
    canConfirmExpertise: false,
    status: "review_required",
    effectivePosition: null,
  });
  await expect(repository.decideNeedExpertise(person, lead.id, stale, key())).rejects.toMatchObject(
    {
      code: "PARTNER_CONFLICT",
    },
  );
  await expect(decide(person, lead.id)).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  expect((await decide(person, lead.id, "clarification_needed")).status).toBe("recorded");
  expect((await decide(person, lead.id, "specialist_required")).status).toBe("recorded");
  await decide(person, lead.id, null);
  expect(await unchanged(lead.id)).toEqual(effects);
});

it("refuses Wallet, neighbours, managers and non-assigned Admin for reads, writes and replay", async () => {
  const { person, owner, lead } = await scenario(),
    neighbour = await professional(),
    manager = await professional();
  const member = (await repository.context(person)).application!;
  await database.pool.query(
    "update partner_members set organization_id=$2,roles='[\"manager\"]' where user_id=$1",
    [manager.userId, member.organizationId],
  );
  const input = command(await repository.needExpertise(person, lead.id));
  for (const rejected of [owner, neighbour, manager, admin]) {
    await expect(repository.needExpertise(rejected, lead.id)).rejects.toBeDefined();
    await expect(
      repository.decideNeedExpertise(rejected, lead.id, input, key()),
    ).rejects.toBeDefined();
  }
  const attempt = key();
  await repository.decideNeedExpertise(person, lead.id, input, attempt);
  await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
    person.id,
  ]);
  await expect(
    repository.decideNeedExpertise(person, lead.id, input, attempt),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
});

it("permits a personally assigned Admin without inventing professional evidence, enforcing current MFA and permission", async () => {
  const owner = { ...(await actor()), wallet: true },
    administrator = await actor(true),
    lead = await assigned(owner, administrator);
  const initial = await repository.needExpertise(administrator, lead.id);
  expect(initial.basis.professionalRevision).toBeNull();
  expect(initial.canConfirmExpertise).toBe(false);
  await expect(
    repository.decideNeedExpertise(administrator, lead.id, command(initial), key()),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  const input = command(initial, "clarification_needed"),
    attempt = key();
  expect(
    (await repository.decideNeedExpertise(administrator, lead.id, input, attempt))
      .effectivePosition,
  ).toBe("clarification_needed");
  await database.pool.query(
    "update identity_sessions set mfa_verified_at=now()-interval '25 hours' where id=$1",
    [administrator.id],
  );
  await expect(repository.needExpertise(administrator, lead.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await expect(
    repository.decideNeedExpertise(administrator, lead.id, input, attempt),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  await database.pool.query(
    "update identity_sessions set mfa_verified_at=now()-interval '1 second' where id=$1",
    [administrator.id],
  );
  await database.pool.query(
    "update identity_admin_permissions set revoked_at=now() where user_id=$1",
    [administrator.userId],
  );
  await expect(
    repository.decideNeedExpertise(administrator, lead.id, input, attempt),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
});

it("removes access on lost mandate, suspension, expired review and closure, retaining the private evidence", async () => {
  const { person, owner, lead } = await scenario(),
    other = await professional();
  const input = command(await repository.needExpertise(person, lead.id)),
    attempt = key();
  await repository.decideNeedExpertise(person, lead.id, input, attempt);
  await repository.command(
    admin,
    lead.id,
    {
      action: "assign",
      revision: (await repository.detail(admin, lead.id)).revision,
      responsibleId: other.userId,
      reason: "Nouveau mandat isolé",
    },
    key(),
  );
  await expect(repository.needExpertise(person, lead.id)).rejects.toBeDefined();
  await expect(
    repository.decideNeedExpertise(person, lead.id, input, attempt),
  ).rejects.toBeDefined();
  expect((await repository.needExpertise(other, lead.id)).current).toBeNull();
  await repository.command(
    admin,
    lead.id,
    {
      action: "assign",
      revision: (await repository.detail(admin, lead.id)).revision,
      responsibleId: person.userId,
      reason: "Mandat rétabli isolé",
    },
    key(),
  );
  expect((await repository.needExpertise(person, lead.id)).status).toBe("review_required");
  for (const update of [
    "state='suspended'",
    "state='approved',review_due_at=now()-interval '1 second'",
  ]) {
    await database.pool.query(`update partner_members set ${update} where user_id=$1`, [
      person.userId,
    ]);
    await expect(repository.needExpertise(person, lead.id)).rejects.toMatchObject({
      code: "PARTNER_ACCESS_DENIED",
    });
  }
  await database.pool.query("update partner_members set review_due_at=null where user_id=$1", [
    person.userId,
  ]);
  await repository.command(
    admin,
    lead.id,
    {
      action: "close",
      revision: (await repository.detail(admin, lead.id)).revision,
      result: "resolved_without_contract",
      reason: "current_suitable",
      comment: "Clôture isolée",
    },
    key(),
  );
  await expect(
    repository.decideNeedExpertise(person, lead.id, input, attempt),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  expect(
    (
      await database.pool.query(
        "select revision from partner_need_expertise_reviews where lead_id=$1",
        [lead.id],
      )
    ).rows,
  ).toEqual([{ revision: 1 }]);
  expect((await repository.detail(owner, lead.id)).stage).toBe("completed");
});

it("keeps a contributor's decision personal and refuses it after revocation, without granting coworker access", async () => {
  const { person, lead } = await scenario(),
    colleague = await professional();
  const contribution = key();
  await database.pool.query(
    "insert into partner_contributors(id,lead_id,user_id,access_scope,can_edit,can_contact) values($1,$2,$3,'advice',false,false)",
    [contribution, lead.id, colleague.userId],
  );
  const input = command(await repository.needExpertise(colleague, lead.id), "clarification_needed"),
    attempt = key();
  await repository.decideNeedExpertise(colleague, lead.id, input, attempt);
  expect((await repository.needExpertise(person, lead.id)).current).toBeNull();
  expect(JSON.stringify(await repository.detail(person, lead.id))).not.toContain(input.reason);
  await database.pool.query("update partner_contributors set revoked_at=now() where id=$1", [
    contribution,
  ]);
  await expect(
    repository.decideNeedExpertise(colleague, lead.id, input, attempt),
  ).rejects.toBeDefined();
});

it("invalidates a canonical owner's round trip and never exposes history from a relinked subject", async () => {
  const owner = { ...(await actor()), wallet: true },
    destination = await actor(),
    person = await professional();
  const profiles = createManagedProfileRepository(database.db),
    transfers = createAdminProfileTransferRepository(database.db);
  const profile = await profiles.create(
      owner,
      { kind: "person", displayName: "Sujet capacité isolé" },
      key(),
    ),
    lead = await assigned(owner, person, profile.id);
  await decide(person, lead.id);
  // Transfer through the canonical operation, including the real revision/ownership guards.
  const first = await transfers.transfer(
    { id: admin.id, userId: owner.userId, administratorUserId: admin.userId },
    profile.id,
    { revision: profile.revision, destinationUserId: destination.userId },
    key(),
  );
  await transfers.transfer(
    { id: admin.id, userId: destination.userId, administratorUserId: admin.userId },
    profile.id,
    { revision: first.revision, destinationUserId: owner.userId },
    key(),
  );
  expect((await repository.needExpertise(person, lead.id)).status).toBe("review_required");
  const other = await profiles.create(
    owner,
    { kind: "person", displayName: "Autre sujet isolé" },
    key(),
  );
  await database.pool.query("update partner_leads set client_profile_id=$2 where id=$1", [
    lead.id,
    other.id,
  ]);
  expect(await repository.needExpertise(person, lead.id)).toMatchObject({
    current: null,
    history: [],
    effectivePosition: null,
    revision: 1,
  });
});

it("waits on the canonical profile lock and refuses a stale decision after the concurrent profile change", async () => {
  const owner = { ...(await actor()), wallet: true },
    person = await professional();
  const profile = await createManagedProfileRepository(database.db).create(
      owner,
      { kind: "person", displayName: "Sujet concurrent capacité" },
      key(),
    ),
    lead = await assigned(owner, person, profile.id);
  const input = command(await repository.needExpertise(person, lead.id)),
    blocker = await database.pool.connect();
  let pending: Promise<unknown> | undefined;
  try {
    await blocker.query("begin");
    await blocker.query("select id from managed_profiles where id=$1 for update", [profile.id]);
    pending = repository
      .decideNeedExpertise(person, lead.id, input, key())
      .catch((cause: unknown) => cause);
    await expect
      .poll(
        async () =>
          (
            await database.pool.query(
              "select pid from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%managed_profiles%' and pid<>pg_backend_pid() limit 1",
            )
          ).rowCount,
        { timeout: 5000 },
      )
      .toBe(1);
    await blocker.query("update managed_profiles set revision=revision+1 where id=$1", [
      profile.id,
    ]);
    await blocker.query("commit");
    expect(await pending).toMatchObject({ code: "PARTNER_CONFLICT" });
    expect((await repository.needExpertise(person, lead.id)).current).toBeNull();
  } finally {
    await blocker.query("rollback");
    blocker.release();
    if (pending) await pending;
  }
});

it("reprojects expiry after a real canonical profile lock wait on an exact retry", async () => {
  const owner = { ...(await actor()), wallet: true },
    person = await professional();
  const profile = await createManagedProfileRepository(database.db).create(
    owner,
    { kind: "person", displayName: "Sujet attente échéance" },
    key(),
  );
  const lead = await assigned(owner, person, profile.id),
    attempt = key();
  const input = {
    ...command(await repository.needExpertise(person, lead.id)),
    validUntil: new Date(Date.now() + 1500).toISOString(),
  };
  await repository.decideNeedExpertise(person, lead.id, input, attempt);
  const blocker = await database.pool.connect();
  let pending: Promise<NeedExpertiseDossier> | undefined;
  try {
    await blocker.query("begin");
    await blocker.query("select id from managed_profiles where id=$1 for update", [profile.id]);
    pending = repository.decideNeedExpertise(person, lead.id, input, attempt);
    await expect
      .poll(
        async () =>
          (
            await database.pool.query(
              "select pid from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%managed_profiles%' and pid<>pg_backend_pid() limit 1",
            )
          ).rowCount,
        { timeout: 5000 },
      )
      .toBe(1);
    await blocker.query(
      "select pg_sleep(greatest(0,extract(epoch from ($1::timestamptz-clock_timestamp())))+0.02)",
      [input.validUntil],
    );
    await blocker.query("commit");
    expect(await pending).toMatchObject({
      status: "expired",
      effectivePosition: null,
      revision: 1,
    });
  } finally {
    await blocker.query("rollback");
    blocker.release();
    if (pending) await pending;
  }
});

it("rejects malformed commands and SQL states, rolling back decisions and idempotency if audit fails", async () => {
  const { person, lead } = await scenario(),
    input = command(await repository.needExpertise(person, lead.id));
  for (const invalid of [
    { confirmed: false },
    { position: null },
    { validUntil: null },
    { action: "withdraw" },
    { scopeFingerprint: "wrong" },
    { reason: "short" },
    { reviewedScope: null },
    { reviewedScope: "short" },
    { reviewedScope: "x".repeat(501) },
    { advisorId: admin.userId },
    { limitations: null },
    { nextStep: "short" },
  ])
    expect(needExpertiseInputSchema.safeParse({ ...input, ...invalid }).success).toBe(false);
  const trigger = `isolated_need_expertise_${key().replaceAll("-", "")}`;
  await database.pool.query(
    `create function ${trigger}() returns trigger language plpgsql as $$ begin if NEW.kind='need_expertise.decided.v1' then raise exception 'Isolated need capacity audit failure'; end if; return NEW; end $$`,
  );
  await database.pool.query(
    `create trigger ${trigger} before insert on partner_events for each row execute function ${trigger}()`,
  );
  const attempt = key();
  try {
    await expect(repository.decideNeedExpertise(person, lead.id, input, attempt)).rejects.toThrow(
      "Isolated need capacity audit failure",
    );
    expect((await repository.needExpertise(person, lead.id)).current).toBeNull();
    expect(
      (
        await database.pool.query("select id from partner_commands where user_id=$1 and key=$2", [
          person.userId,
          attempt,
        ])
      ).rowCount,
    ).toBe(0);
  } finally {
    await database.pool.query(`drop trigger ${trigger} on partner_events`);
    await database.pool.query(`drop function ${trigger}()`);
  }
  await decide(person, lead.id);
  for (const patch of [
    "revision=0",
    "scope_fingerprint='bad'",
    "reason='short'",
    "reviewed_scope=null",
    "reviewed_scope='short'",
    "action='withdraw'",
    "position=null",
    "valid_until=created_at",
    "scope='[]'",
    "limitations=null",
    "next_step='short'",
  ]) {
    await expect(
      database.pool.query(
        `update partner_need_expertise_reviews set ${patch} where user_id=$1 and lead_id=$2`,
        [person.userId, lead.id],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  }
  expect((await repository.needExpertise(person, lead.id)).revision).toBe(1);
});

it("serves v1/v2 and shared assessments without the pending table, failing the new route explicitly", async () => {
  const { person, owner, lead } = await scenario();
  await database.pool.query(
    "alter table partner_need_expertise_reviews rename to isolated_need_expertise_unavailable",
  );
  try {
    for (const version of [false, true]) {
      const result = await repository.advisorAssessment(person, lead.id, version);
      expect(result.remainingChecks).toContain("conflicts");
      expect(result).not.toHaveProperty("effectivePosition");
    }
    expect((await repository.needCapacity(person, lead.id)).current).toBeNull();
    expect(await repository.referentAssessment(owner, lead.id, true)).not.toHaveProperty("current");
    await expect(repository.needExpertise(person, lead.id)).rejects.toMatchObject({
      code: "42P01",
    });
  } finally {
    await database.pool.query(
      "alter table isolated_need_expertise_unavailable rename to partner_need_expertise_reviews",
    );
  }
});
