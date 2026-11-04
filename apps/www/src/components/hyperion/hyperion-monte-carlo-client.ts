import { monteCarlo, type MonteCarloRequest, type MonteCarloResult } from "./hyperion-monte-carlo";

// The worker is created on first use; without workers, or if it fails, the page's thread computes.
let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<
  number,
  { resolve: (value: MonteCarloResult) => void; reject: (reason: Error) => void }
>();

function failAll(message: string) {
  for (const request of pending.values()) request.reject(new Error(message));
  pending.clear();
  worker?.terminate();
  worker = null;
}

export function simulateMonteCarlo(request: MonteCarloRequest): Promise<MonteCarloResult> {
  if (typeof Worker === "undefined") return Promise.resolve(monteCarlo(request));
  try {
    worker ??= new Worker(new URL("./hyperion-monte-carlo.worker.ts", import.meta.url), {
      type: "module",
    });
  } catch {
    return Promise.resolve(monteCarlo(request));
  }
  const current = worker;
  current.onmessage = ({
    data,
  }: MessageEvent<{ id: number; result?: MonteCarloResult; error?: string }>) => {
    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    if (data.result) entry.resolve(data.result);
    else entry.reject(new Error(data.error ?? "HYPERION_MONTE_CARLO_FAILED"));
  };
  current.onerror = () => failAll("HYPERION_MONTE_CARLO_UNAVAILABLE");
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    current.postMessage({ id, ...request });
  });
}
