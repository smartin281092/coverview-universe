import { z } from "zod";
import {
  adminUserIdSchema,
  managedProfileIdSchema,
  clientActivityIdSchema,
  clientActivitiesQuerySchema,
  clientActivitiesSchema,
  clientActivitySchema,
  clientActivityCreateInputSchema,
  clientActivityUpdateInputSchema,
} from "@coverview/contracts";

type RequestOptions = { signal?: AbortSignal };
type MutationOptions = RequestOptions & { csrfToken: string; idempotencyKey: string };
type Request = <T>(
  path: string,
  schema: z.ZodType<T>,
  options?: RequestOptions,
  mutation?: { body: unknown; credentials: MutationOptions },
  authenticated?: boolean,
) => Promise<T>;

export function clientActivityMethods(request: Request) {
  const base = (userId: string, profileId: string) =>
    `/admin/users/${encodeURIComponent(adminUserIdSchema.parse(userId))}/profiles/${encodeURIComponent(managedProfileIdSchema.parse(profileId))}/activities`;
  return {
    adminClientActivities: (
      userId: string,
      profileId: string,
      query: z.input<typeof clientActivitiesQuerySchema> = {},
      options?: RequestOptions,
    ) =>
      request(
        `${base(userId, profileId)}?${new URLSearchParams(Object.entries(clientActivitiesQuerySchema.parse(query)).filter(([, value]) => value !== undefined) as [string, string][])}`,
        clientActivitiesSchema,
        options,
        undefined,
        true,
      ),
    adminClientActivity: (
      userId: string,
      profileId: string,
      id: string,
      options?: RequestOptions,
    ) =>
      request(
        `${base(userId, profileId)}/${clientActivityIdSchema.parse(id)}`,
        clientActivitySchema,
        options,
        undefined,
        true,
      ),
    createAdminClientActivity: (
      userId: string,
      profileId: string,
      input: z.input<typeof clientActivityCreateInputSchema>,
      options: MutationOptions,
    ) =>
      request(
        base(userId, profileId),
        clientActivitySchema,
        options,
        { body: clientActivityCreateInputSchema.parse(input), credentials: options },
        true,
      ),
    updateAdminClientActivity: (
      userId: string,
      profileId: string,
      id: string,
      input: z.input<typeof clientActivityUpdateInputSchema>,
      options: MutationOptions,
    ) =>
      request(
        `${base(userId, profileId)}/${clientActivityIdSchema.parse(id)}`,
        clientActivitySchema,
        options,
        { body: clientActivityUpdateInputSchema.parse(input), credentials: options },
        true,
      ),
  };
}
