import type { Pool, PoolClient } from "pg";
import {
  complementAnswerInputSchema,
  complementCandidatesSchema,
  complementCloseInputSchema,
  complementRequestInputSchema,
  partnerComplementsSchema,
  walletComplementsSchema,
  type ComplementAnswerInput,
  type ComplementCloseInput,
  type ComplementRequest,
  type ComplementRequestInput,
} from "@coverview/contracts/partner-complements";
import {
  readCorrespondenceDocuments,
  retainContractReference,
} from "../document-intelligence/index.js";
import {
  economyCursor,
  economyNext,
  economyRead,
  type EconomyMutation,
} from "./partner.commercial.js";
import { lockContractSubject, readCurrentContract } from "./partner.contract.js";
import { authorityCurrent, fail, managed, type PartnerActor } from "./partner.policy.js";
import { event, newId } from "./partner.audit.js";
import { readAnalysis } from "./partner.recommendations.js";
import type { partnerLeads } from "./partner.schema.js";
import copy from "./partner.complements.fr.json" with { type: "json" };

type Lead = typeof partnerLeads.$inferSelect;
type Access = (tx: PoolClient, actor: PartnerActor, id: string) => Promise<Lead>;
type Row = {
  id: string;
  owner_id: string;
  subject_key: string;
  items: ComplementRequest["items"];
  message: string;
  due_at: Date;
  pause_follow_up: boolean;
  created_at: Date;
  requester_name: string | null;
  answer_text: string | null;
  answer_documents: { documentId: string; fingerprint: string }[] | null;
  answered_at: Date | null;
  outcome: "completed" | "unanswered" | "withdrawn" | null;
  close_note: string | null;
  closed_at: Date | null;
};
const subject = (lead: { clientUserId: string | null; clientProfileId: string | null }) =>
  lead.clientProfileId ? `profile:${lead.clientProfileId}` : `self:${lead.clientUserId}`;
const select = `select r.*,m.application->>'name' requester_name,a.text answer_text,a.documents answer_documents,
  a.created_at answered_at,c.outcome,c.note close_note,c.created_at closed_at
  from partner_complement_requests r left join partner_members m on m.user_id=r.requested_by
  left join partner_complement_answers a on a.request_id=r.id
  left join partner_complement_closures c on c.request_id=r.id`;
// Only one request waits at a time; a new one follows its closure.
const pending = `r.invalidated_at is null and not exists(select 1 from partner_complement_closures c where c.request_id=r.id)`;
const state = (row: Row) => (row.closed_at ? "closed" : row.answered_at ? "answered" : "open");
const day = 86400000;

// Who asks the client for a complement: the responsible who accepted the request, a contributor
// with advice, edit and contact rights, or the manager of the responsible's organisation.
async function mayAsk(tx: PoolClient, actor: PartnerActor, leadId: string) {
  if (actor.wallet || actor.administrator) return false;
  return !!(
    await tx.query(
      `select 1 from partner_leads l where l.id=$2 and (
        (l.responsible_id=$1 and l.assignment='accepted' and ${authorityCurrent("l")})
        or exists(select 1 from partner_contributors c where c.lead_id=l.id and c.user_id=$1 and c.revoked_at is null
          and c.access_scope='advice' and c.can_edit and c.can_contact and ${authorityCurrent("c")})
        or ${managed})`,
      [actor.userId, leadId],
    )
  ).rowCount;
}

