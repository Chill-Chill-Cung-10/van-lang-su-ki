import type { MapDocument, MapObject, Vec2 } from "./map-document.js";

export const GEOMETRY_EPSILON = 1e-6;
type Footprint = { type: "circle"; center: Vec2; radius: number } | { type: "polygon"; points: Vec2[] };

const cross = (a: Vec2, b: Vec2, c: Vec2) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
const samePoint = (a: Vec2, b: Vec2) => Math.abs(a.x - b.x) <= GEOMETRY_EPSILON && Math.abs(a.z - b.z) <= GEOMETRY_EPSILON;

export function polygonArea(points: Vec2[]): number {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.z - next.x * point.z;
  }, 0) / 2;
}

function onSegment(point: Vec2, a: Vec2, b: Vec2) {
  return Math.abs(cross(a, b, point)) <= GEOMETRY_EPSILON
    && point.x >= Math.min(a.x, b.x) - GEOMETRY_EPSILON && point.x <= Math.max(a.x, b.x) + GEOMETRY_EPSILON
    && point.z >= Math.min(a.z, b.z) - GEOMETRY_EPSILON && point.z <= Math.max(a.z, b.z) + GEOMETRY_EPSILON;
}

function segmentsIntersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2) {
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  if (((abC > GEOMETRY_EPSILON && abD < -GEOMETRY_EPSILON) || (abC < -GEOMETRY_EPSILON && abD > GEOMETRY_EPSILON))
    && ((cdA > GEOMETRY_EPSILON && cdB < -GEOMETRY_EPSILON) || (cdA < -GEOMETRY_EPSILON && cdB > GEOMETRY_EPSILON))) return true;
  return (Math.abs(abC) <= GEOMETRY_EPSILON && onSegment(c, a, b))
    || (Math.abs(abD) <= GEOMETRY_EPSILON && onSegment(d, a, b))
    || (Math.abs(cdA) <= GEOMETRY_EPSILON && onSegment(a, c, d))
    || (Math.abs(cdB) <= GEOMETRY_EPSILON && onSegment(b, c, d));
}

export function polygonSelfIntersects(points: Vec2[]): boolean {
  for (let index = 0; index < points.length; index += 1) {
    const next = (index + 1) % points.length;
    for (let other = index + 1; other < points.length; other += 1) {
      const otherNext = (other + 1) % points.length;
      if (index === other || next === other || otherNext === index) continue;
      if (segmentsIntersect(points[index], points[next], points[other], points[otherNext])) return true;
    }
  }
  return false;
}

export function pointInPolygon(point: Vec2, points: Vec2[]): boolean {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const a = points[previous];
    const b = points[index];
    if (onSegment(point, a, b)) return true;
    if ((a.z > point.z) !== (b.z > point.z) && point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

export function closestPointOnSegment(point: Vec2, start: Vec2, end: Vec2): Vec2 {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = dx * dx + dz * dz;
  if (length <= GEOMETRY_EPSILON) return { ...start };
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / length));
  return { x: start.x + dx * t, z: start.z + dz * t };
}

export function distanceToPolygonEdges(point: Vec2, points: Vec2[]) {
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < points.length; index += 1) {
    const closest = closestPointOnSegment(point, points[index], points[(index + 1) % points.length]);
    distance = Math.min(distance, Math.hypot(point.x - closest.x, point.z - closest.z));
  }
  return distance;
}

function rotateScaleTranslate(point: Vec2, position: Vec2, yawDeg: number, scale: Vec2): Vec2 {
  const radians = yawDeg * Math.PI / 180;
  const x = point.x * scale.x;
  const z = point.z * scale.z;
  return { x: position.x + x * Math.cos(radians) - z * Math.sin(radians), z: position.z + x * Math.sin(radians) + z * Math.cos(radians) };
}

