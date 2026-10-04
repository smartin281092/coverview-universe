import type { PoolClient } from "pg";
import { z } from "zod";
import { leadOfferInputSchema, type LeadCommand } from "@coverview/contracts/partner";
import type { partnerLeads } from "./partner.schema.js";
import { fail, membership, type PartnerActor } from "./partner.policy.js";
import { event, newId } from "./partner.audit.js";
import { retainLeadSource } from "../document-intelligence/index.js";
type LeadRow = typeof partnerLeads.$inferSelect;

async function requireAssignee(tx: PoolClient, lead: LeadRow, userId: string, actor: PartnerActor) {
  if (actor.administrator && userId === actor.userId) return;
  const person = await membership(tx, userId, true);
  if (
    !person ||
    person.state !== "approved" ||
    person.organizationState !== "approved" ||
    !person.grantedRoles.includes("advisor") ||
    !person.categories.includes(lead.category as (typeof person.categories)[number]) ||
    (person.reviewDueAt && new Date(person.reviewDueAt).getTime() <= Date.now())
  )
    fail("PARTNER_INVALID_ASSIGNEE");
}
async function requireParticipant(
  tx: PoolClient,
  lead: LeadRow,
  userId: string,
  actor: PartnerActor,
) {
  if (userId === lead.responsibleId || (userId === actor.userId && actor.administrator)) return;
  const participant = await tx.query<Record<string, unknown>>(
    "select id from partner_contributors where lead_id=$1 and user_id=$2 and revoked_at is null",
    [lead.id, userId],
  );
  if (!participant.rowCount) fail("PARTNER_INVALID_ASSIGNEE");
}
async function changeStage(tx: PoolClient, lead: LeadRow, stage: string) {
  await tx.query<Record<string, unknown>>(
    "update partner_leads set stage=$2,stage_changed_at=case when stage=$2 then stage_changed_at else now() end where id=$1",
    [lead.id, stage],
  );
}
async function getOffer(tx: PoolClient, lead: LeadRow, id: string) {
  const offer = (
    await tx.query<Record<string, unknown>>(
      "select * from partner_offers where id=$1 and lead_id=$2 for update",
      [id, lead.id],
    )
  ).rows[0];
  if (!offer) return fail("PARTNER_NOT_FOUND", 404);
  return {
    id: String(offer.id),
    active: offer.active === true,
    state: String(offer.state),
    version: Number(offer.version),
    family_id: String(offer.family_id),
    published_at: offer.published_at,
    reviewed_at: offer.reviewed_at,
    content: leadOfferInputSchema.parse(offer.data),
  };
}
async function availableSource(tx: PoolClient, documentId: string) {
  const row = (
    await tx.query<Record<string, unknown>>(
      "select id from files where id=$1 and deleted_at is null and scan_version is not null and state in ('ready','failed') for share",
      [documentId],
    )
  ).rows[0];
  if (!row) fail("PARTNER_INVALID_DOCUMENT");
}
export async function handoffWork(
  tx: PoolClient,
  actor: PartnerActor,
  leadId: string,
  responsibleId: string | null,
) {
  // Future commitments cannot stay assigned to an intervenant who no longer has access.
  const remainingParticipant =
    "exists(select 1 from partner_contributors pc where pc.lead_id=$1 and pc.user_id=a.advisor_id and pc.revoked_at is null)";
  const cancelled = await tx.query(
    `update partner_appointments a set state='cancelled' where lead_id=$1 and state='scheduled' and starts_at>now() and advisor_id is distinct from $2 and not ${remainingParticipant}`,
    [leadId, responsibleId],
  );
  if (responsibleId)
    await tx.query(
      "update partner_tasks t set responsible_id=$2 where lead_id=$1 and state='open' and responsible_id<>$2 and not exists(select 1 from partner_contributors pc where pc.lead_id=$1 and pc.user_id=t.responsible_id and pc.revoked_at is null)",
      [leadId, responsibleId],
    );
  if (cancelled.rowCount) {
    await tx.query(
      "update partner_leads set stage='appointment_needed',stage_changed_at=now(),next_action='Replanifier le rendez-vous avec le client' where id=$1 and stage='appointment_scheduled' and not exists(select 1 from partner_appointments where lead_id=$1 and state='scheduled' and starts_at>now())",
      [leadId],
    );
    await event(
      tx,
      actor,
      leadId,
      "appointment.cancelled",
      "Le rendez-vous avec l’intervenant sortant doit être replanifié. CoverView suit la reprise du dossier.",
      "client",
    );
  }
}
export async function executeLeadCommand(
  tx: PoolClient,
  actor: PartnerActor,
  lead: LeadRow,
  input: LeadCommand,
) {
  const id = lead.id;
  if (lead.stage === "draft" && !["edit", "note"].includes(input.action))
    fail("PARTNER_ACTION_REQUIRED");
  if (
    lead.stage === "completed" &&
    !["note", "task_state", "task", "offer_withdraw"].includes(input.action)
  )
    fail("PARTNER_INVALID_TRANSITION");
  switch (input.action) {
    case "edit": {
      const data = input.lead;
      if (lead.stage !== "draft" && data.draft) fail("PARTNER_INVALID_TRANSITION");
      if (!data.draft && (!data.transmissionAuthorized || !data.nextAction || !data.dueAt))
        fail("PARTNER_ACTION_REQUIRED");
      const relink =
        data.clientUserId !== lead.clientUserId || data.clientProfileId !== lead.clientProfileId;
      if (
        (data.category !== lead.category || data.object !== lead.object) &&
        (await tx.query("select id from partner_offers where lead_id=$1 limit 1", [id])).rowCount
      )
        fail("PARTNER_INVALID_TRANSITION");
      if (data.category !== lead.category && lead.responsibleId)
        await requireAssignee(tx, { ...lead, category: data.category }, lead.responsibleId, actor);
      if (relink && !actor.administrator) fail("PARTNER_ACCESS_DENIED", 403);
      if (
        relink &&
        (
          await tx.query<Record<string, unknown>>(
            "select id from partner_offers where lead_id=$1 and published_at is not null limit 1",
            [id],
          )
        ).rowCount
      )
        fail("PARTNER_INVALID_TRANSITION");
      let clientName = data.clientName;
      if (data.clientProfileId && !data.clientUserId) fail("PARTNER_INVALID_CLIENT");
      if (data.clientUserId) {
        const profile = data.clientProfileId
          ? await tx.query<Record<string, unknown>>(
              "select display_name from managed_profiles where id=$1 and user_id=$2 for share",
              [data.clientProfileId, data.clientUserId],
            )
          : await tx.query<Record<string, unknown>>(
              "select user_id from identity_profiles where user_id=$1 for share",
              [data.clientUserId],
            );
        if (!profile.rowCount) fail("PARTNER_INVALID_CLIENT");
        if (data.clientProfileId) clientName = String(profile.rows[0]?.display_name);
      }
      await tx.query<Record<string, unknown>>(
        "update partner_leads set title=$2,category=$3,object=$4,client_name=$5,client_user_id=$6,client_profile_id=$7,details=$8,priority=$9,next_action=$10,due_at=$11 where id=$1",
        [
          id,
          data.title,
          data.category,
          data.object,
          clientName,
          data.clientUserId,
          data.clientProfileId,
          JSON.stringify({
            context: data.context,
            email: data.email,
            phone: data.phone,
            language: data.language,
            source: data.source,
            transmissionAuthorized: data.transmissionAuthorized,
          }),
          data.priority,
          data.nextAction,
          data.dueAt,
        ],
      );
      if (lead.stage === "draft" && !data.draft) {
        await changeStage(tx, lead, "new");
        await tx.query<Record<string, unknown>>(
          "update partner_leads set notified_at=case when responsible_id is null then null else now() end where id=$1",
          [id],
        );
      }
      await event(tx, actor, id, "lead.updated", data.title, relink ? "coverview" : "assigned");
      break;
    }
    case "next_action":
      await tx.query<Record<string, unknown>>(
        "update partner_leads set next_action=$2,due_at=$3,waiting=null where id=$1",
        [id, input.title, input.dueAt],
      );
      await event(tx, actor, id, "lead.next_action", input.title);
      break;
    case "contact":
      await tx.query<Record<string, unknown>>(
        "update partner_leads set first_useful_at=coalesce(first_useful_at,now()),next_action=$2,due_at=$3,waiting=null where id=$1",
        [id, input.nextAction, input.dueAt],
      );
      if (
        input.outcome === "reached" &&
        ["new", "qualifying", "ready_to_assign", "to_contact"].includes(lead.stage)
      )
        await changeStage(tx, lead, "contacted");
      await event(tx, actor, id, `contact.${input.outcome}`, input.note);
      break;
    case "note":
      if (input.audience === "coverview" && !actor.administrator)
        fail("PARTNER_ACCESS_DENIED", 403);
      await event(tx, actor, id, "lead.note", input.text, input.audience);
      break;
    case "task": {
      await requireParticipant(tx, lead, input.task.responsibleId, actor);
      if (input.task.reminderAt && new Date(input.task.reminderAt) > new Date(input.task.dueAt))
        fail("PARTNER_ACTION_REQUIRED");
      const task = input.task;
      await tx.query<Record<string, unknown>>(
        "insert into partner_tasks(id,lead_id,responsible_id,title,description,due_at,priority,reminder_at) values($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          newId("task"),
          id,
          task.responsibleId,
          task.title,
          task.description,
          task.dueAt,
          task.priority,
          task.reminderAt,
        ],
      );
      await event(tx, actor, id, "task.created", task.title);
      break;
    }
    case "task_state": {
      const task = (
        await tx.query<Record<string, unknown>>(
          "update partner_tasks set state=$3,completed_at=case when $3='done' then now() else null end where id=$1 and lead_id=$2 returning title",
          [input.taskId, id, input.state],
        )
      ).rows[0];
      if (!task) fail("PARTNER_NOT_FOUND", 404);
      await event(tx, actor, id, `task.${input.state}`, String(task.title));
      break;
    }
    case "appointment": {
      const appt = input.appointment;
      await requireParticipant(tx, lead, appt.advisorId, actor);
      await requireAssignee(tx, lead, appt.advisorId, actor);
      if (new Date(appt.startsAt).getTime() <= Date.now()) fail("PARTNER_ACTION_REQUIRED");
      // Serialize the advisor's schedule across Leads, including simultaneous requests.
      await tx.query<Record<string, unknown>>(
        "select pg_advisory_xact_lock(hashtextextended($1,1))",
        [appt.advisorId],
      );
      const conflict = await tx.query<Record<string, unknown>>(
        "select id from partner_appointments where advisor_id=$1 and state='scheduled' and starts_at < $2::timestamptz + $3 * interval '1 minute' and starts_at + duration_minutes * interval '1 minute' > $2::timestamptz limit 1",
        [appt.advisorId, appt.startsAt, appt.durationMinutes],
      );
      if (conflict.rowCount) fail("PARTNER_APPOINTMENT_CONFLICT", 409);
      await tx.query<Record<string, unknown>>(
        "insert into partner_appointments(id,lead_id,advisor_id,starts_at,duration_minutes,mode,location,timezone) values($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          newId("appt"),
          id,
          appt.advisorId,
          appt.startsAt,
          appt.durationMinutes,
          appt.mode,
          appt.location,
          appt.timezone,
        ],
      );
      await changeStage(tx, lead, "appointment_scheduled");
      await tx.query<Record<string, unknown>>(
        "update partner_leads set first_useful_at=coalesce(first_useful_at,now()),next_action='Tenir le rendez-vous convenu',due_at=$2,waiting=null where id=$1",
        [id, appt.startsAt],
      );
      await event(
        tx,
        actor,
        id,
        "appointment.scheduled",
        `${appt.startsAt} · ${appt.mode}`,
        "client",
      );
      break;
    }
    case "appointment_state": {
      const appt = (
        await tx.query<Record<string, unknown>>(
          "select * from partner_appointments where id=$1 and lead_id=$2 for update",
          [input.appointmentId, id],
        )
      ).rows[0];
      if (!appt || appt.state !== "scheduled") fail("PARTNER_INVALID_TRANSITION");
      if (input.state === "completed" && (appt.starts_at as Date).getTime() > Date.now())
        fail("PARTNER_INVALID_TRANSITION");
      await tx.query<Record<string, unknown>>(
        "update partner_appointments set state=$2 where id=$1",
        [input.appointmentId, input.state],
      );
      if (input.state === "completed") await changeStage(tx, lead, "appointment_completed");
      else if (lead.stage === "appointment_scheduled")
        await changeStage(tx, lead, "appointment_needed");
      await event(tx, actor, id, `appointment.${input.state}`, input.note, "client");
      break;
    }
    case "assign": {
      if (!actor.administrator) fail("PARTNER_ACCESS_DENIED", 403);
      await requireAssignee(tx, lead, input.responsibleId, actor);
      const details = z.object({ transmissionAuthorized: z.boolean() }).parse(lead.details);
      if (!details.transmissionAuthorized || !lead.title || !lead.nextAction || !lead.dueAt)
        fail("PARTNER_ACTION_REQUIRED");
      if (input.responsibleId === lead.responsibleId) fail("PARTNER_CONFLICT", 409);
      await tx.query<Record<string, unknown>>(
        "update partner_leads set responsible_id=$2,assignment='proposed',notified_at=now(),first_useful_at=null where id=$1",
        [id, input.responsibleId],
      );
      await tx.query<Record<string, unknown>>(
        "update partner_contributors set revoked_at=now() where lead_id=$1 and user_id=$2 and revoked_at is null",
        [id, lead.responsibleId],
      );
      await handoffWork(tx, actor, id, input.responsibleId);
      await event(tx, actor, id, "lead.assigned", input.reason, "client", input.responsibleId);
      break;
    }
    case "accept":
      if (lead.responsibleId !== actor.userId || lead.assignment !== "proposed")
        fail("PARTNER_INVALID_TRANSITION");
      await tx.query<Record<string, unknown>>(
        "update partner_leads set assignment='accepted' where id=$1",
        [id],
      );
      await event(tx, actor, id, "lead.accepted", "", "client");
      break;
    case "wait":
      if (input.waiting && new Date(input.waiting.until).getTime() <= Date.now())
        fail("PARTNER_ACTION_REQUIRED");
      await tx.query<Record<string, unknown>>("update partner_leads set waiting=$2 where id=$1", [
        id,
        input.waiting ? JSON.stringify(input.waiting) : null,
      ]);
      await event(
        tx,
        actor,
        id,
        input.waiting ? "lead.waiting" : "lead.resumed",
        input.waiting?.reason ?? "",
      );
      break;
    case "close": {
      const result =
        input.reason === "current_suitable" ? "resolved_without_contract" : input.result;
      if (result === "contract" && lead.stage !== "contract_issued")
        fail("PARTNER_INVALID_TRANSITION");
      if (input.reason === "client_refusal" && result !== "client_refusal")
        fail("PARTNER_INVALID_TRANSITION");
      await tx.query<Record<string, unknown>>(
        "update partner_leads set stage='completed',stage_changed_at=now(),result=$2,reason=$3,next_action='',due_at=null,waiting=null where id=$1",
        [id, result, input.reason],
      );
      if (result !== "contract") {
        await tx.query<Record<string, unknown>>(
          "update partner_tasks set state='cancelled' where lead_id=$1 and state='open'",
          [id],
        );
        await tx.query<Record<string, unknown>>(
          "update partner_appointments set state='cancelled' where lead_id=$1 and state='scheduled' and starts_at>now()",
          [id],
        );
      }
      await event(tx, actor, id, "lead.closed", input.comment, "client");
      break;
    }
    case "transition": {
      if (
        ["draft", "completed", "signed", "signing", "contract_issued", "awaiting_insurer"].includes(
          input.stage,
        )
      )
        fail("PARTNER_ACTION_REQUIRED");
      if (!lead.responsibleId || !lead.nextAction || !lead.dueAt) fail("PARTNER_ACTION_REQUIRED");
      if (input.stage === "appointment_scheduled" || input.stage === "appointment_completed") {
        const appt = await tx.query<Record<string, unknown>>(
          "select id from partner_appointments where id=$1 and lead_id=$2 and state=$3",
          [
            input.appointmentId ?? "",
            id,
            input.stage === "appointment_scheduled" ? "scheduled" : "completed",
          ],
        );
        if (!appt.rowCount) fail("PARTNER_ACTION_REQUIRED");
      }
      if (["offer_received", "offer_presented", "client_decision"].includes(input.stage)) {
        const offer = await getOffer(tx, lead, input.offerId ?? "");
        if (!offer.active || (input.stage !== "offer_received" && !offer.published_at))
          fail("PARTNER_ACTION_REQUIRED");
      }
      await changeStage(tx, lead, input.stage);
      await event(tx, actor, id, "lead.stage_changed", input.stage, "client");
      break;
    }
    case "offer": {
      const offer = input.offer;
      const previous = offer.replacesId ? await getOffer(tx, lead, offer.replacesId) : null;
      if (
        !(await retainLeadSource(
          tx,
          offer.documentId,
          actor,
          {
            userId: lead.clientUserId,
            profileId: lead.clientProfileId,
          },
          previous?.content.documentId === offer.documentId,
        ))
      )
        fail("PARTNER_INVALID_DOCUMENT");
      let version = 1;
      const offerId = newId("offer");
      let familyId = offerId;
      if (previous) {
        if (!previous.active || previous.state === "signed") fail("PARTNER_INVALID_TRANSITION");
        version = Number(previous.version) + 1;
        familyId = String(previous.family_id);
        await tx.query<Record<string, unknown>>(
          "update partner_offers set active=false,state='replaced' where id=$1",
          [offer.replacesId],
        );
      }
      await tx.query<Record<string, unknown>>(
        "insert into partner_offers(id,lead_id,document_id,data,version,family_id) values($1,$2,$3,$4,$5,$6)",
        [offerId, id, offer.documentId, JSON.stringify(offer), version, familyId],
      );
      await event(tx, actor, id, "offer.received", `${offer.company} · ${offer.product}`);
      break;
    }
    case "offer_review": {
      const offer = await getOffer(tx, lead, input.offerId);
      if (!offer.active || !["received", "to_verify", "ready"].includes(String(offer.state)))
        fail("PARTNER_INVALID_TRANSITION");
      await availableSource(tx, offer.content.documentId);
      if (
        offer.content.features.some(
          (f) =>
            f.verification === "to_verify" || (f.verification === "verified" && !f.source.trim()),
        ) ||
        offer.content.annualPremiumMinor === null
      )
        fail("PARTNER_OFFER_NOT_READY");
      await tx.query<Record<string, unknown>>(
        "update partner_offers set reviewed_at=now(),state='ready' where id=$1",
        [input.offerId],
      );
      await event(tx, actor, id, "offer.reviewed", offer.content.company);
      break;
    }
    case "offer_publish": {
      const offer = await getOffer(tx, lead, input.offerId);
      if (!lead.clientUserId || !offer.active || !offer.reviewed_at || offer.state !== "ready")
        fail("PARTNER_OFFER_NOT_READY");
      if (offer.content.validUntil && new Date(offer.content.validUntil).getTime() <= Date.now())
        fail("PARTNER_OFFER_EXPIRED");
      await availableSource(tx, offer.content.documentId);
      await tx.query<Record<string, unknown>>(
        "update partner_offers set published_at=now(),state='published' where id=$1",
        [input.offerId],
      );
      if (!["signing", "signed", "awaiting_insurer", "contract_issued"].includes(lead.stage))
        await changeStage(tx, lead, "offer_presented");
      await event(
        tx,
        actor,
        id,
        "offer.published",
        `${offer.content.company} · ${offer.content.product}`,
        "client",
      );
      break;
    }
    case "offer_withdraw": {
      const offer = await getOffer(tx, lead, input.offerId);
      if (offer.state === "signed") fail("PARTNER_INVALID_TRANSITION");
      await tx.query<Record<string, unknown>>(
        "update partner_offers set state='cancelled',active=false where id=$1",
        [input.offerId],
      );
      await event(
        tx,
        actor,
        id,
        "offer.withdrawn",
        input.reason,
        offer.published_at ? "client" : "assigned",
      );
      break;
    }
    case "client_choice": {
      if (!actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
      if (input.choice === "keep_current") {
        await tx.query<Record<string, unknown>>(
          "update partner_offers set state='viewed' where lead_id=$1 and state='selected'",
          [id],
        );
        await changeStage(tx, lead, "client_decision");
        await event(tx, actor, id, "client.keep_current", input.text, "client");
        break;
      }
      const offer = await getOffer(tx, lead, input.offerId ?? "");
      if (
        !offer.published_at ||
        !offer.active ||
        ["cancelled", "replaced", "signed", "refused"].includes(String(offer.state))
      )
        fail("PARTNER_INVALID_TRANSITION");
      if (offer.content.validUntil && new Date(offer.content.validUntil).getTime() <= Date.now())
        fail("PARTNER_OFFER_EXPIRED");
      if (input.choice === "select") {
        await tx.query<Record<string, unknown>>(
          "update partner_offers set state='viewed' where lead_id=$1 and state='selected'",
          [id],
        );
        await tx.query<Record<string, unknown>>(
          "update partner_offers set state='selected' where id=$1",
          [input.offerId],
        );
        await changeStage(tx, lead, "client_decision");
      } else if (input.choice === "refuse")
        await tx.query<Record<string, unknown>>(
          "update partner_offers set state='refused' where id=$1",
          [input.offerId],
        );
      else if (input.choice === "view") {
        if (offer.state !== "published") break;
        await tx.query<Record<string, unknown>>(
          "update partner_offers set state='viewed' where id=$1",
          [input.offerId],
        );
      } else if (!input.text.trim()) fail("PARTNER_ACTION_REQUIRED");
      await event(
        tx,
        actor,
        id,
        `client.${input.choice}`,
        input.text || `${offer.content.company} · ${offer.content.product}`,
        "client",
      );
      break;
    }
  }
}
