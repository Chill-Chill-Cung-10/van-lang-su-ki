import { MapDocumentSchemaV1, nearestValidPoint, resolveMovement, type MapDocument, type Vec2 } from "@van-lang/map-contract";
import vanlangFixture from "@van-lang/map-contract/maps/vanlang.v1.json";

export type NavPoint = { x: number; y: number };
export const VANLANG_FALLBACK_DOCUMENT = MapDocumentSchemaV1.parse(vanlangFixture);
export const DUNGEON_SPAWN: NavPoint = { x: VANLANG_FALLBACK_DOCUMENT.navigation.spawn.x, y: VANLANG_FALLBACK_DOCUMENT.navigation.spawn.z };

const toVec2 = (point: NavPoint): Vec2 => ({ x: point.x, z: point.y });
const toNavPoint = (point: Vec2): NavPoint => ({ x: point.x, y: point.z });

export function projectToNavmesh(point: NavPoint, document: MapDocument = VANLANG_FALLBACK_DOCUMENT, current?: NavPoint): NavPoint {
  const resolved = resolveMovement(document, current ? toVec2(current) : document.navigation.spawn, toVec2(point));
  if (!resolved.collided) return toNavPoint(resolved.position);
  return toNavPoint(nearestValidPoint(document, toVec2(point)) ?? resolved.position);
}

export function npcPositionFromDocument(document: MapDocument, entityId: string): NavPoint | null {
  const placement = document.objects.find((object) => object.binding?.entityId === entityId);
  if (!placement) return null;
  if (placement.kind === "model3d") return { x: placement.transform3d.position.x, y: placement.transform3d.position.z };
  return placement.navigationTransform ? { x: placement.navigationTransform.position.x, y: placement.navigationTransform.position.z } : null;
}
