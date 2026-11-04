/// <reference lib="webworker" />
// Les simulations tournent hors du fil principal ; un message par stratégie terminée, puis « done ».
import { simulate, type WorkerRequest, type WorkerResponse } from "./monte-carlo";

const scope = self as unknown as DedicatedWorkerGlobalScope;
const reply = (message: WorkerResponse) => scope.postMessage(message);

scope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, jobs } = event.data;
  try {
    for (const job of jobs) reply({ id, key: job.key, result: simulate(job.input) });
    reply({ id, done: true });
  } catch (error) {
    reply({ id, error: error instanceof Error ? error.message : "simulation" });
  }
};
