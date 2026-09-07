import type { FastifyInstance } from "fastify";
import type { Environment } from "../../platform/config.js";
import { createDatabase } from "../../platform/db/database.js";
import { createS3Storage } from "../../platform/file-storage.js";
import { documentConfig } from "./document.config.js";
import { createDocumentRepository } from "./document.repository.js";
import { createDocumentService } from "./document.service.js";
import { registerDocumentRoutes } from "./document.routes.js";
import { startDocumentJobs } from "./document.jobs.js";
export { DocumentError } from "./document.repository.js";

export async function registerDocuments(
  app: FastifyInstance,
  environment: Environment,
  identity: Parameters<typeof registerDocumentRoutes>[3],
) {
  const config = await documentConfig(environment);
  if (!config.enabled) return;
  const database = createDatabase(environment);
  database.pool.on("error", () =>
    app.log.warn({ dependency: "document_database" }, "Document database unavailable"),
  );
  const storage = createS3Storage(config);
  const repository = createDocumentRepository(database.db);
  registerDocumentRoutes(app, repository, createDocumentService(repository, storage), identity);
  const stop = startDocumentJobs(config, repository, storage, app.log);
  app.addHook("onClose", async () => {
    await stop();
    storage.close();
    await database.pool.end();
  });
}
