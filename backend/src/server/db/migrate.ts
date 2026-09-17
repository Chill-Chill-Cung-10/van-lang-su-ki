import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getPool, closeDb } from "./index.js";

async function migrate() {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    const directory = fileURLToPath(new URL("./migrations", import.meta.url));
    const files = (await readdir(directory)).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
    const applied = new Set((await client.query<{ name: string }>("SELECT name FROM schema_migrations")).rows.map((row) => row.name));
    for (const file of files) {
      if (applied.has(file)) continue;
      await client.query(await readFile(new URL(`./migrations/${file}`, import.meta.url), "utf8"));
      await client.query("INSERT INTO schema_migrations(name) VALUES ($1)", [file]);
      console.log(`applied ${file}`);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await closeDb();
  }
}

await migrate();
