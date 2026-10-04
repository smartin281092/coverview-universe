import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { beforeAll, afterAll, expect, it } from "vitest";
import {
  advicePreferencesInputSchema,
  leadCreateInputSchema,
  partnerApplicationInputSchema,
  type AdvicePreferences,
  type LeadCreateInput,
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
const input = (dossier: AdvicePreferences) =>
  advicePreferencesInputSchema.parse({
    revision: dossier.revision,
    scopeRevision: dossier.scopeRevision,
    profileRevision: dossier.profileRevision,
    languageCode: "fr",
    mode: "home",
    canton: "GE",
    confirmed: true,
  });
const leadInput = (owner: PartnerActor | null, profileId: string | null = null) =>
  leadCreateInputSchema.parse({
    title: "Conseil synthétique véhicule",
    category: "vehicle",
    object: "Voiture test",
    context: "Besoin isolé",
    clientUserId: owner?.userId ?? null,
    clientProfileId: profileId,
    clientName: "Client synthétique",
    email: "test@advice.test",
    phone: "",
    language: "fr",
    source: "Test isolé",
    transmissionAuthorized: true,
    priority: "normal",
    draft: false,
    nextAction: "Qualifier",
    dueAt: new Date(Date.now() + 86400000).toISOString(),
  });

it("requires current operational authority for reading, and only the current Wallet owner can confirm", async () => {
  const owner = { ...(await actor()), wallet: true },
    advisor = await professional(),
    neighbor = await professional(),
    outsider = { ...(await actor()), wallet: true };
  let lead = await repository.create(owner, leadInput(owner), key());
  const original = await repository.advicePreferences(owner, lead.id);
  expect(original).toMatchObject({
    status: "unset",
    current: null,
    history: [],
    revision: 0,
    scopeRevision: 1,
    profileRevision: 0,
    canConfirm: true,
  });
  expect(
    (
      await database.pool.query<{ language: string }>(
        "select details->>'language' language from partner_leads where id=$1",
        [lead.id],
      )
    ).rows[0]?.language,
  ).toBe("fr");
  const body = input(original);
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
  await database.pool.query(
    "insert into partner_contributors(id,lead_id,user_id,access_scope,can_edit,can_contact) values($1,$2,$3,'progress',false,false)",
    [key(), lead.id, neighbor.userId],
  );
  expect((await repository.detail(neighbor, lead.id)).access).toBe("progress");
  for (const reader of [neighbor, outsider]) {
    await expect(repository.advicePreferences(reader, lead.id)).rejects.toMatchObject({
      code: "PARTNER_NOT_FOUND",
    });
  }
  for (const reader of [advisor, admin]) {
    expect((await repository.advicePreferences(reader, lead.id)).canConfirm).toBe(false);
    await expect(
      repository.confirmAdvicePreferences(reader, lead.id, body, key()),
    ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  }
  const attempt = key();
  const saved = await repository.confirmAdvicePreferences(owner, lead.id, body, attempt);
  expect(saved).toMatchObject({
    status: "confirmed",
    current: { languageCode: "fr", mode: "home", canton: "GE", revision: 1 },
  });
  expect((await repository.advicePreferences(advisor, lead.id)).current).toEqual(saved.current);
  await review(advisor, "closed");
  await expect(repository.advicePreferences(advisor, lead.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  const otherAdmin = await actor(true);
  await database.pool.query(
    "update identity_sessions set mfa_verified_at=now()-interval '25 hours' where id=$1",
    [otherAdmin.id],
  );
  await expect(repository.advicePreferences(otherAdmin, lead.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
    owner.id,
  ]);
  await expect(repository.advicePreferences(owner, lead.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await expect(
    repository.confirmAdvicePreferences(owner, lead.id, body, attempt),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  const unlinked = await repository.create(admin, leadInput(null), key());
  expect(await repository.advicePreferences(admin, unlinked.id)).toMatchObject({
    status: "unlinked",
    canConfirm: false,
    current: null,
    history: [],
    profileRevision: null,
  });
});

it("does not infer preferences from legacy values and preserves Lead, appointment, notification and referent state", async () => {
  const owner = { ...(await actor()), wallet: true },
    advisor = await professional();
  let lead = await repository.create(owner, leadInput(owner), key());
  const other = await repository.create(owner, leadInput(owner), key());
  lead = await repository.command(
    admin,
    lead.id,
    {
      action: "assign",
      revision: lead.revision,
      responsibleId: advisor.userId,
      reason: "Attribution isolée",
    },
    key(),
  );
  lead = await repository.command(
    advisor,
    lead.id,
    { action: "accept", revision: lead.revision },
    key(),
  );
  const referent = await repository.referentProfile(owner, "self", "vehicle");
  await repository.updateReferent(
    owner,
    "self",
    "vehicle",
    {
      revision: referent.current.revision,
      profileRevision: referent.profileRevision,
      advisorId: advisor.userId,
      confirmed: true,
    },
    key(),
  );
  await database.pool.query(
    "insert into partner_appointments(id,lead_id,advisor_id,starts_at,duration_minutes,mode,location,timezone) values($1,$2,$3,now()+interval '2 days',45,'office','Lieu exact isolé','Europe/Zurich')",
    [key(), lead.id, advisor.userId],
  );
  const before = await invariants(lead.id),
    beforeReferent = await repository.referentProfile(owner, "self", "vehicle");
  const dossier = await repository.advicePreferences(owner, lead.id);
  expect(dossier.current).toBeNull();
  const confirmed = await repository.confirmAdvicePreferences(
    owner,
    lead.id,
    input(dossier),
    key(),
  );
  expect(await invariants(lead.id)).toEqual(before);
  expect(await repository.referentProfile(owner, "self", "vehicle")).toEqual(beforeReferent);
  expect((await repository.advicePreferences(owner, other.id)).status).toBe("unset");
  const continuity = (await repository.detail(owner, lead.id)).referentContinuity;
  expect(continuity?.missingChecks).toEqual(
    expect.arrayContaining(["language", "region", "preferences", "availability", "conflicts"]),
  );
  const events = (
    await database.pool.query(
      "select audience,text,subject_id,actor_id from partner_events where lead_id=$1 and kind='client.advice_preferences_confirmed.v1'",
      [lead.id],
    )
  ).rows;
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ audience: "client", text: "", actor_id: owner.userId });
  const cleared = await repository.confirmAdvicePreferences(
    owner,
    lead.id,
    { ...input(confirmed), languageCode: null, mode: null, canton: null },
    key(),
  );
  expect(cleared).toMatchObject({
    status: "confirmed",
    current: { languageCode: null, mode: null, canton: null },
    revision: 2,
  });
  expect(cleared.history[1]).toEqual(confirmed.current);
  expect(await invariants(lead.id)).toEqual(before);
});

it("rejects invalid values in the contract and database without weakening nullable mode constraints", async () => {
  const owner = { ...(await actor()), wallet: true },
    lead = await repository.create(owner, leadInput(owner), key());
  const original = await repository.advicePreferences(owner, lead.id),
    body = input(original);
  for (const invalid of [
    { languageCode: "zz" },
    { languageCode: "Français" },
    { mode: "remote" },
    { canton: "XX" },
    { mode: null },
    { mode: "video" },
    { confirmed: false },
    { profileRevision: null },
    { unrequested: true },
  ]) {
    expect(advicePreferencesInputSchema.safeParse({ ...body, ...invalid }).success).toBe(false);
  }
  for (const revision of [{ revision: 9 }, { scopeRevision: 9 }, { profileRevision: 9 }]) {
    await expect(
      repository.confirmAdvicePreferences(owner, lead.id, { ...body, ...revision }, key()),
    ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  }
  expect((await repository.advicePreferences(owner, lead.id)).history).toEqual([]);
  const saved = await repository.confirmAdvicePreferences(owner, lead.id, body, key());
  for (const [column, value] of [
    ["language_code", "zz"],
    ["mode", null],
    ["mode", "phone"],
    ["canton", "XX"],
    ["scope_revision", 0],
    ["confirmation_version", 2],
    ["subject_id", `self:${admin.userId}`],
  ]) {
    await expect(
      database.pool.query(`update partner_advice_preferences set ${column}=$2 where lead_id=$1`, [
        lead.id,
        value,
      ]),
    ).rejects.toMatchObject({ code: "23514" });
  }
  expect((await repository.advicePreferences(owner, lead.id)).current).toEqual(saved.current);
});

it("serializes confirmation attempts, reprojects exact retries and paginates immutable history", async () => {
  const owner = { ...(await actor()), wallet: true },
    lead = await repository.create(owner, leadInput(owner), key());
  const body = input(await repository.advicePreferences(owner, lead.id)),
    attempt = key();
  const same = await Promise.all([
    repository.confirmAdvicePreferences(owner, lead.id, body, attempt),
    repository.confirmAdvicePreferences(owner, lead.id, body, attempt),
  ]);
  expect(same[0]).toEqual(same[1]);
  expect(same[0].history).toHaveLength(1);
  await expect(
    repository.confirmAdvicePreferences(owner, lead.id, { ...body, languageCode: "de" }, attempt),
  ).rejects.toMatchObject({ code: "PARTNER_IDEMPOTENCY_REUSED" });
  const competing = await Promise.allSettled(
    (["de", "it"] as const).map((languageCode) =>
      repository.confirmAdvicePreferences(
        owner,
        lead.id,
        { ...input(same[0]), languageCode },
        key(),
      ),
    ),
  );
  expect(competing.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(competing.filter((r) => r.status === "rejected")[0]).toMatchObject({
    reason: { code: "PARTNER_CONFLICT" },
  });
  for (let i = 0; i < 21; i++)
    await repository.confirmAdvicePreferences(
      owner,
      lead.id,
      input(await repository.advicePreferences(owner, lead.id)),
      key(),
    );
  const latest = await repository.advicePreferences(owner, lead.id),
    older = await repository.advicePreferences(owner, lead.id, latest.nextBeforeRevision!);
  expect(latest.history).toHaveLength(20);
  expect(older.history).toHaveLength(3);
  expect(older.current).toEqual(latest.current);
  expect(older.nextBeforeRevision).toBeNull();
  expect(new Set([...latest.history, ...older.history].map((r) => r.revision)).size).toBe(23);
  expect(await repository.confirmAdvicePreferences(owner, lead.id, body, attempt)).toEqual(latest);
  await database.pool.query("update partner_leads set title='Besoin changé' where id=$1", [
    lead.id,
  ]);
  expect((await repository.confirmAdvicePreferences(owner, lead.id, body, attempt)).status).toBe(
    "confirmation_required",
  );
  await repository.command(
    admin,
    lead.id,
    {
      action: "close",
      revision: (await repository.detail(admin, lead.id)).revision,
      result: "resolved_without_contract",
      reason: "current_suitable",
      comment: "Contrat maintenu dans le test isolé",
    },
    key(),
  );
  expect((await repository.advicePreferences(owner, lead.id)).canConfirm).toBe(false);
  await expect(
    repository.confirmAdvicePreferences(owner, lead.id, body, attempt),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
});

it("invalidates changed and restored need scopes through old writers while unrelated edits preserve confirmation", async () => {
  const owner = { ...(await actor()), wallet: true },
    source = leadInput(owner),
    lead = await repository.create(owner, source, key());
  const confirmed = await repository.confirmAdvicePreferences(
    owner,
    lead.id,
    input(await repository.advicePreferences(owner, lead.id)),
    key(),
  );
  await edit(lead.id, {
    ...source,
    email: "changed@advice.test",
    language: "de",
    phone: "123",
    nextAction: "Nouvelle action",
  });
  let current = await repository.advicePreferences(owner, lead.id);
  expect(current.status).toBe("confirmed");
  expect(current.scopeRevision).toBe(confirmed.scopeRevision);
  await repository.command(
    admin,
    lead.id,
    {
      action: "note",
      revision: (await repository.detail(admin, lead.id)).revision,
      text: "Note isolée",
      audience: "assigned",
    },
    key(),
  );
  expect((await repository.advicePreferences(owner, lead.id)).status).toBe("confirmed");
  await database.pool.query("update partner_leads set advice_scope_revision=999 where id=$1", [
    lead.id,
  ]);
  expect((await repository.advicePreferences(owner, lead.id)).scopeRevision).toBe(
    confirmed.scopeRevision,
  );
  for (const [column, value, original] of [
    ["title", "Titre changé", source.title],
    ["category", "health", source.category],
    ["object", "Objet changé", source.object],
  ] as const) {
    await database.pool.query(`update partner_leads set ${column}=$2 where id=$1`, [
      lead.id,
      value,
    ]);
    await database.pool.query(`update partner_leads set ${column}=$2 where id=$1`, [
      lead.id,
      original,
    ]);
  }
  await database.pool.query(
    "update partner_leads set details=jsonb_set(details,'{context}','\"Contexte changé\"') where id=$1",
    [lead.id],
  );
  await database.pool.query(
    "update partner_leads set details=jsonb_set(details,'{context}',$2::jsonb) where id=$1",
    [lead.id, JSON.stringify(source.context)],
  );
  current = await repository.advicePreferences(owner, lead.id);
  expect(current.scope).toEqual(confirmed.scope);
  expect(current.scopeRevision).toBe(confirmed.scopeRevision + 8);
  expect(current.status).toBe("confirmation_required");
  await expect(
    repository.confirmAdvicePreferences(owner, lead.id, input(confirmed), key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  expect(
    (await repository.confirmAdvicePreferences(owner, lead.id, input(current), key())).status,
  ).toBe("confirmed");
});

it("uses the canonical owner and profile revision across real transfers and keeps relinked subjects isolated", async () => {
  const owner = { ...(await actor()), wallet: true },
    destination = { ...(await actor()), wallet: true };
  const profiles = createManagedProfileRepository(database.db),
    transfers = createAdminProfileTransferRepository(database.db);
  const profile = await profiles.create(
    owner,
    { kind: "person", displayName: "Personne gérée isolée" },
    key(),
  );
  const source = leadInput(owner, profile.id),
    lead = await repository.create(owner, source, key());
  const body = input(await repository.advicePreferences(owner, lead.id)),
    attempt = key();
  const saved = await repository.confirmAdvicePreferences(owner, lead.id, body, attempt);
  await transfers.transfer(
    { id: admin.id, userId: owner.userId, administratorUserId: admin.userId },
    profile.id,
    { destinationUserId: destination.userId, revision: profile.revision },
    key(),
  );
  await expect(repository.advicePreferences(owner, lead.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  await expect(
    repository.confirmAdvicePreferences(owner, lead.id, body, attempt),
  ).rejects.toMatchObject({ code: "PARTNER_NOT_FOUND" });
  let current = await repository.advicePreferences(destination, lead.id);
  expect(current).toMatchObject({
    status: "confirmation_required",
    profileRevision: 1,
    scopeRevision: saved.scopeRevision,
    current: { currentOwnerConfirmation: false },
  });
  await expect(
    repository.confirmAdvicePreferences(destination, lead.id, body, key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  await transfers.transfer(
    { id: admin.id, userId: destination.userId, administratorUserId: admin.userId },
    profile.id,
    { destinationUserId: owner.userId, revision: current.profileRevision! },
    key(),
  );
  current = await repository.advicePreferences(owner, lead.id);
  expect(current).toMatchObject({
    status: "confirmation_required",
    profileRevision: 2,
    current: { currentOwnerConfirmation: false },
  });
  expect((await repository.confirmAdvicePreferences(owner, lead.id, body, attempt)).status).toBe(
    "confirmation_required",
  );
  const renewed = await repository.confirmAdvicePreferences(owner, lead.id, input(current), key());
  expect(renewed.status).toBe("confirmed");
  await edit(lead.id, {
    ...source,
    clientUserId: destination.userId,
    clientProfileId: null,
    title: "Besoin d’une autre personne",
  });
  await expect(repository.advicePreferences(owner, lead.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  for (const reader of [destination, admin]) {
    expect(await repository.advicePreferences(reader, lead.id)).toMatchObject({
      status: "unset",
      current: null,
      history: [],
      revision: 2,
    });
    expect(
      (await repository.detail(reader, lead.id)).events.filter(
        (event) => event.kind === "client.advice_preferences_confirmed.v1",
      ),
    ).toEqual([]);
  }
  const other = await repository.confirmAdvicePreferences(
    destination,
    lead.id,
    { ...input(await repository.advicePreferences(destination, lead.id)), languageCode: "it" },
    key(),
  );
  expect(other.history).toHaveLength(1);
  await edit(lead.id, source);
  current = await repository.advicePreferences(owner, lead.id);
  expect(current.current).toBeNull();
  expect(current.history.map((r) => r.revision)).toEqual([2, 1]);
  expect(current.history.some((r) => r.languageCode === "it")).toBe(false);
  expect(
    (await repository.detail(owner, lead.id)).events.filter(
      (event) => event.kind === "client.advice_preferences_confirmed.v1",
    ),
  ).toHaveLength(2);
  await expect(
    repository.confirmAdvicePreferences(owner, lead.id, input(renewed), key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  expect(
    (await repository.confirmAdvicePreferences(owner, lead.id, input(current), key())).status,
  ).toBe("confirmed");
  expect(
    (await profiles.list(owner.userId)).profiles.filter((p) => p.id !== "self").map((p) => p.id),
  ).toEqual([profile.id]);
});

async function edit(id: string, lead: LeadCreateInput) {
  return repository.command(
    admin,
    id,
    { action: "edit", revision: (await repository.detail(admin, id)).revision, lead },
    key(),
  );
}
async function invariants(id: string) {
  const lead = (await database.pool.query("select * from partner_leads where id=$1", [id])).rows;
  const tables = await Promise.all(
    ["partner_notifications", "partner_appointments", "partner_tasks"].map(
      async (table) =>
        (
          await database.pool.query<Record<string, unknown>>(
            `select * from ${table} where lead_id=$1 order by id`,
            [id],
          )
        ).rows,
    ),
  );
  return { lead, tables };
}
async function actor(administrator = false): Promise<PartnerActor> {
  const person = { userId: `user_${key()}`, id: `session_${key()}`, administrator };
  await database.pool.query(
    "insert into identity_users(id,workos_user_id,email) values($1,$2,$3)",
    [person.userId, key(), `${key()}@advice.test`],
  );
  await database.pool.query("insert into identity_profiles(id,user_id) values($1,$2)", [
    key(),
    person.userId,
  ]);
  await database.pool.query(
    "insert into identity_sessions(id,user_id,workos_session_id,token_hash,device,expires_at,mfa_verified_at) values($1,$2,$3,$4,'Isolated advice test',now()+interval '1 hour',now()-interval '1 second')",
    [person.id, person.userId, key(), createHash("sha256").update(key()).digest("hex")],
  );
  if (administrator)
    await database.pool.query(
      "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated Testcontainers permission')",
      [key(), person.userId],
    );
  return person;
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
      qualifications: "Test isolé",
    }),
    key(),
  );
  await review(person, "approved");
  return person;
}
async function review(person: PartnerActor, state: "approved" | "closed") {
  return repository.review(
    admin,
    person.userId,
    {
      revision: (await repository.context(person)).application!.revision,
      state,
      roles: state === "approved" ? ["advisor"] : [],
      reason: "Décision synthétique",
      reviewDueAt: null,
      organizationState: "approved",
    },
    key(),
  );
}
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_advice_test")
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
