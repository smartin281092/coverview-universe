import { createHash } from "node:crypto";
import type { Pool } from "pg";
import {
  dataErasureExecutionSchema,
  dataErasurePlanSchema,
  dataErasureSummarySchema,
  erasureHoldSchema,
  type DataErasurePlan,
} from "@coverview/contracts/partner-data";
import { fail, type Executor, type PartnerActor } from "./partner.policy.js";
import { administer, administeredRequest, requestTransactions } from "./partner.data-requests.js";

type Row = Record<string, unknown>;
// Free-text fields of an erased request hold a neutral marker instead of the client's words: the
// product is French-only so far, and client_erased_at is what states the erasure.
const erasedTitle = "Demande effacée",
  erasedClient = "Client effacé",
  erasedTask = "Tâche effacée",
  erasedPlace = "Lieu effacé",
  erasedEmail = "erased@coverview.invalid";
// Protected evidence an erasure leaves as it is, references to the account included, until a
// validated retention policy (S-131). Named in the plan so that nothing is kept without saying so.
const retained = [
  "journal_actions",
  "booking_proposals",
  "communications",
  "recordings_transcripts",
  "surveys_complaints",
  "complements",
  "recommendations",
  "professional_reviews",
  "matching",
  "source_documents",
];
const holds = erasureHoldSchema.options;

