import assert from "node:assert/strict";
import test from "node:test";
import { MapDocumentSchemaV1, isPositionValid, type MapDocument, type MapRevisionEnvelope, type MapSummary } from "@van-lang/map-contract";
import Fastify from "fastify";
import fixture from "../../../packages/map-contract/maps/vanlang.v1.json" with { type: "json" };
import { mapsRoutes } from "./maps.js";
import { MapDocumentInvalidError, MapRevisionConflictError, type MapsRepository } from "../server/maps/map-repository.js";

class MemoryMapsRepository implements MapsRepository {
  current: MapRevisionEnvelope = {
    mapId: "vanlang", revision: 1, etag: '"vanlang:1:test"', activatedAt: new Date(0).toISOString(), document: MapDocumentSchemaV1.parse(fixture),
  };
  async list(): Promise<MapSummary[]> {
    return [{ mapId: "vanlang", name: this.current.document.metadata.name, description: this.current.document.metadata.description, activeRevision: this.current.revision, updatedAt: this.current.activatedAt }];
  }
  async load(mapId: string) { return mapId === "vanlang" ? this.current : null; }
  async save(mapId: string, expectedEtag: string, document: MapDocument) {
    if (expectedEtag !== this.current.etag) throw new MapRevisionConflictError();
    this.current = { mapId, revision: this.current.revision + 1, etag: `"vanlang:${this.current.revision + 1}:test"`, activatedAt: new Date().toISOString(), document };
    return this.current;
  }
}

async function createApp(repository: MapsRepository = new MemoryMapsRepository(), writeEnabled = true) {
  const app = Fastify();
  await app.register(mapsRoutes, { repository, writeEnabled, frontendUrl: "http://localhost:3000" });
  return { app, repository };
}

test("list, save and load round trip preserves the saved map document", async () => {
  const { app } = await createApp();
  const list = await app.inject({ method: "GET", url: "/api/maps" });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().maps[0].mapId, "vanlang");
  const changed = structuredClone(MapDocumentSchemaV1.parse(fixture));
  changed.metadata.name = "Văn Lang đã sửa";
  const saved = await app.inject({ method: "PUT", url: "/api/admin/maps/vanlang", headers: { origin: "http://localhost:3000", "if-match": '"vanlang:1:test"' }, payload: { document: changed } });
  assert.equal(saved.statusCode, 200);
  assert.equal(saved.json().revision, 2);
  const loaded = await app.inject({ method: "GET", url: "/api/maps/vanlang" });
  assert.equal(loaded.json().document.metadata.name, "Văn Lang đã sửa");
  assert.equal(loaded.headers.etag, saved.headers.etag);
  assert.equal(isPositionValid(MapDocumentSchemaV1.parse(loaded.json().document), { x: 0, z: 0 }), true);
  await app.close();
});

test("API rejects self-intersection, stale ETag and disabled writes", async () => {
  const { app } = await createApp();
  const invalid = structuredClone(MapDocumentSchemaV1.parse(fixture));
  invalid.navigation.walkablePolygons[0].points = [{ x: -1, z: -1 }, { x: 1, z: 1 }, { x: -1, z: 1 }, { x: 1, z: -1 }];
  const rejected = await app.inject({ method: "PUT", url: "/api/admin/maps/vanlang", headers: { origin: "http://localhost:3000", "if-match": '"vanlang:1:test"' }, payload: { document: invalid } });
  assert.equal(rejected.statusCode, 400);
  assert.equal((await app.inject({ method: "GET", url: "/api/maps/vanlang" })).json().revision, 1);
  const unclosed = structuredClone(fixture) as unknown as { navigation: { walkablePolygons: Array<Record<string, unknown>> } };
  unclosed.navigation.walkablePolygons[0].closed = false;
  const unclosedResponse = await app.inject({ method: "PUT", url: "/api/admin/maps/vanlang", headers: { origin: "http://localhost:3000", "if-match": '"vanlang:1:test"' }, payload: { document: unclosed } });
  assert.equal(unclosedResponse.statusCode, 400);
  const stale = await app.inject({ method: "PUT", url: "/api/admin/maps/vanlang", headers: { origin: "http://localhost:3000", "if-match": '"stale"' }, payload: { document: fixture } });
  assert.equal(stale.statusCode, 412);
  await app.close();

  const disabled = await createApp(new MemoryMapsRepository(), false);
  const response = await disabled.app.inject({ method: "PUT", url: "/api/admin/maps/vanlang", payload: { document: fixture } });
  assert.equal(response.statusCode, 503);
  await disabled.app.close();
});

test("two concurrent saves with one ETag produce one revision and one conflict", async () => {
  const repository = new MemoryMapsRepository();
  const { app } = await createApp(repository);
  const first = structuredClone(repository.current.document);
  const second = structuredClone(repository.current.document);
  first.metadata.name = "First";
  second.metadata.name = "Second";
  const responses = await Promise.all([first, second].map((document) => app.inject({
    method: "PUT",
    url: "/api/admin/maps/vanlang",
    headers: { origin: "http://localhost:3000", "if-match": '"vanlang:1:test"' },
    payload: { document },
  })));
  assert.deepEqual(responses.map((response) => response.statusCode).sort(), [200, 412]);
  assert.equal(repository.current.revision, 2);
  await app.close();
});

test("database outage is explicit and corrupt active data is never returned", async () => {
  const unavailable: MapsRepository = {
    async list() { throw new Error("database offline"); },
    async load() { throw new Error("database offline"); },
    async save() { throw new Error("database offline"); },
  };
  const { app } = await createApp(unavailable);
  const list = await app.inject({ method: "GET", url: "/api/maps" });
  assert.equal(list.statusCode, 503);
  assert.equal(list.json().code, "MAP_DATABASE_UNAVAILABLE");
  const load = await app.inject({ method: "GET", url: "/api/maps/vanlang" });
  assert.equal(load.statusCode, 503);
  assert.equal(load.json().code, "MAP_DATABASE_UNAVAILABLE");
  await app.close();

  const corrupt: MapsRepository = {
    async list() { return []; },
    async load() { throw new MapDocumentInvalidError(); },
    async save() { throw new Error("not used"); },
  };
  const corruptApp = await createApp(corrupt);
  const response = await corruptApp.app.inject({ method: "GET", url: "/api/maps/vanlang" });
  assert.equal(response.statusCode, 500);
  assert.equal(response.json().code, "MAP_DOCUMENT_INVALID");
  await corruptApp.app.close();
});
