import { z } from "zod";
import { leadCategorySchema } from "./partner.js";

const instant = z.iso.datetime({ offset: true }),
  token = z.string().regex(/^[A-Za-z0-9_-]{43}$/u);

export const clientInvitationNoticeVersion = "client-invitation-notice-v1";
export const clientInvitationStateSchema = z.enum([
  "queued",
  "sending",
  "sent",
  "accepted",
  "declined",
  "expired",
  "cancelled",
  "failed",
  "superseded",
]);
// Professional projection: never says whether the address already belongs to a Wallet.
export const clientInvitationSchema = z.object({
  id: z.string(),
  state: clientInvitationStateSchema,
  email: z.string(),
  createdAt: instant,
  expiresAt: instant,
  sentAt: instant.nullable(),
  respondedAt: instant.nullable(),
  cancelReason: z.string().nullable(),
  // Why an invitation stopped without an answer from the client.
  reason: z
    .enum(["send_failed", "delivery_unknown", "recipient_changed", "request_changed"])
    .nullable(),
});
export const clientInvitationsSchema = z.object({
  canInvite: z.boolean(),
  // "unconfigured": no sending adapter, invitations stay queued and nothing is presented as sent.
  delivery: z.enum(["configured", "unconfigured"]),
  blocker: z.enum(["linked", "no_email", "draft", "closed", "access"]).nullable(),
  items: z.array(clientInvitationSchema).max(20),
});
export const clientInvitationCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("send"), confirmed: z.literal(true) }).strict(),
  z
    .object({
      action: z.literal("cancel"),
      id: z.string(),
      reason: z.string().trim().min(5).max(500),
    })
    .strict(),
]);
// Wallet side: the token travels in the body only, never in a URL the server logs.
export const clientInvitationLookupSchema = z.object({ token }).strict();
export const clientInvitationPreviewSchema = z.object({
  state: z.enum(["pending", "accepted", "declined", "expired", "cancelled", "unavailable"]),
  emailMatches: z.boolean(),
  title: z.string().nullable(),
  // The name recorded by the professional: on a shared address, the person can see it is not them.
  clientName: z.string().nullable(),
  category: leadCategorySchema.nullable(),
  requester: z.string().nullable(),
  expiresAt: instant.nullable(),
  notice: z.literal(clientInvitationNoticeVersion),
});
export const clientInvitationResponseSchema = z
  .object({
    token,
    decision: z.enum(["accept", "decline"]),
    noticeVersion: z.literal(clientInvitationNoticeVersion),
    confirmed: z.literal(true),
  })
  .strict();
export type ClientInvitationCommand = z.infer<typeof clientInvitationCommandSchema>;
export type ClientInvitationResponse = z.infer<typeof clientInvitationResponseSchema>;
