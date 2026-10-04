import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { beforeAll, afterAll, expect, it } from "vitest";
import {
  capacityInputSchema,
  leadCreateInputSchema,
  partnerApplicationInputSchema,
  type CapacityInput,
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
    .withDatabase("coverview_capacity_test")
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

async function input(person: PartnerActor, position: CapacityInput["position"] = "open") {
  const dossier = await repository.capacity(person, person.userId);
  return capacityInputSchema.parse({
    revision: dossier.current?.revision ?? 0,
    professionalRevision: dossier.professionalRevision,
    action: position ? "declare" : "withdraw",
    position,
    validUntil: position ? new Date(Date.now() + 86400000).toISOString() : null,
    confirmed: true,
  });
}

it("keeps capacity unknown until a private personal statement, without changing assessments or Leads", async () => {
  const person = await professional(),
    owner = { ...(await actor()), wallet: true };
  const lead = await assigned(owner, person);
  const beforeLead = await repository.detail(person, lead.id);
  const beforeAssessment = await repository.advisorAssessment(person, lead.id);
  expect(await repository.capacity(person, person.userId)).toMatchObject({
    current: null,
    history: [],
    activeAdvisor: true,
    canDeclare: true,
    canWithdraw: false,
    workload: { accepted: 1, proposed: 0, contributing: 0 },
  });
  const declared = await repository.declareCapacity(
    person,
    person.userId,
    await input(person),
    key(),
  );
  expect(declared.current).toMatchObject({
    revision: 1,
    status: "declared",
    position: "open",
    categories: ["vehicle"],
    professionalScope: "current",
  });
  expect(await repository.detail(person, lead.id)).toEqual(beforeLead);
  expect({
    ...(await repository.advisorAssessment(person, lead.id)),
    assessedAt: beforeAssessment.assessedAt,
  }).toEqual(beforeAssessment);
  expect(beforeAssessment.remainingChecks).toContain("capacity");
  expect(
    (
      await database.pool.query(
        "select kind,audience,text,lead_id from partner_events where actor_id=$1 and kind like 'capacity.%'",
        [person.userId],
      )
    ).rows,
  ).toEqual([{ kind: "capacity.declared.v1", audience: "private", text: "", lead_id: null }]);
});

it("expires at the chosen instant without writes and replays the current state before reconfirmation", async () => {
  const person = await professional(),
    firstKey = key();
  const command = {
    ...(await input(person)),
    validUntil: new Date(Date.now() + 2000).toISOString(),
  };
  const first = await repository.declareCapacity(person, person.userId, command, firstKey);
  expect(first.current?.status).toBe("declared");
  await database.pool.query(
    "select pg_sleep(greatest(0,extract(epoch from ($1::timestamptz-clock_timestamp())))+0.02)",
    [command.validUntil],
  );
  const expired = await repository.declareCapacity(person, person.userId, command, firstKey);
  expect(expired.current).toMatchObject({ revision: 1, status: "expired", position: "open" });
  expect(expired.history).toHaveLength(1);
  await expect(
    repository.declareCapacity(
      person,
      person.userId,
      { ...(await input(person)), validUntil: command.validUntil },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  const again = await repository.declareCapacity(
    person,
    person.userId,
    await input(person, "case_by_case"),
    key(),
  );
  expect(again.current).toMatchObject({
    revision: 2,
    status: "declared",
    position: "case_by_case",
  });
  const withdrawn = await repository.declareCapacity(
    person,
    person.userId,
    await input(person, null),
    key(),
  );
  expect(withdrawn.current).toMatchObject({
    revision: 3,
    status: "withdrawn",
    position: null,
    validUntil: null,
  });
  expect(
    (await repository.declareCapacity(person, person.userId, command, firstKey)).current,
  ).toEqual(withdrawn.current);
  await expect(
    repository.declareCapacity(person, person.userId, await input(person, null), key()),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
});

it("serializes same-revision contenders and exact retries, then paginates immutable history", async () => {
  const person = await professional(),
    command = await input(person),
    sharedKey = key();
  const race = await Promise.allSettled([
    repository.declareCapacity(person, person.userId, command, sharedKey),
    repository.declareCapacity(
      person,
      person.userId,
      { ...command, position: "unavailable" },
      key(),
    ),
  ]);
  expect(race.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(race.find((result) => result.status === "rejected")).toMatchObject({
    reason: { code: "PARTNER_CONFLICT" },
  });
  const next = await input(person, "case_by_case"),
    retryKey = key();
  const retries = await Promise.all([
    repository.declareCapacity(person, person.userId, next, retryKey),
    repository.declareCapacity(person, person.userId, next, retryKey),
  ]);
  expect(retries.map((result) => result.current?.revision)).toEqual([2, 2]);
  await expect(
    repository.declareCapacity(
      person,
      person.userId,
      { ...next, position: "unavailable" },
      retryKey,
    ),
  ).rejects.toMatchObject({ code: "PARTNER_IDEMPOTENCY_REUSED" });
  const original = retries[0].current;
  for (let count = 0; count < 21; count++)
    await repository.declareCapacity(person, person.userId, await input(person), key());
  const latest = await repository.capacity(person, person.userId);
  expect(latest.history.map((item) => item.revision)).toEqual(
    Array.from({ length: 20 }, (_, index) => 23 - index),
  );
  const older = await repository.capacity(person, person.userId, latest.nextBeforeRevision!);
  expect(older.history.map((item) => item.revision)).toEqual([3, 2, 1]);
  expect(older.history[1]).toEqual(original);
  expect(older.nextBeforeRevision).toBeNull();
  expect(older.current).toEqual(latest.current);
  await expect(repository.capacity(person, person.userId, 0)).rejects.toBeDefined();
});

it("denies other members, managers, Wallet and unverified administrators, including mutation replays", async () => {
  const person = await professional(),
    neighbor = await professional(),
    outsider = await actor(),
    invalidAdmin = await actor(true);
  const command = await input(person),
    commandKey = key();
  await repository.declareCapacity(person, person.userId, command, commandKey);
  await database.pool.query(
    "update partner_members set organization_id=(select organization_id from partner_members where user_id=$2),roles='[\"manager\"]' where user_id=$1",
    [neighbor.userId, person.userId],
  );
  for (const reader of [
    neighbor,
    outsider,
    { ...person, wallet: true },
    { ...admin, wallet: true },
  ]) {
    await expect(repository.capacity(reader, person.userId)).rejects.toMatchObject({
      code: "PARTNER_ACCESS_DENIED",
    });
    await expect(
      repository.declareCapacity(reader, person.userId, command, commandKey),
    ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  }
  expect(await repository.capacity(admin, person.userId)).toMatchObject({
    canDeclare: false,
    canWithdraw: false,
  });
  await expect(
    repository.declareCapacity(admin, person.userId, command, key()),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  await database.pool.query(
    "update identity_sessions set mfa_verified_at=now()-interval '25 hours' where id=$1",
    [invalidAdmin.id],
  );
  await expect(repository.capacity(invalidAdmin, person.userId)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await database.pool.query("update identity_sessions set mfa_verified_at=now() where id=$1", [
    invalidAdmin.id,
  ]);
  await database.pool.query(
    "update identity_admin_permissions set revoked_at=now() where user_id=$1",
    [invalidAdmin.userId],
  );
  await expect(repository.capacity(invalidAdmin, person.userId)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
    person.id,
  ]);
  await expect(repository.capacity(person, person.userId)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await expect(
    repository.declareCapacity(person, person.userId, command, commandKey),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
});

it("allows private declarations without operational approval and only withdrawal after closure", async () => {
  const person = await professional();
  for (const state of ["submitted", "suspended"]) {
    await database.pool.query("update partner_members set state=$2 where user_id=$1", [
      person.userId,
      state,
    ]);
    const value = await repository.declareCapacity(
      person,
      person.userId,
      await input(person),
      key(),
    );
    expect(value).toMatchObject({
      activeAdvisor: false,
      canDeclare: true,
      current: { status: "declared" },
    });
  }
  const command = await input(person),
    commandKey = key();
  await repository.declareCapacity(person, person.userId, command, commandKey);
  await database.pool.query("update partner_members set state='closed' where user_id=$1", [
    person.userId,
  ]);
  expect(await repository.capacity(person, person.userId)).toMatchObject({
    activeAdvisor: false,
    canDeclare: false,
    canWithdraw: true,
  });
  await expect(
    repository.declareCapacity(person, person.userId, command, commandKey),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  expect(
    (await repository.declareCapacity(person, person.userId, await input(person, null), key()))
      .current?.status,
  ).toBe("withdrawn");
});

it("invalidates professional scope through identity, organization and category round trips, requiring reconfirmation", async () => {
  const person = await professional();
  for (const [field, changed] of [
    ["name", "Autre nom"],
    ["organization", "Autre organisation"],
    ["categories", ["vehicle", "health"]],
  ] as const) {
    const member = (await repository.context(person)).application!;
    const command = await input(person);
    await repository.declareCapacity(person, person.userId, command, key());
    await database.pool.query(
      "update partner_members set application=jsonb_set(application,array[$2],$3::jsonb) where user_id=$1",
      [person.userId, field, JSON.stringify(changed)],
    );
    expect((await repository.capacity(person, person.userId)).current?.status).toBe(
      "scope_changed",
    );
    await database.pool.query(
      "update partner_members set application=jsonb_set(application,array[$2],$3::jsonb) where user_id=$1",
      [person.userId, field, JSON.stringify(member[field])],
    );
    expect((await repository.capacity(person, person.userId)).current?.status).toBe(
      "scope_changed",
    );
    await expect(
      repository.declareCapacity(
        person,
        person.userId,
        { ...command, revision: command.revision + 1 },
        key(),
      ),
    ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
    expect(
      (await repository.declareCapacity(person, person.userId, await input(person), key())).current
        ?.status,
    ).toBe("declared");
  }
});

it("counts recorded open Lead links distinctly across multi-Leads, contributor scopes and current eligibility", async () => {
  const person = await professional(),
    other = await professional(),
    owner = await actor();
  const first = await assigned({ ...owner, wallet: true }, person);
  await assigned({ ...owner, wallet: true }, person);
  const fixture = async (
    responsible: string | null,
    assignment: string,
    stage = "analysis",
    category = "vehicle",
  ) => {
    const id = key();
    await database.pool.query(
      "insert into partner_leads(id,creator_id,client_user_id,responsible_id,assignment,title,category,object,client_name,details,stage,priority,next_action,result,reason) values($1,$2,$2,$3,$4,'Private lead',$5,'Car','Private client','{}',$6,'normal','Follow up',case when $6='completed' then 'resolved_without_contract' end,case when $6='completed' then 'current_suitable' end)",
      [id, owner.userId, responsible, assignment, category, stage],
    );
    return id;
  };
  const contribution = async (leadId: string, scope: string, edit: boolean, revoked = false) => {
    await database.pool.query(
      "insert into partner_contributors(id,lead_id,user_id,access_scope,can_edit,can_contact,revoked_at) values($1,$2,$3,$4,$5,false,case when $6 then now() end)",
      [key(), leadId, person.userId, scope, edit, revoked],
    );
  };
  await fixture(person.userId, "proposed");
  await fixture(person.userId, "accepted", "draft");
  await fixture(person.userId, "accepted", "completed");
  await fixture(person.userId, "reassign");
  await fixture(person.userId, "accepted", "analysis", "health");
  await contribution(first.id, "advice", true); // Same Lead never doubles as a contribution.
  const active = await fixture(other.userId, "accepted");
  await contribution(active, "advice", true, true); // An old revoked link never multiplies the active link.
  await contribution(active, "advice", true);
  await contribution(await fixture(other.userId, "accepted"), "advice", false);
  await contribution(await fixture(other.userId, "accepted"), "progress", false);
  await contribution(await fixture(other.userId, "accepted"), "advice", true, true);
  await contribution(await fixture(other.userId, "accepted", "completed"), "advice", true);
  await contribution(await fixture(other.userId, "accepted", "draft"), "advice", true);
  const observed = await repository.capacity(person, person.userId);
  expect(observed.workload).toMatchObject({ accepted: 3, proposed: 1, contributing: 1 });
  for (const field of [
    "clientName",
    "clientUserId",
    "leadId",
    "title",
    "dueAt",
    "periods",
    "score",
    "eligible",
  ])
    expect(JSON.stringify(observed)).not.toContain(field);
  await repository.declareCapacity(
    person,
    person.userId,
    await input(person, "unavailable"),
    key(),
  );
  const declaration = (await repository.capacity(person, person.userId)).current;
  await database.pool.query(
    "update partner_leads set assignment='accepted' where responsible_id=$1 and assignment='proposed'",
    [person.userId],
  );
  await database.pool.query(
    "update partner_contributors set revoked_at=now() where user_id=$1 and lead_id=$2 and revoked_at is null",
    [person.userId, active],
  );
  await database.pool.query(
    "update partner_members set review_due_at=now()-interval '1 hour' where user_id=$1",
    [person.userId],
  );
  const refreshed = await repository.capacity(person, person.userId);
  expect(refreshed).toMatchObject({
    activeAdvisor: false,
    workload: { accepted: 4, proposed: 0, contributing: 0 },
  });
  expect(refreshed.current).toEqual(declaration);
  expect(refreshed.history).toHaveLength(1);
});

it("rejects malformed consent and dates, and rolls back declaration and command if private audit fails", async () => {
  const person = await professional(),
    command = await input(person);
  for (const invalid of [
    { ...command, confirmed: false },
    { ...command, position: null },
    { ...command, validUntil: null },
    { ...command, action: "withdraw" },
    { ...command, extra: true },
    { ...command, validUntil: "2026-02-30T12:00:00Z" },
  ]) {
    expect(capacityInputSchema.safeParse(invalid).success).toBe(false);
    expect(() =>
      repository.declareCapacity(person, person.userId, invalid as CapacityInput, key()),
    ).toThrow();
  }
  await expect(
    repository.declareCapacity(person, person.userId, await input(person, null), key()),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  await database.pool.query(
    "create function isolated_capacity_audit_failure() returns trigger language plpgsql as $$ begin if NEW.kind='capacity.declared.v1' then raise exception 'Isolated audit failure'; end if; return NEW; end $$",
  );
  await database.pool.query(
    "create trigger isolated_capacity_audit_failure before insert on partner_events for each row execute function isolated_capacity_audit_failure()",
  );
  const commandKey = key();
  try {
    await expect(
      repository.declareCapacity(person, person.userId, command, commandKey),
    ).rejects.toThrow("Isolated audit failure");
    expect((await repository.capacity(person, person.userId)).current).toBeNull();
    expect(
      (
        await database.pool.query("select id from partner_commands where user_id=$1 and key=$2", [
          person.userId,
          commandKey,
        ])
      ).rowCount,
    ).toBe(0);
  } finally {
    await database.pool.query("drop trigger isolated_capacity_audit_failure on partner_events");
    await database.pool.query("drop function isolated_capacity_audit_failure()");
  }
  await repository.declareCapacity(person, person.userId, command, commandKey);
  for (const [action, position, validUntil] of [
    ["declare", null, command.validUntil],
    ["declare", "invented", command.validUntil],
    ["declare", "open", null],
    ["declare", "open", "2000-01-01T00:00:00Z"],
    ["withdraw", "open", null],
    ["withdraw", null, command.validUntil],
  ]) {
    await expect(
      database.pool.query(
        "insert into partner_capacity_declarations(id,user_id,organization_id,revision,professional_revision,declared_name,declared_organization,categories,action,position,valid_until) select $1,user_id,organization_id,2,professional_revision,declared_name,declared_organization,categories,$2,$3,$4 from partner_capacity_declarations where user_id=$5 and revision=1",
        [key(), action, position, validUntil, person.userId],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  }
  expect((await repository.capacity(person, person.userId)).history).toHaveLength(1);
});

it("waits for the member lock before projecting a withdrawal to supervision", async () => {
  const person = await professional();
  await repository.declareCapacity(person, person.userId, await input(person), key());
  const blocker = await database.pool.connect();
  let pending: Promise<unknown> | undefined;
  try {
    await blocker.query("begin");
    await blocker.query("select user_id from partner_members where user_id=$1 for update", [
      person.userId,
    ]);
    pending = repository.capacity(admin, person.userId).catch((cause: unknown) => cause);
    await expect
      .poll(
        async () =>
          (
            await database.pool.query(
              "select pid from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%partner_members%' and pid<>pg_backend_pid() limit 1",
            )
          ).rowCount,
        { timeout: 5000 },
      )
      .toBe(1);
    await blocker.query(
      "insert into partner_capacity_declarations(id,user_id,organization_id,revision,professional_revision,declared_name,declared_organization,categories,action) select $1,user_id,organization_id,revision+1,professional_revision,declared_name,declared_organization,categories,'withdraw' from partner_capacity_declarations where user_id=$2 order by revision desc limit 1",
      [key(), person.userId],
    );
    await blocker.query("commit");
    expect(await pending).toMatchObject({
      current: { revision: 2, status: "withdrawn", position: null },
    });
  } finally {
    await blocker.query("rollback");
    blocker.release();
    if (pending) await pending;
  }
});
