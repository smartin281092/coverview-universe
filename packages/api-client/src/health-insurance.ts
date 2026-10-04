import { z } from "zod";
import { healthRequestSignal } from "./health-request-signal.js";
import {
  healthCompareInputSchema,
  healthComparisonSchema,
  healthLocalitiesSchema,
  healthStatusSchema,
  healthModelDetailsSchema,
  healthGuideInputSchema,
  healthGuideResultSchema,
  healthLocateInputSchema,
  healthLocationSuggestionSchema,
  healthCurrentOptionsInputSchema,
  healthCurrentOptionsSchema,
  healthCurrentComparisonInputSchema,
  healthCurrentComparisonSchema,
  type HealthCurrentOptionsInput,
  type HealthCurrentComparisonInput,
  type HealthCompareInput,
  type HealthGuideInput,
} from "@coverview/contracts/health-insurance";
export type {
  HealthCompareInput,
  HealthOffer,
  HealthLocality,
  HealthStatus,
  HealthComparison,
  HealthModelDetails,
  HealthGuideInput,
  HealthGuideResult,
  HealthCurrentSelection,
  HealthCurrentOffer,
  HealthCurrentOptions,
  HealthCurrentComparison,
  HealthPremiumDifference,
} from "@coverview/contracts/health-insurance";

export function createHealthClient(baseUrl: string) {
  const base = new URL(baseUrl);
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password)
    throw new Error("Invalid public API origin");
  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    signal?: AbortSignal,
    body?: unknown,
  ): Promise<T> {
    const requestSignal = healthRequestSignal(signal);
    try {
      const response = await fetch(new URL("/health-insurance" + path, base), {
        method: body === undefined ? "GET" : "POST",
        credentials: "omit",
        cache: "no-store",
        signal: requestSignal.signal,
        headers: {
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok) throw new Error("HEALTH_REQUEST_FAILED");
      return schema.parse(await response.json());
    } finally {
      requestSignal.dispose();
    }
  }
  return {
    currentOptions: (input: HealthCurrentOptionsInput, signal?: AbortSignal) =>
      request(
        "/current/options",
        healthCurrentOptionsSchema,
        signal,
        healthCurrentOptionsInputSchema.parse(input),
      ),
    currentCompare: (input: HealthCurrentComparisonInput, signal?: AbortSignal) =>
      request(
        "/current/compare",
        healthCurrentComparisonSchema,
        signal,
        healthCurrentComparisonInputSchema.parse(input),
      ),
    currentLocalities: (query: string, signal?: AbortSignal) =>
      request(
        "/current/localities?" + new URLSearchParams({ q: query }).toString(),
        healthLocalitiesSchema,
        signal,
      ),
    status: (signal?: AbortSignal) => request("/status", healthStatusSchema, signal),
    locate: (input: z.infer<typeof healthLocateInputSchema>, signal?: AbortSignal) =>
      request(
        "/locate",
        healthLocationSuggestionSchema,
        signal,
        healthLocateInputSchema.parse(input),
      ),
    localities: (query: string, signal?: AbortSignal) =>
      request(
        "/localities?" + new URLSearchParams({ q: query }).toString(),
        healthLocalitiesSchema,
        signal,
      ),
    compare: (input: HealthCompareInput, signal?: AbortSignal) =>
      request("/compare", healthComparisonSchema, signal, healthCompareInputSchema.parse(input)),
    modelOffer: async (
      input: HealthCompareInput,
      modelId: string,
      insurerId: number,
      signal?: AbortSignal,
    ) => {
      let offset = 0;
      while (offset <= 500) {
        signal?.throwIfAborted();
        const page = await request(
          "/compare",
          healthComparisonSchema,
          signal,
          healthCompareInputSchema.parse({
            ...input,
            insurerIds: [insurerId],
            categories: [],
            benefitKeys: [],
            offset,
          }),
        );
        const offer = page.offers.find(
          (item) => item.modelId === modelId && item.insurerId === insurerId,
        );
        if (offer) return offer;
        if (page.nextOffset === null) return null;
        if (page.nextOffset <= offset) throw new Error("HEALTH_MODEL_LOOKUP_PAGINATION");
        offset = page.nextOffset;
      }
      throw new Error("HEALTH_MODEL_LOOKUP_LIMIT");
    },
    details: (id: string, signal?: AbortSignal) =>
      request("/models/" + encodeURIComponent(id), healthModelDetailsSchema, signal),
    guide: (input: HealthGuideInput, signal?: AbortSignal) =>
      request("/guide", healthGuideResultSchema, signal, healthGuideInputSchema.parse(input)),
  };
}
export { healthCompareInputSchema } from "@coverview/contracts/health-insurance";
