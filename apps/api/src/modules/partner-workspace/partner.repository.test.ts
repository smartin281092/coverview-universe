import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createDatabase } from "../../platform/db/database.js";
import {
  leadCreateInputSchema,
  leadListQuerySchema,
  type LeadCommand,
  type LeadDetail,
} from "@coverview/contracts/partner";
import { createPartnerRepository } from "./partner.repository.js";
import type { PartnerActor } from "./partner.policy.js";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let repository: ReturnType<typeof createPartnerRepository>;
let administrator: PartnerActor,
  advisor: PartnerActor,
  neighbor: PartnerActor,
  referrer: PartnerActor,
  client: PartnerActor;
const key = () => randomUUID();
const due = () => new Date(Date.now() + 2 * 86400000).toISOString();
const input = () =>
  leadCreateInputSchema.parse({
    title: "Demande véhicule",
    category: "vehicle",
    object: "Véhicule A",
    context: "Besoin déclaré",
    clientUserId: client.userId,
    clientProfileId: null,
    clientName: "Client isolé",
    email: "client@partner.test",
    phone: "",
    language: "fr",
    source: "Recette PostgreSQL isolée",
    transmissionAuthorized: true,
    priority: "normal",
    draft: false,
    nextAction: "Appeler",
    dueAt: due(),
  });
const list = leadListQuerySchema.parse({ view: "all" });
const command = (actor: PartnerActor, lead: LeadDetail, change: Omit<LeadCommand, "revision">) =>
  repository.command(actor, lead.id, { ...change, revision: lead.revision } as LeadCommand, key());

async function actor(admin = false): Promise<PartnerActor> {
  const token = key();
  const session = { userId: `user_${key()}`, id: `session_${key()}` };
  await database.pool.query(
    "insert into identity_users(id,workos_user_id,email) values($1,$2,$3)",
    [session.userId, key(), `${key()}@partner.test`],
  );
  await database.pool.query("insert into identity_profiles(id,user_id) values($1,$2)", [
    key(),
    session.userId,
  ]);
  await database.pool.query(
    "insert into identity_sessions(id,user_id,workos_session_id,token_hash,device,expires_at) values($1,$2,$3,$4,'Isolated test',now()+interval '1 hour')",
    [session.id, session.userId, key(), createHash("sha256").update(token).digest("hex")],
  );
  if (admin) {
    await database.pool.query(
      "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated Testcontainers permission')",
      [key(), session.userId],
    );
    await database.pool.query("update identity_sessions set mfa_verified_at=now() where id=$1", [
      session.id,
    ]);
  }
  return { userId: session.userId, id: session.id, administrator: admin };
}
async function approve(
  person: PartnerActor,
  roles: ("advisor" | "referrer" | "manager")[] = ["advisor"],
) {
  await repository.apply(
    person,
    {
      name: "Intervenant isolé",
      organization: "Organisation isolée",
      phone: "",
      roles,
      categories: ["vehicle"],
      languages: "fr",
      regions: "Genève",
      qualifications: "Vérification isolée",
    },
    key(),
  );
  const pending = (await repository.context(person)).application!;
  return repository.review(
    administrator,
    person.userId,
    {
      revision: pending.revision,
      state: "approved",
      organizationState: "approved",
      roles,
      reason: "Validation de recette isolée",
      reviewDueAt: null,
    },
    key(),
  );
}
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_partner_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  const migrationsFolder = fileURLToPath(new URL("../../../drizzle/", import.meta.url));
  await migrate(database.db, { migrationsFolder });
  await migrate(database.db, { migrationsFolder });
  repository = createPartnerRepository(database.pool);
  administrator = await actor(true);
  advisor = await actor();
  neighbor = await actor();
  referrer = await actor();
  client = { ...(await actor()), wallet: true };
  await approve(advisor);
  await approve(neighbor);
  await approve(referrer, ["referrer"]);
  const org = (await repository.context(advisor)).application!.organizationId;
  await database.pool.query("update partner_members set organization_id=$2 where user_id=$1", [
    neighbor.userId,
    org,
  ]);
});
afterAll(async () => {
  if (database) await database.pool.end();
  if (container) await container.stop();
});

