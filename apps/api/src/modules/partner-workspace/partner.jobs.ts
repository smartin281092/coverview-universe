import { Queue, Worker, UnrecoverableError, createNodeRedisClient } from "bullmq";
import { createClient } from "redis";
import { z } from "zod";
import type { FastifyBaseLogger } from "fastify";
import type { Pool } from "pg";
import { processPartnerContinuity } from "./partner.continuity.js";
import { processAccessReviews } from "./partner.access.js";
import { processClientInvitations } from "./partner.invitations.js";
import type { Mailer } from "../../platform/mailer.js";

export async function startPartnerJobs(
  redisUrl: string,
  pool: Pool,
  logger: FastifyBaseLogger,
  invitations: { mailer: Mailer | null; walletOrigin: string },
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
  // Historical name: the queue also carries the client invitation sending job.
  const name = "coverview-partner-continuity-v1";
  const queue = new Queue(name, { connection: producer });
  const jobSchema = z.object({ version: z.literal(1) }).strict();
  const worker = new Worker(
    name,
    async (job) => {
      if (
        !["continuity", "invitations"].includes(job.name) ||
        !jobSchema.safeParse(job.data).success
      )
        throw new UnrecoverableError("PARTNER_JOB_INVALID");
      const started = Date.now();
      if (job.name === "invitations") {
        // Counts only: never a recipient, a token or a link in the logs.
        const result = await processClientInvitations(
          pool,
          invitations.mailer,
          invitations.walletOrigin,
        );
        if (result.sent || result.failed)
          logger.info(
            { jobId: job.id, ...result, durationMs: Date.now() - started },
            "Partner client invitations processed",
          );
        return result;
      }
      logger.info({ jobId: job.id }, "Partner continuity started");
      // Reviews that fell due open their re-review first (C8a); the continuity pass below then
      // treats the requests of the people who lost access. Counts only in the logs.
      const reviews = await processAccessReviews(pool);
      if (reviews.members || reviews.organizations)
        logger.info({ jobId: job.id, ...reviews }, "Partner access reviews opened");
      // Ten bounded batches per tick; the oldest unchecked Lead is picked first after a restart.
      let checked = 0,
        escalated = 0;
      for (let batch = 0; batch < 10; batch += 1) {
        const result = await processPartnerContinuity(pool);
        checked += result.checked;
        escalated += result.escalated;
        if (result.checked < 50) break;
      }
      logger.info(
        { jobId: job.id, checked, escalated, durationMs: Date.now() - started },
        "Partner continuity completed",
      );
      return { checked, escalated };
    },
    { connection: consumer, autorun: false, concurrency: 1, lockDuration: 60000 },
  );
  worker.on("error", () =>
    logger.warn({ dependency: "partner_worker" }, "Partner worker unavailable"),
  );
  queue.on("error", () =>
    logger.warn({ dependency: "partner_queue" }, "Partner queue unavailable"),
  );
  worker.on("failed", (job) =>
    logger.warn(
      { jobId: job?.id, attemptsMade: job?.attemptsMade },
      "Partner job failed; retained for retry or operator review",
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
        const opts = {
          attempts: 4,
          backoff: { type: "exponential", delay: 30000 },
          removeOnComplete: { age: 86400, count: 1000 },
          removeOnFail: { age: 604800, count: 1000 },
        };
        await queue.upsertJobScheduler(
          "invitations",
          { every: 60000 },
          { name: "invitations", data: { version: 1 }, opts },
        );
        await queue.upsertJobScheduler(
          "continuity",
          { every: 60000 },
          { name: "continuity", data: { version: 1 }, opts },
        );
      })(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Partner scheduler unavailable")), 20000);
      }),
    ]);
    void worker
      .run()
      .catch(() => logger.error({ dependency: "partner_worker" }, "Partner worker stopped"));
    return close;
  } catch (error) {
    await close();
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
