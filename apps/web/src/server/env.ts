import "server-only";

import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DEMO_PLAYER_ID: z.string().uuid().default("00000000-0000-4000-8000-000000000001"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5-mini"),
  S3_ENDPOINT: z.string().url().default("http://localhost:9000"),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("van-lang-assets"),
  S3_ACCESS_KEY_ID: z.string().default("vanlang"),
  S3_SECRET_ACCESS_KEY: z.string().default("change-me-local-only"),
});

export function getServerEnv() {
  return envSchema.parse(process.env);
}
