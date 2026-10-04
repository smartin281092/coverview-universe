import type {
  RecommendationInput,
  RecommendationResult,
} from "@coverview/contracts/health-recommendation";
/** One result commits the ranking, explanations and next question as a single versioned snapshot. */
export function createLatestRecommendationRequest(
  request: (profile: RecommendationInput, signal: AbortSignal) => Promise<RecommendationResult>,
) {
  let current = 0,
    active: AbortController | null = null;
  return {
    cancel() {
      current++;
      active?.abort();
      active = null;
    },
    async run(profile: RecommendationInput) {
      const id = ++current;
      active?.abort();
      const controller = new AbortController();
      active = controller;
      try {
        const result = await request(profile, controller.signal);
        return id === current &&
          !controller.signal.aborted &&
          result.profileVersion === profile.profileVersion
          ? result
          : null;
      } catch (error) {
        if (id !== current || controller.signal.aborted) return null;
        throw error;
      }
    },
  };
}
