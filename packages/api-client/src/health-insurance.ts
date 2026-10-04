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
    details: (id: string, signal?: AbortSignal) =>
      request("/models/" + encodeURIComponent(id), healthModelDetailsSchema, signal),
    guide: (input: HealthGuideInput, signal?: AbortSignal) =>
      request("/guide", healthGuideResultSchema, signal, healthGuideInputSchema.parse(input)),
  };
}
export { healthCompareInputSchema } from "@coverview/contracts/health-insurance";