export function createComplementOperations(
  pool: Pool,
  transaction: EconomyMutation,
  access: Access,
) {
  async function leadAccess(tx: PoolClient, actor: PartnerActor, id: string) {
    const initial = await access(tx, actor, id);
    if (!initial.clientUserId) {
      if (actor.wallet) fail("PARTNER_NOT_FOUND", 404);
      return initial;
    }
    const lead = { ...initial, ...(await lockContractSubject(tx, initial)) };
    if (actor.wallet && (actor.administrator || actor.userId !== lead.clientUserId))
      fail("PARTNER_NOT_FOUND", 404);
    return lead;
  }
  // The requests of the request's current subject, newest first.
  async function rows(tx: PoolClient, lead: Lead, id?: string) {
    if (!lead.clientUserId) return [];
    return (
      await tx.query<Row>(
        `${select} where r.lead_id=$1 and r.owner_id=$2 and r.subject_key=$3 and r.invalidated_at is null
         and ($4::text is null or r.id=$4) order by r.created_at desc,r.id desc limit 21`,
        [lead.id, lead.clientUserId, subject(lead), id ?? null],
      )
    ).rows;
  }
  async function project(tx: PoolClient, actor: PartnerActor, lead: Lead, list: Row[]) {
    const current = lead.clientUserId ? await readCurrentContract(tx, lead) : null;
    const canClose = !actor.wallet && (await mayAsk(tx, actor, lead.id));
    const open = !["draft", "completed"].includes(lead.stage);
    const items = [];
    for (const row of list) {
      const documents = [];
      for (const shared of row.answer_documents ?? []) {
        const source = (
          await readCorrespondenceDocuments(tx, lead.clientUserId!, lead.clientProfileId, {
            documentId: shared.documentId,
          })
        ).entries[0];
        const same = !!source && source.source.fingerprint === shared.fingerprint;
        documents.push({
          documentId: shared.documentId,
          name: same ? source.name : null,
          current: same,
          canDownload: same,
        });
      }
      const status = state(row);
      items.push({
        id: row.id,
        items: row.items,
        message: row.message,
        dueAt: row.due_at.toISOString(),
        overdue: status === "open" && row.due_at.getTime() < Date.now(),
        pauseFollowUp: row.pause_follow_up,
        state: status,
        requestedBy: row.requester_name ?? "",
        createdAt: row.created_at.toISOString(),
        answer: row.answered_at
          ? { text: row.answer_text ?? "", documents, answeredAt: row.answered_at.toISOString() }
          : null,
        referenceConfirmedAt:
          current && Date.parse(current.confirmedAt) > row.created_at.getTime()
            ? current.confirmedAt
            : null,
        // The closing note stays with the professionals; the client reads the outcome.
        closure: row.closed_at
          ? {
              outcome: row.outcome!,
              note: actor.wallet ? "" : (row.close_note ?? ""),
              closedAt: row.closed_at.toISOString(),
            }
          : null,
        canAnswer: !!actor.wallet && status === "open" && open,
        canClose: canClose && status !== "closed",
      });
    }
    return items;
  }
  async function partnerView(tx: PoolClient, actor: PartnerActor, id: string) {
    if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
    const lead = await leadAccess(tx, actor, id);
    const list = (await rows(tx, lead)).slice(0, 20);
    return partnerComplementsSchema.parse({
      gaps: await readAnalysis(tx, lead),
      canRequest:
        !!lead.clientUserId &&
        !["draft", "completed"].includes(lead.stage) &&
        !list.some((row) => state(row) !== "closed") &&
        (await mayAsk(tx, actor, lead.id)),
      items: await project(tx, actor, lead, list),
    });
  }
  async function walletView(tx: PoolClient, actor: PartnerActor, id: string) {
    if (!actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
    const lead = await leadAccess(tx, actor, id);
    const list = await rows(tx, lead);
    return walletComplementsSchema.parse({
      items: await project(tx, actor, lead, list.slice(0, 20)),
      truncated: list.length > 20,
    });
  }
  async function lockRequest(tx: PoolClient, lead: Lead, requestId: string) {
    await tx.query(
      "select id from partner_complement_requests where id=$1 and lead_id=$2 for update",
      [requestId, lead.id],
    );
    const row = (await rows(tx, lead, requestId))[0];
    if (!row) return fail("PARTNER_NOT_FOUND", 404);
    return row;
  }
  async function touch(tx: PoolClient, leadId: string) {
    await tx.query(
      "update partner_leads set revision=revision+1,updated_at=clock_timestamp() where id=$1",
      [leadId],
    );
  }
  return {
    partnerComplements: (actor: PartnerActor, id: string) =>
      economyRead(pool, actor, (tx) => partnerView(tx, actor, id)),
    walletComplements: (actor: PartnerActor, id: string) =>
      economyRead(pool, actor, (tx) => walletView(tx, actor, id)),
    // The professional asks the client what the analysis lacks on the client's side.
    requestComplement(actor: PartnerActor, id: string, raw: ComplementRequestInput, key: string) {
      const input = complementRequestInputSchema.parse(raw);
      return transaction(
        actor,
        "complement.request",
        key,
        { id, input },
        async (tx) => {
          if (actor.wallet || actor.administrator) fail("PARTNER_ACCESS_DENIED", 403);
          const lead = await leadAccess(tx, actor, id);
          if (!lead.clientUserId) fail("PARTNER_INVALID_CLIENT");
          if (["draft", "completed"].includes(lead.stage)) fail("PARTNER_INVALID_TRANSITION");
          if (!(await mayAsk(tx, actor, id))) fail("PARTNER_ACCESS_DENIED", 403);
          const due = Date.parse(input.dueAt);
          if (due <= Date.now() + 3600000 || due > Date.now() + 30 * day)
            fail("PARTNER_ACTION_REQUIRED");
          if (
            (
              await tx.query(
                `select 1 from partner_complement_requests r where r.lead_id=$1 and ${pending}`,
                [id],
              )
            ).rowCount
          )
            fail("PARTNER_CONFLICT", 409);
          const requestId = newId("pcr");
          const dueAt = new Date(due).toISOString();
          await tx.query(
            `insert into partner_complement_requests(id,lead_id,subject_key,owner_id,requested_by,items,message,due_at,pause_follow_up)
             values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [
              requestId,
              id,
              subject(lead),
              lead.clientUserId,
              actor.userId,
              JSON.stringify(input.items),
              input.message,
              dueAt,
              input.pauseFollowUp,
            ],
          );
          await tx.query(
            "insert into partner_notifications(id,lead_id,recipient_id,audience,kind,dedupe_key,action,priority,due_at) values($1,$2,$3,'wallet','complement.requested',$4,'complement','normal',$5) on conflict(dedupe_key) do nothing",
            [newId("pn"), id, lead.clientUserId, `complement:${requestId}:wallet`, dueAt],
          );
          // The usual waiting state carries the suspension; the professional resumes it as usual.
          if (input.pauseFollowUp) {
            await tx.query("update partner_leads set waiting=$2 where id=$1", [
              id,
              JSON.stringify({ reason: copy.waitingReason, until: dueAt }),
            ]);
            await event(tx, actor, id, "lead.waiting", copy.waitingReason);
          }
          await event(tx, actor, id, "complement.requested.v1", "", "client", requestId);
          await touch(tx, id);
          return id;
        },
        (tx) => partnerView(tx, actor, id),
      );
    },
    // The client answers once: a text, documents of their space, or both.
    answerComplement(
      actor: PartnerActor,
      id: string,
      requestId: string,
      raw: ComplementAnswerInput,
      key: string,
    ) {
      const input = complementAnswerInputSchema.parse(raw);
      return transaction(
        actor,
        "complement.answer",
        key,
        { id, requestId, input },
        async (tx) => {
          if (!actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
          const lead = await leadAccess(tx, actor, id);
          if (["draft", "completed"].includes(lead.stage)) fail("PARTNER_INVALID_TRANSITION");
          const row = await lockRequest(tx, lead, requestId);
          if (state(row) !== "open") fail("PARTNER_CONFLICT", 409);
          for (const shared of input.documents) {
            const source = (
              await readCorrespondenceDocuments(tx, lead.clientUserId!, lead.clientProfileId, {
                documentId: shared.documentId,
                lock: true,
              })
            ).entries[0];
            if (!source || source.source.fingerprint !== shared.fingerprint)
              fail("PARTNER_INVALID_DOCUMENT");
            // Shared as it is: the original stays in the client's space and cannot be removed.
            await retainContractReference(tx, shared.documentId);
          }
          await tx.query(
            "insert into partner_complement_answers(request_id,answered_by,text,documents) values($1,$2,$3,$4)",
            [requestId, actor.userId, input.text, JSON.stringify(input.documents)],
          );
          await tx.query(
            "update partner_notifications set resolved_at=now() where dedupe_key=$1 and resolved_at is null",
            [`complement:${requestId}:wallet`],
          );
          await tx.query(
            "insert into partner_notifications(id,lead_id,recipient_id,audience,kind,dedupe_key,action,priority) values($1,$2,$3,$4,'complement.answered',$5,'review_complement','normal') on conflict(dedupe_key) do nothing",
            [
              newId("pn"),
              id,
              lead.responsibleId,
              lead.responsibleId ? "partner" : "coverview",
              `complement:${requestId}:answered`,
            ],
          );
          await event(tx, actor, id, "complement.answered.v1", "", "client", requestId);
          await touch(tx, id);
          return id;
        },
        (tx) => walletView(tx, actor, id),
      );
    },
    // The professional closes the request: processed, unanswered after the due date, or withdrawn.
    closeComplement(
      actor: PartnerActor,
      id: string,
      requestId: string,
      raw: ComplementCloseInput,
      key: string,
    ) {
      const input = complementCloseInputSchema.parse(raw);
      return transaction(
        actor,
        "complement.close",
        key,
        { id, requestId, input },
        async (tx) => {
          if (actor.wallet || actor.administrator) fail("PARTNER_ACCESS_DENIED", 403);
          const lead = await leadAccess(tx, actor, id);
          if (!(await mayAsk(tx, actor, id))) fail("PARTNER_ACCESS_DENIED", 403);
          const row = await lockRequest(tx, lead, requestId);
          const status = state(row);
          if (
            status === "closed" ||
            (input.outcome === "completed") !== (status === "answered") ||
            (input.outcome === "unanswered" && row.due_at.getTime() > Date.now())
          )
            fail("PARTNER_INVALID_TRANSITION");
          await tx.query(
            "insert into partner_complement_closures(request_id,closed_by,outcome,note) values($1,$2,$3,$4)",
            [requestId, actor.userId, input.outcome, input.note],
          );
          await tx.query(
            "update partner_notifications set resolved_at=now() where left(dedupe_key,length($1))=$1 and resolved_at is null",
            [`complement:${requestId}:`],
          );
          await event(tx, actor, id, "complement.closed.v1", "", "client", requestId);
          await touch(tx, id);
          return id;
        },
        (tx) => partnerView(tx, actor, id),
      );
    },
    // Documents of the client's space that can answer a request.
    complementCandidates: (actor: PartnerActor, id: string, cursor?: string) =>
      economyRead(pool, actor, async (tx) => {
        if (!actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
        const lead = await leadAccess(tx, actor, id);
        const { rows: found, entries } = await readCorrespondenceDocuments(
          tx,
          lead.clientUserId!,
          lead.clientProfileId,
          { after: economyCursor(cursor) },
        );
        return complementCandidatesSchema.parse({
          items: entries.map((entry) => ({
            documentId: entry.documentId,
            name: entry.name,
            fingerprint: entry.source.fingerprint,
          })),
          nextCursor:
            found.length > 20
              ? economyNext({
                  id: String(found[19]!.id),
                  created_at: found[19]!.created_at as Date,
                })
              : null,
        });
      }),
    // A shared document, as long as the client's space still holds that exact version.
    complementSource: (
      actor: PartnerActor,
      id: string,
      requestId: string,
      documentId: string,
      record = false,
    ) =>
      economyRead(pool, actor, async (tx) => {
        const lead = await leadAccess(tx, actor, id);
        const row = (await rows(tx, lead, requestId))[0];
        const shared = row?.answer_documents?.find((item) => item.documentId === documentId);
        if (!shared || !lead.clientUserId) return fail("PARTNER_NOT_FOUND", 404);
        const source = (
          await readCorrespondenceDocuments(tx, lead.clientUserId, lead.clientProfileId, {
            documentId,
            lock: true,
          })
        ).entries[0];
        if (!source || source.source.fingerprint !== shared.fingerprint)
          return fail("PARTNER_NOT_FOUND", 404);
        if (
          record &&
          !(
            await tx.query(
              `select id from partner_events where lead_id=$1 and actor_id=$2 and subject_id=$3
               and kind='complement.document_viewed.v1' and created_at>now()-interval '30 minutes' limit 1`,
              [id, actor.userId, requestId],
            )
          ).rowCount
        )
          await event(tx, actor, id, "complement.document_viewed.v1", "", "private", requestId);
        return documentId;
      }),
  };
}
