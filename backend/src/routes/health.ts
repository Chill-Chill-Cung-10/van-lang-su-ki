import { sql } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { getDb } from "../server/db/index.js";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/health", async (_request, reply) => {
    const startedAt = Date.now();

    try {
      await getDb().execute(sql`select 1`);

      return {
        status: "ok",
        services: { backend: "ok", database: "ok" },
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      app.log.error(error, "Health check failed");
      reply.status(503);

      return {
        status: "degraded",
        services: { backend: "ok", database: "unavailable" },
        timestamp: new Date().toISOString(),
      };
    }
  });
};
