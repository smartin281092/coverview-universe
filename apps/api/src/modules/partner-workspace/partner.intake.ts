import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { z } from "zod";
import type { Horizon3Contact } from "@coverview/contracts/partner-intake";
import type { Mailer } from "../../platform/mailer.js";
import { event, newId, type PartnerAuditActor } from "./partner.audit.js";
import { horizon3RequestMessage, horizon3RequestTemplate } from "./partner.intake-template.js";
import { syncLeadNotifications } from "./partner.notifications.js";
import { fail, type Executor } from "./partner.policy.js";
import copy from "./partner.intake.fr.json" with { type: "json" };

// Orders from horizon3.finance (14 October 2026). The order is stored before it is confirmed; its
// Lead, restricted to one account, and the internal notification follow. The table is the outbox.
const system: PartnerAuditActor = { userId: null, systemActor: "partner-intake-v1" };
const maxAttempts = 10;
// MAIL-07: the public form can never send more than this many notices an hour.
const hourlyNotices = 60;
const storedSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string(),
  birthYear: z.number().int(),
  investmentMinor: z.number().int().min(0),
  frequency: z.string(),
  initialCapitalMinor: z.number().int().min(0).nullable(),
  productId: z.number().int().nullable(),
  productName: z.string(),
  strategyId: z.string(),
  company: z.string(),
});
type Stored = z.infer<typeof storedSchema>;
export type IntakeSettings = {
  ownerEmail: string;
  notifyEmail: string;
  partnerOrigin: string | undefined;
};

const minor = (francs: number) => Math.round(francs * 100);
// Swiss writing, as in the apps: apostrophe between thousands, comma before centimes.
const chf = (amount: number) => {
  const francs = String(Math.trunc(amount / 100)).replace(/\B(?=(\d{3})+(?!\d))/gu, "'");
  const centimes = amount % 100;
  return `${francs}${centimes ? `,${String(centimes).padStart(2, "0")}` : ""} CHF`;
};
// Own labels only: a sent value such as "constructor" is shown as it is.
const frequency = (value: string) =>
  Object.hasOwn(copy.frequencies, value)
    ? copy.frequencies[value as keyof typeof copy.frequencies]
    : copy.otherFrequency.replace("{frequency}", value);
const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/gu, (_, key: string) => values[key] ?? "");

// The account that follows these orders: exactly one active account with that address.
async function owner(db: Executor, email: string) {
  const rows = (
    await db.query<{ id: string }>(
      "select id from identity_users where lower(email)=lower($1) and not global_revocation_pending order by created_at,id limit 2",
      [email],
    )
  ).rows;
  return rows.length === 1 ? rows[0]!.id : null;
}

async function openLead(
  db: Executor,
  account: string,
  requestId: string,
  data: Stored,
  receivedAt: Date,
) {
  const id = newId("lead");
  const name = `${data.firstName} ${data.lastName}`;
  const values = {
    name,
    date: new Intl.DateTimeFormat("fr-CH", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Zurich",
    }).format(receivedAt),
    product: data.productName,
    company: data.company,
    strategy: data.strategyId,
    investment: `${chf(data.investmentMinor)} ${frequency(data.frequency)}`,
    capital: data.initialCapitalMinor === null ? copy.none : chf(data.initialCapitalMinor),
    year: String(data.birthYear),
    reference: requestId,
  };
  // Followed by the account alone: already accepted, never proposed, transmission not authorized.
  await db.query(
    `insert into partner_leads(id,creator_id,responsible_id,restricted_to,title,category,object,client_name,details,stage,assignment,priority,next_action,due_at)
     values($1,$2,$2,$2,$3,'pension',$4,$5,$6,'to_contact','accepted','high',$7,now()+interval '24 hours')`,
    [
      id,
      account,
      fill(copy.title, values).slice(0, 180),
      `${data.productName} · ${data.company}`.slice(0, 200),
      name.slice(0, 160),
      JSON.stringify({
        context: fill(copy.context, values).slice(0, 4000),
        objectReference: "",
        email: data.email,
        phone: data.phone,
        language: "fr",
        source: `horizon3:${requestId}`,
        transmissionAuthorized: false,
      }),
      copy.nextAction,
    ],
  );
  await event(db, system, id, "lead.external_request_received", copy.event, "assigned");
  await syncLeadNotifications(db, id);
  return id;
}

// Stores the order once per request id. The same order again changes nothing; another content
// under the same id is refused (API-04).
export async function receiveExternalRequest(pool: Pool, input: Horizon3Contact) {
  const { source, requestId, investment, initialCapital, ...rest } = input;
  const data: Stored = {
    ...rest,
    investmentMinor: minor(investment),
    initialCapitalMinor: initialCapital === null ? null : minor(initialCapital),
  };
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ source, requestId, ...data }))
    .digest("hex");
  const id = newId("pext");
  const created = await pool.query(
    "insert into partner_external_requests(id,source,request_id,fingerprint,data) values($1,$2,$3,$4,$5) on conflict (source,request_id) do nothing",
    [id, source, requestId, fingerprint, JSON.stringify(data)],
  );
  if (created.rowCount) return { id, created: true };
  const existing = (
    await pool.query<{ id: string; fingerprint: string }>(
      "select id,fingerprint from partner_external_requests where source=$1 and request_id=$2",
      [source, requestId],
    )
  ).rows[0];
  if (!existing || existing.fingerprint !== fingerprint) fail("PARTNER_IDEMPOTENCY_REUSED", 422);
  return { id: existing.id, created: false };
}

