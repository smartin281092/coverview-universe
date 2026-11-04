import { monteCarlo, type MonteCarloRequest } from "./hyperion-monte-carlo";

// 100'000 trajectories off the page's thread. The reply carries the summary only.
type Request = MonteCarloRequest & { id: number };
const scope = globalThis as unknown as {
  addEventListener: (type: "message", listener: (event: MessageEvent<Request>) => void) => void;
  postMessage: (message: unknown) => void;
};
scope.addEventListener("message", (event) => {
  const { id, ...request } = event.data;
  try {
    scope.postMessage({ id, result: monteCarlo(request) });
  } catch (error) {
    scope.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
});
