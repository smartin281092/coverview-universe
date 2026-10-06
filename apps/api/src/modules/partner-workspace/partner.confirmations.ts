import type { Pool, PoolClient } from "pg";
import {
  caseConfirmationSchema,
  clientConfirmationsSchema,
  clientFactsSchema,
  qualityContactInputSchema,
  walletConfirmationInputSchema,
  type ClientFacts,
  type Discrepancy,
  type QualityContactInput,
  type WalletConfirmationInput,
} from "@coverview/contracts/partner-quality";
import { z } from "zod";
import { fail, type Executor, type PartnerActor } from "./partner.policy.js";
import { economyRead, type EconomyMutation } from "./partner.commercial.js";
import { lockContractSubject } from "./partner.contract.js";
import { event, newId } from "./partner.audit.js";
import { openQualityCase, qualitySubject } from "./partner.quality-cases.js";
import type { partnerLeads } from "./partner.schema.js";
import copy from "./partner.quality.fr.json" with { type: "json" };

type Lead = typeof partnerLeads.$inferSelect;
type Access = (tx: PoolClient, actor: PartnerActor, id: string) => Promise<Lead>;
type Declared = { contact: boolean; appointment: boolean; documents: boolean; contract: boolean };
type ConfirmationRow = {
  id: string;
  channel: "survey" | "wallet" | "call" | "email";
  facts: unknown;
  declared: unknown;
  discrepancies: unknown;
  comment: string;
  case_id: string | null;
  created_at: Date;
};
// A client may tell CoverView about a request a few times a day, never more.
const walletDailyLimit = 3;

/**
 * What the request declares at this moment (C8d, brief I.17.2): a useful contact, an appointment
 * held, offers published to Wallet, a contract signed, issued, closed as such or a final policy.
 */
