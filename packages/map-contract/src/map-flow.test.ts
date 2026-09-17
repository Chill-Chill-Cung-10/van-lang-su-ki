import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalStringify, upgradeMapDocument, validateMapDocument, validateMapFlowDocument, validateMapFlowSnapshot } from "./index.js";

const fixture = JSON.parse(await readFile(new URL("../maps/vanlang.v1.json", import.meta.url), "utf8"));

test("upgrades V1 without mutating the fixture", () => {
  const before = canonicalStringify(fixture);
  const upgraded = upgradeMapDocument(fixture);
  assert.equal(upgraded.schemaVersion, 2);
  assert.deepEqual(upgraded.portals, []);
  assert.deepEqual(upgraded.navigation.entryPoints, [{ id: "default", position: fixture.navigation.spawn, facingDeg: 0 }]);
  assert.equal(canonicalStringify(fixture), before);
});

test("validates duplicate portal IDs and invalid trigger or entry positions", () => {
  const document = upgradeMapDocument(fixture);
  document.navigation.entryPoints.push({ id: "default", position: { x: 9_000, z: 9_000 }, facingDeg: 0 });
  document.portals = [
    { id: "gate", enabled: true, trigger: { type: "circle", center: { x: 9_000, z: 9_000 }, radius: 1 }, target: { mapId: "vanlang", entryPointId: "default" } },
    { id: "gate", enabled: false, trigger: { type: "circle", center: document.navigation.spawn, radius: 1 }, target: { mapId: "vanlang", entryPointId: "default" } },
  ];
  const result = validateMapDocument(document);
  assert.equal(result.success, false);
  if (!result.success) assert.deepEqual(new Set(result.issues.map((issue) => issue.code)), new Set(["DUPLICATE_ENTRY_POINT_ID", "INVALID_ENTRY_POINT", "INVALID_PORTAL_TRIGGER", "DUPLICATE_PORTAL_ID"]));
});

test("rejects overlapping portal triggers", () => {
  const document = upgradeMapDocument(fixture);
  document.portals = [
    { id: "gate-a", enabled: true, trigger: { type: "circle", center: { x: 0, z: 0 }, radius: 0.5 }, target: { mapId: "vanlang", entryPointId: "default" } },
    { id: "gate-b", enabled: true, trigger: { type: "circle", center: { x: 0.75, z: 0 }, radius: 0.5 }, target: { mapId: "vanlang", entryPointId: "default" } },
  ];
  const result = validateMapDocument(document);
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.issues.some((issue) => issue.code === "OVERLAPPING_PORTAL_TRIGGER" && issue.portalId === "gate-b"), true);
});

test("rejects entry points and triggers invalidated by a navmesh edit", () => {
  const document = upgradeMapDocument(fixture);
  document.navigation.entryPoints = [{ id: "arrival", position: { x: 3, z: 3 }, facingDeg: 0 }];
  document.portals = [{ id: "gate", enabled: true, trigger: { type: "circle", center: { x: -3, z: -3 }, radius: 0.25 }, target: { mapId: "vanlang", entryPointId: "arrival" } }];
  document.navigation.walkablePolygons = [{ id: "center-only", enabled: true, points: [{ x: -1, z: -1 }, { x: 1, z: -1 }, { x: 1, z: 1 }, { x: -1, z: 1 }] }];
  const result = validateMapDocument(document);
  assert.equal(result.success, false);
  if (!result.success) assert.deepEqual(new Set(result.issues.map((issue) => issue.code)), new Set(["INVALID_ENTRY_POINT", "INVALID_PORTAL_TRIGGER"]));
});

test("validates graph duplicates and cross-map targets", () => {
  const duplicate = validateMapFlowDocument({ schemaVersion: 1, flowId: "vanlang", nodes: [
    { mapId: "vanlang", mapRevision: 1, position: { x: 0.2, y: 0.3 } },
    { mapId: "vanlang", mapRevision: 1, position: { x: 0.4, y: 0.5 } },
  ] });
  assert.equal(duplicate.success, false);

  const source = upgradeMapDocument(fixture);
  source.portals = [{ id: "gate", enabled: true, trigger: { type: "circle", center: source.navigation.spawn, radius: 1 }, target: { mapId: "missing", entryPointId: "default" } }];
  const flow = { schemaVersion: 1 as const, flowId: "vanlang", nodes: [{ mapId: "vanlang", mapRevision: 1, position: { x: 0.2, y: 0.3 } }] };
  assert.equal(validateMapFlowSnapshot(flow, new Map([["vanlang", source]]))[0]?.code, "PORTAL_TARGET_NOT_FOUND");
});
