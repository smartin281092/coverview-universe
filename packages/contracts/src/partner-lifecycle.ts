import { z } from "zod";
import { leadResultSchema, leadReasonSchema } from "./partner.js";
const id = z.string().min(1).max(100);
export const leadReopeningSchema = z.object({
  id,
  leadId: id,
  actorId: id,
  closedResult: leadResultSchema,
  closedReason: leadReasonSchema,
  closedAt: z.iso.datetime(),
  reopenedAt: z.iso.datetime(),
  reason: z.string().max(2000),
  nextAction: z.string().max(240),
  dueAt: z.iso.datetime(),
});
export const leadReopeningsSchema = z.object({
  items: z.array(leadReopeningSchema).max(20),
  nextCursor: z.string().nullable(),
});