async function declaredFacts(db: Executor, leadId: string): Promise<Declared> {
  const row = (
    await db.query<Declared>(
      `select (l.first_useful_at is not null or exists(select 1 from partner_communication_records r
          where r.lead_id=l.id and r.invalidated_at is null and r.input->>'outcome'='reached')) contact,
        exists(select 1 from partner_appointments a where a.lead_id=l.id and a.state='completed') appointment,
        exists(select 1 from partner_offers o where o.lead_id=l.id and o.published_at is not null) documents,
        (coalesce(l.result='contract',false) or l.stage in ('signing','signed','awaiting_insurer','contract_issued')
          or exists(select 1 from partner_final_policies p where p.lead_id=l.id and p.active)) contract
      from partner_leads l where l.id=$1`,
      [leadId],
    )
  ).rows[0];
  if (!row) return fail("PARTNER_NOT_FOUND", 404);
  return row;
}
/** Differences only where the client answers yes or no; "unknown" never creates one. */
function compareFacts(facts: ClientFacts, declared: Declared): Discrepancy[] {
  const found: Discrepancy[] = [];
  if (facts.contract === "yes" && !declared.contract) found.push("contract_undeclared");
  if (facts.contract === "no" && declared.contract) found.push("contract_unconfirmed");
  if (facts.contact === "no" && declared.contact) found.push("contact_unconfirmed");
  if (facts.appointment === "no" && declared.appointment) found.push("appointment_unconfirmed");
  if (facts.documents === "no" && declared.documents) found.push("documents_unconfirmed");
  return found;
}
// One open verification per request: a new statement joins it rather than soliciting anew.
async function openVerification(
  tx: PoolClient,
  actor: PartnerActor,
  lead: Lead,
  discrepancies: Discrepancy[],
) {
  const open = (
    await tx.query<{ id: string }>(
      `select q.id from partner_quality_cases q where q.lead_id=$1 and q.kind='verification' and q.invalidated_at is null
       and exists(select 1 from partner_client_confirmations c where c.case_id=q.id)
       and not coalesce((select a.input->>'action'='close' from partner_quality_actions a where a.case_id=q.id and a.input->>'action'<>'reply' order by a.revision desc limit 1),false)
       order by q.created_at desc,q.id desc limit 1 for update of q`,
      [lead.id],
    )
  ).rows[0];
  if (open) return open.id;
  // Internal: the client is a source of information, never told whether a difference exists.
  return openQualityCase(
    tx,
    actor,
    lead,
    {
      kind: "verification",
      summary: copy.verificationSummary,
      priority: discrepancies.includes("contract_undeclared") ? "high" : "normal",
      sharedWithClient: false,
      confirmed: true,
    },
    null,
    "coverview",
  );
}
/** Records a client statement with the declared state, and opens a verification on difference. */
export async function recordConfirmation(
  tx: PoolClient,
  actor: PartnerActor,
  lead: Lead,
  channel: ConfirmationRow["channel"],
  raw: ClientFacts,
  comment: string,
  occurredAt: string | null = null,
) {
  const facts = clientFactsSchema.parse(raw);
  const declared = await declaredFacts(tx, lead.id);
  const discrepancies = compareFacts(facts, declared);
  const caseId = discrepancies.length
    ? await openVerification(tx, actor, lead, discrepancies)
    : null;
  const id = newId("pcc");
  await tx.query(
    `insert into partner_client_confirmations(id,lead_id,subject_key,owner_id,channel,recorded_by,facts,declared,discrepancies,comment,case_id,occurred_at)
     values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      id,
      lead.id,
      qualitySubject(lead),
      lead.clientUserId,
      channel,
      actor.userId,
      JSON.stringify(facts),
      JSON.stringify(declared),
      JSON.stringify(discrepancies),
      comment,
      caseId,
      occurredAt,
    ],
  );
  await event(tx, actor, lead.id, "quality.confirmation_recorded.v1", "", "coverview", id);
  return id;
}
/** The confirmations linked to a verification, for CoverView and the reconciling professional. */
export async function caseConfirmations(db: Executor, caseId: string) {
  return (
    await db.query<ConfirmationRow>(
      "select * from partner_client_confirmations where case_id=$1 and invalidated_at is null order by created_at desc,id desc limit 10",
      [caseId],
    )
  ).rows.map((row) => caseConfirmation(row));
}
const caseConfirmation = (row: ConfirmationRow) =>
  caseConfirmationSchema.parse({
    id: row.id,
    channel: row.channel,
    facts: row.facts,
    declared: row.declared,
    discrepancies: row.discrepancies,
    createdAt: row.created_at.toISOString(),
  });

// The client reads their own statements: never the declared state, the differences or whether
// a verification followed.
async function ownConfirmations(tx: PoolClient, actor: PartnerActor, lead: Lead) {
  const rows = (
    await tx.query<ConfirmationRow>(
      "select * from partner_client_confirmations where lead_id=$1 and owner_id=$2 and subject_key=$3 and channel in ('survey','wallet') and invalidated_at is null order by created_at desc,id desc limit 101",
      [lead.id, actor.userId, qualitySubject(lead)],
    )
  ).rows;
  return clientConfirmationsSchema.parse({
    truncated: rows.length > 100,
    items: rows.slice(0, 100).map((row) => ({
      id: row.id,
      channel: row.channel,
      facts: row.facts,
      comment: row.comment,
      createdAt: row.created_at.toISOString(),
    })),
  });
}
export function createConfirmationOperations(
  pool: Pool,
  transaction: EconomyMutation,
  access: Access,
) {
  async function leadAccess(tx: PoolClient, actor: PartnerActor, id: string) {
    const initial = await access(tx, actor, id);
    if (!initial.clientUserId) return initial;
    await lockContractSubject(tx, initial);
    const current = await access(tx, actor, id);
    if (actor.wallet && current.clientUserId !== actor.userId) fail("PARTNER_NOT_FOUND", 404);
    return current;
  }
  return {
    // The client's own statements about a request: never the declared state or the differences.
    walletConfirmations: (actor: PartnerActor, leadId: string) =>
      economyRead(pool, actor, async (tx) => {
        if (!actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
        const lead = await leadAccess(tx, actor, leadId);
        return ownConfirmations(tx, actor, lead);
      }),
    confirmFromWallet(
      actor: PartnerActor,
      leadId: string,
      raw: WalletConfirmationInput,
      key: string,
    ) {
      const input = walletConfirmationInputSchema.parse(raw);
      return transaction(
        actor,
        "quality.confirmation",
        key,
        { leadId, input },
        async (tx) => {
          if (!actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
          const lead = await leadAccess(tx, actor, leadId);
          if (lead.stage === "draft") fail("PARTNER_INVALID_TRANSITION");
          const recent = (
            await tx.query<{ count: number }>(
              "select count(*)::int count from partner_client_confirmations where lead_id=$1 and recorded_by=$2 and channel='wallet' and created_at>now()-interval '24 hours'",
              [leadId, actor.userId],
            )
          ).rows[0]!.count;
          if (recent >= walletDailyLimit) fail("PARTNER_RATE_LIMITED", 429);
          return recordConfirmation(tx, actor, lead, "wallet", input.facts, input.comment);
        },
        async (tx) => {
          const lead = await leadAccess(tx, actor, leadId);
          return ownConfirmations(tx, actor, lead);
        },
      );
    },
    // What the client said during a CoverView quality call or email (brief I.17.2).
    recordQualityContact(
      actor: PartnerActor,
      leadId: string,
      raw: QualityContactInput,
      key: string,
    ) {
      const input = qualityContactInputSchema.parse(raw);
      return transaction(
        actor,
        "quality.contact",
        key,
        { leadId, input },
        async (tx) => {
          if (!actor.administrator || actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
          const lead = await leadAccess(tx, actor, leadId);
          if (!lead.clientUserId) fail("PARTNER_INVALID_CLIENT");
          if (
            Date.parse(input.occurredAt) > Date.now() ||
            Date.parse(input.occurredAt) < lead.createdAt.getTime()
          )
            fail("PARTNER_ACTION_REQUIRED");
          return recordConfirmation(
            tx,
            actor,
            lead,
            input.channel,
            input.facts,
            input.note,
            input.occurredAt,
          );
        },
        async (tx, id) =>
          caseConfirmation(
            (
              await tx.query<ConfirmationRow>(
                "select * from partner_client_confirmations where id=$1",
                [id],
              )
            ).rows[0]!,
          ),
      );
    },
    // Every statement recorded on a request, for CoverView.
    leadConfirmations: (actor: PartnerActor, leadId: string) =>
      economyRead(pool, actor, async (tx) => {
        if (!actor.administrator || actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
        await leadAccess(tx, actor, leadId);
        const rows = (
          await tx.query<ConfirmationRow>(
            "select * from partner_client_confirmations where lead_id=$1 and invalidated_at is null order by created_at desc,id desc limit 20",
            [leadId],
          )
        ).rows;
        return z.object({ items: z.array(caseConfirmationSchema) }).parse({
          items: rows.map((row) => caseConfirmation(row)),
        });
      }),
  };
}
