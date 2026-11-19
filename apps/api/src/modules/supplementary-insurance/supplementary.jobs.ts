import { Queue, UnrecoverableError, Worker, createNodeRedisClient } from "bullmq";
import { createClient } from "redis";
import { z } from "zod";
import type { FastifyBaseLogger } from "fastify";
import type { Pool } from "pg";
import type { Mailer } from "../../platform/mailer.js";
import { processSupplementaryOrders, type OrderSettings } from "./supplementary.orders.js";

// Scheduled job of the orders' notices (19 November 2026), every minute, as the Partner job that
// sends the horizon3 notices. Several API instances may run it: claims use SKIP LOCKED.
export async function startSupplementaryJobs(
  redisUrl: string,
  pool: Pool,
  logger: FastifyBaseLogger,
  mailer: Mailer,
  settings: OrderSettings,
) {
  const connection = () =>
    createNodeRedisClient(
      createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 5000,
          reconnectStrategy: (retries) => Math.min(500 * (retries + 1), 5000),
        },
        disableOfflineQueue: true,
        commandsQueueMaxLength: 100,
        commandOptions: { timeout: 15000 },
      }),
    );
  const producer = connection(),
    consumer = connection();
  const name = "coverview-supplementary-orders-v1";
  const queue = new Queue(name, { connection: producer });
  const jobSchema = z.object({ version: z.literal(1) }).strict();
  const worker = new Worker(
    name,
    async (job) => {
      if (job.name !== "order-notices" || !jobSchema.safeParse(job.data).success)
        throw new UnrecoverableError("SUPPLEMENTARY_JOB_INVALID");
      const started = Date.now();
      // Counts only: never a name, an address, a product or a reference in the logs.
      const result = await processSupplementaryOrders(pool, mailer, settings);
      if (result.sent || result.failed)
        logger.info(
          { jobId: job.id, ...result, durationMs: Date.now() - started },
          "Supplementary order notices processed",
        );
      return result;
    },
    { connection: consumer, autorun: false, concurrency: 1, lockDuration: 60000 },
  );
  worker.on("error", () =>
    logger.warn({ dependency: "supplementary_worker" }, "Supplementary worker unavailable"),
  );
  queue.on("error", () =>
    logger.warn({ dependency: "supplementary_queue" }, "Supplementary queue unavailable"),
  );
  worker.on("failed", (job) =>
    logger.warn(
      { jobId: job?.id, attemptsMade: job?.attemptsMade },
      "Supplementary job failed; retained for retry or operator review",
    ),
  );
  async function close() {
    const closing = Promise.all([worker.close(), queue.close()]);
    producer.disconnect();
    consumer.disconnect();
    await closing;
  }
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      (async () => {
        await Promise.all([queue.waitUntilReady(), worker.waitUntilReady()]);
        await queue.upsertJobScheduler(
          "order-notices",
          { every: 60000 },
          {
            name: "order-notices",
            data: { version: 1 },
            opts: {
              attempts: 4,
              backoff: { type: "exponential", delay: 30000 },
              removeOnComplete: { age: 86400, count: 1000 },
              removeOnFail: { age: 604800, count: 1000 },
            },
          },
        );
      })(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Supplementary scheduler unavailable")), 20000);
      }),
    ]);
    void worker
      .run()
      .catch(() =>
        logger.error({ dependency: "supplementary_worker" }, "Supplementary worker stopped"),
      );
    return close;
  } catch (error) {
    await close();
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
