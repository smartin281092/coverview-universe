import type { z } from "zod";
import { healthRequestSignal } from "./health-request-signal.js";
import {
  supplementaryAssistantInputSchema,
  supplementaryAssistantResultSchema,
  supplementaryCatalogSchema,
  supplementaryQuoteInputSchema,
  supplementaryQuoteSchema,
  type SupplementaryAssistantInput,
  type SupplementaryQuoteInput,
} from "@coverview/contracts/supplementary-insurance";
export type * from "@coverview/contracts/supplementary-insurance";
export {
  supplementaryCantons,
  supplementaryAssistantInputSchema,
} from "@coverview/contracts/supplementary-insurance";

export class SupplementaryApiError extends Error {
  constructor(public readonly status: number) {
    super("SUPPLEMENTARY_REQUEST_FAILED");
  }
}

// Public, anonymous client of the supplementary insurance comparator (no cookie, no session).
export function createSupplementaryClient(baseUrl: string) {
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
      const response = await fetch(new URL("/supplementary-insurance" + path, base), {
        method: body === undefined ? "GET" : "POST",
        credentials: "omit",
        // The catalogue is versioned by the server (ETag); quotes and answers are not cached.
        cache: body === undefined ? "default" : "no-store",
        signal: requestSignal.signal,
        headers: {
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok) throw new SupplementaryApiError(response.status);
      return schema.parse(await response.json());
    } finally {
      requestSignal.dispose();
    }
  }
  return {
    catalog: (signal?: AbortSignal) => request("/catalog", supplementaryCatalogSchema, signal),
    quote: (input: SupplementaryQuoteInput, signal?: AbortSignal) =>
      request("/quote", supplementaryQuoteSchema, signal, supplementaryQuoteInputSchema.parse(input)),
    assistant: (input: SupplementaryAssistantInput, signal?: AbortSignal) =>
      request(
        "/assistant",
        supplementaryAssistantResultSchema,
        signal,
        supplementaryAssistantInputSchema.parse(input),
      ),
  };
}
