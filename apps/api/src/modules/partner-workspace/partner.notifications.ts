import { randomUUID } from "node:crypto";
import { followUpDeadline } from "./partner.follow-up.js";
import { attributionDeadlines, currentContinuityPolicy } from "./partner.settings.js";
import { z } from "zod";
import {
  partnerNotificationsSchema,
  type PartnerNotificationQuery,
} from "@coverview/contracts/partner";
import {
  authorityCurrent,
  assigned,
  managed,
  visible,
  date,
  fail,
  type Executor,
  type PartnerActor,
  unrestricted,
} from "./partner.policy.js";

type Notification = {
  leadId: string;
  recipientId: string | null;
  audience: "partner" | "wallet" | "coverview";
  kind: string;
  key: string;
  action: string | null;
  priority?: "normal" | "high" | "urgent";
  dueAt?: Date | null;
  reopen?: boolean;
  collaborationId?: string;
};
async function put(db: Executor, n: Notification) {
  return db.query<{ created_at: Date }>(
    `insert into partner_notifications(id,lead_id,recipient_id,audience,kind,dedupe_key,action,priority,due_at,resolved_at,collaboration_id)
     values($1,$2,$3,$4,$5,$6,$7,$8,$9,case when $7::text is null then now() else null end,$10)
     on conflict(dedupe_key) ${n.reopen ? "do update set resolved_at=null where partner_notifications.resolved_at is not null" : "do nothing"} returning created_at`,
    [
      `pn_${randomUUID()}`,
      n.leadId,
      n.recipientId,
      n.audience,
      n.kind,
      n.key,
      n.action,
      n.priority ?? "normal",
      n.dueAt ?? null,
      n.collaborationId ?? null,
    ],
  );
}

// Open while the comparative analysis of reviewed offers cannot conclude (C4b); resolved as soon
// as it can. One notice per request, reopened if the analysis becomes incomplete again, and
// addressed to the current responsible (C8e).
export async function notifyAnalysis(
  db: Executor,
  lead: { id: string; responsibleId: string | null },
  incomplete: boolean,
) {
  const key = `${lead.id}:analysis_incomplete`;
  if (incomplete) {
    await put(db, {
      leadId: lead.id,
      recipientId: lead.responsibleId,
      audience: lead.responsibleId ? "partner" : "coverview",
      kind: "analysis.incomplete",
      key,
      action: "review_offer",
      reopen: true,
    });
    await db.query(
      "update partner_notifications set recipient_id=$2,audience=case when $2::text is null then 'coverview' else 'partner' end where dedupe_key=$1 and resolved_at is null",
      [key, lead.responsibleId],
    );
  } else
    await db.query(
      "update partner_notifications set resolved_at=now() where dedupe_key=$1 and resolved_at is null",
      [key],
    );
}

export async function notifyCollaboration(db: Executor, id: string, state: string) {
  const c = (
    await db.query<{
      lead_id: string;
      proposer_id: string;
      target_id: string;
      previous_responsible_id: string;
    }>(
      "select lead_id,proposer_id,target_id,previous_responsible_id from partner_collaborations where id=$1",
      [id],
    )
  ).rows[0]!;
  if (state !== "proposed")
    await db.query(
      "update partner_notifications set resolved_at=now() where collaboration_id=$1 and resolved_at is null",
      [id],
    );
  const recipients =
    state === "proposed"
      ? [c.target_id]
      : [...new Set([c.proposer_id, c.target_id, c.previous_responsible_id])];
  for (const recipientId of recipients)
    await put(db, {
      leadId: c.lead_id,
      recipientId,
      audience: "partner",
      kind: `collaboration.${state}`,
      key: `${id}:${state}:${recipientId}`,
      collaborationId: id,
      action: state === "proposed" ? "review_response" : null,
    });
}

