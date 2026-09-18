import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  MAP_EDITOR_WRITE_ENABLED: z.string().default("false").transform((value) => value === "true"),
  ASSET_STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  ASSET_STORAGE_DIR: z.string().default(".runtime/assets"),
  ASSET_UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(67_108_864),
  ASSET_PUBLIC_BASE_URL: z.string().url().optional(),
  DATABASE_URL: z.string().url(),
  DEMO_PLAYER_ID: z.string().uuid().default("00000000-0000-4000-8000-000000000001"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5-mini"),
  S3_ENDPOINT: z.string().url().default("http://localhost:9000"),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("van-lang-assets"),
  S3_ACCESS_KEY_ID: z.string().default("vanlang"),
  S3_SECRET_ACCESS_KEY: z.string().default("change-me-local-only"),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(1025),
}).superRefine((env, context) => {
  if (env.NODE_ENV === "production" && env.MAP_EDITOR_WRITE_ENABLED) {
    context.addIssue({ code: "custom", path: ["MAP_EDITOR_WRITE_ENABLED"], message: "Map editor write không được bật trong production." });
  }
  if (env.ASSET_STORAGE_DRIVER === "s3" && !env.ASSET_PUBLIC_BASE_URL) {
    context.addIssue({ code: "custom", path: ["ASSET_PUBLIC_BASE_URL"], message: "S3 storage cần public asset base URL." });
  }
});

let cachedEnv: z.infer<typeof envSchema> | undefined;

export function getServerEnv() {
  cachedEnv ??= envSchema.parse(process.env);
  return cachedEnv;
}
