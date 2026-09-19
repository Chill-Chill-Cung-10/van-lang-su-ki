import { z } from "zod";

const finite = z.number().finite().min(-10_000).max(10_000);
const positive = z.number().finite().positive().max(10_000);
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(64);
const assetPath = z.string().max(500).refine(
  (value) => value.startsWith("/") && !value.startsWith("//") && !value.includes("..") && !/^(?:data|blob|https?):/i.test(value),
  "Asset phải là path same-origin hợp lệ.",
);
const vec2 = z.object({ x: finite, z: finite }).strict();
const vec3 = z.object({ x: finite, y: finite, z: finite }).strict();
const scale2 = z.object({ x: positive, z: positive }).strict();
const scale3 = z.object({ x: positive, y: positive, z: positive }).strict();

export const Transform2DSchema = z.object({
  position: z.object({ x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1) }).strict(),
  size: z.object({ width: positive, height: positive }).strict(),
  anchor: z.object({ x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1) }).strict(),
  rotationDeg: finite,
  scale: z.object({ x: positive, y: positive }).strict(),
}).strict();

export const Transform3DSchema = z.object({ position: vec3, rotationDeg: vec3, scale: scale3 }).strict();

const noneCollider = z.object({ type: z.literal("none") }).strict();
const circleCollider = z.object({ type: z.literal("circle"), enabled: z.boolean(), center: vec2, radius: positive }).strict();
const rectangleCollider = z.object({
  type: z.literal("rectangle"), enabled: z.boolean(), center: vec2, width: positive, depth: positive,
  rotationDeg: finite.optional(),
}).strict();
const polygonCollider = z.object({ type: z.literal("polygon"), enabled: z.boolean(), points: z.array(vec2).min(3).max(64) }).strict();
export const ColliderSchema = z.discriminatedUnion("type", [noneCollider, circleCollider, rectangleCollider, polygonCollider]);

const commonObject = {
  id: slug,
  name: z.string().min(1).max(120),
  enabled: z.boolean(),
  renderOrder: z.number().int().min(-10_000).max(10_000),
  collider: ColliderSchema,
  binding: z.object({ type: z.literal("npc"), entityId: slug }).strict().optional(),
};

const spriteObject = z.object({
  ...commonObject,
  kind: z.literal("sprite2d"),
  renderLayer: z.enum(["underlay2d", "overlay2d"]),
  src: assetPath,
  alt: z.string().max(240),
  transform2d: Transform2DSchema,
  navigationTransform: z.object({ position: vec2, yawDeg: finite, scale: scale2 }).strict().optional(),
}).strict();

const modelObject = z.object({
  ...commonObject,
  kind: z.literal("model3d"),
  renderLayer: z.literal("world3d"),
  src: assetPath,
  transform3d: Transform3DSchema,
  castShadow: z.boolean(),
  receiveShadow: z.boolean(),
}).strict();

export const MapObjectSchema = z.discriminatedUnion("kind", [spriteObject, modelObject]);

export const MapDocumentSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  mapId: slug,
  metadata: z.object({
    name: z.string().min(1).max(120), description: z.string().max(1_000), ariaLabel: z.string().min(1).max(160), thumbnailSrc: assetPath.optional(), playerPortraitSrc: assetPath.optional(),
  }).strict(),
  background: z.object({
    src: assetPath, alt: z.string().max(240), fit: z.enum(["contain", "cover", "fill"]), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), aspectRatio: positive,
  }).strict(),
  world: z.object({
    groundY: finite,
    rootTransform: Transform3DSchema,
    camera: z.object({ position: vec3, target: vec3, fovDeg: z.number().finite().min(1).max(179), near: positive, far: positive }).strict(),
    ambient: z.object({ presetId: slug }).strict(),
  }).strict(),
  navigation: z.object({
    spawn: vec2,
    playerRadius: positive,
    walkablePolygons: z.array(z.object({ id: slug, enabled: z.boolean(), points: z.array(vec2).min(3).max(128) }).strict()).min(1).max(64),
  }).strict(),
  objects: z.array(MapObjectSchema).max(500),
}).strict();

const EntryPointSchemaV2 = z.object({ id: slug, position: vec2, facingDeg: finite }).strict();
const DirectedPortalSchemaV2 = z.object({ id: slug, enabled: z.boolean(), trigger: z.object({ type: z.literal("circle"), center: vec2, radius: z.number().finite().positive().max(1_000) }).strict(), target: z.object({ mapId: slug, entryPointId: slug }).strict() }).strict();

export const MapDocumentSchemaV2 = MapDocumentSchemaV1.omit({ schemaVersion: true, navigation: true }).extend({
  schemaVersion: z.literal(2),
  navigation: MapDocumentSchemaV1.shape.navigation.extend({ entryPoints: z.array(EntryPointSchemaV2).min(1).max(64) }).strict(),
  portals: z.array(DirectedPortalSchemaV2).max(128),
}).strict();
export const MapNpcDialogueStepSchema = z.object({
  id: z.string().trim().max(64).optional(),
  speaker: z.string().trim().max(120).optional(),
  text: z.string().trim().min(1).max(2_000),
}).strict();
export type MapNpcDialogueStep = z.infer<typeof MapNpcDialogueStepSchema>;

export const MapNpcSchemaV3 = z.object({
  id: slug,
  name: z.string().trim().min(1).max(120),
  src: assetPath,
  portraitSrc: assetPath.optional(),
  transform: Transform3DSchema,
  dialogue: z.string().trim().min(1).max(2_000),
  dialogueChain: z.array(MapNpcDialogueStepSchema).min(1).max(64).optional(),
}).strict();

