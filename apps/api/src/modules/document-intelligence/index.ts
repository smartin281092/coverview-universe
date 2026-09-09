import type { FastifyInstance } from "fastify";
import type { Environment } from "../../platform/config.js";
import { createDatabase } from "../../platform/db/database.js";
import { createS3Storage } from "../../platform/file-storage.js";
import { documentConfig } from "./document.config.js";
import { createDocumentRepository } from "./document.repository.js";
import { createDocumentService } from "./document.service.js";
import { registerDocumentRoutes } from "./document.routes.js";
import {
  registerAdminDocumentRoutes,
  type AdminDocumentIdentity,
} from "./document.admin.routes.js";
import { startDocumentJobs } from "./document.jobs.js";
import { createCompanyActionRepository } from "./document.company-actions.repository.js";
import { registerCompanyActionRoutes } from "./document.company-actions.routes.js";
import { createActionCenterRepository } from "./document.action-center.repository.js";
import { registerActionCenterRoutes } from "./document.action-center.routes.js";
export { DocumentError } from "./document.repository.js";

export async function registerDocuments(
  app: FastifyInstance,
  environment: Environment,
  identity: Parameters<typeof registerDocumentRoutes>[3] & AdminDocumentIdentity,
) {
  const config = await documentConfig(environment);
  if (!config.enabled) return;
  const database = createDatabase(environment);
  database.pool.on("error", () =>
    app.log.warn({ dependency: "document_database" }, "Document database unavailable"),
  );
  const storage = createS3Storage(config);
  const repository = createDocumentRepository(database.db);
  const service = createDocumentService(repository, storage);
  registerDocumentRoutes(app, repository, service, identity);
  registerAdminDocumentRoutes(app, repository, service, identity);
  const actions = createCompanyActionRepository(database.db);
  registerCompanyActionRoutes(app, actions, identity);
  const actionCenter = createActionCenterRepository(database.db);
  registerActionCenterRoutes(app, actionCenter, identity);
  let actionMaintenance: Promise<void> | null = null;
  const maintainActions = () => {
    if (actionMaintenance) return;
    actionMaintenance = actions
      .purgeExpiredCommands()
      .then(() => actionCenter.purgeExpiredCommands())
      .catch(() =>
        app.log.warn(
          { dependency: "company_action_cleanup" },
          "Expired company action receipts will be retried",
        ),
      )
      .finally(() => {
        actionMaintenance = null;
      });
  };
  const actionTimer = setInterval(maintainActions, 60000);
  actionTimer.unref();
  const stop = startDocumentJobs(config, repository, storage, app.log);
  app.addHook("onClose", async () => {
    clearInterval(actionTimer);
    await actionMaintenance;
    await stop();
    storage.close();
    await database.pool.end();
  });
}
