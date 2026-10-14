import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, expect, it } from "vitest";
import { leadListQuerySchema, partnerNotificationQuerySchema } from "@coverview/contracts/partner";
import { createDatabase } from "./db/database.js";
import { parseEnvironment } from "./config.js";
import { buildServer } from "./server.js";
import type { MailMessage } from "./mailer.js";
import { createPartnerRepository } from "../modules/partner-workspace/partner.repository.js";
import type { PartnerActor } from "../modules/partner-workspace/partner.policy.js";
import { processPartnerContinuity } from "../modules/partner-workspace/partner.continuity.js";
import { processExternalRequests } from "../modules/partner-workspace/partner.intake.js";

// Orders from horizon3.finance (S-042a, 14 October 2026), through the real HTTP layer and database.
let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let repository: ReturnType<typeof createPartnerRepository>;
const url = "/api/public/h3/contact";
const origin = "https://horizon3.finance";
const order = (change: Record<string, unknown> = {}) => ({
  source: "horizon3",
  requestId: randomUUID(),
  firstName: "Jean",
  lastName: "Dupont",
  email: "jean@example.test",
  phone: "+41 79 123 45 67",
  birthYear: 1992,
  investment: 300,
  frequency: "monthly",
  initialCapital: 10000,
  productId: 0,
  productName: "Hyperion",
  strategyId: "prosperity",
  company: "Liechtenstein Life",
  ...change,
});

async function server(ownerEmail: string) {
  const example = parseEnv(
    readFileSync(new URL("../../../../.env.example", import.meta.url), "utf8"),
  );
  const config = parseEnvironment({
    ...example,
    DATABASE_URL: container.getConnectionUri(),
    AUTH_ENABLED: "false",
    DOCUMENTS_ENABLED: "false",
    LOG_LEVEL: "silent",
    H3_OWNER_EMAIL: ownerEmail,
  });
  const app = await buildServer(config, {
    checkReadiness: () => Promise.resolve(true),
    readPersonas: () => Promise.resolve([]),
    close: () => Promise.resolve(),
  });
  return { app, config };
}
async function account(email = `${randomUUID()}@intake.test`, admin = false) {
  const userId = `user_${randomUUID()}`,
    id = `session_${randomUUID()}`;
  await database.pool.query(
    "insert into identity_users(id,workos_user_id,email) values($1,$2,$3)",
    [userId, randomUUID(), email],
  );
  await database.pool.query("insert into identity_profiles(id,user_id) values($1,$2)", [
    randomUUID(),
    userId,
  ]);
  await database.pool.query(
    "insert into identity_sessions(id,user_id,workos_session_id,token_hash,device,expires_at,mfa_verified_at) values($1,$2,$3,$4,'Isolated test',now()+interval '1 hour',$5)",
    [
      id,
      userId,
      randomUUID(),
      createHash("sha256").update(randomUUID()).digest("hex"),
      admin ? new Date() : null,
    ],
  );
  if (admin)
    await database.pool.query(
      "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated Testcontainers permission')",
      [randomUUID(), userId],
    );
  return { userId, id, administrator: admin } satisfies PartnerActor;
}
async function advisor(reviewer: PartnerActor) {
  const person = await account();
  await repository.apply(
    person,
    {
      name: "Conseiller isolé",
      organization: "Organisation isolée",
      phone: "",
      roles: ["advisor"],
      categories: ["pension"],
      languages: "fr",
      regions: "Vaud",
      qualifications: "Vérification isolée",
    },
    randomUUID(),
  );
  const pending = (await repository.context(person)).application!;
  await repository.review(
    reviewer,
    person.userId,
    {
      revision: pending.revision,
      state: "approved",
      organizationState: "approved",
      roles: ["advisor"],
      reason: "Validation de recette isolée",
      reviewDueAt: null,
    },
    randomUUID(),
  );
  return person;
}
const stored = async (requestId: string) =>
  (
    await database.pool.query<{
      id: string;
      lead_id: string | null;
      data: unknown;
      notification: string;
      attempts: number;
    }>("select * from partner_external_requests where request_id=$1", [requestId])
  ).rows;
const all = leadListQuerySchema.parse({ view: "all" });
type Refusal = { error: { code: string } };

