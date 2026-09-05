import { loadEnvironment } from "./platform/config.js";
import { buildServer } from "./platform/server.js";

async function main() {
  const config = loadEnvironment();
  const app = await buildServer(config);
  let isStopping = false;
  async function shutdown(exitCode: number) {
    if (isStopping) return;
    isStopping = true;
    const timeout = setTimeout(() => {
      process.exit(1);
    }, 10000);
    timeout.unref();
    try {
      await app.close();
      process.exitCode = exitCode;
    } finally {
      clearTimeout(timeout);
    }
  }
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void shutdown(0);
    });
  }
  process.once("uncaughtException", (error) => {
    app.log.fatal({ err: error }, "Uncaught exception");
    void shutdown(1);
  });
  process.once("unhandledRejection", (error) => {
    app.log.fatal({ err: error }, "Unhandled rejection");
    void shutdown(1);
  });
  try {
    await app.listen({ host: config.API_HOST, port: config.API_PORT });
  } catch (cause) {
    await shutdown(1);
    throw cause;
  }
}

main().catch(() => {
  process.stderr.write(
    "API startup failed. Validate environment configuration and listener availability.\n",
  );
  process.exitCode = 1;
});
