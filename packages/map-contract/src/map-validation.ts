import { MapDocumentSchema, MapFlowDocumentSchemaV1, upgradeMapDocument, type MapDocument, type MapFlowDocument, type Vec2 } from "./map-document.js";
import { isPositionValid, polygonArea, polygonSelfIntersects } from "./collision.js";

export type MapValidationIssue = { code: string; path: string; message: string; mapId?: string; objectId?: string; polygonId?: string; portalId?: string };

function polygonIssues(points: Vec2[], path: string, polygonId?: string, objectId?: string): MapValidationIssue[] {
  const issues: MapValidationIssue[] = [];
  if (points.some((point, index) => index > 0 && point.x === points[index - 1].x && point.z === points[index - 1].z)) {
    issues.push({ code: "DUPLICATE_ADJACENT_POINT", path, message: "Polygon có hai điểm liên tiếp trùng nhau.", polygonId, objectId });
  }
  if (Math.abs(polygonArea(points)) <= 1e-6) issues.push({ code: "DEGENERATE_POLYGON", path, message: "Polygon phải có diện tích khác 0.", polygonId, objectId });
  if (polygonSelfIntersects(points)) issues.push({ code: "SELF_INTERSECTING_POLYGON", path, message: "Polygon không được tự giao nhau.", polygonId, objectId });
  return issues;
}

export function validateMapDocument(input: unknown): { success: true; document: MapDocument } | { success: false; issues: MapValidationIssue[] } {
  const parsed = MapDocumentSchema.safeParse(input);
  if (!parsed.success) return { success: false, issues: parsed.error.issues.map((issue) => ({ code: "STRUCTURAL_VALIDATION", path: issue.path.join("."), message: issue.message })) };
  const document = upgradeMapDocument(parsed.data);
  const issues: MapValidationIssue[] = [];
  const objectIds = new Set<string>();
  const bindingIds = new Set<string>();
  const polygonIds = new Set<string>();
  document.objects.forEach((object, index) => {
    if (objectIds.has(object.id)) issues.push({ code: "DUPLICATE_OBJECT_ID", path: `objects.${index}.id`, message: "ID object phải duy nhất.", objectId: object.id });
    objectIds.add(object.id);
    if (object.binding) {
      if (bindingIds.has(object.binding.entityId)) issues.push({ code: "DUPLICATE_BINDING", path: `objects.${index}.binding.entityId`, message: "Một NPC chỉ được bind một lần.", objectId: object.id });
      bindingIds.add(object.binding.entityId);
    }
    if (object.kind === "sprite2d" && object.collider.type !== "none" && !object.navigationTransform) issues.push({ code: "MISSING_NAVIGATION_TRANSFORM", path: `objects.${index}.navigationTransform`, message: "Sprite có collider cần navigation transform.", objectId: object.id });
    if (object.collider.type === "polygon") issues.push(...polygonIssues(object.collider.points, `objects.${index}.collider.points`, undefined, object.id));
  });
  document.navigation.walkablePolygons.forEach((polygon, index) => {
    if (polygonIds.has(polygon.id)) issues.push({ code: "DUPLICATE_POLYGON_ID", path: `navigation.walkablePolygons.${index}.id`, message: "ID vùng đi được phải duy nhất.", polygonId: polygon.id });
    polygonIds.add(polygon.id);
    issues.push(...polygonIssues(polygon.points, `navigation.walkablePolygons.${index}.points`, polygon.id));
  });
  if (issues.length === 0 && !isPositionValid(document, document.navigation.spawn)) issues.push({ code: "INVALID_SPAWN", path: "navigation.spawn", message: "Điểm spawn không nằm trong vùng hợp lệ." });
  const entryIds = new Set<string>();
  document.navigation.entryPoints.forEach((entry, index) => {
    if (entryIds.has(entry.id)) issues.push({ code: "DUPLICATE_ENTRY_POINT_ID", path: `navigation.entryPoints.${index}.id`, message: "ID entry point phải duy nhất." });
    entryIds.add(entry.id);
    if (!isPositionValid(document, entry.position)) issues.push({ code: "INVALID_ENTRY_POINT", path: `navigation.entryPoints.${index}.position`, message: "Entry point không nằm trong navmesh hợp lệ." });
  });
  const portalIds = new Set<string>();
  document.portals.forEach((portal, index) => {
    if (portalIds.has(portal.id)) issues.push({ code: "DUPLICATE_PORTAL_ID", path: `portals.${index}.id`, message: "ID portal phải duy nhất.", portalId: portal.id });
    portalIds.add(portal.id);
    if (!isPositionValid(document, portal.trigger.center)) issues.push({ code: "INVALID_PORTAL_TRIGGER", path: `portals.${index}.trigger.center`, message: "Trigger portal không nằm trong navmesh hợp lệ.", portalId: portal.id });
    document.portals.slice(0, index).forEach((other) => {
      const distance = Math.hypot(portal.trigger.center.x - other.trigger.center.x, portal.trigger.center.z - other.trigger.center.z);
      if (distance <= portal.trigger.radius + other.trigger.radius) {
        issues.push({ code: "OVERLAPPING_PORTAL_TRIGGER", path: `portals.${index}.trigger`, message: "Trigger portal không được overlap trigger khác.", portalId: portal.id });
      }
    });
  });
  return issues.length ? { success: false, issues } : { success: true, document };
}

