import cors from "@fastify/cors";
import Fastify from "fastify";
import { getServerEnv } from "./server/env.js";
import { healthRoutes } from "./routes/health.js";
import { progressRoutes } from "./routes/progress.js";
import { tutorRoutes } from "./routes/tutor.js";

export function buildApp() {
  const env = getServerEnv();
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: env.FRONTEND_URL,
    methods: ["GET", "PATCH", "POST", "OPTIONS"],
  });

  app.register(healthRoutes);
  app.register(progressRoutes);
  app.register(tutorRoutes);

  return app;
}
