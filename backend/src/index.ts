import { buildApp } from "./app.js";
import { closeDb } from "./server/db/index.js";
import { getServerEnv } from "./server/env.js";

const app = buildApp();

async function start() {
  const env = getServerEnv();

  try {
    await app.listen({ host: env.HOST, port: env.PORT });
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;
  }
}

async function shutdown(signal: NodeJS.Signals) {
  app.log.info({ signal }, "Shutting down backend");
  await app.close();
  await closeDb();
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

void start();