// Joint appointment (C6b). On the joining request: the invited professional is asked to decide,
// and told when the appointment is cancelled or must be reconfirmed. On the hosting request: its
// professional and the owner learn each decision. An open question closes with the next answer.
async function notifyJointAppointment(
  db: Executor,
  leadId: string,
  eventId: string,
  kind: string,
  participationId: string,
  clientId: string | null,
) {
  const p = (
    await db.query<{ lead_id: string; user_id: string; advisor_id: string; host_lead_id: string }>(
      `select p.lead_id,p.user_id,a.advisor_id,a.lead_id host_lead_id from partner_appointment_participants p
      join partner_appointments a on a.id=p.appointment_id where p.id=$1`,
      [participationId],
    )
  ).rows[0];
  if (!p) return;
  const question = `${participationId}:decision:`;
  // The invitation is recorded on both requests: only its copy on the joining one asks.
  const settles =
    kind !== "appointment.joint_outcome.v1" &&
    (leadId === p.lead_id || kind !== "appointment.joint_invited.v1");
  if (settles)
    await db.query(
      "update partner_notifications set resolved_at=now() where left(dedupe_key,length($1))=$1 and resolved_at is null",
      [question],
    );
  if (leadId === p.lead_id) {
    const ask = ["appointment.joint_invited.v1", "appointment.joint_reconfirm.v1"].includes(kind);
    if (ask || kind === "appointment.joint_ended.v1")
      await put(db, {
        leadId,
        recipientId: p.user_id,
        audience: "partner",
        kind,
        key: ask ? `${question}${eventId}` : `${eventId}:participant`,
        action: ask ? "review_participation" : null,
        priority: ask ? "high" : "normal",
      });
  } else if (leadId === p.host_lead_id) {
    await put(db, {
      leadId,
      recipientId: p.advisor_id,
      audience: "partner",
      kind,
      key: `${eventId}:host`,
      action: null,
    });
    if (kind !== "appointment.joint_invited.v1" && clientId)
      await put(db, {
        leadId,
        recipientId: clientId,
        audience: "wallet",
        kind,
        key: `${eventId}:wallet`,
        action: null,
      });
  }
}

