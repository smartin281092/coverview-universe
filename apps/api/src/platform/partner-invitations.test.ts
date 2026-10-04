import { createHash, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  competenceDeclarationSchema,
  competenceDecisionSchema,
  leadCreateInputSchema,
  partnerApplicationInputSchema,
} from "@coverview/contracts/partner";
import { clientInvitationNoticeVersion } from "@coverview/contracts/partner-invitations";
import { createDatabase } from "./db/database.js";
import { createMailpitMailer, type MailMessage, type Mailer } from "./mailer.js";
import { createPartnerRepository } from "../modules/partner-workspace/partner.repository.js";
import { processClientInvitations } from "../modules/partner-workspace/partner.invitations.js";
import { clientInvitationMessage } from "../modules/partner-workspace/partner.invitation-template.js";
import type { PartnerActor } from "../modules/partner-workspace/partner.policy.js";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let repository: ReturnType<typeof createPartnerRepository>;
let admin: PartnerActor;
const key = () => randomUUID();
const later = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const wallet = "http://wallet.test";
const send = { action: "send", confirmed: true } as const;

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_invitations_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  const migrationsFolder = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  await migrate(database.db, { migrationsFolder });
  await migrate(database.db, { migrationsFolder });
  repository = createPartnerRepository(database.pool, true, "configured");
  admin = await actor(true);
});
afterAll(async () => {
  if (database) await database.pool.end();
  if (container) await container.stop();
});

