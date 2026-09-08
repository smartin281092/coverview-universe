import type { FastifyInstance } from "fastify";
import type { Environment } from "../../platform/config.js";
import { createDatabase } from "../../platform/db/database.js";
import { createManagedProfileRepository } from "./profiles.repository.js";
import { registerManagedProfileRoutes } from "./profiles.routes.js";
export { ManagedProfileError } from "./profiles.repository.js";
export { managedProfiles } from "./profiles.schema.js";
export {
  assertDocumentProfileTarget,
  readManagedDocumentValues,
  enrichManagedDocumentProfile,
} from "./profiles.document.repository.js";

export function registerManagedProfiles(
  app: FastifyInstance,
  config: Environment,
  identity: Parameters<typeof registerManagedProfileRoutes>[2],
) {
  if (!config.AUTH_ENABLED) return;
  const database = createDatabase(config);
  database.pool.on("error", () =>
    app.log.warn({ dependency: "profiles_database" }, "Profile database unavailable"),
  );
  const repository = createManagedProfileRepository(database.db);
  registerManagedProfileRoutes(app, repository, identity);
  let maintenance: Promise<void> | null = null;
  const maintain = () => {
    if (maintenance) return;
    maintenance = repository
      .purgeExpiredCommands()
      .catch(() =>
        app.log.warn(
          { dependency: "profiles_cleanup" },
          "Expired profile cache cleanup will retry",
        ),
      )
      .finally(() => {
        maintenance = null;
      });
  };
  const timer = setInterval(maintain, 60000);
  timer.unref();
  maintain();
  app.addHook("onClose", async () => {
    clearInterval(timer);
    await maintenance;
    await database.pool.end();
  });
}
