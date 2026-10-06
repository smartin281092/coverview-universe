import type { PoolClient } from "pg";
import type { z } from "zod";
import type { qualityCreateSchema } from "@coverview/contracts/partner-quality";
import { fail, type PartnerActor } from "./partner.policy.js";
import { event, newId } from "./partner.audit.js";
import type { partnerLeads } from "./partner.schema.js";

type Lead = typeof partnerLeads.$inferSelect;
export const qualitySubject = (l: Lead) =>
  l.clientProfileId ? `profile:${l.clientProfileId}` : `self:${l.clientUserId}`;

/** The CoverView work item of a quality case, reopened at each follow-up date. */
export async function notifyQualityCase(
  tx: PoolClient,
  row: { id: string; leadId: string; priority: string; dueAt: string },
) {
  await tx.query(
    `insert into partner_notifications(id,lead_id,audience,kind,dedupe_key,action,priority,due_at) values($1,$2,'coverview','quality.pending',$3,'review_quality',$4,$5) on conflict(dedupe_key) do update set resolved_at=null,due_at=excluded.due_at`,
    [newId("pn"), row.leadId, `quality:${row.id}`, row.priority, row.dueAt],
  );
}

/** Opens a quality case followed by CoverView within 24 hours (internal triage, not a legal term). */
export async function openQualityCase(
  tx: PoolClient,
  actor: PartnerActor,
  lead: Lead,
  input: z.infer<typeof qualityCreateSchema>,
  surveyId: string | null = null,
  // A verification of a client statement stays with CoverView, whoever reported it (C8d).
  audience: "client" | "coverview" = actor.wallet || input.sharedWithClient
    ? "client"
    : "coverview",
) {
  if (input.sharedWithClient && !lead.clientUserId) fail("PARTNER_ACTION_REQUIRED");
  const id = newId("pqc"),
    dueAt = new Date(Date.now() + 86400000).toISOString();
  await tx.query(
    `insert into partner_quality_cases(id,lead_id,subject_key,author_id,survey_id,kind,summary,priority,audience,due_at,owner_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      id,
      lead.id,
      qualitySubject(lead),
      actor.userId,
      surveyId,
      input.kind,
      input.summary,
      input.priority,
      audience,
      dueAt,
      lead.clientUserId,
    ],
  );
  await notifyQualityCase(tx, { id, leadId: lead.id, priority: input.priority, dueAt });
  await event(tx, actor, lead.id, "quality.opened.v1", "", "coverview", id);
  return id;
}