it("stores an order once, answers a retry alike and refuses another content or a bad payload", async () => {
  const { app } = await server(`${randomUUID()}@intake.test`);
  try {
    // Preflight: the four agreed origins only, POST and Content-Type, never credentials.
    const preflight = await app.inject({
      method: "OPTIONS",
      url,
      headers: {
        origin,
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });
    expect(preflight.statusCode).toBe(204);
    expect(preflight.headers["access-control-allow-origin"]).toBe(origin);
    expect(preflight.headers["access-control-allow-methods"]).toBe("POST, OPTIONS");
    expect(preflight.headers["access-control-allow-headers"]).toBe("Content-Type");
    expect(preflight.headers["access-control-allow-credentials"]).toBeUndefined();
    for (const allowed of [
      "https://www.horizon3.finance",
      "http://127.0.0.1:5187",
      "http://localhost:5187",
    ])
      expect(
        (
          await app.inject({
            method: "OPTIONS",
            url,
            headers: { origin: allowed, "access-control-request-method": "POST" },
          })
        ).headers["access-control-allow-origin"],
      ).toBe(allowed);
    const foreign = await app.inject({
      method: "OPTIONS",
      url,
      headers: { origin: "https://foreign.test", "access-control-request-method": "POST" },
    });
    expect(foreign.headers["access-control-allow-origin"]).toBeUndefined();
    // The other routes keep their own origins: horizon3 reaches nothing else.
    const elsewhere = await app.inject({
      method: "OPTIONS",
      url: "/partner/leads",
      headers: { origin, "access-control-request-method": "POST" },
    });
    expect(elsewhere.headers["access-control-allow-origin"]).toBeUndefined();

    const body = order();
    const first = await app.inject({
      method: "POST",
      url,
      headers: { origin },
      payload: { ...body, unexpected: "ignored" },
    });
    expect(first.statusCode, first.body).toBe(200);
    expect(first.json()).toEqual({ success: true, requestId: body.requestId });
    expect(first.headers["access-control-allow-origin"]).toBe(origin);
    expect(first.headers["access-control-allow-credentials"]).toBeUndefined();
    const retry = await app.inject({ method: "POST", url, headers: { origin }, payload: body });
    expect(retry.statusCode).toBe(200);
    expect(retry.json()).toEqual({ success: true, requestId: body.requestId });
    const rows = await stored(body.requestId);
    expect(rows).toHaveLength(1);
    // Centimes (DATA-11); the unknown field is not kept; no account yet, so no Lead.
    expect(rows[0]).toMatchObject({
      lead_id: null,
      notification: "queued",
      attempts: 0,
      data: {
        firstName: "Jean",
        lastName: "Dupont",
        email: "jean@example.test",
        phone: "+41 79 123 45 67",
        birthYear: 1992,
        investmentMinor: 30000,
        frequency: "monthly",
        initialCapitalMinor: 1000000,
        productId: 0,
        productName: "Hyperion",
        strategyId: "prosperity",
        company: "Liechtenstein Life",
      },
    });
    expect(rows[0]!.data).not.toHaveProperty("unexpected");
    const reused = await app.inject({
      method: "POST",
      url,
      headers: { origin },
      payload: { ...body, phone: "+41 79 000 00 00" },
    });
    expect(reused.statusCode).toBe(422);
    expect(reused.json<Refusal>().error.code).toBe("PARTNER_IDEMPOTENCY_REUSED");
    expect(await stored(body.requestId)).toHaveLength(1);

    const large = await app.inject({
      method: "POST",
      url,
      headers: { origin },
      payload: order({ company: "x".repeat(5000) }),
    });
    expect(large.statusCode).toBe(413);
    const text = await app.inject({
      method: "POST",
      url,
      headers: { origin, "content-type": "text/plain" },
      payload: JSON.stringify(order()),
    });
    // A text body is read as a string, which the order schema refuses: nothing reaches the database.
    expect(text.statusCode).toBe(400);

    // MAIL-03 preview, fictitious values, local adapter only.
    const preview = await app.inject({ url: "/local/emails/horizon3-request?format=text" });
    expect(preview.statusCode).toBe(200);
    expect(preview.body).toContain("horizon3-request-v1");
  } finally {
    await app.close();
  }
});

it("refuses an invalid order without storing anything", async () => {
  const { app } = await server(`${randomUUID()}@intake.test`);
  try {
    const withoutPhone: Record<string, unknown> = order();
    delete withoutPhone.phone;
    const refusals = [
      order({ source: "other" }),
      order({ requestId: "commande-1" }),
      order({ email: "jean" }),
      order({ investment: 10.005 }),
      order({ investment: -1 }),
      order({ birthYear: new Date().getUTCFullYear() + 1 }),
      order({ frequency: "Monthly!" }),
      order({ productName: "" }),
      withoutPhone,
    ];
    for (const bad of refusals) {
      const refused = await app.inject({ method: "POST", url, headers: { origin }, payload: bad });
      expect(refused.statusCode, JSON.stringify(bad)).toBe(400);
      expect(refused.json<Refusal>().error.code).toBe("PLATFORM_INVALID_REQUEST");
      expect(await stored(String(bad.requestId))).toHaveLength(0);
    }
  } finally {
    await app.close();
  }
});

it("limits each address to ten orders a minute, invalid ones included", async () => {
  const { app } = await server(`${randomUUID()}@intake.test`);
  try {
    for (let i = 0; i < 10; i += 1)
      expect(
        (await app.inject({ method: "POST", url, headers: { origin }, payload: order() }))
          .statusCode,
      ).toBe(200);
    const limited = await app.inject({
      method: "POST",
      url,
      headers: { origin },
      payload: order(),
    });
    expect(limited.statusCode).toBe(429);
  } finally {
    await app.close();
  }
});

it("opens the Lead for its one account: hidden from other administrators and professionals, never handed on", async () => {
  const ownerEmail = `${randomUUID()}@intake.test`;
  const owner = await account(ownerEmail.toUpperCase(), true),
    other = await account(undefined, true),
    professional = await advisor(other);
  const { app } = await server(ownerEmail);
  let leadId: string;
  try {
    const body = order();
    expect(
      (await app.inject({ method: "POST", url, headers: { origin }, payload: body })).statusCode,
    ).toBe(200);
    leadId = (await stored(body.requestId))[0]!.lead_id!;
    expect(leadId).toMatch(/^lead_/u);
  } finally {
    await app.close();
  }
  const lead = await repository.detail(owner, leadId);
  expect(lead).toMatchObject({
    title: "3e pilier · Jean Dupont",
    category: "pension",
    object: "Hyperion · Liechtenstein Life",
    clientName: "Jean Dupont",
    stage: "to_contact",
    assignment: "accepted",
    responsibleId: owner.userId,
    priority: "high",
    canAssign: false,
    canCollaborate: false,
    escalationDueAt: null,
  });
  expect(lead.context).toContain("Versement : 300 CHF par mois. Capital initial : 10'000 CHF.");
  expect(lead.events.map((e) => [e.kind, e.systemActor])).toContainEqual([
    "lead.external_request_received",
    "partner-intake-v1",
  ]);
  expect((await repository.list(owner, all)).items.map((item) => item.id)).toContain(leadId);
  for (const denied of [other, professional]) {
    await expect(repository.detail(denied, leadId)).rejects.toMatchObject({
      code: "PARTNER_NOT_FOUND",
    });
    expect((await repository.list(denied, all)).items.map((item) => item.id)).not.toContain(leadId);
  }
  await expect(
    repository.command(
      owner,
      leadId,
      {
        action: "assign",
        responsibleId: professional.userId,
        reason: "Essai de transmission",
        revision: lead.revision,
      },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  // The database refuses it too, whatever the path.
  await expect(
    database.pool.query("update partner_leads set responsible_id=$2 where id=$1", [
      leadId,
      professional.userId,
    ]),
  ).rejects.toMatchObject({ code: "23514" });

  // Long overdue: an ordinary Lead leaves its responsible (proposed or queued), the restricted one stays.
  const control = `lead_${randomUUID()}`;
  await database.pool.query(
    `insert into partner_leads(id,creator_id,responsible_id,title,category,object,client_name,details,stage,assignment,priority,next_action,due_at)
     select $2,creator_id,responsible_id,title,category,object,client_name,details,stage,assignment,priority,next_action,due_at from partner_leads where id=$1`,
    [leadId, control],
  );
  // Its first pass notifies the control as it would any new Lead; the deadlines then lapse.
  await processPartnerContinuity(database.pool);
  await database.pool.query(
    "update partner_leads set notified_at=now()-interval '20 days',acceptance_due_at=now()-interval '19 days',first_action_due_at=now()-interval '19 days',due_at=now()-interval '18 days',continuity_checked_at=null where id=any($1::text[])",
    [[leadId, control]],
  );
  for (let i = 0; i < 5; i += 1) await processPartnerContinuity(database.pool);
  const after = (
    await database.pool.query<{
      id: string;
      responsible_id: string | null;
      assignment: string;
      restricted_to: string | null;
    }>(
      "select id,responsible_id,assignment,restricted_to from partner_leads where id=any($1::text[])",
      [[leadId, control]],
    )
  ).rows;
  const escalated = after.find((row) => row.id === control)!;
  expect(escalated.responsible_id).not.toBe(owner.userId);
  expect(["coverview", "proposed"]).toContain(escalated.assignment);
  expect(after.find((row) => row.id === leadId)).toMatchObject({
    responsible_id: owner.userId,
    assignment: "accepted",
    restricted_to: owner.userId,
  });
  // Its reminders reach its account only: no CoverView queue, nothing listed to another administrator.
  const audiences = (
    await database.pool.query<{ audience: string; recipient_id: string | null }>(
      "select audience,recipient_id from partner_notifications where lead_id=$1 and resolved_at is null",
      [leadId],
    )
  ).rows;
  expect(audiences.length).toBeGreaterThan(0);
  expect(audiences.every((n) => n.audience === "partner" && n.recipient_id === owner.userId)).toBe(
    true,
  );
  const query = partnerNotificationQuerySchema.parse({ status: "all" });
  expect((await repository.notifications(owner, query)).items.map((n) => n.leadId)).toContain(
    leadId,
  );
  expect((await repository.notifications(other, query)).items.map((n) => n.leadId)).not.toContain(
    leadId,
  );
});

it("notifies each order once, with minimal data, retries refused sends and caps the hour", async () => {
  // Earlier orders of this file are set aside: only this test's rows are sent here.
  await database.pool.query(
    "update partner_external_requests set notification='failed' where notification in ('queued','sending')",
  );
  const ownerEmail = `${randomUUID()}@intake.test`;
  await account(ownerEmail, true);
  const { app, config } = await server(ownerEmail);
  const linked = order(),
    waiting = order({ initialCapital: null, frequency: "weekly" });
  try {
    expect(
      (await app.inject({ method: "POST", url, headers: { origin }, payload: linked })).statusCode,
    ).toBe(200);
  } finally {
    await app.close();
  }
  // An order whose account does not exist yet is notified without a link.
  const { app: other } = await server(`${randomUUID()}@intake.test`);
  try {
    expect(
      (await other.inject({ method: "POST", url, headers: { origin }, payload: waiting }))
        .statusCode,
    ).toBe(200);
  } finally {
    await other.close();
  }
  const [linkedRow] = await stored(linked.requestId),
    [waitingRow] = await stored(waiting.requestId);
  const settings = {
    ownerEmail: `${randomUUID()}@intake.test`,
    notifyEmail: "notices@intake.test",
    partnerOrigin: config.AUTH_PARTNER_ORIGIN,
  };

  // No adapter: nothing is sent and no try is used.
  expect(await processExternalRequests(database.pool, null, settings)).toMatchObject({
    sent: 0,
    failed: 0,
  });
  expect((await stored(linked.requestId))[0]).toMatchObject({
    notification: "queued",
    attempts: 0,
  });

  // A refused send is retried after 5 minutes per attempt made.
  const refusing = { send: () => Promise.reject(new Error("MAIL_REJECTED_503")) };
  expect(await processExternalRequests(database.pool, refusing, settings)).toMatchObject({
    sent: 0,
    failed: 2,
  });
  expect((await stored(linked.requestId))[0]).toMatchObject({
    notification: "queued",
    attempts: 1,
  });
  const sent: MailMessage[] = [];
  const accepting = {
    send: (message: MailMessage) => {
      sent.push(message);
      return Promise.resolve();
    },
  };
  expect(await processExternalRequests(database.pool, accepting, settings)).toMatchObject({
    sent: 0,
  });
  await database.pool.query(
    "update partner_external_requests set claimed_at=now()-interval '6 minutes' where id=any($1::text[])",
    [[linkedRow!.id, waitingRow!.id]],
  );
  expect(await processExternalRequests(database.pool, accepting, settings)).toMatchObject({
    sent: 2,
  });
  expect(await processExternalRequests(database.pool, accepting, settings)).toMatchObject({
    sent: 0,
  });
  expect(sent).toHaveLength(2);
  const notice = sent.find((message) => message.reference === linkedRow!.id)!;
  expect(notice).toMatchObject({
    to: "notices@intake.test",
    subject: "Nouvelle commande 3e pilier reçue de horizon3.finance",
    tag: "horizon3-request-v1",
  });
  expect(notice.text).toContain("Produit : Hyperion (Liechtenstein Life)");
  expect(notice.text).toContain("Versement : 300 CHF par mois");
  expect(notice.text).toContain("Capital initial : 10'000 CHF");
  expect(notice.text).toContain(linked.requestId);
  expect(notice.text).toContain(`${config.AUTH_PARTNER_ORIGIN}/leads/${linkedRow!.lead_id}`);
  expect(notice.html).toContain(`href="${config.AUTH_PARTNER_ORIGIN}/leads/${linkedRow!.lead_id}"`);
  // MAIL-06: the client's name, address and phone stay in Partner.
  for (const message of sent)
    for (const personal of ["Jean", "Dupont", "jean@example.test", "+41 79"])
      expect(message.text + message.html).not.toContain(personal);
  const pending = sent.find((message) => message.reference === waitingRow!.id)!;
  expect(pending.text).toContain("dès que le compte qui suit ces commandes y sera disponible");
  expect(pending.text).toContain("Capital initial : aucun");
  expect(pending.text).toContain("selon la fréquence « weekly »");
  expect((await stored(linked.requestId))[0]).toMatchObject({ notification: "sent", attempts: 2 });

  // A send interrupted for more than 10 minutes is sent again (at least once).
  await database.pool.query(
    "update partner_external_requests set notification='sending',notified_at=null,claimed_at=now()-interval '11 minutes' where id=$1",
    [linkedRow!.id],
  );
  expect(await processExternalRequests(database.pool, accepting, settings)).toMatchObject({
    sent: 1,
  });
  // After ten refused tries the notice stops.
  await database.pool.query(
    "update partner_external_requests set notification='queued',notified_at=null,attempts=9,claimed_at=now()-interval '1 hour' where id=$1",
    [linkedRow!.id],
  );
  expect(await processExternalRequests(database.pool, refusing, settings)).toMatchObject({
    failed: 1,
  });
  expect((await stored(linked.requestId))[0]).toMatchObject({
    notification: "failed",
    attempts: 10,
  });

  // MAIL-07: no more than 60 notices an hour, the rest waits without using a try.
  await database.pool.query(
    `insert into partner_external_requests(id,source,request_id,fingerprint,data,notification,notified_at)
     select 'pext_cap_'||g,'horizon3',gen_random_uuid()::text,'cap','{}','sent',now() from generate_series(1,60) g`,
  );
  await database.pool.query(
    "update partner_external_requests set notification='queued',notified_at=null,attempts=0,claimed_at=null where id=$1",
    [waitingRow!.id],
  );
  expect(await processExternalRequests(database.pool, accepting, settings)).toMatchObject({
    sent: 0,
  });
  expect((await stored(waiting.requestId))[0]).toMatchObject({
    notification: "queued",
    attempts: 0,
  });
});

it("opens a waiting order's Lead once its account exists", async () => {
  // The job takes the oldest waiting orders first: earlier ones of this file are set aside.
  await database.pool.query("delete from partner_external_requests where lead_id is null");
  const ownerEmail = `${randomUUID()}@intake.test`;
  const { app } = await server(ownerEmail);
  const body = order();
  try {
    expect(
      (await app.inject({ method: "POST", url, headers: { origin }, payload: body })).statusCode,
    ).toBe(200);
  } finally {
    await app.close();
  }
  expect((await stored(body.requestId))[0]!.lead_id).toBeNull();
  const settings = { ownerEmail, notifyEmail: "notices@intake.test", partnerOrigin: undefined };
  await processExternalRequests(database.pool, null, settings);
  expect((await stored(body.requestId))[0]!.lead_id).toBeNull();
  const owner = await account(ownerEmail, true);
  const result = await processExternalRequests(database.pool, null, settings);
  expect(result.linked).toBeGreaterThanOrEqual(1);
  const leadId = (await stored(body.requestId))[0]!.lead_id!;
  expect(await repository.detail(owner, leadId)).toMatchObject({ responsibleId: owner.userId });
  // Opened once: a second pass changes nothing.
  await processExternalRequests(database.pool, null, settings);
  expect(
    (
      await database.pool.query(
        "select count(*)::int count from partner_leads where restricted_to=$1",
        [owner.userId],
      )
    ).rows[0],
  ).toEqual({ count: 1 });
});

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_intake_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  await migrate(database.db, {
    migrationsFolder: fileURLToPath(new URL("../../drizzle/", import.meta.url)),
  });
  repository = createPartnerRepository(database.pool);
});
afterAll(async () => {
  if (database) await database.pool.end();
  if (container) await container.stop();
});
