import {
  requireAssignee,
  requireNewEngagement,
  requireParticipant,
  handoffWork,
} from "./partner.participants.js";
import { requireTeamAssignment } from "./partner.team.js";
import { proposeCollaboration } from "./partner.collaboration.js";
import type { PoolClient } from "pg";
import { z } from "zod";
import { documentAnalysisSchema } from "@coverview/contracts";
import { leadOfferInputSchema, type LeadCommand } from "@coverview/contracts/partner";
import type { partnerLeads } from "./partner.schema.js";
import { fail, type PartnerActor } from "./partner.policy.js";
import { event, newId } from "./partner.audit.js";
import {
  retainLeadSource,
  leadSourceSnapshot,
  leadSourceReviewRevisionSql,
} from "../document-intelligence/index.js";
import { requireOfferSource } from "./partner.offers.js";
import { executeContractCommand } from "./partner.contract.js";
import { executeFinalPolicyCommand } from "./partner.final-policy.js";
import { conclusionClosureReady } from "./partner.conclusion-evidence.js";
import { reopenLead } from "./partner.lifecycle.js";
import { overlappingAppointment } from "./partner.appointment-assessment.js";
import { computeMatching, recordMatchingDecision } from "./partner.matching.js";
import { syncAnalysisNotice } from "./partner.recommendations.js";
import { leaveJointAppointments, settleJointAppointments } from "./partner.joint-appointments.js";
type LeadRow = typeof partnerLeads.$inferSelect;

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
    sourceSnapshot: offer.source_snapshot,
    content: leadOfferInputSchema.parse(offer.data),
  };
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
    ![
      "reopen",
      "note",
      "task_state",
      "task",
      "offer_withdraw",
      "contract_unlink",
      "final_policy_link",
      "final_policy_unlink",
      "final_policy_review",
    ].includes(input.action)
  )
    fail("PARTNER_INVALID_TRANSITION");
  switch (input.action) {
    case "reopen":
      await reopenLead(tx, actor, lead, input);
      break;
    case "final_policy_link":
    case "final_policy_unlink":
    case "final_policy_review":
      await executeFinalPolicyCommand(tx, actor, lead, input);
      break;
    case "contract_link":
    case "contract_unlink":
    case "contract_review":
      await executeContractCommand(tx, actor, lead, input);
      break;
    case "collaboration_propose":
      await proposeCollaboration(tx, actor, lead, input.terms);
      break;
    case "client_interlocutor":
      if (!actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
      await event(tx, actor, id, "client.interlocutor_requested", input.reason, "client");
      break;
    case "edit": {
      const data = input.lead;
      if (lead.stage !== "draft" && data.draft) fail("PARTNER_INVALID_TRANSITION");
      if (!data.draft && (!data.transmissionAuthorized || !data.nextAction || !data.dueAt))
        fail("PARTNER_ACTION_REQUIRED");
      const relink =
        data.clientUserId !== lead.clientUserId || data.clientProfileId !== lead.clientProfileId;
      const referenceChanged =
        (data.objectReference ?? "") !==
        z.object({ objectReference: z.string().default("") }).parse(lead.details ?? {})
          .objectReference;
      if (
        (relink || data.category !== lead.category || data.object !== lead.object) &&
        (await tx.query("select id from partner_final_policies where lead_id=$1 limit 1", [id]))
          .rowCount
      )
        fail("PARTNER_INVALID_TRANSITION");
      if (
        (relink || data.category !== lead.category || data.object !== lead.object) &&
        (await tx.query("select id from partner_offer_imports where lead_id=$1 limit 1", [id]))
          .rowCount
      )
        fail("PARTNER_INVALID_TRANSITION");
      // The object reference identifies the current contract: it is frozen with the reference.
      if (
        (relink ||
          referenceChanged ||
          data.category !== lead.category ||
          data.object !== lead.object) &&
        (
          await tx.query("select id from partner_contract_references where lead_id=$1 limit 1", [
            id,
          ])
        ).rowCount
      )
        fail("PARTNER_INVALID_TRANSITION");
      if (
        (relink || data.category !== lead.category || data.object !== lead.object) &&
        (await tx.query("select lead_id from partner_insurance_sources where lead_id=$1", [id]))
          .rowCount
      )
        fail("PARTNER_INVALID_TRANSITION");
      if (
        (data.category !== lead.category || data.object !== lead.object) &&
        (await tx.query("select id from partner_offers where lead_id=$1 limit 1", [id])).rowCount
      )
        fail("PARTNER_INVALID_TRANSITION");
      if (data.category !== lead.category && lead.responsibleId)
        await requireNewEngagement(
          tx,
          { ...lead, category: data.category },
          lead.responsibleId,
          actor,
        );
      if (
        (relink || data.category !== lead.category || data.object !== lead.object) &&
        (
          await tx.query(
            "select id from partner_contributors where lead_id=$1 and revoked_at is null union all select id from partner_collaborations where lead_id=$1 and state='proposed' limit 1",
            [id],
          )
        ).rowCount
      )
        fail("PARTNER_INVALID_TRANSITION");
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
            objectReference: data.objectReference ?? "",
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
          "update partner_leads set notified_at=null where id=$1",
          [id],
        );
      }
      await event(tx, actor, id, "lead.updated", data.title, relink ? "coverview" : "assigned");
      // Announced need versus observed need: feeds the referrer evaluation for CoverView only.
      if (lead.stage !== "draft" && data.category !== lead.category)
        await event(
          tx,
          actor,
          id,
          "lead.category_changed",
          `${lead.category} → ${data.category}`,
          "coverview",
          lead.creatorId,
        );
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
      const appointmentId = newId("appt");
      await requireParticipant(tx, lead, appt.advisorId, actor);
      await requireAssignee(tx, lead, appt.advisorId, actor);
      if (
        appt.advisorId !== lead.responsibleId &&
        !(actor.administrator && appt.advisorId === actor.userId)
      ) {
        const direct = await tx.query(
          "select id from partner_contributors where lead_id=$1 and user_id=$2 and revoked_at is null and can_contact and can_edit and access_scope='advice'",
          [id, appt.advisorId],
        );
        if (!direct.rowCount) fail("PARTNER_ACCESS_DENIED", 403);
      }
      if (new Date(appt.startsAt).getTime() <= Date.now()) fail("PARTNER_ACTION_REQUIRED");
      // Serialize the advisor's schedule across Leads, including simultaneous requests.
      await tx.query<Record<string, unknown>>(
        "select pg_advisory_xact_lock(hashtextextended($1,1))",
        [appt.advisorId],
      );
      if (
        await overlappingAppointment(
          tx,
          appt.advisorId,
          null,
          new Date(appt.startsAt),
          new Date(Date.parse(appt.startsAt) + appt.durationMinutes * 60000),
        )
      )
        fail("PARTNER_APPOINTMENT_CONFLICT", 409);
      await tx.query<Record<string, unknown>>(
        "insert into partner_appointments(id,lead_id,advisor_id,starts_at,duration_minutes,mode,location,timezone) values($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          appointmentId,
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
      return appointmentId;
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
      // A cancellation ends the joined participations; an outcome stays each request's own.
      await settleJointAppointments(tx, actor, [input.appointmentId]);
      if (input.state === "completed") await changeStage(tx, lead, "appointment_completed");
      else if (lead.stage === "appointment_scheduled")
        await changeStage(tx, lead, "appointment_needed");
      await event(tx, actor, id, `appointment.${input.state}`, input.note, "client");
      break;
    }
    case "assign": {
      // CoverView anywhere; a manager only between members of their own organisation (C8b).
      if (!actor.administrator) await requireTeamAssignment(tx, actor, lead, input.responsibleId);
      await requireNewEngagement(tx, lead, input.responsibleId, actor);
      const details = z.object({ transmissionAuthorized: z.boolean() }).parse(lead.details);
      if (!details.transmissionAuthorized || !lead.title || !lead.nextAction || !lead.dueAt)
        fail("PARTNER_ACTION_REQUIRED");
      if (input.responsibleId === lead.responsibleId) fail("PARTNER_CONFLICT", 409);
      // Recomputed on the locked Lead: a decision is never recorded against a stale ranking.
      const matching = await computeMatching(
        tx,
        lead,
        lead.responsibleId ? [lead.responsibleId] : [],
      );
      if (input.matchingBasis && input.matchingBasis !== matching.basis)
        fail("PARTNER_CONFLICT", 409);
      await tx.query<Record<string, unknown>>(
        "update partner_leads set responsible_id=$2,assignment='proposed',notified_at=null,first_action_due_at=null,acceptance_due_at=null,continuity_policy_revision=null,first_useful_at=null,waiting=null,notification_cycle=notification_cycle+1 where id=$1",
        [id, input.responsibleId],
      );
      // The mandatory reason documents the choice, and any deviation from the first candidate.
      await recordMatchingDecision(tx, {
        leadId: id,
        cycle: lead.notificationCycle + 1,
        kind: "manual",
        actorId: actor.userId,
        chosenUserId: input.responsibleId,
        reason: input.reason,
        matching,
      });
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
      if (result === "contract") {
        if (!(await conclusionClosureReady(tx, lead))) fail("PARTNER_INVALID_TRANSITION");
      }
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
        const cancelled = await tx.query<{ id: string }>(
          "update partner_appointments set state='cancelled' where lead_id=$1 and state='scheduled' and starts_at>now() returning id",
          [id],
        );
        await settleJointAppointments(
          tx,
          actor,
          cancelled.rows.map((row) => row.id),
        );
      }
      // A closed request also leaves the appointments it joined on other requests.
      await leaveJointAppointments(tx, actor, id, true);
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
        await requireOfferSource(tx, offer.content.documentId, offer.sourceSnapshot);
      }
      await changeStage(tx, lead, input.stage);
      await event(tx, actor, id, "lead.stage_changed", input.stage, "client");
      break;
    }
    case "offer": {
      const offer = input.offer;
      const previous = offer.replacesId ? await getOffer(tx, lead, offer.replacesId) : null;
      const imported = (
        await tx.query<{ id: string; offer_id: string | null }>(
          "select id,offer_id from partner_offer_imports where lead_id=$1 and document_id=$2 for update",
          [id, offer.documentId],
        )
      ).rows[0];
      if (imported?.offer_id && !previous) fail("PARTNER_CONFLICT", 409);
      if (
        !(await retainLeadSource(
          tx,
          offer.documentId,
          actor,
          {
            userId: lead.clientUserId,
            profileId: lead.clientProfileId,
          },
          previous?.content.documentId === offer.documentId || !!imported,
        ))
      )
        fail("PARTNER_INVALID_DOCUMENT");
      const sourceRow = (
        await tx.query<Record<string, unknown>>(
          `select f.*, ${leadSourceReviewRevisionSql} source_review_revision from files f where f.id=$1`,
          [offer.documentId],
        )
      ).rows[0]!;
      const snapshot = leadSourceSnapshot(sourceRow);
      if (!snapshot) fail("PARTNER_INVALID_DOCUMENT");
      if (offer.sourceFingerprint !== snapshot.fingerprint) fail("PARTNER_CONFLICT", 409);
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
        if (previous.published_at)
          await event(
            tx,
            actor,
            id,
            "offer.replaced",
            `${previous.content.company} · ${previous.content.product}`,
            "client",
            previous.id,
          );
      }
      await tx.query<Record<string, unknown>>(
        "insert into partner_offers(id,lead_id,document_id,data,version,family_id,source_snapshot) values($1,$2,$3,$4,$5,$6,$7)",
        [
          offerId,
          id,
          offer.documentId,
          JSON.stringify(offer),
          version,
          familyId,
          JSON.stringify(snapshot),
        ],
      );
      await event(
        tx,
        actor,
        id,
        "offer.received",
        `${offer.company} · ${offer.product}`,
        "assigned",
        offerId,
      );
      if (imported && !imported.offer_id)
        await tx.query("update partner_offer_imports set offer_id=$2 where id=$1", [
          imported.id,
          offerId,
        ]);
      break;
    }
    case "offer_review": {
      const offer = await getOffer(tx, lead, input.offerId);
      if (!offer.active || !["received", "to_verify"].includes(String(offer.state)))
        fail("PARTNER_INVALID_TRANSITION");
      const source = await requireOfferSource(tx, offer.content.documentId, offer.sourceSnapshot);
      const analysis = documentAnalysisSchema.safeParse(source.analysis);
      // An inclusion, an exclusion or a structured amount must cite its page in this exact source.
      for (const feature of offer.content.features) {
        if (feature.limit && (feature.verification === "missing" || feature.origin === "missing"))
          fail("PARTNER_OFFER_NOT_READY");
        if (
          ((feature.coverage && feature.coverage !== "unknown") || feature.limit) &&
          (feature.origin === "calculated" ||
            !feature.sourcePage ||
            !feature.source ||
            !analysis.success ||
            !analysis.data.pages.some(
              (page) => page.page === feature.sourcePage && page.text.includes(feature.source),
            ))
        )
          fail("PARTNER_INVALID_DOCUMENT");
      }
      if (
        offer.content.features.some(
          (f) =>
            f.verification === "to_verify" || (f.verification === "verified" && !f.source.trim()),
        ) ||
        offer.content.annualPremiumMinor === null
      )
        fail("PARTNER_OFFER_NOT_READY");
      await tx.query<Record<string, unknown>>(
        "update partner_offers set reviewed_at=now(),reviewed_by=$2,state='ready' where id=$1",
        [input.offerId, actor.userId],
      );
      await event(tx, actor, id, "offer.reviewed", offer.content.company, "assigned", offer.id);
      break;
    }
    case "offer_publish": {
      const offer = await getOffer(tx, lead, input.offerId);
      if (!lead.clientUserId || !offer.active || !offer.reviewed_at || offer.state !== "ready")
        fail("PARTNER_OFFER_NOT_READY");
      if (offer.content.validUntil && new Date(offer.content.validUntil).getTime() <= Date.now())
        fail("PARTNER_OFFER_EXPIRED");
      await requireOfferSource(tx, offer.content.documentId, offer.sourceSnapshot);
      await tx.query<Record<string, unknown>>(
        "update partner_offers set published_at=now(),published_by=$2,state='published' where id=$1",
        [input.offerId, actor.userId],
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
        offer.id,
      );
      break;
    }
    case "offer_withdraw": {
      const offer = await getOffer(tx, lead, input.offerId);
      if (!offer.active || offer.state === "signed") fail("PARTNER_INVALID_TRANSITION");
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
        offer.id,
      );
      break;
    }
    case "client_choice": {
      if (!actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
      if (["refuse", "question", "modification"].includes(input.choice) && !input.text.trim())
        fail("PARTNER_ACTION_REQUIRED");
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
        !["published", "viewed", "selected"].includes(String(offer.state))
      )
        fail("PARTNER_INVALID_TRANSITION");
      if (offer.content.validUntil && new Date(offer.content.validUntil).getTime() <= Date.now())
        fail("PARTNER_OFFER_EXPIRED");
      await requireOfferSource(tx, offer.content.documentId, offer.sourceSnapshot);
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
      }
      if (input.choice !== "view") await changeStage(tx, lead, "client_decision");
      await event(
        tx,
        actor,
        id,
        `client.${input.choice}`,
        input.text || `${offer.content.company} · ${offer.content.product}`,
        "client",
        offer.id,
      );
      break;
    }
  }
  // The comparative analysis is read again whenever one of its inputs changed.
  if (
    [
      "offer",
      "offer_review",
      "offer_publish",
      "offer_withdraw",
      "contract_link",
      "contract_unlink",
      "contract_review",
    ].includes(input.action)
  )
    await syncAnalysisNotice(tx, lead);
}
