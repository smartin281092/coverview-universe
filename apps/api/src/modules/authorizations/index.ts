export {
  createAuthorizationRepository,
  readAuthorizationStatus,
} from "./authorizations.repository.js";
export { readAuthorizationActivity } from "./authorizations.activity.js";
import type { FastifyInstance } from "fastify";
import type { Environment } from "../../platform/config.js";
import { createDatabase } from "../../platform/db/database.js";
import { createAuthorizationRepository } from "./authorizations.repository.js";
import { registerAuthorizationRoutes } from "./authorizations.routes.js";

export function registerAuthorizations(
  app: FastifyInstance,
  config: Environment,
  identity: Parameters<typeof registerAuthorizationRoutes>[2],
) {
  if (!config.AUTH_ENABLED) return;
  const database = createDatabase(config);
  database.pool.on("error", () =>
    app.log.warn({ dependency: "authorization_database" }, "Authorization database unavailable"),
  );
  registerAuthorizationRoutes(app, createAuthorizationRepository(database.db), identity);
  app.addHook("onClose", () => database.pool.end());
}