async function actor(administrator = false, email = `${key()}@invitations.test`) {
  const value = { userId: `user_${key()}`, id: `session_${key()}`, administrator };
  await database.pool.query(
    "insert into identity_users(id,workos_user_id,email) values($1,$2,$3)",
    [value.userId, key(), email],
  );
  await database.pool.query("insert into identity_profiles(id,user_id) values($1,$2)", [
    key(),
    value.userId,
  ]);
  await database.pool.query(
    "insert into identity_sessions(id,user_id,workos_session_id,token_hash,device,expires_at,mfa_verified_at) values($1,$2,$3,$4,'Isolated invitations',now()+interval '1 hour',now()-interval '1 second')",
    [value.id, value.userId, key(), sha256(key())],
  );
  if (administrator)
    await database.pool.query(
      "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated test')",
      [key(), value.userId],
    );
  return value as PartnerActor;
}
const walletUser = async (email: string) => ({ ...(await actor(false, email)), wallet: true });
async function professional(name: string, roles: ("advisor" | "referrer")[] = ["advisor"]) {
  const person = await actor();
  await repository.apply(
    person,
    partnerApplicationInputSchema.parse({
      name,
      organization: "Organisation isolée",
      phone: "",
      roles,
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
      roles,
      reason: "Test isolé",
      reviewDueAt: null,
      organizationState: "approved",
    },
    key(),
  );
  return person;
}
async function advisor(name: string) {
  const person = await professional(name);
  const current = await repository.competence(person, person.userId, "vehicle");
  const dossier = await repository.declareCompetence(
    person,
    person.userId,
    "vehicle",
    competenceDeclarationSchema.parse({
      revision: 0,
      professionalRevision: current.professionalRevision,
      declaration: "Compétence déclarée dans un test isolé",
      file: { name: "Preuve.pdf", mime: "application/pdf", size: 20, checksum: sha256(key()) },
      confirmed: true,
    }),
    key(),
  );
  await repository.completeCompetenceUpload(
    person,
    person.userId,
    "vehicle",
    dossier.current!.id,
    "application/pdf",
  );
  await database.pool.query(
    "update files set state='ready',scan_version='isolated',revision=revision+1 where id=$1",
    [dossier.current!.documentId],
  );
  const reviewed = await repository.competence(person, person.userId, "vehicle");
  await repository.decideCompetence(
    admin,
    person.userId,
    "vehicle",
    competenceDecisionSchema.parse({
      revision: reviewed.current!.revision,
      decision: "reviewed",
      reason: "Examen isolé",
      scope: "Périmètre de test",
      coverage: "category",
      validUntil: later(48),
      documentRevision: reviewed.current!.documentRevision,
      originalChecked: true,
    }),
    key(),
  );
  return person;
}
// A contact transmitted without Wallet: the request names the client and an email only.
async function request(creator: PartnerActor, email: string, responsible: PartnerActor) {
  const lead = await repository.create(
    creator,
    leadCreateInputSchema.parse({
      title: "Besoin isolé",
      category: "vehicle",
      object: "Voiture",
      context: "Contexte isolé",
      clientUserId: null,
      clientProfileId: null,
      clientName: "Personne isolée",
      email,
      phone: "",
      language: "fr",
      source: "Test",
      transmissionAuthorized: true,
      priority: "normal",
      draft: false,
      nextAction: "Qualifier",
      dueAt: later(24),
    }),
    key(),
  );
  const assigned = await repository.command(
    admin,
    lead.id,
    {
      action: "assign",
      revision: lead.revision,
      responsibleId: responsible.userId,
      reason: "Choix documenté dans un test isolé",
    },
    key(),
  );
  return repository.command(
    responsible,
    lead.id,
    { action: "accept", revision: assigned.revision },
    key(),
  );
}
function recorder(failures = 0) {
  const sent: MailMessage[] = [];
  let remaining = failures;
  const mailer: Mailer = {
    send(message) {
      if (remaining > 0) {
        remaining -= 1;
        return Promise.reject(new Error("refused"));
      }
      sent.push(message);
      return Promise.resolve();
    },
  };
  return { sent, mailer };
}
const tokenOf = (message: MailMessage) => /#token=([A-Za-z0-9_-]{43})/u.exec(message.text)![1]!;
const invitation = async (leadId: string) =>
  (
    await database.pool.query<Record<string, unknown>>(
      "select * from partner_client_invitations where lead_id=$1 order by created_at desc,id desc limit 1",
      [leadId],
    )
  ).rows[0]!;
const answer = (token: string, decision: "accept" | "decline") =>
  ({ token, decision, noticeVersion: clientInvitationNoticeVersion, confirmed: true }) as const;

it("queues one confirmed invitation per request, for people allowed to contact the client only", async () => {
  const referrer = await professional("Rita Apporteuse", ["referrer"]),
    responsible = await advisor("Alain Conseiller"),
    lead = await request(referrer, "Client.One@Invitations.test", responsible),
    owner = await walletUser("client.one@invitations.test");

  // A referrer only transmitted the contact: no control and nothing disclosed about invitations.
  expect(await repository.clientInvitations(referrer, lead.id)).toMatchObject({
    canInvite: false,
    blocker: "access",
    items: [],
  });
  await expect(
    repository.commandClientInvitation(referrer, lead.id, send, key()),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  await expect(repository.clientInvitations(owner, lead.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });

  expect(await repository.clientInvitations(responsible, lead.id)).toMatchObject({
    canInvite: true,
    delivery: "configured",
    blocker: null,
    items: [],
  });
  const retry = key();
  const queued = await repository.commandClientInvitation(responsible, lead.id, send, retry);
  expect(queued).toMatchObject({
    canInvite: false,
    blocker: null,
    items: [{ state: "queued", email: "client.one@invitations.test", reason: null }],
  });
  expect(await repository.commandClientInvitation(responsible, lead.id, send, retry)).toEqual(
    queued,
  );
  await expect(
    repository.commandClientInvitation(admin, lead.id, send, key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });

  // The same answer whether or not the address already belongs to a Wallet account.
  const unknown = await request(referrer, "nobody@invitations.test", responsible);
  const other = await repository.commandClientInvitation(responsible, unknown.id, send, key());
  const shape = (value: typeof queued) => ({
    ...value,
    items: value.items.map((item) => ({ state: item.state, reason: item.reason })),
  });
  expect(shape(other)).toEqual(shape(queued));
  expect(
    (
      await database.pool.query(
        "select kind,audience from partner_events where lead_id=$1 and kind like 'client.invitation%'",
        [lead.id],
      )
    ).rows,
  ).toEqual([{ kind: "client.invitation_queued", audience: "coverview" }]);
});

it("sends a hashed single-use link through the job and links the request for its recipient only", async () => {
  const referrer = await professional("Rémi Apporteur", ["referrer"]),
    responsible = await advisor("Béatrice Conseillère"),
    email = "client.two@invitations.test",
    lead = await request(referrer, email, responsible);
  await repository.commandClientInvitation(responsible, lead.id, send, key());
  const box = recorder();
  expect((await processClientInvitations(database.pool, box.mailer, wallet)).sent).toBeGreaterThan(
    0,
  );
  const message = box.sent.find((item) => item.to === email)!;
  const token = tokenOf(message),
    stored = await invitation(lead.id);
  expect(message).toMatchObject({
    subject: "Une demande de conseil à votre nom sur CoverView",
    tag: "client-invitation-v1",
    reference: stored.id,
  });
  // Category and inviting professional only: never the request title nor the client's name.
  expect(message.text).toContain("Béatrice Conseillère (Organisation isolée)");
  expect(message.text).toContain("assurance véhicule");
  expect(message.text).toContain(clientInvitationNoticeVersion);
  expect(`${message.text}${message.html}`).not.toMatch(/Besoin isolé|Personne isolée/u);
  expect(message.html).toContain(`<a href="${wallet}/activation#token=${token}">`);
  expect(stored).toMatchObject({ state: "sent", token_hash: sha256(token), attempts: 1 });
  expect(JSON.stringify(stored)).not.toContain(token);
  await processClientInvitations(database.pool, box.mailer, wallet);
  expect(box.sent.filter((item) => item.to === email)).toHaveLength(1);

  const owner = await walletUser(email),
    stranger = await walletUser("stranger.two@invitations.test");
  expect(await repository.previewClientInvitation(stranger, { token })).toMatchObject({
    state: "pending",
    emailMatches: false,
    title: null,
    clientName: null,
    category: null,
    requester: null,
    expiresAt: null,
  });
  expect(await repository.previewClientInvitation(owner, { token })).toMatchObject({
    state: "pending",
    emailMatches: true,
    title: "Besoin isolé",
    clientName: "Personne isolée",
    category: "vehicle",
    requester: "Béatrice Conseillère (Organisation isolée)",
  });
  await expect(repository.detail(owner, lead.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  await expect(
    repository.respondClientInvitation(stranger, answer(token, "accept"), key()),
  ).rejects.toMatchObject({ code: "PARTNER_NOT_FOUND" });
  await expect(
    repository.previewClientInvitation(owner, { token: "x".repeat(43) }),
  ).resolves.toMatchObject({ state: "unavailable", emailMatches: false });

  const retry = key();
  expect(
    await repository.respondClientInvitation(owner, answer(token, "accept"), retry),
  ).toMatchObject({ state: "accepted" });
  expect(
    await repository.respondClientInvitation(owner, answer(token, "accept"), retry),
  ).toMatchObject({ state: "accepted" });
  await expect(
    repository.respondClientInvitation(owner, answer(token, "decline"), key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });

  // Personal subject only: no managed profile, mandate or household link is inferred.
  expect(
    (
      await database.pool.query(
        "select client_user_id,client_profile_id from partner_leads where id=$1",
        [lead.id],
      )
    ).rows[0],
  ).toEqual({ client_user_id: owner.userId, client_profile_id: null });
  expect((await repository.detail(owner, lead.id)).id).toBe(lead.id);
  expect(await repository.previewClientInvitation(owner, { token })).toMatchObject({
    state: "accepted",
  });
  expect(await repository.previewClientInvitation(stranger, { token })).toMatchObject({
    state: "unavailable",
    emailMatches: false,
  });
  expect(await repository.clientInvitations(responsible, lead.id)).toMatchObject({
    canInvite: false,
    blocker: "linked",
  });
  expect(
    (
      await database.pool.query(
        "select recipient_id,action from partner_notifications where lead_id=$1 and kind='client.invitation_accepted'",
        [lead.id],
      )
    ).rows,
  ).toEqual([{ recipient_id: responsible.userId, action: null }]);
  expect(
    (
      await database.pool.query(
        "select count(*)::int count from partner_commands where operation like $1",
        [`%${token}%`],
      )
    ).rows[0],
  ).toEqual({ count: 0 });
});

it("handles a decline, a corrected email, a cancellation and the per-recipient bound", async () => {
  const referrer = await professional("Romain Apporteur", ["referrer"]),
    responsible = await advisor("Claire Conseillère"),
    email = "client.three@invitations.test",
    lead = await request(referrer, email, responsible),
    owner = await walletUser(email),
    box = recorder();
  await repository.commandClientInvitation(responsible, lead.id, send, key());
  await processClientInvitations(database.pool, box.mailer, wallet);
  const declined = tokenOf(box.sent.find((item) => item.to === email)!);
  expect(
    await repository.respondClientInvitation(owner, answer(declined, "decline"), key()),
  ).toMatchObject({ state: "declined" });
  expect(
    (await database.pool.query("select client_user_id from partner_leads where id=$1", [lead.id]))
      .rows[0],
  ).toEqual({ client_user_id: null });
  const notice = async () =>
    (
      await database.pool.query<Record<string, unknown>>(
        "select recipient_id,action,priority,resolved_at is not null resolved from partner_notifications where lead_id=$1 and kind='client.invitation_declined'",
        [lead.id],
      )
    ).rows;
  expect(await notice()).toEqual([
    {
      recipient_id: responsible.userId,
      action: "review_response",
      priority: "high",
      resolved: false,
    },
  ]);

  // After a correction, the previous invitation is void and a new one resolves the answer.
  await repository.commandClientInvitation(responsible, lead.id, send, key());
  expect((await notice())[0]).toMatchObject({ resolved: true });
  box.sent.length = 0;
  await processClientInvitations(database.pool, box.mailer, wallet);
  const stale = tokenOf(box.sent.find((item) => item.to === email)!);
  await database.pool.query(
    "update partner_leads set details=jsonb_set(details,'{email}','\"corrected.three@invitations.test\"') where id=$1",
    [lead.id],
  );
  expect(await repository.clientInvitations(responsible, lead.id)).toMatchObject({
    canInvite: true,
    items: [{ state: "superseded", reason: "recipient_changed" }, { state: "declined" }],
  });
  expect(await repository.previewClientInvitation(owner, { token: stale })).toMatchObject({
    state: "unavailable",
    emailMatches: true,
  });
  await expect(
    repository.respondClientInvitation(owner, answer(stale, "accept"), key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  await processClientInvitations(database.pool, box.mailer, wallet);
  expect(await invitation(lead.id)).toMatchObject({
    state: "superseded",
    failure: "recipient_changed",
  });

  const corrected = await repository.commandClientInvitation(responsible, lead.id, send, key());
  const current = corrected.items[0]!;
  expect(current).toMatchObject({ state: "queued", email: "corrected.three@invitations.test" });
  // A cancellation always carries a reason: the contract refuses it before any write.
  expect(() =>
    repository.commandClientInvitation(
      responsible,
      lead.id,
      { action: "cancel", id: current.id, reason: "Non" },
      key(),
    ),
  ).toThrow();
  const cancelled = await repository.commandClientInvitation(
    responsible,
    lead.id,
    { action: "cancel", id: current.id, reason: "Adresse à confirmer par téléphone" },
    key(),
  );
  expect(cancelled.canInvite).toBe(true);
  expect(cancelled.items.map((item) => item.state)).toEqual([
    "cancelled",
    "superseded",
    "declined",
  ]);
  expect(cancelled.items[0]).toMatchObject({ cancelReason: "Adresse à confirmer par téléphone" });

  // Three invitations per recipient and 24 hours, whatever the request (MAIL-07).
  const bounded = "bounded@invitations.test";
  for (let i = 0; i < 3; i += 1)
    await repository.commandClientInvitation(
      responsible,
      (await request(referrer, bounded, responsible)).id,
      send,
      key(),
    );
  await expect(
    repository.commandClientInvitation(
      responsible,
      (await request(referrer, bounded, responsible)).id,
      send,
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_RATE_LIMITED", statusCode: 429 });
});

it("never sends without an adapter, retries a refused send three times and flags an interrupted one", async () => {
  const referrer = await professional("Régis Apporteur", ["referrer"]),
    responsible = await advisor("Denis Conseiller"),
    email = "client.four@invitations.test",
    lead = await request(referrer, email, responsible),
    unconfigured = createPartnerRepository(database.pool, true, "unconfigured");
  await unconfigured.commandClientInvitation(responsible, lead.id, send, key());
  await processClientInvitations(database.pool, null, wallet);
  expect(await unconfigured.clientInvitations(responsible, lead.id)).toMatchObject({
    delivery: "unconfigured",
    items: [{ state: "queued" }],
  });
  expect(await invitation(lead.id)).toMatchObject({ state: "queued", token_hash: null });

  const box = recorder(Number.MAX_SAFE_INTEGER);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await processClientInvitations(database.pool, box.mailer, wallet);
    expect(await invitation(lead.id)).toMatchObject({ attempts: attempt, token_hash: null });
    // No immediate retry: the next attempt waits five minutes per attempt already made.
    await processClientInvitations(database.pool, box.mailer, wallet);
    expect(await invitation(lead.id)).toMatchObject({ attempts: attempt });
    if (attempt < 3)
      await database.pool.query(
        "update partner_client_invitations set claimed_at=claimed_at-interval '20 minutes' where lead_id=$1",
        [lead.id],
      );
  }
  expect(await invitation(lead.id)).toMatchObject({ state: "failed", failure: "send_failed" });
  expect(await repository.clientInvitations(responsible, lead.id)).toMatchObject({
    canInvite: true,
    items: [{ state: "failed", reason: "send_failed" }],
  });

  // A claim left without outcome is never resent blindly.
  const other = await request(referrer, "client.five@invitations.test", responsible);
  await database.pool.query(
    "insert into partner_client_invitations(id,lead_id,email,state,token_hash,attempts,created_by,created_at,expires_at,claimed_at) values($1,$2,'client.five@invitations.test','sending',$3,1,$4,now()-interval '1 hour',now()+interval '13 days',now()-interval '11 minutes')",
    [`pinv_${key()}`, other.id, sha256(key()), responsible.userId],
  );
  await processClientInvitations(database.pool, recorder().mailer, wallet);
  expect(await invitation(other.id)).toMatchObject({
    state: "failed",
    failure: "delivery_unknown",
  });

  // Past its validity, a sent link only says it expired.
  const expired = await request(referrer, "client.six@invitations.test", responsible),
    token = "e".repeat(43);
  await database.pool.query(
    "insert into partner_client_invitations(id,lead_id,email,state,token_hash,attempts,created_by,created_at,expires_at,claimed_at,sent_at) values($1,$2,'client.six@invitations.test','sent',$3,1,$4,now()-interval '15 days',now()-interval '1 day',now()-interval '15 days',now()-interval '15 days')",
    [`pinv_${key()}`, expired.id, sha256(token), responsible.userId],
  );
  const late = await walletUser("client.six@invitations.test");
  expect(await repository.previewClientInvitation(late, { token })).toMatchObject({
    state: "expired",
  });
  await processClientInvitations(database.pool, null, wallet);
  expect(await invitation(expired.id)).toMatchObject({ state: "expired" });
  await expect(
    repository.respondClientInvitation(late, answer(token, "accept"), key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
});

it("keeps the invitation history append-only and forward-only in the database", async () => {
  const referrer = await professional("Rose Apporteuse", ["referrer"]),
    responsible = await advisor("Émile Conseiller"),
    lead = await request(referrer, "client.seven@invitations.test", responsible);
  const { id } = (await repository.commandClientInvitation(responsible, lead.id, send, key()))
    .items[0]!;
  for (const statement of [
    "update partner_client_invitations set email='other@invitations.test' where id=$1",
    "update partner_client_invitations set expires_at=expires_at+interval '30 days' where id=$1",
    "update partner_client_invitations set state='sent',sent_at=now(),token_hash=repeat('a',64) where id=$1",
    "delete from partner_client_invitations where id=$1",
  ])
    await expect(database.pool.query(statement, [id])).rejects.toMatchObject({ code: "23514" });
  await database.pool.query(
    "update partner_client_invitations set state='cancelled',cancelled_by=$2,cancel_reason='Annulation isolée' where id=$1",
    [id, responsible.userId],
  );
  await expect(
    database.pool.query("update partner_client_invitations set state='queued' where id=$1", [id]),
  ).rejects.toMatchObject({ code: "23514" });
});

it("renders validated, escaped copy and posts it to the Mailpit HTTP API", async () => {
  const message = clientInvitationMessage({
    locale: "fr",
    requester: "Zoé <b>Test</b> {{until}}",
    category: "pension",
    link: "http://wallet.test/activation#token=abc",
    expiresAt: new Date("2026-10-18T10:00:00Z"),
  });
  expect(message.html).toContain("Zoé &lt;b&gt;Test&lt;/b&gt; {{until}}");
  expect(message.text).toContain("Zoé <b>Test</b> {{until}} a enregistré");
  expect(message.text).toContain("prévoyance");
  expect(message.text).toContain("18 octobre 2026");
  expect(() =>
    clientInvitationMessage({
      locale: "fr",
      requester: "Test",
      category: "pension",
      link: "javascript:alert(1)",
      expiresAt: new Date(),
    }),
  ).toThrow();

  const received: { url: string | undefined; body: unknown }[] = [];
  let status = 200;
  const server = createServer((request: IncomingMessage, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => (body += chunk.toString()));
    request.on("end", () => {
      received.push({ url: request.url, body: JSON.parse(body) as unknown });
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify({ ID: "local" }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const mailer = createMailpitMailer(
      `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      2000,
    );
    await mailer.send({
      to: "client@invitations.test",
      ...message,
      tag: "client-invitation-v1",
      reference: "pinv_reference",
    });
    expect(received).toEqual([
      {
        url: "/api/v1/send",
        body: {
          From: { Email: "no-reply@coverview.local", Name: "CoverView" },
          To: [{ Email: "client@invitations.test" }],
          Subject: message.subject,
          Text: message.text,
          HTML: message.html,
          Tags: ["client-invitation-v1"],
          Headers: { "X-CoverView-Reference": "pinv_reference" },
        },
      },
    ]);
    status = 400;
    await expect(
      mailer.send({ to: "client@invitations.test", ...message, tag: "t", reference: "r" }),
    ).rejects.toThrow("MAIL_REJECTED_400");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
