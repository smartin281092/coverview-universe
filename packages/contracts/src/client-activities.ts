import { z } from "zod";
import { managedProfileIdSchema } from "./managed-profiles.js";

export const clientActivityErrorCodes = [
  "CLIENT_ACTIVITY_NOT_FOUND",
  "CLIENT_ACTIVITY_CONFLICT",
  "CLIENT_ACTIVITY_IDEMPOTENCY_REUSED",
] as const;
export const clientActivityIdSchema = z.string().regex(/^cact_[0-9a-f-]{36}$/);
export const clientActivityKindSchema = z.enum(["task", "note", "event", "appointment"]);
export const clientActivityStateSchema = z.enum(["open", "completed", "cancelled"]);
const timezoneSchema = z
  .string()
  .min(1)
  .max(100)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("fr", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  });
const fields = {
  kind: clientActivityKindSchema,
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(8000),
  state: clientActivityStateSchema,
  startsAt: z.iso.datetime({ offset: true }).nullable(),
  endsAt: z.iso.datetime({ offset: true }).nullable(),
  timezone: timezoneSchema,
};
function validSchedule(value: { kind: string; startsAt: string | null; endsAt: string | null }) {
  return (
    !((value.kind === "event" || value.kind === "appointment") && !value.startsAt) &&
    (!value.endsAt || (!!value.startsAt && Date.parse(value.endsAt) >= Date.parse(value.startsAt)))
  );
}
export const clientActivityCreateInputSchema = z.object(fields).strict().refine(validSchedule);
export const clientActivityUpdateInputSchema = z
  .object({ ...fields, revision: z.number().int().min(0).max(2147483646) })
  .strict()
  .refine(validSchedule);
export const clientActivitySchema = z.object({
  ...fields,
  id: clientActivityIdSchema,
  profileId: managedProfileIdSchema,
  revision: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const clientActivitiesQuerySchema = z
  .object({
    cursor: clientActivityIdSchema.optional(),
    kind: clientActivityKindSchema.optional(),
  })
  .strict();
export const clientActivitiesSchema = z.object({
  activities: z.array(clientActivitySchema).max(20),
  nextCursor: z.string().max(100).nullable(),
});
export type ClientActivity = z.infer<typeof clientActivitySchema>;
export type ClientActivityCreateInput = z.infer<typeof clientActivityCreateInputSchema>;
export type ClientActivityUpdateInput = z.infer<typeof clientActivityUpdateInputSchema>;
