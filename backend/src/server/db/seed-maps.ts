import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { canonicalStringify, canonicalizeMapDocument, validateMapDocument } from "@van-lang/map-contract";
import { closeDb, getPool } from "./index.js";

async function seedMaps() {
  const input = JSON.parse(await readFile(new URL("../../../../packages/map-contract/maps/vanlang.v1.json", import.meta.url), "utf8"));
  const validation = validateMapDocument(input);
  if (!validation.success) throw new Error(`Fixture Văn Lang không hợp lệ: ${JSON.stringify(validation.issues)}`);
  const document = canonicalizeMapDocument(validation.document);
  const checksum = createHash("sha256").update(canonicalStringify(document)).digest("hex");
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO maps(map_id, display_name, description, thumbnail_src)
       VALUES ($1, $2, $3, $4) ON CONFLICT (map_id) DO NOTHING`,
      [document.mapId, document.metadata.name, document.metadata.description, document.metadata.thumbnailSrc ?? null],
    );
    const existing = await client.query("SELECT 1 FROM map_revisions WHERE map_id = $1 LIMIT 1", [document.mapId]);
    if (existing.rowCount) {
      await client.query("COMMIT");
      console.log("skipped vanlang");
      return;
    }
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO map_revisions(map_id, revision, schema_version, document, checksum, created_by)
       VALUES ($1, 1, 1, $2::jsonb, $3, 'seed') RETURNING id`,
      [document.mapId, JSON.stringify(document), checksum],
    );
    await client.query(
      `UPDATE maps SET active_revision_id = $2, display_name = $3, description = $4,
       thumbnail_src = $5, updated_at = NOW() WHERE map_id = $1`,
      [document.mapId, inserted.rows[0].id, document.metadata.name, document.metadata.description, document.metadata.thumbnailSrc ?? null],
    );
    await client.query("COMMIT");
    console.log("seeded vanlang revision 1");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await closeDb();
  }
}

await seedMaps();