export function getNpcDialogueChain(npc: { name: string; dialogue: string; dialogueChain?: MapNpcDialogueStep[] }): MapNpcDialogueStep[] {
  if (npc.dialogueChain && npc.dialogueChain.length > 0) {
    return npc.dialogueChain;
  }
  return [{ text: npc.dialogue, speaker: npc.name }];
}
export const MapDocumentSchemaV3 = MapDocumentSchemaV2.omit({ schemaVersion: true }).extend({
  schemaVersion: z.literal(3),
  npcs: z.array(MapNpcSchemaV3).max(128),
}).strict();
export const MapDocumentSchemaV4 = MapDocumentSchemaV3.omit({ schemaVersion: true, navigation: true }).extend({
  schemaVersion: z.literal(4),
  navigation: MapDocumentSchemaV3.shape.navigation.extend({ spawnFacingDeg: finite }).strict(),
}).strict();
export const MapDocumentSchema = z.discriminatedUnion("schemaVersion", [MapDocumentSchemaV1, MapDocumentSchemaV2, MapDocumentSchemaV3, MapDocumentSchemaV4]);
export type MapDocumentInput = z.infer<typeof MapDocumentSchema>;
export type MapDocumentV1 = z.infer<typeof MapDocumentSchemaV1>;
export type MapDocumentV2 = z.infer<typeof MapDocumentSchemaV2>;
export type MapDocument = z.infer<typeof MapDocumentSchemaV4>;
export type MapNpc = z.infer<typeof MapNpcSchemaV3>;
export type MapObject = z.infer<typeof MapObjectSchema>;
export type Collider = z.infer<typeof ColliderSchema>;
export type Vec2 = z.infer<typeof vec2>;
export type EntryPoint = z.infer<typeof EntryPointSchemaV2>;
export type DirectedPortal = z.infer<typeof DirectedPortalSchemaV2>;

export function upgradeMapDocument(input: unknown): MapDocument {
  const document = MapDocumentSchema.parse(input);
  if (document.schemaVersion === 4) return structuredClone(document);
  const v2: MapDocumentV2 = document.schemaVersion === 2 ? structuredClone(document) : { ...structuredClone(document), schemaVersion: 2, navigation: { ...structuredClone(document.navigation), entryPoints: [{ id: "default", position: { ...document.navigation.spawn }, facingDeg: 0 }] }, portals: [] };
  const v3 = document.schemaVersion === 3 ? structuredClone(document) : { ...v2, schemaVersion: 3 as const, npcs: [] };
  return { ...v3, schemaVersion: 4, navigation: { ...v3.navigation, spawnFacingDeg: 180 } };
}

export const MapFlowNodeSchemaV1 = z.object({ mapId: slug, mapRevision: z.number().int().positive(), position: z.object({ x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1) }).strict() }).strict();
export const MapFlowDocumentSchemaV1 = z.object({ schemaVersion: z.literal(1), flowId: slug, nodes: z.array(MapFlowNodeSchemaV1).min(1).max(128) }).strict();
export const MapFlowDraftSchemaV1 = z.object({ schemaVersion: z.literal(1), flowId: slug, nodes: z.array(MapFlowNodeSchemaV1.omit({ mapRevision: true })).min(1).max(128) }).strict();
export type MapFlowDocument = z.infer<typeof MapFlowDocumentSchemaV1>;
export type MapFlowDraft = z.infer<typeof MapFlowDraftSchemaV1>;

export const MapSummarySchema = z.object({
  mapId: slug, name: z.string(), description: z.string(), thumbnailSrc: assetPath.optional(), activeRevision: z.number().int().positive(), updatedAt: z.string().datetime(),
}).strict();
export const MapListResponseSchema = z.object({ maps: z.array(MapSummarySchema) }).strict();
export const MapRevisionEnvelopeSchema = z.object({
  mapId: slug, revision: z.number().int().positive(), etag: z.string().min(1), activatedAt: z.string().datetime(), document: MapDocumentSchema,
}).strict().transform((value) => ({ ...value, document: upgradeMapDocument(value.document) }));
export const MapFlowEnvelopeSchema = z.object({ flowId: slug, revision: z.number().int().positive(), etag: z.string().min(1), activatedAt: z.string().datetime(), document: MapFlowDocumentSchemaV1 }).strict();
export const SaveMapRequestSchema = z.object({ document: MapDocumentSchemaV4 }).strict();
export const SaveMapFlowRequestSchema = z.object({ document: MapFlowDraftSchemaV1, maps: z.array(z.object({ mapId: slug, expectedEtag: z.string().min(1), document: MapDocumentSchemaV4 }).strict()).max(128) }).strict();
export const CloneMapRequestSchema = z.object({ sourceMapId: slug, mapId: slug, metadata: MapDocumentSchemaV4.shape.metadata.pick({ name: true, description: true, thumbnailSrc: true, playerPortraitSrc: true }), nodePosition: MapFlowNodeSchemaV1.shape.position, expectedSourceMapEtag: z.string().min(1) }).strict();
export type MapSummary = z.infer<typeof MapSummarySchema>;
export type MapRevisionEnvelope = z.infer<typeof MapRevisionEnvelopeSchema>;
export type MapFlowEnvelope = z.infer<typeof MapFlowEnvelopeSchema>;
export type SaveMapFlowRequest = z.infer<typeof SaveMapFlowRequestSchema>;
export type CloneMapRequest = z.infer<typeof CloneMapRequestSchema>;

export function canonicalStringify(value: unknown): string {
  const visit = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(visit);
    if (item && typeof item === "object") {
      return Object.fromEntries(Object.entries(item as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, visit(child)]));
    }
    return item;
  };
  return JSON.stringify(visit(value));
}
