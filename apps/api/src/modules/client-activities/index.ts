import type { FastifyInstance } from "fastify";
import type { Environment } from "../../platform/config.js";
import { createDatabase } from "../../platform/db/database.js";
import { createClientActivityRepository } from "./client-activities.repository.js";
import { registerClientActivityRoutes } from "./client-activities.routes.js";
export { ClientActivityError } from "./client-activities.repository.js";

export function registerClientActivities(
  app: FastifyInstance,
  config: Environment,
  identity: Parameters<typeof registerClientActivityRoutes>[2],
) {
  if (!config.AUTH_ENABLED) return;
  const database = createDatabase(config);
  database.pool.on("error", () =>
    app.log.warn({ dependency: "activities_database" }, "Activities database unavailable"),
  );
  const repository = createClientActivityRepository(database.db);
  registerClientActivityRoutes(app, repository, identity);
  let maintenance: Promise<void> | null = null;
  const maintain = () => {
    if (maintenance) return;
    maintenance = repository
      .purgeExpiredCommands()
      .catch(() =>
        app.log.warn(
          { dependency: "activities_cleanup" },
          "Expired activity command cleanup will retry",
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
