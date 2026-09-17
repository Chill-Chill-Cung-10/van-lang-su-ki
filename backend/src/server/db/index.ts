import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getServerEnv } from "../env.js";

let pool: Pool | undefined;
let database: ReturnType<typeof drizzle> | undefined;

export function getDb() {
  if (!pool) {
    pool = new Pool({ connectionString: getServerEnv().DATABASE_URL, max: 5 });
    database = drizzle(pool);
  }

  return database!;
}

export function getPool() {
  getDb();
  return pool!;
}

export async function closeDb() {
  await pool?.end();
  pool = undefined;
  database = undefined;
}
