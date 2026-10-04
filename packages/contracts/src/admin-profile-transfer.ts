import { z } from "zod";
import { adminUserIdSchema, adminUsersQuerySchema } from "./admin-users.js";
import { managedProfileIdSchema } from "./managed-profiles.js";

export const adminProfileDirectoryQuerySchema = adminUsersQuerySchema;
export const adminProfileDirectoryEntrySchema = z.object({
  profileId: managedProfileIdSchema,
  userId: adminUserIdSchema,
  kind: z.enum(["person", "legal_entity"]),
  isSelf: z.boolean(),
  displayName: z.string().min(1).max(320),
  accountEmail: z.email(),
  accountDisplayName: z.string().max(320).nullable(),
  createdAt: z.iso.datetime(),
});
export const adminProfileDirectorySchema = z.object({
  profiles: z.array(adminProfileDirectoryEntrySchema).max(50),
  nextCursor: z.string().max(1000).nullable(),
});
export const adminProfileTransferInputSchema = z
  .object({
    destinationUserId: adminUserIdSchema,
    revision: z.number().int().min(0).max(2147483646),
  })
  .strict();
export const adminProfileTransferResultSchema = z.object({
  transferId: z.string().startsWith("ptransfer_").max(100),
  profileId: managedProfileIdSchema,
  sourceUserId: adminUserIdSchema,
  destinationUserId: adminUserIdSchema,
  revision: z.number().int().min(1),
  transferredAt: z.iso.datetime(),
});
export const adminProfileTransferErrorCodes = [
  "PROFILE_TRANSFER_SELF_UNAVAILABLE",
  "PROFILE_TRANSFER_SAME_ACCOUNT",
  "PROFILE_TRANSFER_BUSY",
  "PROFILE_TRANSFER_CONFLICT",
  "PROFILE_TRANSFER_DESTINATION_LIMIT",
  "PROFILE_TRANSFER_IDEMPOTENCY_REUSED",
] as const;
export type AdminProfileTransferInput = z.infer<typeof adminProfileTransferInputSchema>;
export type AdminProfileTransferResult = z.infer<typeof adminProfileTransferResultSchema>;
