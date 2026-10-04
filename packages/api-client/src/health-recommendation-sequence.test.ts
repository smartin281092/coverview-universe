import { expect, it } from "vitest";
import {
  recommendationInputSchema,
  recommendationResultSchema,
} from "@coverview/contracts/health-recommendation";
import { createLatestRecommendationRequest } from "./health-recommendation-sequence.js";
import { healthRequestSignal } from "./health-request-signal.js";
it("18 late or mismatched responses cannot overwrite the last confirmed profile", async () => {
  const input = recommendationInputSchema.parse({
    profileVersion: 1,
    tariff: { birthYear: 1990, accident: true, deductible: 300 },
    tariffKnown: { birth: true, locality: false },
    scope: "same_deductible",
    answers: {},
  });
  const result = recommendationResultSchema.parse({
    profileVersion: 1,
    rulesVersion: "test",
    catalogVersion: "test",
    year: 2027,
    scope: "same_deductible",
    subsidy: "before_unverified_subsidy",
    active: true,
    outcome: "provisional",
    ranked: [],
    unevaluable: [],
    leaders: { premium: [], annual: [], preferred: [] },
    nextQuestion: null,
    questionStates: [],
    messages: [],
    decisiveMissing: [],
    examinedCandidateCount: 0,
    examinedScenarios: 1,
    evidenceCounts: { models: 0, researched: 0, verified: 0, remaining: 0 },
  });
  const pending = new Map<number, (value: typeof result) => void>(),
    signals: AbortSignal[] = [];
  const requests = createLatestRecommendationRequest(
    (profile, signal) =>
      new Promise((resolve) => {
        pending.set(profile.profileVersion, resolve);
        signals.push(signal);
      }),
  );
  const old = requests.run(input),
    latest = requests.run({ ...input, profileVersion: 2 });
  expect(signals[0]?.aborted).toBe(true);
  pending.get(2)!({ ...result, profileVersion: 2 });
  expect((await latest)?.profileVersion).toBe(2);
  pending.get(1)!(result);
  expect(await old).toBeNull();
  const mismatch = requests.run({ ...input, profileVersion: 3 });
  pending.get(3)!(result);
  expect(await mismatch).toBeNull();
  const unmounted = requests.run({ ...input, profileVersion: 4 });
  requests.cancel();
  pending.get(4)!({ ...result, profileVersion: 4 });
  expect(await unmounted).toBeNull();
});
it("cancels portable HTTP requests without relying on AbortSignal.any", () => {
  const parent = new AbortController(),
    request = healthRequestSignal(parent.signal);
  expect(request.signal.aborted).toBe(false);
  parent.abort();
  expect(request.signal.aborted).toBe(true);
  request.dispose();
});