// The request's subject now: its requests not yet erased, each with what keeps or blocks it.
async function plan(db: Executor, request: Row, lock = false) {
  const requester = String(request.requester_id),
    profileId = (request.profile_id as string | null) ?? null;
  let blocked: DataErasurePlan["blocked"] = null;
  if (
    profileId &&
    !(
      await db.query("select 1 from managed_profiles where id=$1 and user_id=$2", [
        profileId,
        requester,
      ])
    ).rowCount
  )
    blocked = "subject_transferred";
  const rows = blocked
    ? []
    : (
        await db.query<Row>(
          `select l.id,l.title,l.category,l.created_at,l.revision,l.stage not in ('completed','draft') open,
            (exists(select 1 from partner_conclusions c where c.lead_id=l.id and (c.invalidated_at is null and c.withdrawn_at is null
              or exists(select 1 from partner_offer_signatures s where s.conclusion_id=c.id)))
             or exists(select 1 from partner_final_policies p where p.lead_id=l.id)) conclusion,
            exists(select 1 from partner_market_reservations r where r.lead_id=l.id) economy,
            exists(select 1 from partner_quality_cases q where q.lead_id=l.id and q.kind='complaint' and q.invalidated_at is null
              and not coalesce((select a.input->>'action'='close' from partner_quality_actions a where a.case_id=q.id
                and a.input->>'action'<>'reply' order by a.revision desc limit 1),false)) dispute,
            exists(select 1 from partner_evaluation_contests c where c.decision is null and (
              c.subject_kind='survey' and exists(select 1 from partner_surveys s where s.id=c.subject_id and s.lead_id=l.id)
              or c.subject_kind='quality_case' and exists(select 1 from partner_quality_cases q where q.id=c.subject_id and q.lead_id=l.id))) contest
           from partner_leads l
           where l.client_erased_at is null and ${profileId ? "l.client_profile_id=$1" : "l.client_profile_id is null and l.client_user_id=$1"}
           order by l.created_at,l.id limit 101 ${lock ? "for update of l" : ""}`,
          [profileId ?? requester],
        )
      ).rows;
  if (!blocked && rows.length > 100) blocked = "too_many";
  const leads = rows.slice(0, 100).map((row) => {
    const found = holds.filter((hold) => row[hold] === true);
    return {
      id: String(row.id),
      title: String(row.title),
      category: row.category,
      createdAt: (row.created_at as Date).toISOString(),
      status: row.open === true ? "open" : found.length ? "kept" : "erasable",
      holds: found,
      revision: Number(row.revision),
    };
  });
  if (!blocked && leads.some((lead) => lead.status === "open")) blocked = "open_requests";
  const basis = createHash("sha256")
    .update(
      JSON.stringify({
        request: request.id,
        blocked,
        leads: leads.map((lead) => [lead.id, lead.revision, lead.status, lead.holds]),
      }),
    )
    .digest("hex");
  return {
    leads,
    view: dataErasurePlanSchema.parse({
      requestId: request.id,
      requestRevision: request.revision,
      basis,
      blocked,
      leads,
      retained,
    }),
  };
}
function eligible(actor: PartnerActor, request: Row) {
  if (!actor.administrator || actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
  if (request.surface !== "wallet" || request.kind !== "erasure")
    fail("PARTNER_INVALID_TRANSITION", 422);
}

// Controlled erasure of a Wallet client's Partner data (brief I.20, C7c): previewed by the server,
// decided by an Admin under MFA with an attestation, executed in one transaction, never automatic.
export function createDataErasureOperations(pool: Pool) {
  const { command, read } = requestTransactions(pool);
  return {
    erasurePlan: (actor: PartnerActor, id: string) =>
      read(actor, async (tx) => {
        const request = await administeredRequest(tx, id);
        eligible(actor, request);
        return (await plan(tx, request)).view;
      }),
    executeErasure: (actor: PartnerActor, id: string, raw: unknown, key: string) => {
      const input = dataErasureExecutionSchema.parse(raw);
      return command(
        actor,
        "data_request.erasure",
        key,
        { id, ...input },
        async (tx) => {
          const request = await administeredRequest(tx, id, true);
          eligible(actor, request);
          if (request.revision !== input.revision) fail("PARTNER_CONFLICT", 409);
          if (!["received", "in_progress"].includes(String(request.state)))
            fail("PARTNER_INVALID_TRANSITION", 422);
          // The plan is recomputed on locked requests: what the Admin saw is what is erased.
          const current = await plan(tx, request, true);
          if (current.view.basis !== input.basis) fail("PARTNER_CONFLICT", 409);
          if (current.view.blocked) fail("PARTNER_ACTION_REQUIRED", 422);
          const ids = current.leads.filter((lead) => lead.status === "erasable").map((l) => l.id),
            kept = current.leads.filter((lead) => lead.status === "kept"),
            requester = String(request.requester_id),
            erased: Record<string, number> = {};
          const run = async (name: string, sql: string, values: unknown[]) => {
            erased[name] = (await tx.query(sql, values)).rowCount ?? 0;
          };
          // Only this transaction may replace an invitation's recipient (migration 0076).
          await tx.query("select set_config('coverview.partner_erasure',$1,true)", [id]);
          if (ids.length) {
            await run(
              "events",
              "update partner_events set text='' where lead_id=any($1) and text<>''",
              [ids],
            );
            await run(
              "tasks",
              "update partner_tasks set title=$2,description='' where lead_id=any($1)",
              [ids, erasedTask],
            );
            await run(
              "appointments",
              "update partner_appointments set location=$2 where lead_id=any($1) and location<>$2",
              [ids, erasedPlace],
            );
            await run(
              "insuranceSources",
              "update partner_insurance_sources set snapshot=jsonb_build_object('id',person_id,'profileId',profile_id) where lead_id=any($1)",
              [ids],
            );
            await run(
              "invitations",
              "update partner_client_invitations set email=$2 where lead_id=any($1) and email<>$2",
              [ids, erasedEmail],
            );
            await run(
              "preferences",
              "delete from partner_advice_preferences where lead_id=any($1)",
              [ids],
            );
            await tx.query(
              "delete from partner_notification_reads where notification_id in (select id from partner_notifications where lead_id=any($1) and (audience='wallet' or recipient_id=$2))",
              [ids, requester],
            );
            await run(
              "notifications",
              "delete from partner_notifications where lead_id=any($1) and (audience='wallet' or recipient_id=$2)",
              [ids, requester],
            );
            await run(
              "requests",
              `update partner_leads set title=$2,object='',client_name=$3,next_action='',
               details=jsonb_build_object('context','','email','','phone','','language','','source','','objectReference','',
                 'transmissionAuthorized',coalesce((details->>'transmissionAuthorized')::boolean,false)),
               client_user_id=null,client_profile_id=null,client_erased_at=clock_timestamp(),client_erasure_request_id=$4,
               revision=revision+1,updated_at=clock_timestamp() where id=any($1)`,
              [ids, erasedTitle, erasedClient, id],
            );
          }
          // The subject's referent choices go once nothing kept still concerns it.
          if (!kept.length)
            await run("referents", "delete from partner_referent_selections where subject_id=$1", [
              request.subject_key,
            ]);
          const executedAt = (await tx.query<{ at: Date }>("select clock_timestamp() at")).rows[0]!
            .at;
          const summary = dataErasureSummarySchema.parse({
            version: "partner-erasure-v1",
            executedAt: executedAt.toISOString(),
            erased,
            kept: kept.map((lead) => ({
              leadId: lead.id,
              category: lead.category,
              holds: lead.holds,
            })),
          });
          await tx.query(
            `update partner_data_requests set state='answered',outcome=$2,answer=$3,answered_by=$4,answered_at=clock_timestamp(),
             erasure=$5,revision=revision+1 where id=$1`,
            [
              id,
              kept.length ? "partially_done" : "done",
              input.answer,
              actor.userId,
              JSON.stringify(summary),
            ],
          );
          return id;
        },
        async (tx, target) => administer(await administeredRequest(tx, target)),
      );
    },
  };
}