export function validateMapFlowDocument(input: unknown): { success: true; document: MapFlowDocument } | { success: false; issues: MapValidationIssue[] } {
  const parsed = MapFlowDocumentSchemaV1.safeParse(input);
  if (!parsed.success) return { success: false, issues: parsed.error.issues.map((issue) => ({ code: "STRUCTURAL_VALIDATION", path: issue.path.join("."), message: issue.message })) };
  const seen = new Set<string>();
  const issues: MapValidationIssue[] = [];
  parsed.data.nodes.forEach((node, index) => {
    if (seen.has(node.mapId)) issues.push({ code: "DUPLICATE_MAP_ID", path: `nodes.${index}.mapId`, message: "Mỗi map chỉ có một node trong flow.", mapId: node.mapId });
    seen.add(node.mapId);
  });
  return issues.length ? { success: false, issues } : { success: true, document: parsed.data };
}

export function validateMapFlowSnapshot(flow: MapFlowDocument, maps: ReadonlyMap<string, MapDocument>): MapValidationIssue[] {
  const issues: MapValidationIssue[] = [];
  const nodeIds = new Set(flow.nodes.map((node) => node.mapId));
  for (const node of flow.nodes) {
    const document = maps.get(node.mapId);
    if (!document) {
      issues.push({ code: "MAP_NOT_RESOLVED", path: "nodes", message: "Node không resolve được map revision.", mapId: node.mapId });
      continue;
    }
    document.portals.forEach((portal, index) => {
      const target = maps.get(portal.target.mapId);
      if (!nodeIds.has(portal.target.mapId) || !target) issues.push({ code: "PORTAL_TARGET_NOT_FOUND", path: `portals.${index}.target.mapId`, message: "Map đích không tồn tại trong flow.", mapId: node.mapId, portalId: portal.id });
      else if (!target.navigation.entryPoints.some((entry) => entry.id === portal.target.entryPointId)) issues.push({ code: "PORTAL_ENTRY_POINT_NOT_FOUND", path: `portals.${index}.target.entryPointId`, message: "Entry point đích không tồn tại.", mapId: node.mapId, portalId: portal.id });
    });
  }
  return issues;
}

export function canonicalizeMapDocument(document: MapDocument): MapDocument {
  const orient = <T extends Vec2>(points: T[]) => polygonArea(points) < 0 ? [...points].reverse() : [...points];
  return {
    ...document,
    navigation: { ...document.navigation, walkablePolygons: document.navigation.walkablePolygons.map((polygon) => ({ ...polygon, points: orient(polygon.points) })) },
    objects: document.objects.map((object) => object.collider.type === "polygon" ? { ...object, collider: { ...object.collider, points: orient(object.collider.points) } } : object),
  };
}
