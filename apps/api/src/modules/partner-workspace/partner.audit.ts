import { randomUUID } from "node:crypto";
import type { Executor, PartnerActor } from "./partner.policy.js";
export const newId = (prefix: string) => `${prefix}_${randomUUID()}`;
export async function event(
  db: Executor,
  actor: PartnerActor,
  leadId: string | null,
  kind: string,
  text: string,
  audience = "assigned",
  subjectId: string | null = null,
) {
  await db.query<Record<string, unknown>>(
    "insert into partner_events(id,lead_id,actor_id,subject_id,kind,audience,text) values($1,$2,$3,$4,$5,$6,$7)",
    [newId("pev"), leadId, actor.userId, subjectId, kind, audience, text],
  );
}