// An in-app delivery is itself durable: no external send is claimed. Call only in the business transaction.
export async function notifyPartnerEvent(
  db: Executor,
  leadId: string | null,
  eventId: string,
  kind: string,
  audience: string,
  subjectId: string | null = null,
) {
  if (!leadId) return;
  const row = (
    await db.query<{ responsible_id: string | null; client_id: string | null }>(
      "select responsible_id,coalesce((select user_id from managed_profiles where id=l.client_profile_id),client_user_id) client_id from partner_leads l where id=$1",
      [leadId],
    )
  ).rows[0];
  if (!row) return;
  if (kind.startsWith("conclusion.")) {
    if (kind !== "conclusion.prepared.v1")
      await db.query(
        "update partner_notifications set resolved_at=now() where lead_id=$1 and left(dedupe_key,length($2))=$2 and resolved_at is null",
        [leadId, `${subjectId}:conclusion:`],
      );
    if (kind === "conclusion.prepared.v1" && row.client_id)
      await put(db, {
        leadId,
        recipientId: row.client_id,
        audience: "wallet",
        kind,
        key: `${subjectId}:conclusion:wallet`,
        action: "conclusion",
        priority: "high",
      });
    if (
      [
        "conclusion.signed.v1",
        "conclusion.transmitted.v1",
        "conclusion.accepted.v1",
        "conclusion.correct.v1",
      ].includes(kind)
    )
      await put(db, {
        leadId,
        recipientId: row.responsible_id,
        audience: row.responsible_id ? "partner" : "coverview",
        kind,
        key: `${subjectId}:conclusion:${eventId}`,
        action: "conclusion",
        priority: "high",
      });
    if (kind !== "conclusion.prepared.v1" && row.client_id)
      await put(db, {
        leadId,
        recipientId: row.client_id,
        audience: "wallet",
        kind,
        key: `${eventId}:wallet`,
        action: null,
      });
  }
  if (["appointment.rescheduled.v1", "client.appointment_reserved.v1"].includes(kind))
    await put(db, {
      leadId,
      recipientId: row.responsible_id,
      audience: row.responsible_id ? "partner" : "coverview",
      kind,
      key: `${eventId}:responsible`,
      action: null,
    });
  if (kind === "policy.linked")
    await put(db, {
      leadId,
      recipientId: row.responsible_id,
      audience: row.responsible_id ? "partner" : "coverview",
      kind: "policy_review",
      key: `${subjectId}:policy`,
      action: "review_policy",
      priority: "high",
    });
  if (kind === "policy.withdrawn") {
    await db.query(
      "update partner_notifications set resolved_at=now() where lead_id=$1 and dedupe_key=$2 and kind='policy_review' and resolved_at is null",
      [leadId, `${subjectId}:policy`],
    );
    await put(db, {
      leadId,
      recipientId: row.responsible_id,
      audience: row.responsible_id ? "partner" : "coverview",
      kind,
      key: `${eventId}:policy-withdrawn`,
      action: null,
    });
  }
  if (kind.startsWith("appointment.joint_") && subjectId)
    await notifyJointAppointment(db, leadId, eventId, kind, subjectId, row.client_id);
  if (kind === "client.interlocutor_requested")
    await put(db, {
      leadId,
      recipientId: null,
      audience: "coverview",
      kind: "interlocutor_request",
      key: `${leadId}:interlocutor_request`,
      action: "assign",
      priority: "high",
      reopen: true,
    });
  // The answer to a Wallet invitation goes to whoever follows the request.
  if (["client.invitation_accepted", "client.invitation_declined"].includes(kind))
    await put(db, {
      leadId,
      recipientId: row.responsible_id,
      audience: row.responsible_id ? "partner" : "coverview",
      kind,
      key: `${eventId}:invitation`,
      action: kind === "client.invitation_declined" ? "review_response" : null,
      priority: kind === "client.invitation_declined" ? "high" : "normal",
    });
  if (["client.invitation_queued", "client.invitation_accepted", "lead.closed"].includes(kind))
    await db.query(
      "update partner_notifications set resolved_at=now() where lead_id=$1 and kind='client.invitation_declined' and resolved_at is null",
      [leadId],
    );
  if (["lead.assigned", "lead.transferred"].includes(kind))
    await db.query(
      "update partner_notifications set resolved_at=now() where lead_id=$1 and kind='interlocutor_request' and resolved_at is null",
      [leadId],
    );
  if (["contact.reached", "lead.closed"].includes(kind))
    await db.query(
      "update partner_notifications set resolved_at=now() where lead_id=$1 and kind='client_response' and resolved_at is null",
      [leadId],
    );
  if (
    [
      "client.select",
      "client.question",
      "client.modification",
      "client.refuse",
      "client.keep_current",
      "client.appointment_cancelled.v1",
    ].includes(kind)
  ) {
    if (["client.select", "client.refuse", "client.keep_current"].includes(kind))
      await db.query(
        `update partner_notifications n set resolved_at=now() where n.lead_id=$1 and n.kind='offer.published' and n.resolved_at is null
         and ($3::boolean or exists(select 1 from partner_events e where e.lead_id=n.lead_id and e.subject_id=$2 and n.dedupe_key=e.id||':wallet'))`,
        [leadId, subjectId, kind === "client.keep_current"],
      );
    await put(db, {
      leadId,
      recipientId: row.responsible_id,
      audience: row.responsible_id ? "partner" : "coverview",
      kind: "client_response",
      key: `${eventId}:response`,
      action: "review_response",
      priority: "high",
    });
  }
  if (
    ["client.appointment_cancelled.v1", "client.appointment_reserved.v1"].includes(kind) &&
    subjectId
  ) {
    const advisor = (
      await db.query<{ advisor_id: string }>(
        `select a.advisor_id from partner_appointments a
      join partner_leads l on l.id=a.lead_id
      join partner_members m on m.user_id=a.advisor_id
      join partner_organizations o on o.id=m.organization_id
      where a.id=$1 and l.id=$2 and a.advisor_id is distinct from l.responsible_id
        and m.state='approved' and o.state='approved' and m.roles ? 'advisor'
        and (m.review_due_at is null or m.review_due_at>clock_timestamp())
        and exists(select 1 from partner_contributors c where c.lead_id=l.id and c.user_id=a.advisor_id
          and c.revoked_at is null and ${authorityCurrent("c")} and c.access_scope='advice')`,
        [subjectId, leadId],
      )
    ).rows[0];
    if (advisor)
      await put(db, {
        leadId,
        recipientId: advisor.advisor_id,
        audience: "partner",
        kind,
        key: `${eventId}:advisor`,
        action: null,
      });
  }
  if (["offer.withdrawn", "offer.replaced"].includes(kind))
    await db.query(
      `update partner_notifications n set resolved_at=now() where n.lead_id=$1 and n.kind='offer.published' and n.resolved_at is null
       and exists(select 1 from partner_events e where e.subject_id=$2 and n.dedupe_key=e.id||':wallet')`,
      [leadId, subjectId],
    );
  if (["contract.linked", "contract.unlinked"].includes(kind))
    await put(db, {
      leadId,
      recipientId: row.responsible_id,
      audience: row.responsible_id ? "partner" : "coverview",
      kind,
      key: `${eventId}:contract`,
      action: null,
    });
  if (
    audience === "client" &&
    row.client_id &&
    [
      "lead.assigned",
      "lead.transferred",
      "collaboration.accepted",
      "collaboration.ended",
      "market.mandate_requested.v1",
      "market.mandate_changed.v1",
      "lead.reassignment_required",
      "lead.continuity_escalated",
      "appointment.scheduled",
      "appointment.rescheduled.v1",
      "appointment.slots_offered.v1",
      "appointment.slots_withdrawn.v1",
      "appointment.cancelled",
      "offer.published",
      "recommendation.published",
      "offer.withdrawn",
      "offer.replaced",
      "lead.closed",
      "lead.reopened.v1",
      "contract.reviewed",
      "policy.reviewed",
    ].includes(kind)
  )
    await put(db, {
      leadId,
      recipientId: row.client_id,
      audience: "wallet",
      kind,
      key: `${eventId}:wallet`,
      action: ["offer.published", "recommendation.published"].includes(kind)
        ? "review_offer"
        : null,
    });
}