export function colliderFootprint(object: MapObject): Footprint | null {
  if (!object.enabled || object.collider.type === "none" || !object.collider.enabled) return null;
  const pose = object.kind === "model3d"
    ? { position: { x: object.transform3d.position.x, z: object.transform3d.position.z }, yawDeg: object.transform3d.rotationDeg.y, scale: { x: object.transform3d.scale.x, z: object.transform3d.scale.z } }
    : object.navigationTransform;
  if (!pose) return null;
  const collider = object.collider;
  if (collider.type === "circle") {
    return { type: "circle", center: rotateScaleTranslate(collider.center, pose.position, pose.yawDeg, pose.scale), radius: collider.radius * Math.max(Math.abs(pose.scale.x), Math.abs(pose.scale.z)) };
  }
  let points: Vec2[];
  if (collider.type === "rectangle") {
    const halfWidth = collider.width / 2;
    const halfDepth = collider.depth / 2;
    const local = [{ x: -halfWidth, z: -halfDepth }, { x: halfWidth, z: -halfDepth }, { x: halfWidth, z: halfDepth }, { x: -halfWidth, z: halfDepth }];
    const radians = (collider.rotationDeg ?? 0) * Math.PI / 180;
    points = local.map((point) => ({
      x: collider.center.x + point.x * Math.cos(radians) - point.z * Math.sin(radians),
      z: collider.center.z + point.x * Math.sin(radians) + point.z * Math.cos(radians),
    }));
  } else {
    points = collider.points;
  }
  return { type: "polygon", points: points.map((point) => rotateScaleTranslate(point, pose.position, pose.yawDeg, pose.scale)) };
}

export function isPositionValid(document: MapDocument, position: Vec2, radius = document.navigation.playerRadius): boolean {
  const walkable = document.navigation.walkablePolygons.filter((polygon) => polygon.enabled);
  const footprintSamples = [{ ...position }, ...Array.from({ length: 32 }, (_, index) => {
    const angle = 2 * Math.PI * index / 32;
    return { x: position.x + Math.cos(angle) * radius, z: position.z + Math.sin(angle) * radius };
  })];
  const insideWalkable = footprintSamples.every((sample) => walkable.some((polygon) => pointInPolygon(sample, polygon.points)));
  if (!insideWalkable) return false;
  for (const object of document.objects) {
    const footprint = colliderFootprint(object);
    if (!footprint) continue;
    if (footprint.type === "circle") {
      if (Math.hypot(position.x - footprint.center.x, position.z - footprint.center.z) <= footprint.radius + radius + GEOMETRY_EPSILON) return false;
    } else if (pointInPolygon(position, footprint.points) || distanceToPolygonEdges(position, footprint.points) <= radius + GEOMETRY_EPSILON) {
      return false;
    }
  }
  return true;
}

export function nearestValidPoint(document: MapDocument, origin: Vec2, maxDistance = 40): Vec2 | null {
  if (isPositionValid(document, origin)) return origin;
  const step = Math.max(0.04, document.navigation.playerRadius / 3);
  for (let distance = step; distance <= maxDistance; distance += step) {
    const samples = Math.min(128, Math.max(24, Math.ceil(2 * Math.PI * distance / step)));
    const candidates: Vec2[] = [];
    for (let index = 0; index < samples; index += 1) {
      const angle = 2 * Math.PI * index / samples;
      const candidate = { x: origin.x + Math.cos(angle) * distance, z: origin.z + Math.sin(angle) * distance };
      if (isPositionValid(document, candidate)) candidates.push(candidate);
    }
    if (candidates.length) return candidates.sort((a, b) => Math.hypot(a.x - origin.x, a.z - origin.z) - Math.hypot(b.x - origin.x, b.z - origin.z) || a.x - b.x || a.z - b.z)[0];
  }
  return null;
}

function segmentIntersectionParameter(start: Vec2, end: Vec2, edgeStart: Vec2, edgeEnd: Vec2): number | null {
  const movement = { x: end.x - start.x, z: end.z - start.z };
  const edge = { x: edgeEnd.x - edgeStart.x, z: edgeEnd.z - edgeStart.z };
  const denominator = movement.x * edge.z - movement.z * edge.x;
  if (Math.abs(denominator) <= GEOMETRY_EPSILON) return null;
  const offset = { x: edgeStart.x - start.x, z: edgeStart.z - start.z };
  const movementT = (offset.x * edge.z - offset.z * edge.x) / denominator;
  const edgeT = (offset.x * movement.z - offset.z * movement.x) / denominator;
  return movementT >= 0 && movementT <= 1 && edgeT >= 0 && edgeT <= 1 ? movementT : null;
}

