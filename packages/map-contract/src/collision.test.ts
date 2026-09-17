import assert from "node:assert/strict";
import test from "node:test";
import fixture from "../maps/vanlang.v1.json";
import {
  MapDocumentSchemaV1,
  applyObstacleTransform,
  colliderFootprint,
  isPositionValid,
  nearestValidPoint,
  pointInPolygon,
  polygonSelfIntersects,
  resolveMovement,
  validateMapDocument,
  type MapDocument,
  type MapObject,
} from "./index.js";

const base = MapDocumentSchemaV1.parse(fixture);
const square = [{ x: -5, z: -5 }, { x: 5, z: -5 }, { x: 5, z: 5 }, { x: -5, z: 5 }];
const documentWith = (...objects: MapObject[]): MapDocument => ({
  ...base,
  navigation: { ...base.navigation, playerRadius: 0.1, walkablePolygons: [{ id: "test", enabled: true, points: square }] },
  objects,
});
const model = (id: string, collider: MapObject["collider"], x = 0, z = 0, yaw = 0): Extract<MapObject, { kind: "model3d" }> => ({
  id, name: id, kind: "model3d", enabled: true, renderLayer: "world3d", renderOrder: 0,
  src: "/models/vanlang-rebirth/arena.runtime.glb", castShadow: false, receiveShadow: false, collider,
  transform3d: { position: { x, y: 0, z }, rotationDeg: { x: 0, y: yaw, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
});

test("point-in-polygon includes the boundary and self-intersection is detected", () => {
  assert.equal(pointInPolygon({ x: 0, z: 0 }, square), true);
  assert.equal(pointInPolygon({ x: 5, z: 0 }, square), true);
  assert.equal(pointInPolygon({ x: 6, z: 0 }, square), false);
  assert.equal(polygonSelfIntersects([{ x: -1, z: -1 }, { x: 1, z: 1 }, { x: -1, z: 1 }, { x: 1, z: -1 }]), true);
});

test("circle, rectangle, rotated rectangle and polygon colliders block the player", () => {
  const colliders: MapObject[] = [
    model("circle", { type: "circle", enabled: true, center: { x: 0, z: 0 }, radius: 0.5 }, -3, 0),
    model("rectangle", { type: "rectangle", enabled: true, center: { x: 0, z: 0 }, width: 1, depth: 1 }, -1, 0),
    model("rotated", { type: "rectangle", enabled: true, center: { x: 0, z: 0 }, width: 2, depth: 0.5 }, 1, 0, 45),
    model("polygon", { type: "polygon", enabled: true, points: [{ x: -0.5, z: -0.5 }, { x: 0.5, z: -0.5 }, { x: 0, z: 0.5 }] }, 3, 0),
  ];
  const doc = documentWith(...colliders);
  for (const point of [-3, -1, 1, 3]) assert.equal(isPositionValid(doc, { x: point, z: 0 }), false);
  assert.equal(colliderFootprint(colliders[2])?.type, "polygon");
});

test("overlapping colliders and colliders touching walkable boundary remain invalid", () => {
  const doc = documentWith(
    model("a", { type: "circle", enabled: true, center: { x: 0, z: 0 }, radius: 1 }),
    model("b", { type: "rectangle", enabled: true, center: { x: 0, z: 0 }, width: 2, depth: 2 }, 0.5),
    model("edge", { type: "circle", enabled: true, center: { x: 0, z: 0 }, radius: 0.5 }, 4.5),
  );
  assert.equal(isPositionValid(doc, { x: 0.25, z: 0 }), false);
  assert.equal(isPositionValid(doc, { x: 4.7, z: 0 }), false);
  assert.equal(isPositionValid(doc, { x: 4.95, z: 4.95 }), false);
});

test("overlapping walkable polygons behave as a union", () => {
  const doc = documentWith();
  doc.navigation.walkablePolygons = [
    { id: "left", enabled: true, points: [{ x: -2, z: -1 }, { x: 0.25, z: -1 }, { x: 0.25, z: 1 }, { x: -2, z: 1 }] },
    { id: "right", enabled: true, points: [{ x: -0.25, z: -1 }, { x: 2, z: -1 }, { x: 2, z: 1 }, { x: -0.25, z: 1 }] },
  ];
  doc.navigation.playerRadius = 0.3;
  assert.equal(isPositionValid(doc, { x: 0, z: 0 }), true);
});

test("runtime transform changes footprint and moving obstacle recovers player", () => {
  const obstacle = model("moving", { type: "circle", enabled: true, center: { x: 0, z: 0 }, radius: 0.8 }, 3);
  const doc = documentWith(obstacle);
  assert.equal(isPositionValid(doc, { x: 0, z: 0 }), true);
  const result = applyObstacleTransform(doc, "moving", { ...obstacle.transform3d, position: { x: 0, y: 0, z: 0 } }, { x: 0, z: 0 });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.notDeepEqual(result.player, { x: 0, z: 0 });
    assert.equal(isPositionValid(result.document, result.player), true);
  }
});

test("nearest valid point is deterministic", () => {
  const doc = documentWith(model("circle", { type: "circle", enabled: true, center: { x: 0, z: 0 }, radius: 1 }));
  const first = nearestValidPoint(doc, { x: 0, z: 0 });
  const second = nearestValidPoint(doc, { x: 0, z: 0 });
  assert.deepEqual(first, second);
  assert.ok(first && isPositionValid(doc, first));
});

test("canonical fixture validates and non-finite/self-intersecting input rejects", () => {
  assert.equal(validateMapDocument(fixture).success, true);
  const bow = structuredClone(base);
  bow.navigation.walkablePolygons[0].points = [{ x: -1, z: -1 }, { x: 1, z: 1 }, { x: -1, z: 1 }, { x: 1, z: -1 }];
  assert.equal(validateMapDocument(bow).success, false);
  const invalid = structuredClone(base) as unknown as { world: { groundY: number } };
  invalid.world.groundY = Number.POSITIVE_INFINITY;
  assert.equal(validateMapDocument(invalid).success, false);
});

test("rotated and non-uniformly scaled collider footprint is the overlay geometry", () => {
  const obstacle = model("scaled", { type: "rectangle", enabled: true, center: { x: 0, z: 0 }, width: 2, depth: 1 }, 1, 2, 90);
  obstacle.transform3d.scale = { x: 2, y: 1, z: 3 };
  const footprint = colliderFootprint(obstacle);
  assert.equal(footprint?.type, "polygon");
  if (footprint?.type === "polygon") {
    const expected = [{ x: 2.5, z: 0 }, { x: 2.5, z: 4 }, { x: -0.5, z: 4 }, { x: -0.5, z: 0 }];
    footprint.points.forEach((point, index) => {
      assert.ok(Math.abs(point.x - expected[index].x) < 1e-12);
      assert.ok(Math.abs(point.z - expected[index].z) < 1e-12);
    });
  }
  assert.equal(isPositionValid(documentWith(obstacle), { x: 1, z: 2 }), false);
});

test("large movement sweeps cannot tunnel through a thin collider", () => {
  const doc = documentWith(model("thin-wall", { type: "rectangle", enabled: true, center: { x: 0, z: 0 }, width: 0.01, depth: 4 }));
  const result = resolveMovement(doc, { x: -2, z: 0 }, { x: 2, z: 0 });
  assert.equal(result.collided, true);
  assert.equal(result.reason, "BLOCKED");
  assert.ok(result.position.x < -0.1);
  assert.equal(isPositionValid(doc, result.position), true);
});

test("nearest-point recovery stays bounded and deterministic with many overlapping colliders", () => {
  const obstacles = Array.from({ length: 64 }, (_, index) =>
    model(`overlap-${index}`, { type: "circle", enabled: true, center: { x: 0, z: 0 }, radius: 1 + index / 100 }),
  );
  const doc = documentWith(...obstacles);
  const first = nearestValidPoint(doc, { x: 0, z: 0 }, 3);
  const second = nearestValidPoint(doc, { x: 0, z: 0 }, 3);
  assert.deepEqual(first, second);
  assert.ok(first && isPositionValid(doc, first));
});

test("invalid spawn is projected safely and a trapping obstacle transform is rejected", () => {
  const blockingSpawn = model("spawn-blocker", { type: "circle", enabled: true, center: { x: 0, z: 0 }, radius: 0.5 });
  const doc = documentWith(blockingSpawn);
  doc.navigation.spawn = { x: 0, z: 0 };
  const movement = resolveMovement(doc, doc.navigation.spawn, { x: 2, z: 0 });
  assert.equal(isPositionValid(doc, movement.position), true);

  const moving = model("moving-wall", { type: "circle", enabled: true, center: { x: 0, z: 0 }, radius: 1 }, 3);
  const trapped = documentWith(moving);
  trapped.navigation.walkablePolygons = [{ id: "tiny", enabled: true, points: [{ x: -0.25, z: -0.25 }, { x: 0.25, z: -0.25 }, { x: 0.25, z: 0.25 }, { x: -0.25, z: 0.25 }] }];
  trapped.navigation.spawn = { x: 0, z: 0 };
  const rejected = applyObstacleTransform(trapped, "moving-wall", { ...moving.transform3d, position: { x: 0, y: 0, z: 0 } }, { x: 0, z: 0 });
  assert.deepEqual(rejected, { ok: false, code: "OBSTACLE_TRAPS_PLAYER" });
});

test("malformed, degenerate and non-finite polygon documents are rejected", () => {
  const missing = structuredClone(base) as Partial<MapDocument>;
  delete missing.navigation;
  assert.equal(validateMapDocument(missing).success, false);

  const degenerate = structuredClone(base);
  degenerate.navigation.walkablePolygons[0].points = [{ x: -1, z: 0 }, { x: 0, z: 0 }, { x: 1, z: 0 }];
  const degenerateResult = validateMapDocument(degenerate);
  assert.equal(degenerateResult.success, false);
  if (!degenerateResult.success) assert.ok(degenerateResult.issues.some((issue) => issue.code === "DEGENERATE_POLYGON"));

  const nonFinite = structuredClone(base);
  nonFinite.navigation.walkablePolygons[0].points[0].x = Number.NaN;
  assert.equal(validateMapDocument(nonFinite).success, false);
});
