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
import { registerActionRealtime, type RealtimeIdentity } from "./document.action-realtime.js";
import {
  registerLeadDocumentRoutes,
  type LeadSourceAuthorization,
} from "./document.lead.routes.js";
export { DocumentError } from "./document.repository.js";
export { createPartnerProof, queuePartnerProof } from "./document.partner-proof.js";
export {
  retainLeadSource,
  leadSourceSnapshot,
  leadSourceSnapshotSchema,
  leadSourceReviewRevisionSql,
} from "./document.lead-source.js";
export { documents } from "./document.schema.js";
export {
  createLeadOfferUpload,
  queueLeadOfferUpload,
  leadImportAnalysis,
} from "./document.lead-import.js";
export { readContractCandidates, retainContractReference } from "./document.contract-reference.js";
export { readCorrespondenceDocuments } from "./document.correspondence.js";
export { referencedCompanyIds } from "./document.companies.js";

export async function registerDocuments(
  app: FastifyInstance,
  environment: Environment,
  identity: Parameters<typeof registerDocumentRoutes>[3] & AdminDocumentIdentity & RealtimeIdentity,
  leadSources?: LeadSourceAuthorization,
) {
  const config = await documentConfig(environment);
  if (!config.enabled) {
    // Documents off (production, 20 October 2026): the action center reads profiles,
    // authorizations and company requests from the database only, so Wallet keeps its Actions.
    if (environment.AUTH_ENABLED) registerActionCenter(app, environment, identity);
    return;
  }
  const database = createDatabase(environment);
  database.pool.on("error", () =>
    app.log.warn({ dependency: "document_database" }, "Document database unavailable"),
  );
  const storage = createS3Storage(config);
  const repository = createDocumentRepository(database.db);
  const service = createDocumentService(repository, storage);
  if (leadSources) registerLeadDocumentRoutes(app, database.pool, service, leadSources);
  registerDocumentRoutes(app, repository, service, identity);
  registerAdminDocumentRoutes(app, repository, service, identity);
  const actions = createCompanyActionRepository(database.db);
  registerCompanyActionRoutes(app, actions, identity);
  const actionCenter = createActionCenterRepository(database.db);
  registerActionCenterRoutes(app, actionCenter, identity);
  registerActionRealtime(app, actionCenter, identity, {
    wallet: environment.AUTH_WALLET_ORIGIN,
    api: environment.AUTH_API_ORIGIN,
  });
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

function registerActionCenter(
  app: FastifyInstance,
  environment: Environment,
  identity: Parameters<typeof registerDocumentRoutes>[3] & AdminDocumentIdentity & RealtimeIdentity,
) {
  const database = createDatabase(environment);
  database.pool.on("error", () =>
    app.log.warn({ dependency: "action_database" }, "Action database unavailable"),
  );
  const actionCenter = createActionCenterRepository(database.db);
  registerActionCenterRoutes(app, actionCenter, identity);
  registerActionRealtime(app, actionCenter, identity, {
    wallet: environment.AUTH_WALLET_ORIGIN,
    api: environment.AUTH_API_ORIGIN,
  });
  let maintenance: Promise<void> | null = null;
  const timer = setInterval(() => {
    if (maintenance) return;
    maintenance = actionCenter
      .purgeExpiredCommands()
      .catch(() =>
        app.log.warn({ dependency: "action_cleanup" }, "Expired action receipts will be retried"),
      )
      .finally(() => {
        maintenance = null;
      });
  }, 60000);
  timer.unref();
  app.addHook("onClose", async () => {
    clearInterval(timer);
    await maintenance;
    await database.pool.end();
  });
}
