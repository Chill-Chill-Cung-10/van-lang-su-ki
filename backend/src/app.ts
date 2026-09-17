import cors from "@fastify/cors";
import Fastify from "fastify";
import { getServerEnv } from "./server/env.js";
import { healthRoutes } from "./routes/health.js";
import { progressRoutes } from "./routes/progress.js";
import { tutorRoutes } from "./routes/tutor.js";
import { mapsRoutes } from "./routes/maps.js";
import { mapFlowsRoutes } from "./routes/map-flows.js";

export function buildApp() {
  const env = getServerEnv();
  const app = Fastify({ logger: true, bodyLimit: 1024 * 1024 });

  app.register(cors, {
    origin: env.FRONTEND_URL,
    methods: ["GET", "PATCH", "POST", "PUT", "OPTIONS"],
    allowedHeaders: ["Content-Type", "If-Match", "If-None-Match"],
  });

  app.register(healthRoutes);
  app.register(progressRoutes);
  app.register(tutorRoutes);
  app.register(mapsRoutes);
  app.register(mapFlowsRoutes);

  return app;
}