function sweepParameters(document: MapDocument, start: Vec2, end: Vec2): number[] {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared <= GEOMETRY_EPSILON) return [0, 1];
  const values = new Set<number>([0, 1]);
  const addProjection = (point: Vec2) => values.add(Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared)));
  const addPolygon = (points: Vec2[]) => points.forEach((point, index) => {
    addProjection(point);
    const intersection = segmentIntersectionParameter(start, end, point, points[(index + 1) % points.length]);
    if (intersection !== null) values.add(intersection);
  });

  document.navigation.walkablePolygons.filter((polygon) => polygon.enabled).forEach((polygon) => addPolygon(polygon.points));
  document.objects.forEach((object) => {
    const footprint = colliderFootprint(object);
    if (footprint?.type === "circle") addProjection(footprint.center);
    else if (footprint?.type === "polygon") addPolygon(footprint.points);
  });

  const distance = Math.sqrt(lengthSquared);
  const step = Math.max(0.01, Math.min(0.05, document.navigation.playerRadius / 2));
  const uniformSteps = Math.min(4096, Math.ceil(distance / step));
  for (let index = 1; index < uniformSteps; index += 1) values.add(index / uniformSteps);

  const critical = [...values].sort((a, b) => a - b);
  for (let index = 1; index < critical.length; index += 1) values.add((critical[index - 1] + critical[index]) / 2);
  return [...values].sort((a, b) => a - b);
}

function sweepMovement(document: MapDocument, start: Vec2, end: Vec2) {
  let lastValid = 0;
  for (const parameter of sweepParameters(document, start, end)) {
    const candidate = { x: start.x + (end.x - start.x) * parameter, z: start.z + (end.z - start.z) * parameter };
    if (isPositionValid(document, candidate)) {
      lastValid = parameter;
      continue;
    }
    let low = lastValid;
    let high = parameter;
    for (let index = 0; index < 24; index += 1) {
      const middle = (low + high) / 2;
      const point = { x: start.x + (end.x - start.x) * middle, z: start.z + (end.z - start.z) * middle };
      if (isPositionValid(document, point)) low = middle; else high = middle;
    }
    return { position: { x: start.x + (end.x - start.x) * low, z: start.z + (end.z - start.z) * low }, collided: true };
  }
  return { position: end, collided: false };
}

export function resolveMovement(document: MapDocument, current: Vec2, desired: Vec2) {
  const validStart = isPositionValid(document, current)
    ? current
    : nearestValidPoint(document, current) ?? nearestValidPoint(document, document.navigation.spawn);
  if (!validStart) return { position: current, collided: true as const, reason: "NO_VALID_POSITION" as const };
  const movement = sweepMovement(document, validStart, desired);
  if (!movement.collided) return { position: desired, collided: false as const, reason: null };
  const position = movement.position;
  const slideCandidates = [{ x: desired.x, z: position.z }, { x: position.x, z: desired.z }]
    .map((candidate) => sweepMovement(document, position, candidate).position)
    .filter((candidate) => isPositionValid(document, candidate))
    .sort((a, b) => Math.hypot(a.x - desired.x, a.z - desired.z) - Math.hypot(b.x - desired.x, b.z - desired.z) || a.x - b.x || a.z - b.z);
  if (slideCandidates[0] && Math.hypot(slideCandidates[0].x - position.x, slideCandidates[0].z - position.z) > GEOMETRY_EPSILON) {
    return { position: slideCandidates[0], collided: true as const, reason: "BLOCKED" as const };
  }
  return { position, collided: true as const, reason: "BLOCKED" as const };
}

type Transform3D = Extract<MapObject, { kind: "model3d" }>["transform3d"];
type NavigationTransform = NonNullable<Extract<MapObject, { kind: "sprite2d" }>["navigationTransform"]>;

export function applyObstacleTransform(document: MapDocument, objectId: string, transform: Transform3D | NavigationTransform, player: Vec2) {
  const objectIndex = document.objects.findIndex((object) => object.id === objectId);
  if (objectIndex < 0) return { ok: false as const, code: "OBJECT_NOT_FOUND" as const };
  const object = document.objects[objectIndex];
  const updated = object.kind === "model3d" ? { ...object, transform3d: transform as typeof object.transform3d } : { ...object, navigationTransform: transform as typeof object.navigationTransform };
  const next = { ...document, objects: document.objects.map((item, index) => index === objectIndex ? updated : item) } as MapDocument;
  if (isPositionValid(next, player)) return { ok: true as const, document: next, player };
  const recovered = nearestValidPoint(next, player);
  if (recovered) return { ok: true as const, document: next, player: recovered };
  if (isPositionValid(next, next.navigation.spawn)) return { ok: true as const, document: next, player: next.navigation.spawn };
  return { ok: false as const, code: "OBSTACLE_TRAPS_PLAYER" as const };
}
