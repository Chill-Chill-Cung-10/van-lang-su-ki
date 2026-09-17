import assert from "node:assert/strict";
import test from "node:test";
import { upgradeMapDocument, validateMapFlowSnapshot, type CloneMapRequest, type MapFlowEnvelope, type MapRevisionEnvelope, type SaveMapFlowRequest } from "@van-lang/map-contract";
import Fastify from "fastify";
import fixture from "../../../packages/map-contract/maps/vanlang.v1.json" with { type: "json" };
import { mapFlowsRoutes } from "./map-flows.js";
import { FlowMapAlreadyExistsError, FlowMapRevisionConflictError, FlowRevisionConflictError, MapFlowInvalidError, type MapFlowsRepository } from "../server/maps/map-flow-repository.js";

class MemoryFlowRepository implements MapFlowsRepository {
  flow: MapFlowEnvelope = { flowId: "vanlang", revision: 1, etag: '"vanlang:1:flow"', activatedAt: new Date(0).toISOString(), document: { schemaVersion: 1, flowId: "vanlang", nodes: [{ mapId: "vanlang", mapRevision: 1, position: { x: 0.5, y: 0.5 } }] } };
  maps = new Map<string, MapRevisionEnvelope>([["vanlang", { mapId: "vanlang", revision: 1, etag: '"vanlang:1:map"', activatedAt: new Date(0).toISOString(), document: upgradeMapDocument(fixture) }]]);
  async loadFlow(flowId: string) { return flowId === "vanlang" ? this.flow : null; }
  async loadMap(flowId: string, mapId: string) { return flowId === "vanlang" ? this.maps.get(mapId) ?? null : null; }
  async cloneMap(_flowId: string, expectedFlowEtag: string, input: CloneMapRequest) {
    if (expectedFlowEtag !== this.flow.etag) throw new FlowRevisionConflictError();
    if (this.maps.has(input.mapId)) throw new FlowMapAlreadyExistsError();
    if (this.maps.get(input.sourceMapId)?.etag !== input.expectedSourceMapEtag) throw new FlowMapRevisionConflictError([input.sourceMapId]);
    const source = this.maps.get(input.sourceMapId)!;
    const map: MapRevisionEnvelope = { mapId: input.mapId, revision: 1, etag: `"${input.mapId}:1:map"`, activatedAt: new Date().toISOString(), document: { ...structuredClone(source.document), mapId: input.mapId, metadata: { ...source.document.metadata, ...input.metadata }, portals: [] } };
    this.maps.set(input.mapId, map);
    this.flow = { ...this.flow, revision: 2, etag: '"vanlang:2:flow"', document: { ...this.flow.document, nodes: [...this.flow.document.nodes, { mapId: input.mapId, mapRevision: 1, position: input.nodePosition }] } };
    return { flow: this.flow, map };
  }
  async saveFlow(_flowId: string, expectedFlowEtag: string, input: SaveMapFlowRequest) {
    if (expectedFlowEtag !== this.flow.etag) throw new FlowRevisionConflictError();
    const stale = input.maps.filter((item) => this.maps.get(item.mapId)?.etag !== item.expectedEtag).map((item) => item.mapId);
    if (stale.length) throw new FlowMapRevisionConflictError(stale);
    const snapshot = new Map(this.maps);
    for (const item of input.maps) snapshot.set(item.mapId, { ...snapshot.get(item.mapId)!, document: item.document });
    const document = { schemaVersion: 1 as const, flowId: "vanlang", nodes: input.document.nodes.map((node) => ({ ...node, mapRevision: snapshot.get(node.mapId)?.revision ?? 1 })) };
    const issues = validateMapFlowSnapshot(document, new Map([...snapshot].map(([id, envelope]) => [id, envelope.document])));
    if (issues.length) throw new MapFlowInvalidError(issues);
    const savedMaps = input.maps.map((item) => ({ ...this.maps.get(item.mapId)!, revision: this.maps.get(item.mapId)!.revision + 1, etag: `"${item.mapId}:next"`, document: item.document }));
    for (const map of savedMaps) this.maps.set(map.mapId, map);
    this.flow = { ...this.flow, revision: this.flow.revision + 1, etag: '"vanlang:next"', document };
    return { flow: this.flow, maps: savedMaps };
  }
}

async function appFor(repository = new MemoryFlowRepository()) {
  const app = Fastify();
  await app.register(mapFlowsRoutes, { repository, writeEnabled: true, frontendUrl: "http://localhost:3000" });
  return { app, repository };
}

test("clone creates revision 1 without portals and switches through pinned read", async () => {
  const { app } = await appFor();
  const response = await app.inject({ method: "POST", url: "/api/admin/map-flows/vanlang/maps", headers: { origin: "http://localhost:3000", "if-match": '"vanlang:1:flow"' }, payload: { sourceMapId: "vanlang", mapId: "second-map", metadata: { name: "Map thứ hai", description: "Clone" }, nodePosition: { x: 0.8, y: 0.5 }, expectedSourceMapEtag: '"vanlang:1:map"' } });
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().map.revision, 1);
  assert.deepEqual(response.json().map.document.portals, []);
  assert.equal((await app.inject({ method: "GET", url: "/api/map-flows/vanlang/maps/second-map" })).statusCode, 200);
  await app.close();
});

