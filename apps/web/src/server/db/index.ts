import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getServerEnv } from "@/server/env";

const globalForDb = globalThis as unknown as { pool?: Pool };

export function getDb() {
  const env = getServerEnv();
  const pool = globalForDb.pool ?? new Pool({ connectionString: env.DATABASE_URL, max: 5 });
  if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;
  return drizzle(pool);
}
