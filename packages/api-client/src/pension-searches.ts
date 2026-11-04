import { z } from "zod";
import {
  pensionSearchBrowserSchema,
  pensionSearchCodeInputSchema,
  pensionSearchEmailInputSchema,
  pensionSearchEmailResultSchema,
  pensionSearchIdSchema,
  pensionSearchListQuerySchema,
  pensionSearchListSchema,
  pensionSearchSchema,
  pensionSearchSubmitInputSchema,
  pensionSearchTransitionInputSchema,
  pensionSearchVerifyResultSchema,
  type PensionSearchListQuery,
  type PensionSearchTransitionInput,
} from "@coverview/contracts/pension-searches";
export {
  pensionSearchDetailsSchema,
  pensionSearchStages,
} from "@coverview/contracts/pension-searches";
export type {
  PensionSearch,
  PensionSearchDetails,
  PensionSearchDetailsInput,
  PensionSearchEmployer,
  PensionSearchSituation,
  PensionSearchState,
} from "@coverview/contracts/pension-searches";
export class PensionSearchApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}
type Mutation = { csrfToken: string; idempotencyKey: string; signal?: AbortSignal | undefined };
export function createPensionSearchClient(baseUrl: string) {
  const base = new URL(baseUrl);
  if (!["https:", "http:"].includes(base.protocol) || base.username || base.password)
    throw new Error("Invalid API URL");
  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    body?: unknown,
    options?: Partial<Mutation>,
  ) {
    const timeout = AbortSignal.timeout(20000);
    const response = await fetch(new URL(path, base), {
      method: body === undefined ? "GET" : "POST",
      credentials: "include",
      cache: "no-store",
      signal: options?.signal ? AbortSignal.any([timeout, options.signal]) : timeout,
      headers: {
        Accept: "application/json",
        ...(body === undefined
          ? {}
          : {
              "Content-Type": "application/json",
              "X-CSRF-Token": options?.csrfToken ?? "",
              "Idempotency-Key": options?.idempotencyKey ?? "",
            }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const json: unknown = await response.json();
    if (!response.ok) {
      const error = z.object({ error: z.object({ code: z.string() }) }).safeParse(json);
      throw new PensionSearchApiError(
        error.success ? error.data.error.code : "PENSION_SEARCH_UNAVAILABLE",
        response.status,
      );
    }
    return schema.parse(json);
  }
  const path = (id: string) =>
    `/pension-searches/${encodeURIComponent(pensionSearchIdSchema.parse(id))}`;
  const query = (value: PensionSearchListQuery) =>
    new URLSearchParams(
      Object.entries(pensionSearchListQuerySchema.parse(value)).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  return {
    browser: (signal?: AbortSignal) =>
      request("/pension-searches/browser", pensionSearchBrowserSchema, undefined, { signal }),
    email: (email: string, options: Mutation) =>
      request(
        "/pension-searches/email",
        pensionSearchEmailResultSchema,
        pensionSearchEmailInputSchema.parse({ email }),
        options,
      ),
    verify: (code: string, options: Mutation) =>
      request(
        "/pension-searches/verify-email",
        pensionSearchVerifyResultSchema,
        pensionSearchCodeInputSchema.parse({ code }),
        options,
      ),
    submit: (input: z.input<typeof pensionSearchSubmitInputSchema>, options: Mutation) =>
      request(
        "/pension-searches",
        pensionSearchSchema,
        pensionSearchSubmitInputSchema.parse(input),
        options,
      ),
    get: (id: string, signal?: AbortSignal, admin = false) =>
      request(`${admin ? "/admin" : ""}${path(id)}`, pensionSearchSchema, undefined, { signal }),
    list: (value: PensionSearchListQuery, signal?: AbortSignal, admin = false) =>
      request(
        `${admin ? "/admin" : ""}/pension-searches?${query(value)}`,
        pensionSearchListSchema,
        undefined,
        { signal },
      ),
    transition: (id: string, input: PensionSearchTransitionInput, options: Mutation) =>
      request(
        `/admin${path(id)}/transition`,
        pensionSearchSchema,
        pensionSearchTransitionInputSchema.parse(input),
        options,
      ),
  };
}
