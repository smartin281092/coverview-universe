import type { z } from "zod";

export type PartnerMutation = { csrfToken: string; idempotencyKey: string; signal?: AbortSignal };
export type PartnerRequest = <T>(
  path: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
  body?: unknown,
  options?: PartnerMutation,
) => Promise<T>;