// Opens the order's Lead for the account once it exists. False when it is already open, taken by
// another worker, or the account is missing or ambiguous.
export async function linkExternalRequest(pool: Pool, id: string, ownerEmail: string) {
  const tx = await pool.connect();
  try {
    await tx.query("begin");
    await tx.query("set local lock_timeout='2s'");
    await tx.query("set local statement_timeout='10s'");
    const row = (
      await tx.query<{ request_id: string; data: unknown; created_at: Date }>(
        "select request_id,data,created_at from partner_external_requests where id=$1 and lead_id is null for update skip locked",
        [id],
      )
    ).rows[0];
    const account = row ? await owner(tx, ownerEmail) : null;
    if (!row || !account) {
      await tx.query("rollback");
      return false;
    }
    const leadId = await openLead(
      tx,
      account,
      row.request_id,
      storedSchema.parse(row.data),
      row.created_at,
    );
    await tx.query("update partner_external_requests set lead_id=$2 where id=$1", [id, leadId]);
    await tx.query("commit");
    return true;
  } catch (error) {
    await tx.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    tx.release();
  }
}

// Job: opens the Leads still waiting for their account, then sends the notices, retried 5 minutes
// per attempt already made. Without a mail adapter the notices stay queued without using a try.
export async function processExternalRequests(
  pool: Pool,
  mailer: Mailer | null,
  settings: IntakeSettings,
) {
  let linked = 0,
    unlinked = 0;
  const waiting = (
    await pool.query<{ id: string }>(
      "select id from partner_external_requests where lead_id is null order by created_at,id limit 20",
    )
  ).rows;
  for (const { id } of waiting) {
    try {
      if (await linkExternalRequest(pool, id, settings.ownerEmail)) linked += 1;
    } catch {
      unlinked += 1;
    }
  }
  // An interrupted send is sent again: a notice may arrive twice, never not at all (G-10).
  await pool.query(
    "update partner_external_requests set notification='queued' where notification='sending' and claimed_at<now()-interval '10 minutes'",
  );
  if (!mailer) return { linked, unlinked, sent: 0, failed: 0 };
  const recent = (
    await pool.query<{ count: number }>(
      "select count(*)::int count from partner_external_requests where notified_at>now()-interval '1 hour'",
    )
  ).rows[0]!.count;
  let sent = 0,
    failed = 0;
  for (let i = 0; i < Math.min(20, hourlyNotices - recent); i += 1) {
    const claimed = (
      await pool.query<{
        id: string;
        request_id: string;
        data: unknown;
        lead_id: string | null;
        created_at: Date;
      }>(
        `update partner_external_requests set notification='sending',claimed_at=now(),attempts=attempts+1
         where id=(select id from partner_external_requests where notification='queued'
           and (claimed_at is null or claimed_at<now()-attempts*interval '5 minutes')
           order by created_at,id for update skip locked limit 1)
         returning id,request_id,data,lead_id,created_at`,
      )
    ).rows[0];
    if (!claimed) break;
    try {
      const data = storedSchema.parse(claimed.data);
      const message = horizon3RequestMessage({
        locale: "fr",
        name: `${data.firstName} ${data.lastName}`,
        email: data.email,
        phone: data.phone,
        product: data.productName,
        company: data.company,
        strategy: data.strategyId,
        investment: `${chf(data.investmentMinor)} ${frequency(data.frequency)}`,
        capital: data.initialCapitalMinor === null ? copy.none : chf(data.initialCapitalMinor),
        reference: claimed.request_id,
        receivedAt: claimed.created_at,
        link:
          claimed.lead_id && settings.partnerOrigin
            ? `${settings.partnerOrigin}/leads/${claimed.lead_id}`
            : null,
      });
      await mailer.send({
        to: settings.notifyEmail,
        ...message,
        tag: horizon3RequestTemplate,
        reference: claimed.id,
      });
    } catch {
      await pool.query(
        `update partner_external_requests set notification=case when attempts>=${maxAttempts} then 'failed' else 'queued' end
         where id=$1 and notification='sending'`,
        [claimed.id],
      );
      failed += 1;
      continue;
    }
    await pool.query(
      "update partner_external_requests set notification='sent',notified_at=now() where id=$1 and notification='sending'",
      [claimed.id],
    );
    sent += 1;
  }
  return { linked, unlinked, sent, failed };
}

// MAIL-03 preview: fictitious values only.
export function horizon3RequestPreview(partnerOrigin: string | undefined) {
  return horizon3RequestMessage({
    locale: "fr",
    name: "Camille Exemple",
    email: "camille@example.test",
    phone: "+41 79 000 00 00",
    product: "Produit exemple",
    company: "Compagnie exemple",
    strategy: "exemple",
    investment: `${chf(30000)} ${frequency("monthly")}`,
    capital: chf(1000000),
    reference: "00000000-0000-4000-8000-000000000000",
    receivedAt: new Date(),
    link: partnerOrigin ? `${partnerOrigin}/leads/lead_exemple` : null,
  });
}
