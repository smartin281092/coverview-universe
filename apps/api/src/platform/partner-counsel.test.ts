import { cp, mkdir, mkdtemp, readFile, writeFile, copyFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { beforeAll, afterAll, expect, it } from "vitest";
import {
  leadCreateInputSchema,
  partnerApplicationInputSchema,
  counselRequestInputSchema,
  type CounselCandidate,
} from "@coverview/contracts/partner";
import { createDatabase } from "./db/database.js";
import { createPartnerRepository } from "../modules/partner-workspace/partner.repository.js";
import type { PartnerActor } from "../modules/partner-workspace/partner.policy.js";
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
    .withDatabase("coverview_counsel_orchestration_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  // The incoming journal is protected. Assemble the pending additive migration only in this
  // ignored test catalogue; the normal deployment catalogue deliberately remains untouched.
  const local = resolve(".planning-local");
  await mkdir(local, { recursive: true });
  const migrationsFolder = await mkdtemp(join(local, "booking-proposals-test-"));
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
    "0053_partner_solution_clauses",
    "0054_partner_distribution_review",
    "0055_partner_appointment_links",
    "0056_partner_booking_proposals",
    "0057_partner_counsel_orchestration",
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

async function setup() {
  const person = await professional(),
    owner = { ...(await actor()), wallet: true };
  const lead = await assigned(owner, person);
  const view = await repository.counselPersonal(person, lead.id);
  const input = counselRequestInputSchema.parse({
    basis: view.basis,
    kind: "specialist",
    summary: "Résumé choisi pour CoverView uniquement",
    nextAction: "Trouver un spécialiste et organiser la suite",
    dueAt: new Date(Date.now() + 86400000).toISOString(),
    shareConfirmed: true,
  });
  return { person, owner, lead, input };
}
it("routes an explicit dated request to CoverView without sharing private assessments or altering ongoing work", async () => {
  const s = await setup();
  const capacity = await repository.needCapacity(s.person, s.lead.id);
  await repository.decideNeedCapacity(
    s.person,
    s.lead.id,
    {
      revision: capacity.revision,
      scopeFingerprint: capacity.scopeFingerprint,
      action: "decide",
      position: "capacity_insufficient",
      reason: "PRIVATE_CAPACITY_REASON",
      validUntil: new Date(Date.now() + 86400000).toISOString(),
      confirmed: true,
    },
    key(),
  );
  s.input.basis = (await repository.counselPersonal(s.person, s.lead.id)).basis;
  const before = (await database.pool.query("select * from partner_leads where id=$1", [s.lead.id]))
    .rows;
  const idempotency = key(),
    request = await repository.requestCounsel(s.person, s.lead.id, s.input, idempotency);
  expect(request.state).toBe("open");
  expect(await repository.requestCounsel(s.person, s.lead.id, s.input, idempotency)).toEqual(
    request,
  );
  expect((await repository.counselPersonal(s.person, s.lead.id)).canRequest).toBe(false);
  expect(
    (await database.pool.query("select * from partner_leads where id=$1", [s.lead.id])).rows,
  ).toEqual(before);
  const queue = await repository.counselQueue(admin);
  expect(queue.items.some((r) => r.id === request.id)).toBe(true);
  expect(JSON.stringify(queue)).not.toContain("PRIVATE_CAPACITY_REASON");
  expect(JSON.stringify(queue)).not.toContain("sourceBasis");
  expect(JSON.stringify(queue)).not.toContain("capacity_insufficient");
  await expect(repository.counselRequest(s.owner, request.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await expect(repository.counselRequest(await professional(), request.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  await expect(repository.counselPersonal(admin, s.lead.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await expect(
    repository.requestCounsel(s.person, s.lead.id, s.input, key()),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
});
it("keeps unknown criteria distinct and executes an accepted collaboration while preserving the original clock", async () => {
  const s = await setup(),
    specialist = await professional();
  const request = await repository.requestCounsel(s.person, s.lead.id, s.input, key());
  const followed = await repository.actCounsel(
    admin,
    request.id,
    {
      action: "follow_up",
      revision: 0,
      reason: "Prise en charge de cette recherche",
      nextAction: "Contacter le spécialiste",
      dueAt: s.input.dueAt,
    },
    key(),
  );
  const candidates = await repository.counselCandidates(admin, request.id),
    candidate = candidates.items.find((c) => c.id === specialist.userId)!;
  expect(candidate).toMatchObject({
    language: "unknown",
    region: "unknown",
    mode: "unknown",
    decision: "human_review_required",
    competence: { status: "missing" },
  });
  expect(candidate.remainingChecks).toContain("distribution");
  const before = (
    await database.pool.query(
      "select notification_cycle,first_action_due_at,acceptance_due_at,next_action,due_at from partner_leads where id=$1",
      [s.lead.id],
    )
  ).rows;
  const proposed = await repository.actCounsel(
    admin,
    request.id,
    {
      action: "propose",
      revision: followed.revision,
      reason: "Reprise manuelle des critères encore inconnus",
      nextAction: "Attendre la réponse puis vérifier le besoin",
      dueAt: s.input.dueAt,
      candidateBasis: candidate.basis,
      humanReviewConfirmed: true,
      terms: {
        targetId: specialist.userId,
        mode: "co_advice",
        access: "contribute",
        communication: "client_direct",
        scope: "Qualifier la question explicitement transmise",
        responsibilities: "Le responsable garde le suivi et le spécialiste qualifie",
        reason: "Demande explicite de spécialiste",
        economicNote: "Aucune rémunération activée par cette proposition",
        existingRightsPreserved: true,
        transmissionConfirmed: true,
      },
    },
    key(),
  );
  expect(proposed.state).toBe("awaiting_specialist");
  await expect(repository.detail(specialist, s.lead.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  await repository.respondCollaboration(
    specialist,
    proposed.collaboration!.id,
    {
      decision: "accept",
      revision: proposed.collaboration!.revision,
      reason: "Je prends en charge la qualification du besoin",
    },
    key(),
  );
  expect((await repository.counselRequest(admin, request.id)).state).toBe("accepted");
  expect((await repository.detail(specialist, s.lead.id)).id).toBe(s.lead.id);
  expect(
    (
      await database.pool.query(
        "select notification_cycle,first_action_due_at,acceptance_due_at,next_action,due_at from partner_leads where id=$1",
        [s.lead.id],
      )
    ).rows,
  ).toEqual(before);
  expect((await repository.counselQueue(admin)).items.some((r) => r.id === request.id)).toBe(false);
});
it("rejects changed sources, stale revisions and expired deadlines, and records withdrawal immutably", async () => {
  const s = await setup();
  expect(counselRequestInputSchema.safeParse({ ...s.input, shareConfirmed: false }).success).toBe(
    false,
  );
  await expect(
    repository.requestCounsel(
      s.person,
      s.lead.id,
      { ...s.input, dueAt: new Date(Date.now() - 1000).toISOString() },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  const request = await repository.requestCounsel(s.person, s.lead.id, s.input, key());
  const withdrawn = await repository.actCounsel(
    s.person,
    request.id,
    { action: "withdraw", revision: 0, reason: "La clarification est déjà réalisée" },
    key(),
  );
  expect(withdrawn.state).toBe("withdrawn");
  await expect(
    repository.actCounsel(
      admin,
      request.id,
      { action: "resolve", revision: 0, reason: "Réponse après une page devenue ancienne" },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  await expect(
    database.pool.query("update partner_counsel_requests set input='{}' where id=$1", [request.id]),
  ).rejects.toThrow("immutable");
  await expect(
    database.pool.query("delete from partner_counsel_actions where request_id=$1", [request.id]),
  ).rejects.toThrow("immutable");
});
it("does not resurrect an actionable request after a subject-context round trip", async () => {
  const s = await setup(),
    request = await repository.requestCounsel(s.person, s.lead.id, s.input, key());
  await database.pool.query(
    "update partner_leads set object='Changement de contexte' where id=$1",
    [s.lead.id],
  );
  await database.pool.query("update partner_leads set object=$2 where id=$1", [
    s.lead.id,
    s.lead.object,
  ]);
  expect((await repository.counselRequest(admin, request.id)).state).toBe("context_changed");
  await expect(repository.counselCandidates(admin, request.id)).rejects.toMatchObject({
    code: "PARTNER_ACTION_REQUIRED",
  });
  const resolved = await repository.actCounsel(
    admin,
    request.id,
    {
      action: "resolve",
      revision: 0,
      reason: "Un nouveau besoin doit être confirmé avec son auteur",
    },
    key(),
  );
  expect(resolved.state).toBe("resolved");
  expect((await repository.counselPersonal(s.person, s.lead.id)).canRequest).toBe(true);
});
it("rolls back the request and its command when its audit cannot persist", async () => {
  const s = await setup(),
    commandKey = key();
  await database.pool
    .query(`create function counsel_fail() returns trigger language plpgsql as $$ begin if new.kind='counsel.requested.v1' then raise exception 'Isolated counsel audit failure'; end if; return new; end $$;
    create trigger counsel_fail before insert on partner_events for each row execute function counsel_fail()`);
  try {
    await expect(
      repository.requestCounsel(s.person, s.lead.id, s.input, commandKey),
    ).rejects.toThrow("Isolated counsel audit failure");
  } finally {
    await database.pool.query(
      "drop trigger counsel_fail on partner_events; drop function counsel_fail()",
    );
  }
  expect((await repository.counselPersonal(s.person, s.lead.id)).requests.items).toHaveLength(0);
  expect(
    (
      await database.pool.query("select id from partner_commands where user_id=$1 and key=$2", [
        s.person.userId,
        commandKey,
      ])
    ).rowCount,
  ).toBe(0);
});

async function findCandidate(requestId: string, userId: string): Promise<CounselCandidate> {
  let cursor: string | undefined;
  do {
    const page = await repository.counselCandidates(admin, requestId, cursor);
    const item = page.items.find((c) => c.id === userId);
    if (item) return item;
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  throw new Error("Missing isolated candidate");
}
const proposal = (c: CounselCandidate, revision: number, dueAt: string) => ({
  action: "propose" as const,
  revision,
  reason: "Clarification manuelle des critères du besoin",
  nextAction: "Suivre la réponse du spécialiste",
  dueAt,
  candidateBasis: c.basis,
  humanReviewConfirmed: true as const,
  terms: {
    targetId: c.id,
    mode: "co_advice" as const,
    access: "read" as const,
    communication: "referent_only" as const,
    scope: "Clarifier les critères avec le responsable",
    responsibilities: "Le responsable conserve le contact avec le client",
    reason: "Examen manuel du besoin",
    economicNote: "Aucun paiement ou montant confirmé",
    existingRightsPreserved: true as const,
    transmissionConfirmed: true as const,
  },
});
it("compares confirmed preferences to dated declarations, rejects a stale selection, and follows a declined invitation", async () => {
  const s = await setup(),
    specialist = await professional();
  const pref = await repository.advicePreferences(s.owner, s.lead.id);
  await repository.confirmAdvicePreferences(
    s.owner,
    s.lead.id,
    {
      revision: pref.revision,
      scopeRevision: pref.scopeRevision,
      profileRevision: pref.profileRevision!,
      mode: "office",
      languageCode: "fr",
      canton: "VD",
      confirmed: true,
    },
    key(),
  );
  s.input.basis = (await repository.counselPersonal(s.person, s.lead.id)).basis;
  const request = await repository.requestCounsel(s.person, s.lead.id, s.input, key());
  const previous = await findCandidate(request.id, specialist.userId),
    practice = await repository.practice(specialist, specialist.userId);
  await repository.declarePractice(
    specialist,
    specialist.userId,
    {
      revision: practice.current?.revision ?? 0,
      professionalRevision: practice.professionalRevision,
      languageCodes: ["de"],
      cantons: ["ZH"],
      confirmed: true,
    },
    key(),
  );
  const candidate = await findCandidate(request.id, specialist.userId);
  expect(candidate).toMatchObject({
    language: "differs",
    region: "differs",
    mode: "unknown",
    decision: "human_review_required",
  });
  expect(candidate.practice.declaredAt).not.toBeNull();
  await expect(
    repository.actCounsel(admin, request.id, proposal(previous, 0, s.input.dueAt), key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  expect((await repository.counselRequest(admin, request.id)).history).toHaveLength(0);
  const value = await repository.actCounsel(
    admin,
    request.id,
    proposal(candidate, 0, s.input.dueAt),
    key(),
  );
  const dated = await repository.actCounsel(
    admin,
    request.id,
    {
      action: "follow_up",
      revision: value.revision,
      reason: "Réponse toujours attendue",
      nextAction: "Relancer personnellement le spécialiste",
      dueAt: s.input.dueAt,
    },
    key(),
  );
  expect(dated.state).toBe("awaiting_specialist");
  await repository.respondCollaboration(
    specialist,
    value.collaboration!.id,
    {
      revision: value.collaboration!.revision,
      decision: "decline",
      reason: "Cette mission ne correspond pas à ma pratique",
    },
    key(),
  );
  const reopened = await repository.counselRequest(admin, request.id);
  expect(reopened.state).toBe("open");
  expect(reopened.nextAction).toBe("Relancer personnellement le spécialiste");
});
it("reauthorizes a canonical owner transfer and never reactivates the old context on return", async () => {
  const person = await professional(),
    owner = { ...(await actor()), wallet: true },
    newOwner = await actor(),
    profileId = `prf_${key()}`;
  await database.pool.query(
    "insert into managed_profiles(id,user_id,display_name,kind) values($1,$2,'Sujet isolé','person')",
    [profileId, owner.userId],
  );
  const lead = await assigned(owner, person, profileId),
    view = await repository.counselPersonal(person, lead.id);
  const request = await repository.requestCounsel(
    person,
    lead.id,
    {
      basis: view.basis,
      kind: "clarification",
      summary: "Résumé explicitement transmis pour ce sujet",
      nextAction: "Clarifier le besoin avec le propriétaire",
      dueAt: new Date(Date.now() + 86400000).toISOString(),
      shareConfirmed: true,
    },
    key(),
  );
  await database.pool.query(
    "update managed_profiles set user_id=$2,revision=revision+1 where id=$1",
    [profileId, newOwner.userId],
  );
  await expect(repository.counselRequest(admin, request.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  expect((await repository.counselQueue(admin)).items.some((r) => r.id === request.id)).toBe(false);
  await database.pool.query(
    "update managed_profiles set user_id=$2,revision=revision+1 where id=$1",
    [profileId, owner.userId],
  );
  expect((await repository.counselRequest(admin, request.id)).state).toBe("context_changed");
});
it("serializes competing resolutions and rolls back a linked collaboration on a late command failure", async () => {
  const s = await setup(),
    specialist = await professional(),
    request = await repository.requestCounsel(s.person, s.lead.id, s.input, key());
  const c = await findCandidate(request.id, specialist.userId);
  await database.pool
    .query(`create function counsel_command_fail() returns trigger language plpgsql as $$ begin if new.operation like 'counsel.action:%' then raise exception 'Isolated command failure'; end if; return new; end $$;
    create trigger counsel_command_fail before insert on partner_commands for each row execute function counsel_command_fail()`);
  try {
    await expect(
      repository.actCounsel(admin, request.id, proposal(c, 0, s.input.dueAt), key()),
    ).rejects.toThrow("Isolated command failure");
  } finally {
    await database.pool.query(
      "drop trigger counsel_command_fail on partner_commands; drop function counsel_command_fail()",
    );
  }
  expect((await repository.counselRequest(admin, request.id)).history).toHaveLength(0);
  expect(
    (await repository.collaborations(admin)).items.filter((c) => c.leadId === s.lead.id),
  ).toHaveLength(0);
  const outcomes = await Promise.allSettled(
    [key(), key()].map((k) =>
      repository.actCounsel(
        admin,
        request.id,
        { action: "resolve", revision: 0, reason: "Clarification effectuée avec le conseiller" },
        k,
      ),
    ),
  );
  expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
  expect((await repository.counselRequest(admin, request.id)).history).toHaveLength(1);
});
it("rechecks an expiring private source after a real wait following request persistence", async () => {
  const s = await setup(),
    capacity = await repository.needCapacity(s.person, s.lead.id);
  await repository.decideNeedCapacity(
    s.person,
    s.lead.id,
    {
      revision: capacity.revision,
      scopeFingerprint: capacity.scopeFingerprint,
      action: "decide",
      position: "capacity_insufficient",
      reason: "Capacité temporairement limitée pour le test isolé",
      validUntil: new Date(Date.now() + 4000).toISOString(),
      confirmed: true,
    },
    key(),
  );
  s.input.basis = (await repository.counselPersonal(s.person, s.lead.id)).basis;
  const blocker = await database.pool.connect();
  await blocker.query("begin; select pg_advisory_xact_lock(664433)");
  await database.pool
    .query(`create function counsel_wait() returns trigger language plpgsql as $$ begin if new.operation like 'counsel.request:%' then perform pg_advisory_xact_lock(664433); end if; return new; end $$;
    create trigger counsel_wait before insert on partner_commands for each row execute function counsel_wait()`);
  const outcome = repository.requestCounsel(s.person, s.lead.id, s.input, key()).then(
    (value) => ({ value, error: null }),
    (error: unknown) => ({ value: null, error }),
  );
  try {
    let waiting = false;
    for (let i = 0; i < 100; i++) {
      waiting = !!(
        await database.pool.query(
          "select 1 from pg_locks where locktype='advisory' and objid=664433 and not granted",
        )
      ).rowCount;
      if (waiting) break;
      await setTimeout(25);
    }
    expect(waiting).toBe(true);
    await setTimeout(4200);
    await blocker.query("commit");
    expect((await outcome).error).toMatchObject({ code: "PARTNER_CONFLICT" });
    expect((await repository.counselPersonal(s.person, s.lead.id)).requests.items).toHaveLength(0);
  } finally {
    await blocker.query("rollback");
    blocker.release();
    await outcome;
    await database.pool.query(
      "drop trigger counsel_wait on partner_commands; drop function counsel_wait()",
    );
  }
});

it("paginates the actual human queue without losing or duplicating requests", async () => {
  const person = await professional(),
    owner = { ...(await actor()), wallet: true },
    expected = new Set<string>();
  for (let i = 0; i < 21; i++) {
    const lead = await assigned(owner, person),
      view = await repository.counselPersonal(person, lead.id);
    const request = await repository.requestCounsel(
      person,
      lead.id,
      {
        basis: view.basis,
        kind: "clarification",
        summary: `Besoin isolé numéro ${i} à clarifier`,
        nextAction: "Examiner cette demande avec son auteur",
        dueAt: new Date(Date.now() + 86400000).toISOString(),
        shareConfirmed: true,
      },
      key(),
    );
    expected.add(request.id);
  }
  const seen = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await repository.counselQueue(admin, cursor);
    expect(page.items.length).toBeLessThanOrEqual(20);
    for (const item of page.items) {
      expect(seen.has(item.id)).toBe(false);
      seen.add(item.id);
    }
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  expect([...expected].every((id) => seen.has(id))).toBe(true);
  await expect(repository.counselQueue(admin, "broken-cursor")).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
});
