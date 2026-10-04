import { z } from "zod";
import { authorizationIdSchema, authorizationKindSchema } from "./authorizations.js";
import { adminUserIdSchema } from "./admin-users.js";
import { managedProfileIdSchema } from "./managed-profiles.js";

export const adminNotificationsQuerySchema = z
  .object({ cursor: z.string().max(500).optional() })
  .strict();
export const adminNotificationsSchema = z.object({
  notifications: z
    .array(
      z.object({
        id: authorizationIdSchema,
        userId: adminUserIdSchema,
        profileId: managedProfileIdSchema,
        profileName: z.string().max(160),
        accountEmail: z.email(),
        kind: authorizationKindSchema,
        signedAt: z.iso.datetime(),
        revokedAt: z.iso.datetime().nullable(),
      }),
    )
    .max(20),
  nextCursor: z.string().max(500).nullable(),
});
