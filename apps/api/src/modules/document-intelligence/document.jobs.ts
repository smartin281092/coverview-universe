import { createHash } from "node:crypto";
import { Queue, Worker, UnrecoverableError } from "bullmq";
import { z } from "zod";
import type { FastifyBaseLogger } from "fastify";
import type { FileStorage } from "../../platform/file-storage.js";
import { createOpenAiProvider, LlmError } from "../../platform/llm-provider.js";
import { scanDocument, ProcessingError } from "./document.antivirus.js";
import type { DocumentConfig } from "./document.config.js";
import { extractDocument } from "./document.extraction.js";
import { DocumentError, type createDocumentRepository } from "./document.repository.js";

const jobSchema = z
  .object({
    id: z.string().uuid(),
    documentId: z.string().regex(/^doc_[0-9a-f-]{36}$/),
    userId: z.string().min(1).max(200),
    generation: z.number().int().nonnegative(),
    type: z.enum([
      "document.uploaded.v1",
      "document.retry_requested.v1",
      "document.deletion_requested.v1",
    ]),
  })
  .strict();
export function startDocumentJobs(
  config: DocumentConfig,
  repository: ReturnType<typeof createDocumentRepository>,
  storage: FileStorage,
  logger: FastifyBaseLogger,
) {
  const redis = new URL(config.redisUrl);
  const connection = {
    host: redis.hostname,
    port: Number(redis.port || 6379),
    ...(redis.password ? { password: decodeURIComponent(redis.password) } : {}),
    ...(redis.username ? { username: decodeURIComponent(redis.username) } : {}),
    ...(redis.protocol === "rediss:" ? { tls: {} } : {}),
    db: Number(redis.pathname.slice(1) || 0),
    connectTimeout: 5000,
  };
  const queue = new Queue("coverview-documents-v1", {
    connection: {
      ...connection,
      maxRetriesPerRequest: 1,
      commandTimeout: 10000,
      enableOfflineQueue: false,
    },
  });
  const provider = createOpenAiProvider(config);
  const abort = new AbortController();
  const worker = new Worker(
    "coverview-documents-v1",
    async (job) => {
      if (job.name === "maintenance") {
        await repository.cleanup();
        return;
      }
      const data = jobSchema.parse(job.data);
      const row = await repository.jobRow(data.userId, data.documentId, data.generation);
      if (!row || row.state === "deleted") return;
      if (data.type === "document.deletion_requested.v1") {
        if (row.state !== "deleting" || !row.deletedAt) return;
        // Storage operations have finite timeouts. A delayed second delete catches a late PUT even after an API crash.
        await storage.remove(row.objectKey);
        if (Date.now() - row.deletedAt.getTime() < 120000)
          throw new ProcessingError("deletion_settling", true);
        await repository.finishDelete(row.userId, row.id, row.generation);
        return;
      }
      if (row.deletedAt || ["ready", "quarantined", "pending"].includes(row.state)) return;
      try {
        if (
          !(await repository.transition(row.userId, row.id, row.generation, {
            state: "scanning",
            failure: null,
          }))
        )
          return;
        const bytes = await storage.get(row.objectKey);
        if (
          bytes.length !== row.size ||
          createHash("sha256").update(bytes).digest("hex") !== row.checksum
        )
          throw new ProcessingError("integrity_failed", false);
        const scanVersion = await scanDocument(bytes, config);
        if (
          !(await repository.transition(row.userId, row.id, row.generation, {
            state: "reading",
            scanVersion,
          }))
        )
          return;
        if (!row.analysisRequested) {
          await repository.transition(row.userId, row.id, row.generation, {
            state: "ready",
            failure: null,
          });
          return;
        }
        if (!["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(row.mime))
          throw new ProcessingError("format_unsupported", false);
        if (!(await provider.available())) throw new ProcessingError("ai_not_configured", false);
        const call = await repository.reserveAi(
          row.userId,
          row.id,
          row.generation,
          config.OPENAI_DOCUMENT_MODEL,
          config.OPENAI_DOCUMENT_DAILY_CALLS,
        );
        if (!call) throw new ProcessingError("ai_daily_limit", false);
        if (call.existing) throw new ProcessingError("ai_outcome_unknown", false);
        const result = await extractDocument(provider, bytes, row.mime, abort.signal);
        await repository.completeAnalysis(
          row.userId,
          row.id,
          row.generation,
          call.id,
          result.analysis,
          result.usage,
        );
        logger.info(
          {
            documentId: row.id,
            jobId: job.id,
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
            model: result.usage.model,
            costMicroUsdEstimate: Math.ceil(
              result.usage.inputTokens * config.OPENAI_DOCUMENT_INPUT_USD_PER_MILLION +
                result.usage.outputTokens * config.OPENAI_DOCUMENT_OUTPUT_USD_PER_MILLION,
            ),
            providerRequestId: result.usage.requestId,
          },
          "Document analysis completed",
        );
      } catch (error) {
        if (error instanceof DocumentError && [404, 409].includes(error.statusCode)) return;
        const known = error instanceof ProcessingError || error instanceof LlmError;
        const code = known ? error.code : "processing_unavailable";
        await repository.transition(row.userId, row.id, row.generation, {
          state: code === "malware_detected" ? "quarantined" : "failed",
          failure: code,
        });
        if (known && !error.retryable) throw new UnrecoverableError(code);
        throw new Error(code, { cause: error });
      }
    },
    {
      connection: { ...connection, maxRetriesPerRequest: null },
      concurrency: 1,
      lockDuration: 180000,
    },
  );
  worker.on("error", () =>
    logger.warn({ dependency: "document_worker" }, "Document worker unavailable"),
  );
  worker.on("failed", (job, error) =>
    logger.warn(
      { jobId: job?.id, code: error.message.slice(0, 100) },
      "Document job awaits retry or owner action",
    ),
  );
  queue.on("error", () =>
    logger.warn({ dependency: "document_queue" }, "Document queue unavailable"),
  );
  let closed = false;
  let relayRunning: Promise<void> | undefined;
  let maintenanceAt = 0;
  async function relay() {
    if (closed || relayRunning) return;
    relayRunning = (async () => {
      try {
        if (Date.now() - maintenanceAt >= 60000) {
          maintenanceAt = Date.now();
          await repository.recover();
          await repository.cleanup();
        }
        for (const row of await repository.pendingEvents()) {
          const data = jobSchema.parse({
            id: row.id,
            documentId: row.documentId,
            userId: row.userId,
            generation: row.generation,
            type: row.type,
          });
          await queue.add("document", data, {
            jobId: row.id,
            attempts: 4,
            backoff: { type: "exponential", delay: 30000 },
            removeOnComplete: { age: 86400, count: 1000 },
            removeOnFail: { age: 604800, count: 1000 },
          });
          await repository.published(row.id);
        }
      } catch {
        logger.warn({ dependency: "document_outbox" }, "Document dispatch will retry");
      }
    })();
    try {
      await relayRunning;
    } finally {
      relayRunning = undefined;
    }
  }
  const timer = setInterval(() => {
    void relay();
  }, 3000);
  timer.unref();
  void relay();
  return async () => {
    closed = true;
    clearInterval(timer);
    abort.abort();
    await relayRunning;
    await worker.close();
    await queue.close();
  };
}
