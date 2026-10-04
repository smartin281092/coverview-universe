import { z } from "zod";
import {
  adminProfileDirectoryQuerySchema,
  adminProfileDirectorySchema,
  adminProfileTransferInputSchema,
  adminProfileTransferResultSchema,
  adminUserIdSchema,
  managedProfileIdSchema,
} from "@coverview/contracts";

type Options = { signal?: AbortSignal };
type Mutation = Options & { csrfToken: string; idempotencyKey: string };
type Request = <T>(
  path: string,
  schema: z.ZodType<T>,
  options?: Options,
  mutation?: { body: unknown; credentials: Mutation; timeoutMs?: number },
  authenticated?: boolean,
) => Promise<T>;

export function createAdminProfileTransferClient(request: Request) {
  return {
    adminProfileDirectory: (
      query: z.input<typeof adminProfileDirectoryQuerySchema> = {},
      options?: Options,
    ) =>
      request(
        `/admin/profiles?${new URLSearchParams(
          Object.entries(adminProfileDirectoryQuerySchema.parse(query))
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => [key, String(value)]),
        )}`,
        adminProfileDirectorySchema,
        options,
        undefined,
        true,
      ),
    transferAdminProfile: (
      userId: string,
      profileId: string,
      input: z.infer<typeof adminProfileTransferInputSchema>,
      options: Mutation,
    ) =>
      request(
        `/admin/users/${encodeURIComponent(adminUserIdSchema.parse(userId))}/profiles/${encodeURIComponent(managedProfileIdSchema.parse(profileId))}/transfer`,
        adminProfileTransferResultSchema,
        options,
        {
          body: adminProfileTransferInputSchema.parse(input),
          credentials: options,
          timeoutMs: 15000,
        },
        true,
      ),
  };
}
