import { z } from "zod";
import {
  leadCommandSchema,
  leadCreateInputSchema,
  leadDetailSchema,
  leadListSchema,
  leadListQuerySchema,
  partnerContextSchema,
  partnerApplicationInputSchema,
  partnerApplicationsSchema,
  partnerReviewInputSchema,
  partnerApplicationSchema,
  partnerDirectorySchema,
  partnerDashboardSchema,
  offerExtractionSchema,
  partnerWorkSchema,
  type LeadCreateInput,
  type LeadCommand,
  type LeadListQuery,
} from "@coverview/contracts/partner";
export type {
  LeadDetail,
  LeadSummary,
  LeadStage,
  LeadOffer,
  PartnerApplication,
  PartnerContext,
} from "@coverview/contracts/partner";
export class PartnerApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}
export type PartnerMutation = { csrfToken: string; idempotencyKey: string; signal?: AbortSignal };
export function createPartnerClient(baseUrl: string) {
  const base = new URL(baseUrl);
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password)
    throw new Error("Invalid API URL");
  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    signal?: AbortSignal,
    body?: unknown,
    options?: PartnerMutation,
  ) {
    const response = await fetch(new URL(path, base), {
      method: body === undefined ? "GET" : "POST",
      credentials: "include",
      cache: "no-store",
      signal: signal
        ? AbortSignal.any([AbortSignal.timeout(20000), signal])
        : AbortSignal.timeout(20000),
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
    const payload: unknown = await response.json();
    if (!response.ok) {
      const parsed = z.object({ error: z.object({ code: z.string() }) }).safeParse(payload);
      throw new PartnerApiError(
        parsed.success ? parsed.data.error.code : "PARTNER_UNAVAILABLE",
        response.status,
      );
    }
    return schema.parse(payload);
  }
  const path = (wallet = false) => (wallet ? "/wallet/leads" : "/partner/leads");
  return {
    dashboard: (signal?: AbortSignal) =>
      request("/partner/dashboard", partnerDashboardSchema, signal),
    work: (signal?: AbortSignal) => request("/partner/work", partnerWorkSchema, signal),
    context: (signal?: AbortSignal) => request("/partner/context", partnerContextSchema, signal),
    application: (input: z.infer<typeof partnerApplicationInputSchema>, options: PartnerMutation) =>
      request(
        "/partner/application",
        partnerContextSchema,
        options.signal,
        partnerApplicationInputSchema.parse(input),
        options,
      ),
    applications: (signal?: AbortSignal) =>
      request("/admin/partner/applications", partnerApplicationsSchema, signal),
    review: (
      id: string,
      input: z.infer<typeof partnerReviewInputSchema>,
      options: PartnerMutation,
    ) =>
      request(
        `/admin/partner/applications/${encodeURIComponent(id)}/review`,
        partnerApplicationSchema,
        options.signal,
        partnerReviewInputSchema.parse(input),
        options,
      ),
    directory: (signal?: AbortSignal) =>
      request("/partner/directory", partnerDirectorySchema, signal),
    list: (query: Partial<LeadListQuery>, signal?: AbortSignal, wallet = false) =>
      request(
        `${path(wallet)}?${new URLSearchParams(Object.entries(leadListQuerySchema.parse(query)).map(([key, value]) => [key, String(value)]))}`,
        leadListSchema,
        signal,
      ),
    lead: (id: string, signal?: AbortSignal, wallet = false) =>
      request(`${path(wallet)}/${encodeURIComponent(id)}`, leadDetailSchema, signal),
    create: (input: LeadCreateInput, options: PartnerMutation, wallet = false) =>
      request(
        path(wallet),
        leadDetailSchema,
        options.signal,
        leadCreateInputSchema.parse(input),
        options,
      ),
    command: (id: string, input: LeadCommand, options: PartnerMutation, wallet = false) =>
      request(
        `${path(wallet)}/${encodeURIComponent(id)}/commands`,
        leadDetailSchema,
        options.signal,
        leadCommandSchema.parse(input),
        options,
      ),
    extraction: (leadId: string, documentId: string, signal?: AbortSignal) =>
      request(
        `/partner/leads/${encodeURIComponent(leadId)}/extraction/${encodeURIComponent(documentId)}`,
        offerExtractionSchema,
        signal,
      ),
    sourceUrl: (leadId: string, offerId: string, wallet = false) =>
      new URL(
        `${path(wallet)}/${encodeURIComponent(leadId)}/offers/${encodeURIComponent(offerId)}/source`,
        base,
      ).href,
  };
}
