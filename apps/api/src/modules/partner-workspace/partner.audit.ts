import { randomUUID } from "node:crypto";
import type { Executor, PartnerActor } from "./partner.policy.js";
import { notifyPartnerEvent } from "./partner.notifications.js";
export type PartnerAuditActor =
  PartnerActor | { userId: null; systemActor: "partner-continuity-v1" };
export const newId = (prefix: string) => `${prefix}_${randomUUID()}`;
export async function event(
  db: Executor,
  actor: PartnerAuditActor,
  leadId: string | null,
  kind: string,
  text: string,
  audience = "assigned",
  subjectId: string | null = null,
) {
  const id = newId("pev");
  await db.query<Record<string, unknown>>(
    "insert into partner_events(id,lead_id,actor_id,subject_id,kind,audience,text,system_actor) values($1,$2,$3,$4,$5,$6,$7,$8)",
    [
      id,
      leadId,
      actor.userId,
      subjectId,
      kind,
      audience,
      text,
      "systemActor" in actor ? actor.systemActor : null,
    ],
  );
  await notifyPartnerEvent(db, leadId, id, kind, audience, subjectId);
}
