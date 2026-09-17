import { MapDocumentSchemaV1, type MapDocument, type Vec2 } from "./map-document.js";
import { isPositionValid, polygonArea, polygonSelfIntersects } from "./collision.js";

export type MapValidationIssue = { code: string; path: string; message: string; objectId?: string; polygonId?: string };

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
  const parsed = MapDocumentSchemaV1.safeParse(input);
  if (!parsed.success) return { success: false, issues: parsed.error.issues.map((issue) => ({ code: "STRUCTURAL_VALIDATION", path: issue.path.join("."), message: issue.message })) };
  const document = parsed.data;
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
  return issues.length ? { success: false, issues } : { success: true, document };
}

export function canonicalizeMapDocument(document: MapDocument): MapDocument {
  const orient = <T extends Vec2>(points: T[]) => polygonArea(points) < 0 ? [...points].reverse() : [...points];
  return {
    ...document,
    navigation: { ...document.navigation, walkablePolygons: document.navigation.walkablePolygons.map((polygon) => ({ ...polygon, points: orient(polygon.points) })) },
    objects: document.objects.map((object) => object.collider.type === "polygon" ? { ...object, collider: { ...object.collider, points: orient(object.collider.points) } } : object),
  };
}
