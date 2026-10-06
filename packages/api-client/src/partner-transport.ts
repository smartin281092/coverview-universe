import type { z } from "zod";

export type PartnerMutation = { csrfToken: string; idempotencyKey: string; signal?: AbortSignal };
export type PartnerRequest = <T>(
  path: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
  body?: unknown,
  options?: PartnerMutation,
  binary?: boolean,
) => Promise<T>;
// Bytes served by the API as an attachment, such as a profile photo (C8c).
export type PartnerPicture = (path: string, signal?: AbortSignal) => Promise<Blob>;
