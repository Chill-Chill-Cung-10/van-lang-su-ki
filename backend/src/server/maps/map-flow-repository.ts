import { createHash } from "node:crypto";
import {
  canonicalStringify,
  canonicalizeMapDocument,
  upgradeMapDocument,
  validateMapDocument,
  validateMapFlowDocument,
  validateMapFlowSnapshot,
  type CloneMapRequest,
  type MapDocument,
  type MapFlowDocument,
  type MapFlowDraft,
  type MapFlowEnvelope,
  type MapRevisionEnvelope,
  type SaveMapFlowRequest,
} from "@van-lang/map-contract";
import type { PoolClient } from "pg";
import { getPool } from "../db/index.js";

export class FlowNotFoundError extends Error {}
export class FlowRevisionConflictError extends Error {}
export class FlowMapRevisionConflictError extends Error { constructor(public mapIds: string[]) { super(); } }
export class FlowMapNotFoundError extends Error {}
export class FlowMapAlreadyExistsError extends Error {}
export class MapFlowInvalidError extends Error { constructor(public issues: unknown[]) { super(); } }

type FlowRow = { flow_id: string; revision: number; document: unknown; checksum: string; created_at: Date };
type MapRow = { map_id: string; revision: number; document: unknown; checksum: string; created_at: Date };

const checksumFor = (value: unknown) => createHash("sha256").update(canonicalStringify(value)).digest("hex");
const mapEtag = (mapId: string, revision: number, checksum: string) => `"${mapId}:${revision}:${checksum.slice(0, 16)}"`;
const flowEtag = (flowId: string, revision: number, checksum: string) => `"${flowId}:${revision}:${checksum.slice(0, 16)}"`;

function mapEnvelope(row: MapRow): MapRevisionEnvelope {
  const validation = validateMapDocument(row.document);
  if (!validation.success) throw new MapFlowInvalidError(validation.issues);
  return { mapId: row.map_id, revision: row.revision, etag: mapEtag(row.map_id, row.revision, row.checksum), activatedAt: row.created_at.toISOString(), document: validation.document };
}

function flowEnvelope(row: FlowRow): MapFlowEnvelope {
  const validation = validateMapFlowDocument(row.document);
  if (!validation.success) throw new MapFlowInvalidError(validation.issues);
  return { flowId: row.flow_id, revision: row.revision, etag: flowEtag(row.flow_id, row.revision, row.checksum), activatedAt: row.created_at.toISOString(), document: validation.document };
}

async function activeFlow(client: PoolClient, flowId: string, lock = false) {
  const result = await client.query<FlowRow>(
    `SELECT f.flow_id, r.revision, r.document, r.checksum, r.created_at
     FROM map_flows f JOIN map_flow_revisions r ON r.id = f.active_revision_id AND r.flow_id = f.flow_id
     WHERE f.flow_id = $1 ${lock ? "FOR UPDATE OF f" : ""}`,
    [flowId],
  );
  return result.rows[0] ?? null;
}

async function pinnedMap(client: PoolClient, flow: MapFlowDocument, mapId: string, lock = false) {
  const revision = flow.nodes.find((node) => node.mapId === mapId)?.mapRevision;
  if (!revision) return null;
  const result = await client.query<MapRow>(
    `SELECT m.map_id, r.revision, r.document, r.checksum, r.created_at
     FROM maps m JOIN map_revisions r ON r.map_id = m.map_id AND r.revision = $2
     WHERE m.map_id = $1 ${lock ? "FOR UPDATE OF m" : ""}`,
    [mapId, revision],
  );
  return result.rows[0] ?? null;
}

export interface MapFlowsRepository {
  loadFlow(flowId: string): Promise<MapFlowEnvelope | null>;
  loadMap(flowId: string, mapId: string): Promise<MapRevisionEnvelope | null>;
  cloneMap(flowId: string, expectedFlowEtag: string, input: CloneMapRequest): Promise<{ flow: MapFlowEnvelope; map: MapRevisionEnvelope }>;
  saveFlow(flowId: string, expectedFlowEtag: string, input: SaveMapFlowRequest): Promise<{ flow: MapFlowEnvelope; maps: MapRevisionEnvelope[] }>;
}

