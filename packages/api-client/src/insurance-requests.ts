import { z } from "zod";
export { insurancePersonSchema } from "@coverview/contracts/insurance-requests";
import {
  insuranceBrowserSchema,
  insuranceEmailInputSchema,
  insuranceEmailResultSchema,
  insuranceCodeInputSchema,
  insuranceCartSchema,
  insuranceRequestSchema,
  insuranceRequestListSchema,
  insuranceRequestListQuerySchema,
  insuranceTransitionInputSchema,
  insuranceRequestIdSchema,
  insurancePreviousContractInputSchema,
  type InsuranceCart,
  type InsurancePreviousContractInput,
  type InsuranceRequestListQuery,
  type InsuranceTransitionInput,
} from "@coverview/contracts/insurance-requests";
export type {
  InsuranceCart,
  InsurancePerson,
  InsurancePreviousContract,
  InsuranceRequest,
  InsuranceRequestState,
} from "@coverview/contracts/insurance-requests";
export class InsuranceApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}
type Mutation = { csrfToken: string; idempotencyKey: string; signal?: AbortSignal | undefined };
export function createInsuranceClient(baseUrl: string) {
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
      throw new InsuranceApiError(
        error.success ? error.data.error.code : "INSURANCE_REQUEST_UNAVAILABLE",
        response.status,
      );
    }
    return schema.parse(json);
  }
  const path = (id: string) =>
    `/insurance-requests/${encodeURIComponent(insuranceRequestIdSchema.parse(id))}`;
  return {
    draft: (signal?: AbortSignal) =>
      request("/insurance-requests/draft", insuranceRequestSchema.nullable(), undefined, {
        signal,
      }),
    browser: (signal?: AbortSignal) =>
      request("/insurance-requests/browser", insuranceBrowserSchema, undefined, { signal }),
    email: (email: string, options: Mutation, access: "guest" | "wallet" = "wallet") =>
      request(
        "/insurance-requests/email",
        insuranceEmailResultSchema,
        insuranceEmailInputSchema.parse({ email, access }),
        options,
      ),
    verify: (id: string, code: string, options: Mutation) =>
      request(
        `${path(id)}/verify-email`,
        insuranceRequestSchema,
        insuranceCodeInputSchema.parse({ code }),
        options,
      ),
    claim: (id: string, options: Mutation) =>
      request(`${path(id)}/claim`, insuranceRequestSchema, {}, options),
    cart: (id: string, input: InsuranceCart, options: Mutation) =>
      request(
        `${path(id)}/cart`,
        insuranceRequestSchema,
        insuranceCartSchema.parse(input),
        options,
      ),
    submit: (id: string, input: InsuranceCart, options: Mutation) =>
      request(
        `${path(id)}/submit`,
        insuranceRequestSchema,
        insuranceCartSchema.parse(input),
        options,
      ),
    get: (id: string, signal?: AbortSignal, admin = false) =>
      request(`${admin ? "/admin" : ""}${path(id)}`, insuranceRequestSchema, undefined, { signal }),
    list: (query: InsuranceRequestListQuery, signal?: AbortSignal, admin = false) => {
      const params = new URLSearchParams(
        Object.entries(insuranceRequestListQuerySchema.parse(query)).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      );
      return request(
        `${admin ? "/admin" : ""}/insurance-requests?${params}`,
        insuranceRequestListSchema,
        undefined,
        { signal },
      );
    },
    previousContract: (id: string, input: InsurancePreviousContractInput, options: Mutation) =>
      request(
        `${path(id)}/previous-contract`,
        insuranceRequestSchema,
        insurancePreviousContractInputSchema.parse(input),
        options,
      ),
    transition: (id: string, input: InsuranceTransitionInput, options: Mutation) =>
      request(
        `/admin${path(id)}/transition`,
        insuranceRequestSchema,
        insuranceTransitionInputSchema.parse(input),
        options,
      ),
  };
}
