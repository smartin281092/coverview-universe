import { z } from "zod";
import { healthRequestSignal } from "./health-request-signal.js";
import {
  recommendationInputSchema,
  recommendationResultSchema,
  recommendationAdminStateSchema,
  recommendationPublishSchema,
  recommendationCatalogPublishSchema,
  operatorCaseUpdateSchema,
  operatorCaseSchema,
  evidenceCatalogSchema,
  evidenceModelListSchema,
  modelEvidenceSchema,
  type RecommendationInput,
  type RecommendationRules,
} from "@coverview/contracts/health-recommendation";
export type * from "@coverview/contracts/health-recommendation";
export { createLatestRecommendationRequest } from "./health-recommendation-sequence.js";
export class RecommendationApiError extends Error {
  constructor(public readonly status: number) {
    super("HEALTH_RECOMMENDATION_UNAVAILABLE");
  }
}
type Mutation = { csrfToken: string; idempotencyKey: string; signal?: AbortSignal | undefined };
export function createRecommendationClient(baseUrl: string) {
  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    body?: unknown,
    options?: Partial<Mutation>,
  ) {
    const admin = path.startsWith("/admin/");
    const requestSignal = healthRequestSignal(options?.signal);
    try {
      const response = await fetch(baseUrl.replace(/\/$/, "") + path, {
        method: body === undefined ? "GET" : "POST",
        credentials: admin ? "include" : "omit",
        cache: "no-store",
        signal: requestSignal.signal,
        headers: {
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...(options?.csrfToken ? { "x-csrf-token": options.csrfToken } : {}),
          ...(options?.idempotencyKey ? { "idempotency-key": options.idempotencyKey } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok) throw new RecommendationApiError(response.status);
      return schema.parse(await response.json());
    } finally {
      requestSignal.dispose();
    }
  }
  return {
    recommend: (input: RecommendationInput, signal?: AbortSignal) =>
      request(
        "/health-insurance/recommend",
        recommendationResultSchema,
        recommendationInputSchema.parse(input),
        { signal },
      ),
    catalog: (year: number, signal?: AbortSignal) =>
      request(
        `/health-insurance/recommendation-catalog?year=${year}`,
        evidenceCatalogSchema.nullable(),
        undefined,
        { signal },
      ),
    // Offers linked to a comparator model (9 October 2026): the models, then one model's facts.
    models: (year: number, signal?: AbortSignal) =>
      request(
        `/health-insurance/recommendation-catalog/models?year=${year}`,
        evidenceModelListSchema,
        undefined,
        { signal },
      ),
    modelEvidence: (modelId: string, year: number, signal?: AbortSignal) =>
      request(
        `/health-insurance/recommendation-catalog/models/${encodeURIComponent(modelId)}?year=${year}`,
        modelEvidenceSchema.nullable(),
        undefined,
        { signal },
      ),
    admin: (year: number, signal?: AbortSignal) =>
      request(
        `/admin/health-recommendation?year=${year}`,
        recommendationAdminStateSchema,
        undefined,
        { signal },
      ),
    simulate: (profile: RecommendationInput, config: RecommendationRules, options: Mutation) =>
      request(
        "/admin/health-recommendation/simulate",
        recommendationResultSchema,
        { profile: recommendationInputSchema.parse(profile), config },
        options,
      ),
    publish: (input: z.infer<typeof recommendationPublishSchema>, options: Mutation) =>
      request(
        "/admin/health-recommendation/publish",
        z.object({ id: z.string(), revision: z.number() }),
        recommendationPublishSchema.parse(input),
        options,
      ),
    catalogVersion: (id: string, signal?: AbortSignal) =>
      request(
        `/admin/health-recommendation/catalog/${encodeURIComponent(id)}`,
        evidenceCatalogSchema,
        undefined,
        { signal },
      ),
    publishCatalog: (
      input: z.infer<typeof recommendationCatalogPublishSchema>,
      options: Mutation,
    ) =>
      request(
        "/admin/health-recommendation/catalog",
        z.object({ id: z.string() }),
        recommendationCatalogPublishSchema.parse(input),
        options,
      ),
    review: (
      catalogId: string,
      id: string,
      input: z.infer<typeof operatorCaseUpdateSchema>,
      options: Mutation,
    ) =>
      request(
        `/admin/health-recommendation/reviews/${encodeURIComponent(catalogId)}/${encodeURIComponent(id)}`,
        operatorCaseSchema,
        operatorCaseUpdateSchema.parse(input),
        options,
      ),
  };
}