export function createDatabaseMapFlowsRepository(hooks: { afterMapRevisionInsert?: (mapId: string) => void | Promise<void> } = {}): MapFlowsRepository {
  return {
  async loadFlow(flowId) {
    const client = await getPool().connect();
    try { const row = await activeFlow(client, flowId); return row ? flowEnvelope(row) : null; } finally { client.release(); }
  },

  async loadMap(flowId, mapId) {
    const client = await getPool().connect();
    try {
      const row = await activeFlow(client, flowId);
      if (!row) return null;
      const flow = flowEnvelope(row);
      const found = await pinnedMap(client, flow.document, mapId);
      return found ? mapEnvelope(found) : null;
    } finally { client.release(); }
  },

  async cloneMap(flowId, expectedFlowEtag, input) {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const flowRow = await activeFlow(client, flowId, true);
      if (!flowRow) throw new FlowNotFoundError();
      const flow = flowEnvelope(flowRow);
      if (flow.etag !== expectedFlowEtag) throw new FlowRevisionConflictError();
      const sourceRow = await pinnedMap(client, flow.document, input.sourceMapId, true);
      if (!sourceRow) throw new FlowMapNotFoundError();
      const source = mapEnvelope(sourceRow);
      if (source.etag !== input.expectedSourceMapEtag) throw new FlowMapRevisionConflictError([input.sourceMapId]);
      if ((await client.query("SELECT 1 FROM maps WHERE map_id = $1", [input.mapId])).rowCount) throw new FlowMapAlreadyExistsError();

      const document: MapDocument = { ...structuredClone(source.document), mapId: input.mapId, metadata: { ...source.document.metadata, ...input.metadata }, portals: [] };
      const validation = validateMapDocument(document);
      if (!validation.success) throw new MapFlowInvalidError(validation.issues);
      const canonical = canonicalizeMapDocument(validation.document);
      const mapChecksum = checksumFor(canonical);
      await client.query(`INSERT INTO maps(map_id, display_name, description, thumbnail_src) VALUES ($1, $2, $3, $4)`, [input.mapId, canonical.metadata.name, canonical.metadata.description, canonical.metadata.thumbnailSrc ?? null]);
      const insertedMap = await client.query<{ id: string; created_at: Date }>(
        `INSERT INTO map_revisions(map_id, revision, schema_version, document, checksum, created_by) VALUES ($1, 1, 3, $2::jsonb, $3, 'local-editor') RETURNING id, created_at`,
        [input.mapId, canonicalStringify(canonical), mapChecksum],
      );
      await client.query("UPDATE maps SET active_revision_id = $2, updated_at = NOW() WHERE map_id = $1", [input.mapId, insertedMap.rows[0].id]);

      const nextDocument: MapFlowDocument = { ...flow.document, nodes: [...flow.document.nodes, { mapId: input.mapId, mapRevision: 1, position: input.nodePosition }] };
      const flowChecksum = checksumFor(nextDocument);
      const insertedFlow = await client.query<{ id: string; created_at: Date }>(
        `INSERT INTO map_flow_revisions(flow_id, revision, schema_version, document, checksum, created_by) VALUES ($1, $2, 1, $3::jsonb, $4, 'local-editor') RETURNING id, created_at`,
        [flowId, flow.revision + 1, canonicalStringify(nextDocument), flowChecksum],
      );
      await client.query("UPDATE map_flows SET active_revision_id = $2, updated_at = NOW() WHERE flow_id = $1", [flowId, insertedFlow.rows[0].id]);
      await client.query("COMMIT");
      return {
        map: { mapId: input.mapId, revision: 1, etag: mapEtag(input.mapId, 1, mapChecksum), activatedAt: insertedMap.rows[0].created_at.toISOString(), document: canonical },
        flow: { flowId, revision: flow.revision + 1, etag: flowEtag(flowId, flow.revision + 1, flowChecksum), activatedAt: insertedFlow.rows[0].created_at.toISOString(), document: nextDocument },
      };
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  },

  async saveFlow(flowId, expectedFlowEtag, input) {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const flowRow = await activeFlow(client, flowId, true);
      if (!flowRow) throw new FlowNotFoundError();
      const base = flowEnvelope(flowRow);
      if (base.etag !== expectedFlowEtag) throw new FlowRevisionConflictError();
      if (input.document.flowId !== flowId) throw new MapFlowInvalidError([{ code: "FLOW_ID_MISMATCH", path: "flowId" }]);
      const duplicateNodes = new Set<string>();
      for (const node of input.document.nodes) { if (duplicateNodes.has(node.mapId)) throw new MapFlowInvalidError([{ code: "DUPLICATE_MAP_ID", path: "nodes", mapId: node.mapId }]); duplicateNodes.add(node.mapId); }
      const dirtyById = new Map(input.maps.map((item) => [item.mapId, item]));
      if (dirtyById.size !== input.maps.length) throw new MapFlowInvalidError([{ code: "DUPLICATE_MAP_ID", path: "maps" }]);
      if (input.maps.some((item) => !duplicateNodes.has(item.mapId))) throw new MapFlowInvalidError([{ code: "DIRTY_MAP_NOT_IN_FLOW", path: "maps" }]);

      const nodeIds = [...duplicateNodes].sort();
      await client.query("SELECT map_id FROM maps WHERE map_id = ANY($1::text[]) ORDER BY map_id FOR UPDATE", [nodeIds]);
      const baseRows = new Map<string, MapRow>();
      for (const node of base.document.nodes) {
        const row = await pinnedMap(client, base.document, node.mapId);
        if (row) baseRows.set(node.mapId, row);
      }
      const stale = input.maps.filter((item) => {
        const row = baseRows.get(item.mapId);
        return !row || mapEtag(item.mapId, row.revision, row.checksum) !== item.expectedEtag;
      }).map((item) => item.mapId);
      if (stale.length) throw new FlowMapRevisionConflictError(stale);

      const resolved = new Map<string, MapDocument>();
      for (const node of input.document.nodes) {
        const dirty = dirtyById.get(node.mapId);
        if (dirty) {
          if (dirty.document.mapId !== node.mapId) throw new MapFlowInvalidError([{ code: "MAP_ID_MISMATCH", path: "document.mapId", mapId: node.mapId }]);
          const validation = validateMapDocument(dirty.document);
          if (!validation.success) throw new MapFlowInvalidError(validation.issues.map((issue) => ({ ...issue, mapId: node.mapId })));
          resolved.set(node.mapId, canonicalizeMapDocument(validation.document));
        } else {
          const row = baseRows.get(node.mapId);
          if (!row) throw new MapFlowInvalidError([{ code: "MAP_NOT_RESOLVED", path: "nodes", mapId: node.mapId }]);
          resolved.set(node.mapId, upgradeMapDocument(row.document));
        }
      }
      const provisional: MapFlowDocument = { schemaVersion: 1, flowId, nodes: input.document.nodes.map((node) => ({ ...node, mapRevision: baseRows.get(node.mapId)?.revision ?? 1 })) };
      const issues = validateMapFlowSnapshot(provisional, resolved);
      if (issues.length) throw new MapFlowInvalidError(issues);

      const savedMaps: MapRevisionEnvelope[] = [];
      const nextRevisions = new Map<string, number>();
      for (const mapId of [...dirtyById.keys()].sort()) {
        const document = resolved.get(mapId)!;
        const latest = await client.query<{ revision: number }>("SELECT COALESCE(MAX(revision), 0)::int AS revision FROM map_revisions WHERE map_id = $1", [mapId]);
        const revision = latest.rows[0].revision + 1;
        const checksum = checksumFor(document);
        const inserted = await client.query<{ id: string; created_at: Date }>(
          `INSERT INTO map_revisions(map_id, revision, schema_version, document, checksum, created_by) VALUES ($1, $2, 3, $3::jsonb, $4, 'local-editor') RETURNING id, created_at`,
          [mapId, revision, canonicalStringify(document), checksum],
        );
        await hooks.afterMapRevisionInsert?.(mapId);
        await client.query(`UPDATE maps SET active_revision_id = $2, display_name = $3, description = $4, thumbnail_src = $5, updated_at = NOW() WHERE map_id = $1`, [mapId, inserted.rows[0].id, document.metadata.name, document.metadata.description, document.metadata.thumbnailSrc ?? null]);
        nextRevisions.set(mapId, revision);
        savedMaps.push({ mapId, revision, etag: mapEtag(mapId, revision, checksum), activatedAt: inserted.rows[0].created_at.toISOString(), document });
      }
      const nextDocument: MapFlowDocument = { schemaVersion: 1, flowId, nodes: input.document.nodes.map((node) => ({ ...node, mapRevision: nextRevisions.get(node.mapId) ?? baseRows.get(node.mapId)!.revision })) };
      const checksum = checksumFor(nextDocument);
      const revision = base.revision + 1;
      const inserted = await client.query<{ id: string; created_at: Date }>(
        `INSERT INTO map_flow_revisions(flow_id, revision, schema_version, document, checksum, created_by) VALUES ($1, $2, 1, $3::jsonb, $4, 'local-editor') RETURNING id, created_at`,
        [flowId, revision, canonicalStringify(nextDocument), checksum],
      );
      await client.query("UPDATE map_flows SET active_revision_id = $2, updated_at = NOW() WHERE flow_id = $1", [flowId, inserted.rows[0].id]);
      await client.query("COMMIT");
      return { flow: { flowId, revision, etag: flowEtag(flowId, revision, checksum), activatedAt: inserted.rows[0].created_at.toISOString(), document: nextDocument }, maps: savedMaps };
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  },
  };
}

export const databaseMapFlowsRepository = createDatabaseMapFlowsRepository();