it("isolates unapproved users, colleagues, referrers and Wallet; preserves independent Leads and idempotency", async () => {
  const unapproved = await actor();
  await expect(repository.list(unapproved, list)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  const createInput = input(),
    idempotencyKey = key();
  const [first, replayed] = await Promise.all([
    repository.create(administrator, createInput, idempotencyKey),
    repository.create(administrator, createInput, idempotencyKey),
  ]);
  expect(replayed.id).toBe(first.id);
  await expect(
    repository.create(administrator, { ...createInput, title: "Autre demande" }, idempotencyKey),
  ).rejects.toMatchObject({ code: "PARTNER_IDEMPOTENCY_REUSED" });
  const second = await repository.create(
    administrator,
    { ...createInput, object: "Véhicule B" },
    key(),
  );
  expect(first.id).not.toBe(second.id);
  const assigned = await repository.command(
    administrator,
    first.id,
    {
      action: "assign",
      revision: first.revision,
      responsibleId: advisor.userId,
      reason: "Adéquation au besoin",
    },
    key(),
  );
  await expect(repository.detail(neighbor, assigned.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  const own = await repository.detail(advisor, assigned.id);
  const note = await repository.command(
    advisor,
    own.id,
    { action: "note", revision: own.revision, text: "Note privée", audience: "private" },
    key(),
  );
  expect(
    (await repository.detail(administrator, note.id)).events.some((e) => e.text === "Note privée"),
  ).toBe(false);
  const wallet = await repository.detail(client, note.id);
  expect(wallet.events.some((e) => e.text === "Note privée")).toBe(false);
  expect(wallet.email).toBeNull();
  expect(wallet.tasks).toEqual([]);
  expect(
    (await repository.list(client, { ...list, clientProfileId: "self" })).items.map((l) => l.id),
  ).toEqual(expect.arrayContaining([first.id, second.id]));
  const referred = await repository.create(referrer, { ...input(), clientUserId: null }, key());
  expect(referred.access).toBe("progress");
  expect(referred.offers).toEqual([]);
  expect(referred.email).toBeNull();
  const draft = await repository.create(
    advisor,
    { ...input(), clientUserId: null, draft: true },
    key(),
  );
  expect(draft.notifiedAt).toBeNull();
  const outside = await repository.create(
    neighbor,
    { ...input(), clientUserId: null, category: "pension" },
    key(),
  );
  expect(outside.responsibleId).toBeNull();
  const ownDraft = await repository.create(
    referrer,
    { ...input(), clientUserId: null, draft: true },
    key(),
  );
  expect(ownDraft.availableTabs).toEqual(["overview"]);
  await expect(
    repository.command(
      referrer,
      ownDraft.id,
      {
        action: "contact",
        revision: ownDraft.revision,
        outcome: "reached",
        note: "Appel",
        nextAction: "Suite",
        dueAt: due(),
      },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  await expect(repository.list(advisor, { ...list, cursor: "bad" })).rejects.toMatchObject({
    statusCode: 400,
  });
});

it("serializes transitions and appointments, keeps the first-action clock, and records a positive resolution without a sale", async () => {
  let lead = await repository.create(administrator, input(), key());
  lead = await repository.command(
    administrator,
    lead.id,
    { action: "assign", revision: lead.revision, responsibleId: advisor.userId, reason: "Mission" },
    key(),
  );
  const notified = lead.notifiedAt;
  lead = await command(advisor, lead, { action: "accept" });
  expect(lead.notifiedAt).toBe(notified);
  expect(lead.firstUsefulAt).toBeNull();
  const edits = await Promise.allSettled([
    repository.command(
      advisor,
      lead.id,
      { action: "note", revision: lead.revision, text: "Un", audience: "assigned" },
      key(),
    ),
    repository.command(
      advisor,
      lead.id,
      { action: "note", revision: lead.revision, text: "Deux", audience: "assigned" },
      key(),
    ),
  ]);
  expect(edits.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  lead = await repository.detail(advisor, lead.id);
  await expect(
    repository.command(
      advisor,
      lead.id,
      { action: "transition", stage: "signed", revision: lead.revision },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  const startsAt = due();
  lead = await repository.command(
    advisor,
    lead.id,
    {
      action: "appointment",
      revision: lead.revision,
      appointment: {
        advisorId: advisor.userId,
        startsAt,
        durationMinutes: 60,
        mode: "phone",
        location: "Numéro convenu",
        timezone: "Europe/Zurich",
      },
    },
    key(),
  );
  expect(lead.appointments).toHaveLength(1);
  expect(lead.firstUsefulAt).not.toBeNull();
  expect(lead.notifiedAt).toBe(notified);
  await expect(
    repository.command(
      advisor,
      lead.id,
      {
        action: "appointment",
        revision: lead.revision,
        appointment: {
          advisorId: advisor.userId,
          startsAt,
          durationMinutes: 30,
          mode: "phone",
          location: "Numéro convenu",
          timezone: "Europe/Zurich",
        },
      },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_APPOINTMENT_CONFLICT" });
  lead = await repository.command(
    advisor,
    lead.id,
    {
      action: "close",
      revision: lead.revision,
      result: "lost",
      reason: "current_suitable",
      comment: "Contrat actuel adapté",
    },
    key(),
  );
  expect(lead.result).toBe("resolved_without_contract");
  expect(lead.stage).toBe("completed");
  expect(lead.appointments[0]?.state).toBe("cancelled");
});

it("publishes only reviewed sources, invalidates replaced offers and removes operational rights after role withdrawal", async () => {
  let lead = await repository.create(administrator, input(), key());
  const documentId = `doc_${key()}`;
  await database.pool.query(
    "insert into files(id,user_id,name,mime,declared_mime,size,checksum,object_key,state,category,purpose,scan_version) values($1,$2,'Source isolée.pdf','application/pdf','application/pdf',10,$3,$4,'ready','insurance','lead_offer','isolated-scan')",
    [documentId, administrator.userId, "a".repeat(64), key()],
  );
  const offer = {
    documentId,
    company: "Compagnie isolée",
    product: "Véhicule",
    reference: "Recette",
    annualPremiumMinor: 123450,
    currency: "CHF" as const,
    validUntil: due(),
    effectiveDate: null,
    features: [],
    summary: "Données isolées pour contrôle des droits",
    limitations: "Aucune offre réelle",
    replacesId: null,
  };
  lead = await repository.command(
    administrator,
    lead.id,
    { action: "offer", revision: lead.revision, offer },
    key(),
  );
  const offerId = lead.offers[0]!.id;
  expect((await repository.detail(client, lead.id)).offers).toEqual([]);
  await expect(
    repository.command(
      administrator,
      lead.id,
      { action: "offer_publish", revision: lead.revision, offerId },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_OFFER_NOT_READY" });
  lead = await repository.command(
    administrator,
    lead.id,
    { action: "offer_review", revision: lead.revision, offerId },
    key(),
  );
  lead = await repository.command(
    administrator,
    lead.id,
    { action: "offer_publish", revision: lead.revision, offerId },
    key(),
  );
  expect((await repository.detail(client, lead.id)).offers).toHaveLength(1);
  await repository.sourceConsulted(client, lead.id, offerId);
  await repository.sourceConsulted(client, lead.id, offerId);
  expect(
    (await repository.detail(administrator, lead.id)).events.filter(
      (value) => value.kind === "document.viewed",
    ),
  ).toHaveLength(1);
  await expect(repository.sourceConsulted(neighbor, lead.id, offerId)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  lead = await repository.command(
    client,
    lead.id,
    { action: "client_choice", revision: lead.revision, choice: "select", offerId, text: "" },
    key(),
  );
  expect(lead.stage).toBe("client_decision");
  lead = await repository.command(
    administrator,
    lead.id,
    {
      action: "offer",
      revision: lead.revision,
      offer: { ...offer, replacesId: offerId, annualPremiumMinor: 123000 },
    },
    key(),
  );
  await expect(
    repository.command(
      client,
      lead.id,
      { action: "client_choice", revision: lead.revision, choice: "select", offerId, text: "" },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_TRANSITION" });
  expect((await repository.detail(client, lead.id)).offers[0]?.active).toBe(false);
  expect(lead.offers.map((o) => o.version).sort()).toEqual([1, 2]);
  const retained = await database.pool.query<{ retained_at: Date }>(
    "select retained_at from files where id=$1",
    [documentId],
  );
  expect(retained.rows[0]?.retained_at).toBeInstanceOf(Date);
  lead = await repository.command(
    administrator,
    lead.id,
    {
      action: "assign",
      revision: lead.revision,
      responsibleId: advisor.userId,
      reason: "Reprise du suivi",
    },
    key(),
  );
  const current = lead.offers.find((value) => value.active)!;
  lead = await repository.command(
    advisor,
    lead.id,
    { action: "offer", revision: lead.revision, offer: { ...offer, replacesId: current.id } },
    key(),
  );
  expect(lead.offers).toHaveLength(3);
  lead = await repository.command(
    advisor,
    lead.id,
    {
      action: "appointment",
      revision: lead.revision,
      appointment: {
        advisorId: advisor.userId,
        startsAt: due(),
        durationMinutes: 30,
        mode: "phone",
        location: "Numéro convenu",
        timezone: "Europe/Zurich",
      },
    },
    key(),
  );
  lead = await repository.command(
    advisor,
    lead.id,
    {
      action: "task",
      revision: lead.revision,
      task: {
        title: "Préparer le rendez-vous",
        description: "",
        responsibleId: advisor.userId,
        dueAt: due(),
        reminderAt: null,
        priority: "normal",
      },
    },
    key(),
  );
  const application = (await repository.context(advisor)).application!;
  await repository.review(
    administrator,
    advisor.userId,
    {
      revision: application.revision,
      state: "approved",
      roles: ["referrer"],
      reason: "Retrait de l’activité de conseil",
      reviewDueAt: null,
    },
    key(),
  );
  await expect(repository.detail(advisor, lead.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  const updated = await repository.detail(administrator, lead.id);
  expect(updated.responsibleId).toBeNull();
  expect(updated.offers).toHaveLength(3);
  expect(updated.assignment).toBe("reassign");
  expect(updated.appointments[0]?.state).toBe("cancelled");
  expect(updated.stage).toBe("appointment_needed");
  const resumed = await repository.command(
    administrator,
    updated.id,
    {
      action: "assign",
      revision: updated.revision,
      responsibleId: neighbor.userId,
      reason: "Nouvelle prise en charge",
    },
    key(),
  );
  expect(resumed.tasks[0]?.responsibleId).toBe(neighbor.userId);
});
