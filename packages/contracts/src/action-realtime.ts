import { z } from "zod";
import { actionCenterDetailsSchema, actionCenterIdSchema } from "./action-center.js";
import { managedProfileIdSchema } from "./managed-profiles.js";

export const actionReadEvent = "action.read.v1";
export const actionSocketPath = "/action-center/socket.io";
export const actionSocketAuthSchema = z.object({ csrfToken: z.string().min(1).max(128) }).strict();
export const actionReadInputSchema = z
  .object({
    id: actionCenterIdSchema,
    profileId: managedProfileIdSchema.optional(),
  })
  .strict();
export const actionReadErrorSchema = z.enum([
  "IDENTITY_UNAUTHENTICATED",
  "IDENTITY_ACCESS_DENIED",
  "IDENTITY_CSRF_INVALID",
  "IDENTITY_RATE_LIMITED",
  "IDENTITY_UNAVAILABLE",
  "DOCUMENT_NOT_FOUND",
  "PLATFORM_INVALID_REQUEST",
  "PLATFORM_INTERNAL_ERROR",
]);
export const actionReadResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), data: actionCenterDetailsSchema }),
  z.object({
    ok: z.literal(false),
    code: actionReadErrorSchema,
    status: z.number().int().min(400).max(599),
  }),
]);
export type ActionCardDetails = z.infer<typeof actionCenterDetailsSchema>;
export type ActionReadInput = z.infer<typeof actionReadInputSchema>;
export type ActionReadResult = z.infer<typeof actionReadResultSchema>;
