import { z } from "zod";
import {
  pilotageQuerySchema,
  pilotageSchema,
  pilotageSourceQuerySchema,
  pilotageSourcesSchema,
  pilotageOptionsSchema,
  goalInputSchema,
  goalSchema,
  goalsQuerySchema,
  goalsSchema,
  type PilotageQuery,
  type PilotageMetric,
} from "@coverview/contracts/partner-pilotage";
import type { PartnerMutation, PartnerRequest } from "./partner-transport.js";
export function createPilotageClient(request: PartnerRequest) {
  const id = encodeURIComponent,
    search = (value: Record<string, string | undefined>) =>
      new URLSearchParams(
        Object.entries(value).filter((entry): entry is [string, string] => entry[1] !== undefined),
      ).toString();
  return {
    pilotage: (query: PilotageQuery, signal?: AbortSignal) =>
      request(
        `/partner/pilotage?${search(pilotageQuerySchema.parse(query))}`,
        pilotageSchema,
        signal,
      ),
    pilotageSources: (
      query: PilotageQuery & { metric: PilotageMetric; cursor?: string },
      signal?: AbortSignal,
    ) =>
      request(
        `/partner/pilotage/sources?${search(pilotageSourceQuerySchema.parse(query))}`,
        pilotageSourcesSchema,
        signal,
      ),
    pilotageOptions: (signal?: AbortSignal) =>
      request("/partner/pilotage/options", pilotageOptionsSchema, signal),
    goals: (query: z.input<typeof goalsQuerySchema>, signal?: AbortSignal) =>
      request(`/partner/goals?${search(goalsQuerySchema.parse(query))}`, goalsSchema, signal),
    goal: (goalId: string, beforeRevision?: number, signal?: AbortSignal) =>
      request(
        `/partner/goals/${id(goalId)}${beforeRevision ? `?beforeRevision=${beforeRevision}` : ""}`,
        goalSchema,
        signal,
      ),
    saveGoal: (goalId: string | null, input: z.infer<typeof goalInputSchema>, o: PartnerMutation) =>
      request(
        `/partner/goals${goalId ? `/${id(goalId)}` : ""}`,
        goalSchema,
        o.signal,
        goalInputSchema.parse(input),
        o,
      ),
  };
}