test("save rejects dangling target and stale revisions without changing state", async () => {
  const { app, repository } = await appFor();
  const before = structuredClone(repository.flow);
  const invalid = upgradeMapDocument(fixture);
  invalid.portals.push({ id: "broken", enabled: true, trigger: { type: "circle", center: invalid.navigation.spawn, radius: 1 }, target: { mapId: "missing", entryPointId: "default" } });
  const rejected = await app.inject({ method: "PUT", url: "/api/admin/map-flows/vanlang", headers: { origin: "http://localhost:3000", "if-match": before.etag }, payload: { document: { schemaVersion: 1, flowId: "vanlang", nodes: [{ mapId: "vanlang", position: { x: 0.5, y: 0.5 } }] }, maps: [{ mapId: "vanlang", expectedEtag: '"vanlang:1:map"', document: invalid }] } });
  assert.equal(rejected.statusCode, 422);
  assert.deepEqual(repository.flow, before);
  const stale = await app.inject({ method: "PUT", url: "/api/admin/map-flows/vanlang", headers: { origin: "http://localhost:3000", "if-match": '"stale"' }, payload: { document: { schemaVersion: 1, flowId: "vanlang", nodes: [{ mapId: "vanlang", position: { x: 0.5, y: 0.5 } }] }, maps: [] } });
  assert.equal(stale.statusCode, 412);
  assert.deepEqual(repository.flow, before);
  await app.close();
});

test("two clone requests for the same map ID create exactly one map and one flow node", async () => {
  const { app, repository } = await appFor();
  const request = {
    method: "POST" as const,
    url: "/api/admin/map-flows/vanlang/maps",
    headers: { origin: "http://localhost:3000", "if-match": '"vanlang:1:flow"' },
    payload: { sourceMapId: "vanlang", mapId: "same-map", metadata: { name: "Same map", description: "Concurrent clone" }, nodePosition: { x: 0.8, y: 0.5 }, expectedSourceMapEtag: '"vanlang:1:map"' },
  };
  const responses = await Promise.all([app.inject(request), app.inject(request)]);
  assert.deepEqual(responses.map((response) => response.statusCode).sort(), [201, 412]);
  assert.equal(repository.maps.has("same-map"), true);
  assert.equal(repository.flow.document.nodes.filter((node) => node.mapId === "same-map").length, 1);
  await app.close();
});

test("two admins saving the same old flow revision produce one save and one explicit conflict", async () => {
  const { app, repository } = await appFor();
  const request = {
    method: "PUT" as const,
    url: "/api/admin/map-flows/vanlang",
    headers: { origin: "http://localhost:3000", "if-match": '"vanlang:1:flow"' },
    payload: { document: { schemaVersion: 1, flowId: "vanlang", nodes: [{ mapId: "vanlang", position: { x: 0.6, y: 0.5 } }] }, maps: [] },
  };
  const responses = await Promise.all([app.inject(request), app.inject(request)]);
  assert.deepEqual(responses.map((response) => response.statusCode).sort(), [200, 412]);
  assert.equal(responses.find((response) => response.statusCode === 412)?.json().code, "FLOW_REVISION_CONFLICT");
  assert.equal(repository.flow.revision, 2);
  await app.close();
});

test("save rejects a target map removed between edit and save without changing the flow", async () => {
  const { app, repository } = await appFor();
  const before = structuredClone(repository.flow);
  const source = structuredClone(repository.maps.get("vanlang")!);
  const target = { ...structuredClone(source), mapId: "target", document: { ...structuredClone(source.document), mapId: "target" } };
  repository.maps.set("target", target);
  repository.flow = { ...repository.flow, document: { ...repository.flow.document, nodes: [...repository.flow.document.nodes, { mapId: "target", mapRevision: 1, position: { x: 0.8, y: 0.5 } }] } };
  const editedFlow = structuredClone(repository.flow);
  const editedSource = structuredClone(source.document);
  editedSource.portals = [{ id: "to-target", enabled: true, trigger: { type: "circle", center: editedSource.navigation.spawn, radius: 0.2 }, target: { mapId: "target", entryPointId: "default" } }];
  repository.maps.delete("target");
  const response = await app.inject({
    method: "PUT",
    url: "/api/admin/map-flows/vanlang",
    headers: { origin: "http://localhost:3000", "if-match": repository.flow.etag },
    payload: { document: { schemaVersion: 1, flowId: "vanlang", nodes: editedFlow.document.nodes.map(({ mapId, position }) => ({ mapId, position })) }, maps: [{ mapId: "vanlang", expectedEtag: source.etag, document: editedSource }] },
  });
  assert.equal(response.statusCode, 422);
  assert.equal(response.json().code, "MAP_FLOW_INVALID");
  assert.deepEqual(repository.maps.get("vanlang"), source);
  assert.equal(repository.flow.revision, before.revision);
  await app.close();
});