type ContinuityRow = {
  id: string;
  responsible_id: string | null;
  stage: string;
  assignment: string;
  notified_at: Date | null;
  first_action_due_at: Date | null;
  acceptance_due_at: Date | null;
  first_useful_at: Date | null;
  due_at: Date | null;
  waiting: { reason: string; until: string } | null;
  notification_cycle: number;
  restricted_to: string | null;
  now: Date;
};
const conditionKinds = [
  "acceptance_overdue",
  "first_action_due",
  "first_action_overdue",
  "next_action_overdue",
  "waiting_review",
  "coverview_review",
];

// The caller holds the Lead lock. Resolution follows the business state, never a read receipt.
export async function syncLeadNotifications(db: Executor, leadId: string) {
  const row = (
    await db.query<ContinuityRow>("select *,now() as now from partner_leads where id=$1", [leadId])
  ).rows[0];
  if (!row) return;
  await db.query(
    "update partner_notifications set recipient_id=$2,audience=case when $2::text is null then 'coverview' else 'partner' end where lead_id=$1 and (kind in ('client_response','policy_review','analysis.incomplete','complement.answered') or action='conclusion' and audience<>'wallet') and resolved_at is null",
    [leadId, row.responsible_id],
  );
  if (["draft", "completed"].includes(row.stage)) {
    await db.query(
      "update partner_notifications set resolved_at=now() where lead_id=$1 and resolved_at is null and action is distinct from 'conclusion' and kind not in ('policy_review','quality.pending','quality.survey','quality.survey_dependency','quality.reconciliation','communication.consent')",
      [leadId],
    );
    return;
  }
  const cycle = `${leadId}:${row.notification_cycle}`;
  if (row.responsible_id) {
    const delivered = await put(db, {
      leadId,
      recipientId: row.responsible_id,
      audience: "partner",
      kind: "assignment",
      key: `${cycle}:assignment`,
      action: "accept",
      priority: "high",
    });
    if (delivered.rows[0]) {
      row.notified_at = delivered.rows[0].created_at;
      const settings = await currentContinuityPolicy(db);
      const deadlines = attributionDeadlines(row.notified_at, settings.policy);
      row.first_action_due_at = deadlines.firstActionDueAt;
      row.acceptance_due_at = deadlines.acceptanceDueAt;
      await db.query(
        "update partner_leads set notified_at=$2,first_action_due_at=$3,acceptance_due_at=$4,continuity_policy_revision=$5 where id=$1",
        [
          leadId,
          row.notified_at,
          row.first_action_due_at,
          row.acceptance_due_at,
          settings.revision || null,
        ],
      );
      await db.query("update partner_notifications set due_at=$2 where dedupe_key=$1", [
        `${cycle}:assignment`,
        row.acceptance_due_at,
      ]);
    }
  }
  await db.query(
    `update partner_notifications set resolved_at=now() where lead_id=$1 and kind='assignment' and resolved_at is null
     and (dedupe_key<>$2 or $3::text is null or $4::boolean)`,
    [
      leadId,
      `${cycle}:assignment`,
      row.responsible_id,
      row.assignment === "accepted" || !!row.first_useful_at,
    ],
  );
  const keys: string[] = [];
  const condition = async (kind: string, action: string, at: Date | null, admin = false) => {
    // A restricted Lead's reminders go to its account only, never to the CoverView queue.
    if (admin && row.restricted_to) return;
    const recipientId = admin ? null : row.responsible_id;
    const audience = recipientId ? "partner" : "coverview";
    const key = `${cycle}:${kind}:${at?.toISOString() ?? "none"}:${audience}:${recipientId ?? "coverview"}`;
    keys.push(key);
    await put(db, {
      leadId,
      recipientId,
      audience,
      kind,
      key,
      action,
      dueAt: at,
      priority: kind === "first_action_due" ? "high" : "urgent",
      reopen: true,
    });
  };
  const now = row.now.getTime();
  const suspended = row.waiting && new Date(row.waiting.until).getTime() > now;
  if (!row.responsible_id) await condition("coverview_review", "assign", null, true);
  else if (!suspended) {
    const deadlines = followUpDeadline({
      notifiedAt: row.notified_at,
      firstUsefulAt: row.first_useful_at,
      dueAt: row.due_at,
      waiting: row.waiting,
      firstActionDueAt: row.first_action_due_at,
      acceptanceDueAt: row.acceptance_due_at,
    });
    if (
      row.assignment === "proposed" &&
      !row.first_useful_at &&
      deadlines.acceptanceDueAt &&
      deadlines.acceptanceDueAt.getTime() <= now
    ) {
      await condition("acceptance_overdue", "accept", deadlines.acceptanceDueAt);
      await condition("acceptance_overdue", "follow_up", deadlines.acceptanceDueAt, true);
    }
    if (row.waiting) await condition("waiting_review", "review_wait", new Date(row.waiting.until));
    if (!row.first_useful_at && row.notified_at) {
      const due = deadlines.firstActionDueAt!;
      if (due.getTime() <= now) {
        await condition("first_action_overdue", "follow_up", due);
        await condition("first_action_overdue", "follow_up", due, true);
      } else if (due.getTime() - now <= 4 * 3600000)
        await condition("first_action_due", "follow_up", due);
    }
    if (row.first_useful_at && row.due_at && row.due_at.getTime() <= now) {
      await condition("next_action_overdue", "follow_up", row.due_at);
      await condition("next_action_overdue", "follow_up", row.due_at, true);
    }
  }
  await db.query(
    "update partner_notifications set resolved_at=now() where lead_id=$1 and kind=any($2::text[]) and resolved_at is null and not(dedupe_key=any($3::text[]))",
    [leadId, conditionKinds, keys],
  );
}

