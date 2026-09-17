import assert from "node:assert/strict";
import test from "node:test";
import { canonicalStringify, upgradeMapDocument } from "@van-lang/map-contract";
import fixture from "../../../../packages/map-contract/maps/vanlang.v1.json" with { type: "json" };
import { getPool } from "../db/index.js";
import { createDatabaseMapFlowsRepository } from "./map-flow-repository.js";

test("database Save Flow rolls back every revision when a later transaction step fails", { skip: !process.env.DATABASE_URL }, async () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const flowId = `atomic-${suffix}`;
  const mapIds = [`atomic-a-${suffix}`, `atomic-b-${suffix}`];
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    for (const mapId of mapIds) {
      const document = { ...upgradeMapDocument(fixture), mapId, metadata: { ...upgradeMapDocument(fixture).metadata, name: mapId } };
      await client.query("INSERT INTO maps(map_id, display_name, description) VALUES ($1, $2, '')", [mapId, mapId]);
      const revision = await client.query<{ id: string }>("INSERT INTO map_revisions(map_id, revision, schema_version, document, checksum, created_by) VALUES ($1, 1, 2, $2::jsonb, $3, 'atomic-test') RETURNING id", [mapId, canonicalStringify(document), `${mapId}-checksum`]);
      await client.query("UPDATE maps SET active_revision_id = $2 WHERE map_id = $1", [mapId, revision.rows[0].id]);
    }
    const flowDocument = { schemaVersion: 1, flowId, nodes: mapIds.map((mapId, index) => ({ mapId, mapRevision: 1, position: { x: 0.25 + index * 0.5, y: 0.5 } })) };
    await client.query("INSERT INTO map_flows(flow_id, display_name) VALUES ($1, 'Atomic test')", [flowId]);
    const flowRevision = await client.query<{ id: string }>("INSERT INTO map_flow_revisions(flow_id, revision, schema_version, document, checksum, created_by) VALUES ($1, 1, 1, $2::jsonb, 'flow-checksum', 'atomic-test') RETURNING id", [flowId, canonicalStringify(flowDocument)]);
    await client.query("UPDATE map_flows SET active_revision_id = $2 WHERE flow_id = $1", [flowId, flowRevision.rows[0].id]);
    await client.query("COMMIT");

    const baseRepository = createDatabaseMapFlowsRepository();
    const flow = await baseRepository.loadFlow(flowId);
    const maps = await Promise.all(mapIds.map((mapId) => baseRepository.loadMap(flowId, mapId)));
    assert.ok(flow && maps.every(Boolean));
    let inserts = 0;
    const failingRepository = createDatabaseMapFlowsRepository({ afterMapRevisionInsert: () => { inserts += 1; throw new Error("injected-after-first-map-insert"); } });
    await assert.rejects(() => failingRepository.saveFlow(flowId, flow.etag, {
      document: { schemaVersion: 1, flowId, nodes: flow.document.nodes.map(({ mapId, position }) => ({ mapId, position })) },
      maps: maps.map((item) => ({ mapId: item!.mapId, expectedEtag: item!.etag, document: { ...item!.document, metadata: { ...item!.document.metadata, name: `${item!.document.metadata.name} changed` } } })),
    }), /injected-after-first-map-insert/);
    assert.equal(inserts, 1);
    const revisionCounts = await client.query<{ map_id: string; count: string }>("SELECT map_id, COUNT(*)::text AS count FROM map_revisions WHERE map_id = ANY($1::text[]) GROUP BY map_id ORDER BY map_id", [mapIds]);
    assert.deepEqual(revisionCounts.rows.map((row) => [row.map_id, row.count]), mapIds.map((mapId) => [mapId, "1"]));
    assert.equal((await client.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM map_flow_revisions WHERE flow_id = $1", [flowId])).rows[0].count, "1");
  } finally {
    await client.query("BEGIN");
    await client.query("UPDATE map_flows SET active_revision_id = NULL WHERE flow_id = $1", [flowId]);
    await client.query("DELETE FROM map_flow_revisions WHERE flow_id = $1", [flowId]);
    await client.query("DELETE FROM map_flows WHERE flow_id = $1", [flowId]);
    await client.query("UPDATE maps SET active_revision_id = NULL WHERE map_id = ANY($1::text[])", [mapIds]);
    await client.query("DELETE FROM map_revisions WHERE map_id = ANY($1::text[])", [mapIds]);
    await client.query("DELETE FROM maps WHERE map_id = ANY($1::text[])", [mapIds]);
    await client.query("COMMIT");
    client.release();
  }
});
