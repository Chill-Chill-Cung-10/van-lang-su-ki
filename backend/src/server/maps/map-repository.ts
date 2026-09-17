import { createHash } from "node:crypto";
import {
  canonicalStringify,
  canonicalizeMapDocument,
  validateMapDocument,
  type MapDocument,
  type MapRevisionEnvelope,
  type MapSummary,
} from "@van-lang/map-contract";
import { getPool } from "../db/index.js";

export class MapNotFoundError extends Error {}
export class MapRevisionConflictError extends Error {}
export class MapDocumentInvalidError extends Error {}

export interface MapsRepository {
  list(): Promise<MapSummary[]>;
  load(mapId: string): Promise<MapRevisionEnvelope | null>;
  save(mapId: string, expectedEtag: string, document: MapDocument): Promise<MapRevisionEnvelope>;
}

const etagFor = (mapId: string, revision: number, checksum: string) => `"${mapId}:${revision}:${checksum.slice(0, 16)}"`;

type ActiveRow = {
  map_id: string;
  revision: number;
  document: unknown;
  checksum: string;
  created_at: Date;
};

function envelope(row: ActiveRow): MapRevisionEnvelope {
  const validation = validateMapDocument(row.document);
  if (!validation.success) throw new MapDocumentInvalidError(JSON.stringify(validation.issues));
  return {
    mapId: row.map_id,
    revision: row.revision,
    etag: etagFor(row.map_id, row.revision, row.checksum),
    activatedAt: row.created_at.toISOString(),
    document: validation.document,
  };
}

export const databaseMapsRepository: MapsRepository = {
  async list() {
    const result = await getPool().query<{
      map_id: string; display_name: string; description: string; thumbnail_src: string | null; revision: number; updated_at: Date;
    }>(
      `SELECT m.map_id, m.display_name, m.description, m.thumbnail_src, r.revision, m.updated_at
       FROM maps m JOIN map_revisions r ON r.id = m.active_revision_id AND r.map_id = m.map_id`,
    );
    return result.rows.map((row) => ({
      mapId: row.map_id, name: row.display_name, description: row.description,
      ...(row.thumbnail_src ? { thumbnailSrc: row.thumbnail_src } : {}),
      activeRevision: row.revision, updatedAt: row.updated_at.toISOString(),
    })).sort((a, b) => a.name.localeCompare(b.name, "vi") || a.mapId.localeCompare(b.mapId));
  },

  async load(mapId) {
    const result = await getPool().query<ActiveRow>(
      `SELECT m.map_id, r.revision, r.document, r.checksum, r.created_at
       FROM maps m JOIN map_revisions r ON r.id = m.active_revision_id AND r.map_id = m.map_id
       WHERE m.map_id = $1`,
      [mapId],
    );
    return result.rows[0] ? envelope(result.rows[0]) : null;
  },

  async save(mapId, expectedEtag, input) {
    const document = canonicalizeMapDocument(input);
    const serialized = canonicalStringify(document);
    const checksum = createHash("sha256").update(serialized).digest("hex");
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const current = await client.query<ActiveRow>(
        `SELECT m.map_id, r.revision, r.document, r.checksum, r.created_at
         FROM maps m LEFT JOIN map_revisions r ON r.id = m.active_revision_id AND r.map_id = m.map_id
         WHERE m.map_id = $1 FOR UPDATE OF m`,
        [mapId],
      );
      if (!current.rows[0]) throw new MapNotFoundError();
      const row = current.rows[0];
      if (!row.revision || etagFor(mapId, row.revision, row.checksum) !== expectedEtag) throw new MapRevisionConflictError();
      const nextRevision = row.revision + 1;
      const inserted = await client.query<{ id: string; created_at: Date }>(
        `INSERT INTO map_revisions(map_id, revision, schema_version, document, checksum, created_by)
         VALUES ($1, $2, 2, $3::jsonb, $4, 'local-editor') RETURNING id, created_at`,
        [mapId, nextRevision, serialized, checksum],
      );
      await client.query(
        `UPDATE maps SET active_revision_id = $2, display_name = $3, description = $4,
         thumbnail_src = $5, updated_at = NOW() WHERE map_id = $1`,
        [mapId, inserted.rows[0].id, document.metadata.name, document.metadata.description, document.metadata.thumbnailSrc ?? null],
      );
      await client.query("COMMIT");
      return { mapId, revision: nextRevision, etag: etagFor(mapId, nextRevision, checksum), activatedAt: inserted.rows[0].created_at.toISOString(), document };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};
