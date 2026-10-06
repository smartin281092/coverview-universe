import { z } from "zod";
import {
  applicationStateSchema,
  leadCategorySchema,
  memberRestrictionsSchema,
  partnerRoleSchema,
} from "./partner.js";

const id = z.string().min(1).max(100);
const instant = z.iso.datetime({ offset: true });

// Team of an organisation's manager (C8b, brief I.3 and I.4). The manager supervises users,
// requests, assignments and terms of their own organisation only; CoverView still validates.
export const teamInvitationLimits = { open: 20, perDay: 10, days: 14 } as const;
export const teamEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(254)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/u);
export const teamInvitationInputSchema = z.object({ email: teamEmailSchema }).strict();
export const teamInvitationStateSchema = z.enum([
  "pending",
  "expired",
  "accepted",
  "declined",
  "cancelled",
]);
export const teamInvitationSchema = z.object({
  id,
  email: z.string(),
  state: teamInvitationStateSchema,
  invitedBy: z.string(),
  createdAt: instant,
  expiresAt: instant,
  decidedAt: instant.nullable(),
});
// What a manager sees of a colleague: no CoverView reason, no private declaration.
export const teamMemberSchema = z.object({
  userId: id,
  name: z.string(),
  state: applicationStateSchema,
  grantedRoles: z.array(partnerRoleSchema),
  categories: z.array(leadCategorySchema),
  reviewDueAt: instant.nullable(),
  restrictions: memberRestrictionsSchema.omit({ reviewAt: true }),
  revision: z.number().int().nonnegative(),
  activeLeads: z.number().int().nonnegative(),
  overdueLeads: z.number().int().nonnegative(),
  self: z.boolean(),
  canRemove: z.boolean(),
});
export const teamSchema = z.object({
  organization: z.object({
    id,
    name: z.string(),
    state: applicationStateSchema,
    reviewDueAt: instant.nullable(),
  }),
  members: z.array(teamMemberSchema).max(100),
  invitations: z.array(teamInvitationSchema).max(50),
  canInvite: z.boolean(),
});
export const teamRemovalInputSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    reason: z.string().trim().min(5).max(2000),
  })
  .strict();
// An invitation as the invited person sees it once signed in with the invited address.
export const receivedInvitationSchema = z.object({
  id,
  organizationName: z.string(),
  invitedBy: z.string(),
  expiresAt: instant,
  // Joining is impossible from an approved or suspended membership: it must end first.
  blocker: z.enum(["membership_active", "membership_suspended"]).nullable(),
});
export const receivedInvitationsSchema = z.object({
  items: z.array(receivedInvitationSchema).max(20),
});
export type TeamInvitationInput = z.infer<typeof teamInvitationInputSchema>;
export type TeamInvitation = z.infer<typeof teamInvitationSchema>;
export type TeamMember = z.infer<typeof teamMemberSchema>;
export type Team = z.infer<typeof teamSchema>;
export type TeamRemovalInput = z.infer<typeof teamRemovalInputSchema>;
export type ReceivedInvitation = z.infer<typeof receivedInvitationSchema>;