function notificationScope(actor: PartnerActor) {
  // Delivery keeps its historical recipient; access follows the canonical profile owner.
  if (actor.wallet) return `n.audience='wallet' and (${visible(actor)})`;
  const permitted = `(${visible(actor)}) and (${assigned} or ${managed})`;
  const collaboration = `n.collaboration_id is not null and exists(select 1 from partner_members m join partner_organizations o on o.id=m.organization_id where m.user_id=$1 and m.state='approved' and o.state='approved' and (m.review_due_at is null or m.review_due_at>now())) and exists(select 1 from partner_collaborations c where c.id=n.collaboration_id and (c.proposer_id=$1 or c.target_id=$1 or c.previous_responsible_id=$1))`;
  return actor.administrator
    ? `(n.audience='coverview' or (n.audience='partner' and n.recipient_id=$1)) and ${unrestricted}`
    : `n.audience='partner' and n.recipient_id=$1 and ((${collaboration}) or (n.collaboration_id is null and (${permitted})))`;
}
export async function readPartnerNotifications(
  db: Executor,
  actor: PartnerActor,
  query: PartnerNotificationQuery,
) {
  const values: unknown[] = [actor.userId];
  const clauses = [notificationScope(actor)];
  const hasConclusions = !!(
    await db.query<{ table: string | null }>(
      "select to_regclass('partner_conclusions')::text as table",
    )
  ).rows[0]?.table;
  // Expiry is derived from the signed invitation and offer, including before anyone opens it.
  // Keep the historical notification; its effective resolution requires no background write.
  const resolved = hasConclusions
    ? `coalesce(n.resolved_at,(select least(c.valid_until,(o.data->>'validUntil')::timestamptz)
    from partner_conclusions c join partner_offers o on o.id=c.offer_id
    where n.kind='conclusion.prepared.v1' and n.dedupe_key=c.id||':conclusion:wallet'
    and not exists(select 1 from partner_offer_signatures s where s.conclusion_id=c.id)
    and least(c.valid_until,(o.data->>'validUntil')::timestamptz)<=now() limit 1))`
    : "n.resolved_at";
  if (query.status === "open") clauses.push(`${resolved} is null`);
  if (query.clientProfileId) {
    if (query.clientProfileId === "self") clauses.push("l.client_profile_id is null");
    else {
      values.push(query.clientProfileId);
      clauses.push(`l.client_profile_id=$${values.length}`);
    }
  }
  if (query.cursor) {
    let cursor: { at: string; id: string };
    try {
      cursor = z
        .object({ at: z.iso.datetime(), id: z.string().max(100) })
        .strict()
        .parse(JSON.parse(Buffer.from(query.cursor, "base64url").toString("utf8")) as unknown);
    } catch {
      return fail("PARTNER_NOT_FOUND", 400);
    }
    values.push(cursor.at, cursor.id);
    clauses.push(
      `(n.created_at,n.id)<($${values.length - 1}::timestamptz,$${values.length}::text)`,
    );
  }
  const rows = (
    await db.query<Record<string, unknown>>(
      `select n.*,${resolved} resolved_at,case when n.collaboration_id is null then l.title else '' end title,coalesce((select application->>'name' from partner_members where user_id=case when n.audience='wallet' then l.responsible_id else n.recipient_id end),case when n.audience in ('coverview','wallet') then 'CoverView' else '' end) responsible_name,
     (select read_at from partner_notification_reads where notification_id=n.id and user_id=$1) read_at,
     e.kind event_kind,case when o.id is not null then json_build_object('id',o.id,'version',o.version,'company',o.data->>'company','product',o.data->>'product') end offer
     from partner_notifications n join partner_leads l on l.id=n.lead_id
     left join partner_events e on e.lead_id=n.lead_id and
       (n.dedupe_key=e.id||case when n.kind='client_response' then ':response' when n.kind='policy.withdrawn' then ':policy-withdrawn' else ':wallet' end
        or n.kind='policy_review' and e.kind='policy.linked' and n.dedupe_key=e.subject_id||':policy')
     left join partner_final_policies p on p.id=e.subject_id and p.lead_id=e.lead_id
     left join partner_offers o on o.id=coalesce(p.offer_id,e.subject_id) and o.lead_id=e.lead_id and o.published_at is not null
     where ${clauses.join(" and ")}
     order by n.created_at desc,n.id desc limit 31`,
      values,
    )
  ).rows;
  const page = rows.slice(0, 30),
    last = page.at(-1);
  return partnerNotificationsSchema.parse({
    items: page.map((r) => ({
      id: r.id,
      leadId: r.lead_id,
      collaborationId: r.collaboration_id,
      title: r.title,
      kind: r.kind,
      eventKind: r.event_kind,
      offer: r.offer,
      responsibleName: r.responsible_name,
      priority: r.priority,
      action: r.action,
      dueAt: date(r.due_at as Date | null),
      createdAt: date(r.created_at as Date),
      readAt: date(r.read_at as Date | null),
      resolvedAt: date(r.resolved_at as Date | null),
    })),
    nextCursor:
      rows.length > 30 && last
        ? Buffer.from(JSON.stringify({ at: date(last.created_at as Date), id: last.id })).toString(
            "base64url",
          )
        : null,
  });
}
export async function markPartnerNotificationRead(db: Executor, actor: PartnerActor, id: string) {
  const permitted = await db.query(
    `select n.id from partner_notifications n join partner_leads l on l.id=n.lead_id where n.id=$2 and (${notificationScope(actor)}) for share of l,n`,
    [actor.userId, id],
  );
  if (!permitted.rowCount) fail("PARTNER_NOT_FOUND", 404);
  await db.query(
    "insert into partner_notification_reads(id,notification_id,user_id) values($1,$2,$3) on conflict(notification_id,user_id) do nothing",
    [`pnr_${randomUUID()}`, id, actor.userId],
  );
}
