"use client";

import {
  canonicalStringify,
  colliderFootprint,
  isPositionValid,
  nearestValidPoint,
  validateMapDocument,
  type Collider,
  type DirectedPortal,
  type MapDocument,
  type MapFlowEnvelope,
  type MapNpc,
  type MapObject,
  type MapRevisionEnvelope,
  type MapSummary,
  type MapValidationIssue,
  type Vec2,
} from "@van-lang/map-contract";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { cloneFlowMap, importGlb, listMaps, loadFlowMap, loadMap, loadMapFlow, MapApiError, saveMap, saveMapFlow } from "../../_lib/map-api-client";

const WRITE_ENABLED = process.env.NEXT_PUBLIC_MAP_EDITOR_WRITE_ENABLED === "true";
const DungeonPreview = dynamic(
  () => import("../../_components/vanlang-dungeon-world").then((module) => module.VanlangDungeonWorld),
  { ssr: false, loading: () => null },
);
const ASSETS = [
  { kind: "model3d" as const, name: "Đấu trường 3D", src: "/models/vanlang-rebirth/arena.runtime.glb" },
  { kind: "sprite2d" as const, name: "Nền Văn Lang", src: "/vanlang-rebirth-arena.png" },
];
const clone = <T,>(value: T): T => structuredClone(value);
const numberValue = (value: string) => Number.isFinite(Number(value)) ? Number(value) : 0;
type ViewportMode = "2d" | "3d" | "overlay";
type EditorTab = "map" | "flow";
type ValidationGroup = "geometry" | "entry" | "portal" | "npc" | "map";

const issueGroup = (issue: MapValidationIssue): ValidationGroup => issue.npcId ? "npc"
  : issue.portalId || issue.path.startsWith("portals.") ? "portal"
  : issue.path.startsWith("navigation.entryPoints.") || issue.code === "INVALID_SPAWN" ? "entry"
  : issue.polygonId || issue.objectId || issue.path.includes("collider") || issue.path.startsWith("navigation.walkablePolygons.") ? "geometry"
  : "map";
const issueKey = (issue: MapValidationIssue) => `${issue.code}:${issue.path}`;

function prepareDocumentForSave(document: MapDocument) {
  const repaired = clone(document);
  const adjustedEntryPointIds: string[] = [];
  const adjustedPortalIds: string[] = [];
  for (const entry of repaired.navigation.entryPoints) {
    if (isPositionValid(repaired, entry.position)) continue;
    const position = nearestValidPoint(repaired, entry.position);
    if (!position) continue;
    entry.position = position;
    adjustedEntryPointIds.push(entry.id);
  }
  for (const portal of repaired.portals) {
    if (isPositionValid(repaired, portal.trigger.center)) continue;
    const center = nearestValidPoint(repaired, portal.trigger.center);
    if (!center) continue;
    portal.trigger.center = center;
    adjustedPortalIds.push(portal.id);
  }
  return { repaired, adjustedEntryPointIds, adjustedPortalIds };
}

function ValidationMessages({ issues }: { issues: MapValidationIssue[] }) {
  if (!issues.length) return null;
  return <ul className="editor-inline-issues">{issues.map((issue, index) => <li key={`${issueKey(issue)}-${index}`}>{issue.message}</li>)}</ul>;
}

function createObject(document: MapDocument, asset: (typeof ASSETS)[number]): MapObject {
  let suffix = document.objects.length + 1;
  while (document.objects.some((object) => object.id === `object-${suffix}`)) suffix += 1;
  const common = { id: `object-${suffix}`, name: asset.name, enabled: true, renderOrder: document.objects.length, collider: { type: "none" } as const };
  return asset.kind === "model3d"
    ? { ...common, kind: "model3d", renderLayer: "world3d", src: asset.src, transform3d: { position: { x: 0, y: document.world.groundY, z: 0 }, rotationDeg: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } }, castShadow: true, receiveShadow: true }
    : { ...common, kind: "sprite2d", renderLayer: "overlay2d", src: asset.src, alt: asset.name, transform2d: { position: { x: 0.5, y: 0.5 }, size: { width: 0.2, height: 0.2 }, anchor: { x: 0.5, y: 0.5 }, rotationDeg: 0, scale: { x: 1, y: 1 } } };
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label><span>{label}</span><input type="number" step="0.1" value={value} onChange={(event) => onChange(numberValue(event.target.value))} /></label>;
}

function MapViewport({ document, mode, onModeChange, polygonId, onPolygonSelect, onPointMove, onPointInsert, drawing, draft, onDraftPoint, selectedEntryPointId, onEntryPointSelect, onEntryPointMove, selectedPortalId, onPortalSelect, onPortalMove, selectedNpcId, onNpcSelect, onNpcMove }: {
  document: MapDocument; mode: ViewportMode; onModeChange: (mode: ViewportMode) => void;
  polygonId: string | null; onPolygonSelect: (polygonId: string) => void;
  onPointMove: (polygonId: string, index: number, point: Vec2) => void;
  onPointInsert: (polygonId: string, index: number, point: Vec2) => void;
  drawing: boolean; draft: Vec2[]; onDraftPoint: (point: Vec2) => void;
  selectedEntryPointId: string | null; onEntryPointSelect: (entryPointId: string) => void; onEntryPointMove: (entryPointId: string, point: Vec2) => void;
  selectedPortalId: string | null; onPortalSelect: (portalId: string) => void; onPortalMove: (portalId: string, point: Vec2) => void;
  selectedNpcId: string | null; onNpcSelect: (npcId: string) => void; onNpcMove: (npcId: string, position: MapNpc["transform"]["position"]) => void;
}) {
  const [dragging, setDragging] = useState<{ polygonId: string; index: number } | null>(null);
  const [draggingEntryPointId, setDraggingEntryPointId] = useState<string | null>(null);
  const [draggingPortalId, setDraggingPortalId] = useState<string | null>(null);
  const [draggingNpcId, setDraggingNpcId] = useState<string | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const markPreviewReady = useCallback(() => setPreviewReady(true), []);
  const toCanvas = (point: Vec2) => ({ x: (point.x + 6) / 12 * 1000, y: (point.z + 6) / 12 * 1000 });
  const fromPointer = (event: { currentTarget: SVGSVGElement; clientX: number; clientY: number }) => {
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return { x: 0, z: 0 };
    const pointer = event.currentTarget.createSVGPoint();
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    const canvas = pointer.matrixTransform(matrix.inverse());
    return { x: canvas.x / 1000 * 12 - 6, z: canvas.y / 1000 * 12 - 6 };
  };
  const footprints = document.objects.map((object) => ({ id: object.id, footprint: colliderFootprint(object) })).filter((item) => item.footprint);
  const selectedEntryPoint = document.navigation.entryPoints.find((entry) => entry.id === selectedEntryPointId) ?? null;
  const spawnMarker = toCanvas(document.navigation.spawn);
  return (
    <section className={`map-viewport is-${mode}`} aria-label={mode === "2d" ? "Map viewport 2D" : mode === "overlay" ? "Map viewport Overlay" : "Map viewport 3D"}>
      <div className="viewport-mode-switch" role="group" aria-label="Chế độ xem viewport">
        <button type="button" className={mode === "3d" ? "active" : ""} aria-pressed={mode === "3d"} onClick={() => { setPreviewReady(false); onModeChange("3d"); }}>3D góc người chơi</button>
        <button type="button" className={mode === "overlay" ? "active" : ""} aria-pressed={mode === "overlay"} onClick={() => { setPreviewReady(false); onModeChange("overlay"); }}>Overlay vùng</button>
      </div>
      {mode === "2d" ? <>
        <Image unoptimized fill src={document.background.src} alt={document.background.alt} style={{ objectFit: document.background.fit }} />
        {document.objects.filter((object): object is Extract<MapObject, { kind: "sprite2d" }> => object.kind === "sprite2d" && object.enabled).map((object) => <Image unoptimized width={1} height={1} className="viewport-sprite" key={object.id} src={object.src} alt={object.alt} style={{ left: `${object.transform2d.position.x * 100}%`, top: `${object.transform2d.position.y * 100}%`, width: `${object.transform2d.size.width * 100}%`, height: `${object.transform2d.size.height * 100}%`, transform: `translate(${-object.transform2d.anchor.x * 100}%, ${-object.transform2d.anchor.y * 100}%) rotate(${object.transform2d.rotationDeg}deg) scale(${object.transform2d.scale.x}, ${object.transform2d.scale.y})` }} />)}
        <svg className={drawing ? "is-drawing" : ""} viewBox="0 0 1000 1000" onPointerMove={(event) => { const point = fromPointer(event); if (dragging) onPointMove(dragging.polygonId, dragging.index, point); if (draggingEntryPointId) onEntryPointMove(draggingEntryPointId, point); if (draggingPortalId) onPortalMove(draggingPortalId, point); if (draggingNpcId) onNpcMove(draggingNpcId, { x: point.x, y: document.world.groundY, z: point.z }); }} onPointerUp={() => { setDragging(null); setDraggingEntryPointId(null); setDraggingPortalId(null); setDraggingNpcId(null); }} onPointerCancel={() => { setDragging(null); setDraggingEntryPointId(null); setDraggingPortalId(null); setDraggingNpcId(null); }} onClick={(event) => { if (drawing) onDraftPoint(fromPointer(event)); }}>
          {document.navigation.walkablePolygons.filter((polygon) => polygon.enabled).map((polygon) => (
            <g key={polygon.id} className={polygon.id === polygonId ? "selected" : ""} onClick={(event) => { if (!drawing) { event.stopPropagation(); onPolygonSelect(polygon.id); } }}>
              <polygon className="walkable-shape" points={polygon.points.map((point) => { const item = toCanvas(point); return `${item.x},${item.y}`; }).join(" ")} />
              {polygon.points.map((point, index) => { const item = toCanvas(point); return <circle className="point-handle" key={index} cx={item.x} cy={item.y} r="10" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); onPolygonSelect(polygon.id); setDragging({ polygonId: polygon.id, index }); }} />; })}
              {polygon.id === polygonId && !drawing ? polygon.points.map((point, index) => { const next = polygon.points[(index + 1) % polygon.points.length]; const item = toCanvas({ x: (point.x + next.x) / 2, z: (point.z + next.z) / 2 }); return <circle className="insert-handle" key={`insert-${index}`} cx={item.x} cy={item.y} r="7" onClick={(event) => { event.stopPropagation(); onPointInsert(polygon.id, index + 1, { x: (point.x + next.x) / 2, z: (point.z + next.z) / 2 }); }} />; }) : null}
            </g>
          ))}
          {draft.length ? <polyline className="draft" points={draft.map((point) => { const item = toCanvas(point); return `${item.x},${item.y}`; }).join(" ")} /> : null}
          {footprints.map(({ id, footprint }) => footprint?.type === "circle" ? (() => { const center = toCanvas(footprint.center); return <circle className="collider" key={id} cx={center.x} cy={center.y} r={footprint.radius / 12 * 1000} />; })() : footprint?.type === "polygon" ? <polygon className="collider" key={id} points={footprint.points.map((point) => { const item = toCanvas(point); return `${item.x},${item.y}`; }).join(" ")} /> : null)}
          {document.portals.filter((portal) => portal.enabled).map((portal) => { const center = toCanvas(portal.trigger.center); return <g key={portal.id} className={`portal-trigger${portal.id === selectedPortalId ? " selected" : ""}`} onClick={(event) => { event.stopPropagation(); onPortalSelect(portal.id); }}><circle className="portal-radius" cx={center.x} cy={center.y} r={portal.trigger.radius / 12 * 1000} /><circle className="portal-handle" cx={center.x} cy={center.y} r="13" role="button" aria-label={`Di chuyển portal ${portal.id}`} onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); onPortalSelect(portal.id); setDraggingPortalId(portal.id); }} /></g>; })}
          <g className="spawn-marker" role="img" aria-label="Spawn point"><circle cx={spawnMarker.x} cy={spawnMarker.y} r="15" /><path d={`M ${spawnMarker.x} ${spawnMarker.y - 24} L ${spawnMarker.x} ${spawnMarker.y + 24} M ${spawnMarker.x - 24} ${spawnMarker.y} L ${spawnMarker.x + 24} ${spawnMarker.y}`} /></g>
          {document.navigation.entryPoints.map((entryPoint) => { const center = toCanvas(entryPoint.position); const radians = entryPoint.facingDeg * Math.PI / 180; const facing = toCanvas({ x: entryPoint.position.x + Math.sin(radians) * 0.45, z: entryPoint.position.z + Math.cos(radians) * 0.45 }); return <g key={entryPoint.id} className={`entry-point-marker${entryPoint.id === selectedEntryPointId ? " selected" : ""}`} aria-label={`Entrypoint ${entryPoint.id}`} onClick={(event) => { event.stopPropagation(); onEntryPointSelect(entryPoint.id); }}><line x1={center.x} y1={center.y} x2={facing.x} y2={facing.y} /><circle cx={center.x} cy={center.y} r="13" role="button" aria-label={`Di chuyển entrypoint ${entryPoint.id}`} onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); onEntryPointSelect(entryPoint.id); setDraggingEntryPointId(entryPoint.id); }} /></g>; })}
          {document.npcs.map((npc) => { const center = toCanvas({ x: npc.transform.position.x, z: npc.transform.position.z }); return <g key={npc.id} className={`npc-position-marker${npc.id === selectedNpcId ? " selected" : ""}`} aria-label={`NPC ${npc.name}`} onClick={(event) => { event.stopPropagation(); onNpcSelect(npc.id); }}><circle cx={center.x} cy={center.y} r="13" role="button" aria-label={`Di chuyển NPC ${npc.name}`} onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); onNpcSelect(npc.id); setDraggingNpcId(npc.id); }} /><text x={center.x} y={center.y - 20} textAnchor="middle">{npc.name}</text></g>; })}
        </svg>
        <p>{drawing ? "Click trên viewport để đặt điểm; đủ 3 điểm thì đóng polygon." : "Giữ và kéo entrypoint, NPC hoặc tâm portal để đặt nhanh vị trí."}</p>
      </> : <div className="viewport-3d">
        <Image unoptimized fill className="viewport-3d-background" src={document.background.src} alt="" aria-hidden="true" style={{ objectFit: document.background.fit }} />
        <DungeonPreview key={mode} mapDocument={document} playerPos={{ x: selectedEntryPoint?.position.x ?? document.navigation.spawn.x, y: selectedEntryPoint?.position.z ?? document.navigation.spawn.z }} facing={(selectedEntryPoint?.facingDeg ?? 0) * Math.PI / 180} isMoving={false} onSceneReady={markPreviewReady} selectedNpcId={selectedNpcId} onNpcSelect={onNpcSelect} onNpcMove={onNpcMove} editorOverlay={{ selectedPolygonId: polygonId, selectedEntryPointId, selectedPortalId, showAllPolygons: mode === "overlay", editablePolygons: true, editableNavigation: true, drawing, draft, onPolygonSelect, onEntryPointSelect, onPortalSelect, onPointMove, onPointInsert, onDraftPoint, onEntryPointMove, onPortalMove }} />
        {previewReady
          ? <p role="status">{drawing ? "Click trực tiếp trên scene để đặt điểm; đủ 3 điểm thì đóng polygon." : mode === "overlay" ? "Overlay đã sẵn sàng: kéo điểm lớn để chỉnh vùng, entrypoint hoặc portal; xanh là walkable, vàng là vùng đang chọn, đỏ là collider." : "Preview 3D đã sẵn sàng: vùng đang chọn, entrypoint, portal và NPC đều có thể chỉnh trực tiếp theo đúng runtime."}</p>
          : <div className="viewport-3d-loading" role="status">Đang tải mô hình 3D…</div>}
      </div>}
    </section>
  );
}

function ColliderFields({ object, mutateObject, setCollider }: {
  object: MapObject;
  mutateObject: (recipe: (object: MapObject) => void) => void;
  setCollider: (type: Collider["type"]) => void;
}) {
  const collider = object.collider;
  return <>
    <label><span>Collider</span><select value={collider.type} onChange={(event) => setCollider(event.target.value as Collider["type"])}>{["none", "circle", "rectangle", "polygon"].map((type) => <option key={type}>{type}</option>)}</select></label>
    {collider.type !== "none" ? <label><span>Collider active</span><input type="checkbox" checked={collider.enabled} onChange={(event) => mutateObject((item) => { if (item.collider.type !== "none") item.collider.enabled = event.target.checked; })} /></label> : null}
    {collider.type === "circle" || collider.type === "rectangle" ? <>{(["x", "z"] as const).map((axis) => <NumberField key={`center-${axis}`} label={`Center ${axis.toUpperCase()}`} value={collider.center[axis]} onChange={(value) => mutateObject((item) => { if (item.collider.type === "circle" || item.collider.type === "rectangle") item.collider.center[axis] = value; })} />)}</> : null}
    {collider.type === "circle" ? <NumberField label="Radius" value={collider.radius} onChange={(value) => mutateObject((item) => { if (item.collider.type === "circle") item.collider.radius = value; })} /> : null}
    {collider.type === "rectangle" ? <><NumberField label="Width collider" value={collider.width} onChange={(value) => mutateObject((item) => { if (item.collider.type === "rectangle") item.collider.width = value; })} /><NumberField label="Depth collider" value={collider.depth} onChange={(value) => mutateObject((item) => { if (item.collider.type === "rectangle") item.collider.depth = value; })} /><NumberField label="Local rotation°" value={collider.rotationDeg ?? 0} onChange={(value) => mutateObject((item) => { if (item.collider.type === "rectangle") item.collider.rotationDeg = value; })} /></> : null}
    {collider.type === "polygon" ? <div className="point-list">{collider.points.map((point, index) => <div className="row" key={index}><NumberField label={`P${index + 1} X`} value={point.x} onChange={(value) => mutateObject((item) => { if (item.collider.type === "polygon") item.collider.points[index].x = value; })} /><NumberField label="Z" value={point.z} onChange={(value) => mutateObject((item) => { if (item.collider.type === "polygon") item.collider.points[index].z = value; })} /><button disabled={collider.points.length <= 3} onClick={() => mutateObject((item) => { if (item.collider.type === "polygon" && item.collider.points.length > 3) item.collider.points.splice(index, 1); })}>Xóa</button></div>)}<button onClick={() => mutateObject((item) => { if (item.collider.type === "polygon") item.collider.points.push({ x: 0, z: 0 }); })}>+ Point collider</button></div> : null}
    {object.kind === "sprite2d" && object.navigationTransform ? <><NumberField label="Nav X" value={object.navigationTransform.position.x} onChange={(value) => mutateObject((item) => { if (item.kind === "sprite2d" && item.navigationTransform) item.navigationTransform.position.x = value; })} /><NumberField label="Nav Z" value={object.navigationTransform.position.z} onChange={(value) => mutateObject((item) => { if (item.kind === "sprite2d" && item.navigationTransform) item.navigationTransform.position.z = value; })} /><NumberField label="Nav yaw°" value={object.navigationTransform.yawDeg} onChange={(value) => mutateObject((item) => { if (item.kind === "sprite2d" && item.navigationTransform) item.navigationTransform.yawDeg = value; })} />{(["x", "z"] as const).map((axis) => <NumberField key={`nav-scale-${axis}`} label={`Nav scale ${axis.toUpperCase()}`} value={object.navigationTransform!.scale[axis]} onChange={(value) => mutateObject((item) => { if (item.kind === "sprite2d" && item.navigationTransform) item.navigationTransform.scale[axis] = value; })} />)}</> : null}
  </>;
}

function NpcFields({ npc, document, issues, mutateNpc }: { npc: MapNpc; document: MapDocument; issues: MapValidationIssue[]; mutateNpc: (recipe: (npc: MapNpc) => void) => void }) {
  return <details open><summary>NPC</summary><div className="editor-section">
    <ValidationMessages issues={issues} />
    <label><span>NPC ID</span><input readOnly value={npc.id} /></label>
    <label><span>Tên</span><input value={npc.name} onChange={(event) => mutateNpc((item) => { item.name = event.target.value; })} /></label>
    <label><span>Runtime GLB</span><input readOnly value={npc.src} /></label>
    <label><span>Hội thoại</span><textarea value={npc.dialogue} onChange={(event) => mutateNpc((item) => { item.dialogue = event.target.value; })} /></label>
    {(["x", "y", "z"] as const).map((axis) => <NumberField key={axis} label={`Position ${axis.toUpperCase()}`} value={npc.transform.position[axis]} onChange={(value) => mutateNpc((item) => {
      const position = { ...item.transform.position, [axis]: value };
      if (axis === "y" || isPositionValid(document, { x: position.x, z: position.z }, 0)) item.transform.position = position;
    })} />)}
  </div></details>;
}

function MapFlowPanel({ onDirtyChange, onMapCreated }: { onDirtyChange: (dirty: boolean) => void; onMapCreated: (map: MapRevisionEnvelope) => void }) {
  const [flow, setFlow] = useState<MapFlowEnvelope | null>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [envelopes, setEnvelopes] = useState<Record<string, MapRevisionEnvelope>>({});
  const [documents, setDocuments] = useState<Record<string, MapDocument>>({});
  const [selectedMapId, setSelectedMapId] = useState("");
  const [selectedPortalId, setSelectedPortalId] = useState<string | null>(null);
  const [linkSource, setLinkSource] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [templateMapId, setTemplateMapId] = useState("");
  const [newMapId, setNewMapId] = useState("");
  const [newMapName, setNewMapName] = useState("");
  const [portalTargetMapId, setPortalTargetMapId] = useState("");

  const dirtyMaps = useMemo(() => Object.keys(documents).filter((mapId) => envelopes[mapId] && canonicalStringify(documents[mapId]) !== canonicalStringify(envelopes[mapId].document)), [documents, envelopes]);
  const layoutDirty = Boolean(flow && flow.document.nodes.some((node) => canonicalStringify(node.position) !== canonicalStringify(positions[node.mapId])));
  const dirty = layoutDirty || dirtyMaps.length > 0;
  const newMapIdValid = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(newMapId);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  const hydrate = useCallback(async () => {
    setError("");
    const loadedFlow = await loadMapFlow("vanlang");
    const loadedMaps = await Promise.all(loadedFlow.document.nodes.map((node) => loadFlowMap(loadedFlow.flowId, node.mapId)));
    setFlow(loadedFlow);
    setPositions(Object.fromEntries(loadedFlow.document.nodes.map((node) => [node.mapId, clone(node.position)])));
    setEnvelopes(Object.fromEntries(loadedMaps.map((item) => [item.mapId, item])));
    setDocuments(Object.fromEntries(loadedMaps.map((item) => [item.mapId, clone(item.document)])));
    setSelectedMapId((current) => loadedMaps.some((item) => item.mapId === current) ? current : loadedMaps[0]?.mapId ?? "");
    setTemplateMapId((current) => loadedMaps.some((item) => item.mapId === current) ? current : loadedMaps[0]?.mapId ?? "");
    setPortalTargetMapId((current) => loadedMaps.some((item) => item.mapId === current) ? current : loadedMaps[1]?.mapId ?? loadedMaps[0]?.mapId ?? "");
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void hydrate().catch((caught) => setError(caught instanceof Error ? caught.message : "Không thể tải Map Flow.")); }, 0);
    return () => window.clearTimeout(timer);
  }, [hydrate]);

  const mutateDocument = (mapId: string, recipe: (document: MapDocument) => void) => setDocuments((current) => {
    const document = current[mapId];
    if (!document) return current;
    const next = clone(document); recipe(next); return { ...current, [mapId]: next };
  });
  const selectedDocument = documents[selectedMapId];
  const selectedPortal = selectedDocument?.portals.find((portal) => portal.id === selectedPortalId) ?? null;
  const edges = Object.values(documents).flatMap((document) => document.portals.map((portal) => ({ sourceMapId: document.mapId, portal })));

  const addPortal = (sourceMapId: string, targetMapId: string) => {
    if (sourceMapId === targetMapId || !documents[sourceMapId] || !documents[targetMapId]) return;
    const targetEntry = documents[targetMapId].navigation.entryPoints[0];
    if (!targetEntry) return;
    mutateDocument(sourceMapId, (document) => {
      let suffix = 1;
      while (document.portals.some((portal) => portal.id === `portal-${targetMapId}-${suffix}`)) suffix += 1;
      const portal: DirectedPortal = { id: `portal-${targetMapId}-${suffix}`, enabled: true, trigger: { type: "circle", center: { ...document.navigation.spawn }, radius: 0.8 }, target: { mapId: targetMapId, entryPointId: targetEntry.id } };
      document.portals.push(portal);
      setSelectedMapId(sourceMapId);
      setSelectedPortalId(portal.id);
    });
    setNotice(`Đã tạo portal một chiều ${sourceMapId} → ${targetMapId}. Đặt trigger rồi Save Flow.`);
  };

  const connect = (targetMapId: string) => {
    if (!linkSource || linkSource === targetMapId) { setLinkSource(null); return; }
    addPortal(linkSource, targetMapId);
    setLinkSource(null);
  };

  const renameEntryPoint = (mapId: string, index: number, nextId: string) => {
    setDocuments((current) => {
      const selected = current[mapId];
      if (!selected) return current;
      const previousId = selected.navigation.entryPoints[index]?.id;
      if (previousId === undefined) return current;
      const next = clone(current);
      next[mapId].navigation.entryPoints[index].id = nextId;
      for (const document of Object.values(next)) {
        for (const portal of document.portals) {
          if (portal.target.mapId === mapId && portal.target.entryPointId === previousId) portal.target.entryPointId = nextId;
        }
      }
      return next;
    });
  };

  const save = async () => {
    if (!flow || saving || !dirty) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await saveMapFlow(flow.flowId, { schemaVersion: 1, flowId: flow.flowId, nodes: flow.document.nodes.map((node) => ({ mapId: node.mapId, position: positions[node.mapId] })) }, dirtyMaps.map((mapId) => ({ mapId, expectedEtag: envelopes[mapId].etag, document: documents[mapId] })), flow.etag);
      const nextEnvelopes = { ...envelopes };
      for (const item of result.maps) nextEnvelopes[item.mapId] = item;
      setFlow(result.flow); setEnvelopes(nextEnvelopes);
      setDocuments((current) => ({ ...current, ...Object.fromEntries(result.maps.map((item) => [item.mapId, clone(item.document)])) }));
      setNotice(`Đã lưu flow revision ${result.flow.revision}.`);
    } catch (caught) {
      setError(caught instanceof MapApiError && (caught.status === 412 || caught.status === 422) ? `${caught.code}: ${caught.issues.map((issue) => `${issue.mapId ?? selectedMapId}:${issue.path ?? "document"} ${issue.message ?? "không hợp lệ"}`).join("; ") || "draft local vẫn được giữ."}` : caught instanceof Error ? caught.message : "Save Flow thất bại.");
    } finally { setSaving(false); }
  };

  const createMap = async () => {
    if (!flow || !templateMapId || !newMapId || !newMapName || dirty) { if (dirty) setError("Hãy Save Flow trước khi tạo map mới."); return; }
    setSaving(true); setError("");
    try {
      const created = await cloneFlowMap(flow.flowId, { sourceMapId: templateMapId, mapId: newMapId, metadata: { name: newMapName, description: documents[templateMapId].metadata.description }, nodePosition: { x: 0.75, y: 0.5 }, expectedSourceMapEtag: envelopes[templateMapId].etag }, flow.etag);
      setFlow(created.flow);
      setPositions((current) => ({ ...current, [created.map.mapId]: { x: 0.75, y: 0.5 } }));
      setEnvelopes((current) => ({ ...current, [created.map.mapId]: created.map }));
      setDocuments((current) => ({ ...current, [created.map.mapId]: clone(created.map.document) }));
      setSelectedMapId(created.map.mapId); setTemplateMapId(created.map.mapId); setPortalTargetMapId(flow.document.nodes[0]?.mapId ?? ""); setNewMapId(""); setNewMapName(""); onMapCreated(created.map);
      setNotice(`Đã tạo map ${created.map.mapId} revision 1. Hãy cấu hình entrypoint và portal rồi Save Flow.`);
    } catch (caught) { if (caught instanceof MapApiError && caught.code === "MAP_ALREADY_EXISTS") await hydrate(); setError(caught instanceof Error ? caught.message : "Tạo map thất bại."); }
    finally { setSaving(false); }
  };

  if (!flow) return <section className="map-flow-panel"><p>{error || "Đang tải Map Flow…"}</p></section>;
  const moveNode = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setPositions((current) => ({ ...current, [dragging]: { x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)), y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)) } }));
  };

  return <section className="map-flow-panel" aria-label="Map Flow editor">
    <div className="map-flow-toolbar">
      <strong>Map Flow · r{flow.revision}</strong>
      <span className={dirty ? "dirty" : ""}>{dirty ? `${dirtyMaps.length} map + layout chưa lưu` : "Đã đồng bộ"}</span>
      <button disabled={!WRITE_ENABLED || !dirty || saving} onClick={save}>{saving ? "Đang lưu…" : "Save Flow"}</button>
      <button disabled={dirty || saving} onClick={() => void hydrate()}>Reload</button>
    </div>
    <div className="map-flow-layout">
      <div className="map-flow-canvas" onPointerMove={moveNode} onPointerUp={() => setDragging(null)}>
        <svg aria-hidden="true">{edges.map(({ sourceMapId, portal }) => { const source = positions[sourceMapId]; const target = positions[portal.target.mapId]; return source && target ? <line key={`${sourceMapId}-${portal.id}`} className={sourceMapId === selectedMapId && portal.id === selectedPortalId ? "selected" : ""} x1={`${source.x * 100}%`} y1={`${source.y * 100}%`} x2={`${target.x * 100}%`} y2={`${target.y * 100}%`} onClick={() => { setSelectedMapId(sourceMapId); setSelectedPortalId(portal.id); }} /> : null; })}</svg>
        {flow.document.nodes.map((node) => <article key={node.mapId} className={`map-flow-node${selectedMapId === node.mapId ? " selected" : ""}`} style={{ left: `${positions[node.mapId]?.x * 100}%`, top: `${positions[node.mapId]?.y * 100}%` }} onPointerDown={(event) => { if ((event.target as HTMLElement).closest(".flow-input, .flow-output")) return; setDragging(node.mapId); setSelectedMapId(node.mapId); }}>
          <button className="flow-input" aria-label={`Input ${node.mapId}`} onPointerUp={() => connect(node.mapId)} onClick={() => connect(node.mapId)} />
          <button className="flow-node-body" onClick={() => setSelectedMapId(node.mapId)}><strong>{documents[node.mapId]?.metadata.name ?? node.mapId}</strong><small>{node.mapId} · r{node.mapRevision}</small></button>
          <button className="flow-output" aria-label={`Output ${node.mapId}`} aria-pressed={linkSource === node.mapId} onPointerDown={() => setLinkSource(node.mapId)} onClick={() => setLinkSource(node.mapId)} />
        </article>)}
        {linkSource ? <p className="flow-link-hint">Chọn input của map đích để tạo portal một chiều.</p> : null}
      </div>
      <aside className="map-flow-inspector">
        <h2>Flow Inspector</h2>
        <label><span>Map đang chọn</span><select value={selectedMapId} onChange={(event) => { const mapId = event.target.value; setSelectedMapId(mapId); setSelectedPortalId(null); setPortalTargetMapId(flow.document.nodes.find((node) => node.mapId !== mapId)?.mapId ?? ""); }}>{flow.document.nodes.map((node) => <option key={node.mapId}>{node.mapId}</option>)}</select></label>
        {positions[selectedMapId] ? <div className="flow-form-grid"><NumberField label="Node X" value={positions[selectedMapId].x} onChange={(value) => setPositions((current) => ({ ...current, [selectedMapId]: { ...current[selectedMapId], x: Math.max(0, Math.min(1, value)) } }))} /><NumberField label="Node Y" value={positions[selectedMapId].y} onChange={(value) => setPositions((current) => ({ ...current, [selectedMapId]: { ...current[selectedMapId], y: Math.max(0, Math.min(1, value)) } }))} /></div> : null}
        <fieldset className="create-map-fieldset"><legend>1. Tạo map mới</legend><p>Map mới sao chép asset và vùng di chuyển từ map mẫu, nhưng không sao chép portal.</p><label><span>Map mẫu</span><select value={templateMapId} onChange={(event) => setTemplateMapId(event.target.value)}>{flow.document.nodes.map((node) => <option key={node.mapId} value={node.mapId}>{documents[node.mapId]?.metadata.name ?? node.mapId}</option>)}</select></label><label><span>Map ID mới</span><input value={newMapId} aria-describedby="new-map-id-hint" aria-invalid={Boolean(newMapId) && !newMapIdValid} placeholder="vi-du: thanh-co-loa" onChange={(event) => setNewMapId(event.target.value)} /></label><small id="new-map-id-hint">Chỉ dùng chữ thường, số và dấu gạch ngang.</small><label><span>Tên hiển thị</span><input value={newMapName} onChange={(event) => setNewMapName(event.target.value)} /></label><button disabled={!WRITE_ENABLED || dirty || saving || !newMapIdValid || !newMapName.trim()} onClick={createMap}>{saving ? "Đang tạo…" : "Tạo map"}</button>{dirty ? <small>Save Flow trước khi tạo map mới.</small> : null}</fieldset>
        {selectedDocument ? <><fieldset><legend>2. Entrypoint của map</legend><p>Nhân vật xuất hiện tại entrypoint này khi đi qua portal.</p>{selectedDocument.navigation.entryPoints.map((entry, index) => <div className="flow-form-grid" key={index}><label><span>ID</span><input value={entry.id} onChange={(event) => renameEntryPoint(selectedMapId, index, event.target.value)} /></label><NumberField label="X" value={entry.position.x} onChange={(value) => mutateDocument(selectedMapId, (document) => { document.navigation.entryPoints[index].position.x = value; })} /><NumberField label="Z" value={entry.position.z} onChange={(value) => mutateDocument(selectedMapId, (document) => { document.navigation.entryPoints[index].position.z = value; })} /><NumberField label="Hướng (°)" value={entry.facingDeg} onChange={(value) => mutateDocument(selectedMapId, (document) => { document.navigation.entryPoints[index].facingDeg = value; })} /><button type="button" onClick={() => mutateDocument(selectedMapId, (document) => { document.navigation.entryPoints[index].position = { ...document.navigation.spawn }; })}>Đặt tại spawn</button></div>)}<button onClick={() => mutateDocument(selectedMapId, (document) => { let suffix = document.navigation.entryPoints.length + 1; while (document.navigation.entryPoints.some((entry) => entry.id === `entry-${suffix}`)) suffix += 1; document.navigation.entryPoints.push({ id: `entry-${suffix}`, position: { ...document.navigation.spawn }, facingDeg: 0 }); })}>+ Thêm entrypoint</button></fieldset>
        <fieldset><legend>3. Portal / Map Flow</legend><p>Portal là kết nối một chiều. Trigger là vùng nhân vật bước vào ở map nguồn.</p><div className="flow-add-portal"><label><span>Map đích</span><select value={portalTargetMapId} onChange={(event) => setPortalTargetMapId(event.target.value)}>{flow.document.nodes.filter((node) => node.mapId !== selectedMapId).map((node) => <option key={node.mapId} value={node.mapId}>{documents[node.mapId]?.metadata.name ?? node.mapId}</option>)}</select></label><button disabled={!portalTargetMapId || portalTargetMapId === selectedMapId} onClick={() => addPortal(selectedMapId, portalTargetMapId)}>+ Thêm portal</button></div><select aria-label="Portal" value={selectedPortalId ?? ""} onChange={(event) => setSelectedPortalId(event.target.value || null)}><option value="">Chọn portal để cấu hình</option>{selectedDocument.portals.map((portal) => <option key={portal.id} value={portal.id}>{portal.id} → {portal.target.mapId}</option>)}</select>{selectedPortal ? <div className="flow-form-grid"><label><span>Portal ID</span><input value={selectedPortal.id} onChange={(event) => mutateDocument(selectedMapId, (document) => { document.portals.find((portal) => portal.id === selectedPortal.id)!.id = event.target.value; setSelectedPortalId(event.target.value); })} /></label><NumberField label="Trigger X" value={selectedPortal.trigger.center.x} onChange={(value) => mutateDocument(selectedMapId, (document) => { document.portals.find((portal) => portal.id === selectedPortal.id)!.trigger.center.x = value; })} /><NumberField label="Trigger Z" value={selectedPortal.trigger.center.z} onChange={(value) => mutateDocument(selectedMapId, (document) => { document.portals.find((portal) => portal.id === selectedPortal.id)!.trigger.center.z = value; })} /><NumberField label="Bán kính" value={selectedPortal.trigger.radius} onChange={(value) => mutateDocument(selectedMapId, (document) => { document.portals.find((portal) => portal.id === selectedPortal.id)!.trigger.radius = value; })} /><label><span>Map đích</span><select value={selectedPortal.target.mapId} onChange={(event) => mutateDocument(selectedMapId, (document) => { const portal = document.portals.find((item) => item.id === selectedPortal.id)!; portal.target.mapId = event.target.value; portal.target.entryPointId = documents[event.target.value].navigation.entryPoints[0]?.id ?? ""; })}>{flow.document.nodes.map((node) => <option key={node.mapId}>{node.mapId}</option>)}</select></label><label><span>Entrypoint đích</span><select value={selectedPortal.target.entryPointId} onChange={(event) => mutateDocument(selectedMapId, (document) => { document.portals.find((portal) => portal.id === selectedPortal.id)!.target.entryPointId = event.target.value; })}>{documents[selectedPortal.target.mapId]?.navigation.entryPoints.map((entry) => <option key={entry.id}>{entry.id}</option>)}</select></label><button onClick={() => { mutateDocument(selectedMapId, (document) => { document.portals = document.portals.filter((portal) => portal.id !== selectedPortal.id); }); setSelectedPortalId(null); }}>Xóa portal</button></div> : null}</fieldset></> : null}
        {error ? <p role="alert">{error}</p> : null}{notice ? <p role="status">{notice}</p> : null}
      </aside>
    </div>
  </section>;
}

export function MapEditorShell() {
  const [tab, setTab] = useState<EditorTab>("map");
  const [flowDirty, setFlowDirty] = useState(false);
  const [maps, setMaps] = useState<MapSummary[]>([]);
  const [envelope, setEnvelope] = useState<MapRevisionEnvelope | null>(null);
  const [document, setDocument] = useState<MapDocument | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedEntryPointId, setSelectedEntryPointId] = useState<string | null>(null);
  const [selectedPortalId, setSelectedPortalId] = useState<string | null>(null);
  const [flowPin, setFlowPin] = useState<{ flowRevision: number; mapRevision: number } | null>(null);
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);
  const [npcFile, setNpcFile] = useState<File | null>(null);
  const [npcId, setNpcId] = useState("");
  const [npcName, setNpcName] = useState("");
  const [npcDialogue, setNpcDialogue] = useState("");
  const [importing, setImporting] = useState(false);
  const [selectedPolygonId, setSelectedPolygonId] = useState<string | null>(null);
  const [viewportMode, setViewportModeState] = useState<ViewportMode>("overlay");
  const setViewportMode = (mode: ViewportMode) => setViewportModeState(mode === "2d" ? "overlay" : mode);
  const [draftPoints, setDraftPoints] = useState<Vec2[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const saveInFlight = useRef(false);
  const dirty = Boolean(document && envelope && canonicalStringify(document) !== canonicalStringify(envelope.document));
  const validation = useMemo(() => document ? validateMapDocument(document) : null, [document]);
  const preparedValidation = useMemo(() => document ? validateMapDocument(prepareDocumentForSave(document).repaired) : null, [document]);
  const validationIssues = validation && !validation.success ? validation.issues : [];
  const blockingIssues = preparedValidation && !preparedValidation.success ? preparedValidation.issues : [];
  const blockingIssueKeys = new Set(blockingIssues.map(issueKey));
  const repairableIssues = validationIssues.filter((issue) => !blockingIssueKeys.has(issueKey(issue)));
  const issuesByGroup = Object.fromEntries((["geometry", "entry", "portal", "npc", "map"] as const).map((group) => [group, validationIssues.filter((issue) => issueGroup(issue) === group)])) as Record<ValidationGroup, MapValidationIssue[]>;
  const saveBlocked = drawing || blockingIssues.length > 0;
  const selectedObject = document?.objects.find((object) => object.id === selectedObjectId) ?? null;
  const selectedEntryPoint = document?.navigation.entryPoints.find((entry) => entry.id === selectedEntryPointId) ?? null;
  const selectedPortal = document?.portals.find((portal) => portal.id === selectedPortalId) ?? null;
  const selectedNpc = document?.npcs.find((npc) => npc.id === selectedNpcId) ?? null;
  const selectedPolygon = document?.navigation.walkablePolygons.find((polygon) => polygon.id === selectedPolygonId) ?? null;
  const flowOutOfSync = Boolean(flowPin && envelope && flowPin.mapRevision !== envelope.revision);

  const focusIssue = (issue: MapValidationIssue) => {
    setTab("map");
    if (issue.objectId) { setSelectedObjectId(issue.objectId); setSelectedNpcId(null); setViewportMode("overlay"); }
    if (issue.npcId) { setSelectedNpcId(issue.npcId); setSelectedObjectId(null); setViewportMode("overlay"); }
    if (issue.polygonId) { setSelectedPolygonId(issue.polygonId); setViewportMode("overlay"); }
    if (issue.portalId) { setSelectedPortalId(issue.portalId); setViewportMode("overlay"); }
    const entryIndex = issue.path.match(/^navigation\.entryPoints\.(\d+)/)?.[1];
    if (entryIndex !== undefined) {
      setSelectedEntryPointId(document?.navigation.entryPoints[Number(entryIndex)]?.id ?? null);
      setViewportMode("overlay");
    }
  };

  const openMap = async (mapId: string) => {
    setLoading(true); setError(""); setNotice("");
    try {
      const [loaded, loadedFlow] = await Promise.all([loadMap(mapId), loadMapFlow("vanlang").catch(() => null)]);
      const flowNode = loadedFlow?.document.nodes.find((node) => node.mapId === mapId);
      setEnvelope(loaded); setDocument(clone(loaded.document));
      setFlowPin(loadedFlow && flowNode ? { flowRevision: loadedFlow.revision, mapRevision: flowNode.mapRevision } : null);
      setSelectedObjectId(loaded.document.objects[0]?.id ?? null);
      setSelectedEntryPointId(loaded.document.navigation.entryPoints[0]?.id ?? null);
      setSelectedPortalId(loaded.document.portals[0]?.id ?? null);
      setSelectedNpcId(null);
      setSelectedPolygonId(loaded.document.navigation.walkablePolygons[0]?.id ?? null);
      setDraftPoints([]);
      setDrawing(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tải map.");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    void (async () => {
      try { const items = await listMaps(); setMaps(items); if (items[0]) await openMap(items[0].mapId); else setLoading(false); }
      catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể tải danh sách map."); setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty || flowDirty) event.preventDefault(); };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty, flowDirty]);

  const mutate = (recipe: (next: MapDocument) => void) => setDocument((current) => { if (!current) return current; const next = clone(current); recipe(next); return next; });
  const mutateObject = (recipe: (object: MapObject) => void) => mutate((next) => { const object = next.objects.find((item) => item.id === selectedObjectId); if (object) recipe(object); });
  const mutateNpc = (id: string, recipe: (npc: MapNpc) => void) => mutate((next) => { const npc = next.npcs.find((item) => item.id === id); if (npc) recipe(npc); });
  const importNpc = async () => {
    if (!npcFile || !npcId || !npcName || !npcDialogue.trim() || importing) { setError("Chọn GLB và nhập đủ NPC ID, tên, hội thoại."); return; }
    setImporting(true); setError(""); setNotice("");
    try {
      const asset = await importGlb(npcFile);
      if (document?.npcs.some((npc) => npc.id === npcId)) throw new Error("NPC ID đã tồn tại.");
      mutate((next) => next.npcs.push({ id: npcId, name: npcName, dialogue: npcDialogue, src: asset.src, transform: { position: { x: next.navigation.spawn.x, y: next.world.groundY, z: next.navigation.spawn.z }, rotationDeg: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } } }));
      setSelectedNpcId(npcId); setSelectedObjectId(null); setViewportMode("3d");
      setNotice(`Đã import và thêm NPC ${npcName}; nhấn Save để tạo revision.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Import GLB thất bại."); }
    finally { setImporting(false); }
  };
  const confirmDiscard = () => (!dirty && !flowDirty) || window.confirm("Map Flow có thay đổi chưa lưu. Bạn có muốn bỏ thay đổi?");
  const selectMap = (mapId: string) => { if (!confirmDiscard()) return; void openMap(mapId); };
  const save = async () => {
    if (!document || !envelope || saveInFlight.current || (!dirty && !flowOutOfSync)) return;
    setError(""); setNotice("");
    if (drawing) { setError("Polygon đang vẽ chưa được đóng."); return; }
    const sourceCanonical = canonicalStringify(document);
    const { repaired, adjustedEntryPointIds, adjustedPortalIds } = prepareDocumentForSave(document);
    const submittedValidation = validateMapDocument(repaired);
    if (!submittedValidation.success) { setError("Map còn lỗi validation. Hãy sửa trước khi lưu."); return; }
    const submitted = clone(submittedValidation.document);
    saveInFlight.current = true;
    setSaving(true);
    try {
      const currentFlow = await loadMapFlow("vanlang").catch((caught) => {
        if (caught instanceof MapApiError && caught.status === 404) return null;
        throw caught;
      });
      let saved: MapRevisionEnvelope;
      let savedFlowRevision: number | null = null;
      const flowNode = currentFlow?.document.nodes.find((node) => node.mapId === submitted.mapId);
      if (currentFlow && flowNode) {
        const pinnedMaps = await Promise.all(currentFlow.document.nodes.map((node) => loadFlowMap(currentFlow.flowId, node.mapId)));
        const pinnedCurrent = pinnedMaps.find((item) => item.mapId === submitted.mapId)!;
        const renamedEntries = new Map((pinnedCurrent.document.navigation.entryPoints.length === submitted.navigation.entryPoints.length ? pinnedCurrent.document.navigation.entryPoints : []).flatMap((entry, index) => {
          const nextId = submitted.navigation.entryPoints[index]?.id;
          return nextId && nextId !== entry.id ? [[entry.id, nextId] as const] : [];
        }));
        const updates = pinnedMaps.flatMap((pinned) => {
          if (pinned.mapId === submitted.mapId) return [{ mapId: pinned.mapId, expectedEtag: pinned.etag, document: submitted }];
          const next = clone(pinned.document);
          let changed = false;
          for (const portal of next.portals) {
            const nextEntryId = portal.target.mapId === submitted.mapId ? renamedEntries.get(portal.target.entryPointId) : undefined;
            if (nextEntryId) { portal.target.entryPointId = nextEntryId; changed = true; }
          }
          return changed ? [{ mapId: pinned.mapId, expectedEtag: pinned.etag, document: next }] : [];
        });
        const result = await saveMapFlow(currentFlow.flowId, { schemaVersion: 1, flowId: currentFlow.flowId, nodes: currentFlow.document.nodes.map((node) => ({ mapId: node.mapId, position: node.position })) }, updates, currentFlow.etag);
        saved = result.maps.find((item) => item.mapId === submitted.mapId)!;
        savedFlowRevision = result.flow.revision;
        setFlowPin({ flowRevision: result.flow.revision, mapRevision: saved.revision });
      } else {
        saved = await saveMap(submitted.mapId, submitted, envelope.etag);
        setFlowPin(null);
      }
      setEnvelope(saved);
      setDocument((current) => current && canonicalStringify(current) === sourceCanonical ? clone(saved.document) : current);
      setMaps((current) => current.map((map) => map.mapId === saved.mapId ? { ...map, name: saved.document.metadata.name, description: saved.document.metadata.description, activeRevision: saved.revision, updatedAt: saved.activatedAt } : map));
      const adjustedEntriesNotice = adjustedEntryPointIds.length ? ` Đã tự đưa entry point ${adjustedEntryPointIds.join(", ")} vào vị trí hợp lệ gần nhất.` : "";
      const adjustedPortalsNotice = adjustedPortalIds.length ? ` Đã tự đưa portal ${adjustedPortalIds.join(", ")} vào vị trí hợp lệ gần nhất.` : "";
      setNotice((savedFlowRevision ? `Đã lưu map r${saved.revision} và đồng bộ Map Flow r${savedFlowRevision}.` : `Đã lưu revision ${saved.revision}.`) + adjustedEntriesNotice + adjustedPortalsNotice);
    }
    catch (caught) { setError(caught instanceof MapApiError && caught.status === 412 ? "Revision trên server đã thay đổi. Bản local vẫn được giữ; hãy reload để so sánh." : caught instanceof Error ? caught.message : "Save thất bại."); }
    finally { saveInFlight.current = false; setSaving(false); }
  };

  if (loading && !document) return <main id="noi-dung-chinh" className="map-editor-status">Đang tải Map Editor…</main>;
  if (!document || !envelope) return <main id="noi-dung-chinh" className="map-editor-status"><h1>Map Editor</h1><p role="alert">{error || "Không có map active."}</p><button onClick={() => location.reload()}>Thử lại</button></main>;

  const setCollider = (type: Collider["type"]) => mutateObject((object) => {
    object.collider = type === "none" ? { type: "none" }
      : type === "circle" ? { type, enabled: true, center: { x: 0, z: 0 }, radius: 0.5 }
      : type === "rectangle" ? { type, enabled: true, center: { x: 0, z: 0 }, width: 1, depth: 1, rotationDeg: 0 }
      : { type, enabled: true, points: [{ x: -0.5, z: -0.5 }, { x: 0.5, z: -0.5 }, { x: 0, z: 0.5 }] };
    if (object.kind === "sprite2d" && type !== "none" && !object.navigationTransform) object.navigationTransform = { position: { x: 0, z: 0 }, yawDeg: 0, scale: { x: 1, z: 1 } };
  });

  const closeDraft = () => {
    if (draftPoints.length < 3) return;
    mutate((next) => {
      const id = `walkable-${Date.now().toString(36)}`;
      next.navigation.walkablePolygons.push({ id, enabled: true, points: [...draftPoints] });
      setSelectedPolygonId(id);
    });
    setDraftPoints([]);
    setDrawing(false);
  };
  const createQuickRectangle = () => {
    const { x, z } = document.navigation.spawn;
    const id = `walkable-${Date.now().toString(36)}`;
    mutate((next) => next.navigation.walkablePolygons.push({ id, enabled: true, points: [{ x: x - 1.5, z: z - 1.5 }, { x: x + 1.5, z: z - 1.5 }, { x: x + 1.5, z: z + 1.5 }, { x: x - 1.5, z: z + 1.5 }] }));
    setSelectedPolygonId(id);
    setViewportMode("2d");
  };
  const setEntryPointFromSelectedObject = () => {
    if (!selectedEntryPoint || !selectedObject) return;
    const pose = selectedObject.kind === "model3d"
      ? { position: { x: selectedObject.transform3d.position.x, z: selectedObject.transform3d.position.z }, facingDeg: selectedObject.transform3d.rotationDeg.y }
      : selectedObject.navigationTransform
        ? { position: { ...selectedObject.navigationTransform.position }, facingDeg: selectedObject.navigationTransform.yawDeg }
        : null;
    if (!pose) { setError("Sprite đang chọn chưa có navigation transform."); return; }
    mutate((next) => {
      const entry = next.navigation.entryPoints.find((item) => item.id === selectedEntryPoint.id);
      if (entry) { entry.position = pose.position; entry.facingDeg = pose.facingDeg; }
    });
    setViewportMode("overlay");
    setError("");
    setNotice(`Đã đặt entrypoint ${selectedEntryPoint.id} từ ${selectedObject.name}. Nhấn Lưu map để tạo revision.`);
  };

  return (
    <main id="noi-dung-chinh" className="map-editor-shell">
      <header><div><p>Admin · Editor Mode</p><h1>Map Editor</h1></div><nav className="editor-tabs" aria-label="Editor tabs"><button className={tab === "map" ? "active" : ""} onClick={() => setTab("map")}>Map</button><button className={tab === "flow" ? "active" : ""} onClick={() => setTab("flow")}>Map Flow</button></nav>{tab === "map" ? <><button type="button" className="create-map-button" onClick={() => setTab("flow")}>+ Tạo map mới</button><label>Map<select value={document.mapId} onChange={(event) => selectMap(event.target.value)}>{maps.map((map) => <option key={map.mapId} value={map.mapId}>{map.name} · r{map.activeRevision}</option>)}</select></label><div className="header-save-controls"><span className={blockingIssues.length ? "invalid" : dirty || flowOutOfSync ? "dirty" : ""}>{blockingIssues.length ? `${blockingIssues.length} lỗi chặn lưu` : dirty ? "Chưa lưu" : flowOutOfSync ? `Flow đang ở r${flowPin?.mapRevision}` : `Revision ${envelope.revision}`}</span><button type="button" className="header-save-button" disabled={!WRITE_ENABLED || saving || saveBlocked || (!dirty && !flowOutOfSync)} title={saveBlocked ? drawing ? "Đóng hoặc hủy polygon đang vẽ trước khi lưu." : "Sửa các lỗi validation trước khi lưu." : undefined} aria-busy={saving} onClick={save}>{saving ? "Đang lưu…" : flowOutOfSync && !dirty ? "Đồng bộ Flow" : "Lưu map"}</button></div></> : null}<Link href="/" onClick={(event) => { if (!confirmDiscard()) event.preventDefault(); }}>Về game</Link></header>
      {tab === "flow" ? <MapFlowPanel onDirtyChange={setFlowDirty} onMapCreated={(created) => { setMaps((current) => [...current, { mapId: created.mapId, name: created.document.metadata.name, description: created.document.metadata.description, activeRevision: created.revision, updatedAt: created.activatedAt }]); setEnvelope(created); setDocument(clone(created.document)); setSelectedEntryPointId(created.document.navigation.entryPoints[0]?.id ?? null); }} /> : <><aside>
        <section className={`editor-validation-summary ${saveBlocked ? "has-errors" : validationIssues.length ? "has-warnings" : "is-valid"}`} aria-live="polite" aria-atomic="false">
          <div><strong>{drawing ? "Polygon chưa đóng đang chặn lưu" : blockingIssues.length ? `${blockingIssues.length} lỗi đang chặn lưu` : validationIssues.length ? `${validationIssues.length} cảnh báo sẽ được tự căn khi lưu` : "Map hợp lệ, sẵn sàng lưu"}</strong>{repairableIssues.length ? <small>Entry point hoặc portal ngoài vùng hợp lệ sẽ được đưa về điểm gần nhất.</small> : null}</div>
          {validationIssues.length ? <ul>{validationIssues.map((issue, index) => <li key={`${issueKey(issue)}-${index}`}><button type="button" onClick={() => focusIssue(issue)}><span>{issueGroup(issue) === "geometry" ? "Vùng / Collider" : issueGroup(issue) === "entry" ? "Entry point" : issueGroup(issue) === "portal" ? "Portal" : issueGroup(issue) === "npc" ? "NPC" : "Map"}</span>{issue.message}</button></li>)}</ul> : null}
          {drawing ? <p>Polygon đang vẽ chưa được đóng. Đóng hoặc hủy polygon để có thể lưu.</p> : null}
        </section>
        <details open><summary>NPC GLB</summary><div className="editor-section"><label><span>GLB</span><input aria-label="NPC GLB" type="file" accept=".glb,model/gltf-binary" onChange={(event) => setNpcFile(event.target.files?.[0] ?? null)} /></label><label><span>NPC ID</span><input value={npcId} onChange={(event) => setNpcId(event.target.value)} /></label><label><span>Tên</span><input value={npcName} onChange={(event) => setNpcName(event.target.value)} /></label><label><span>Hội thoại</span><textarea value={npcDialogue} onChange={(event) => setNpcDialogue(event.target.value)} /></label><button type="button" disabled={!WRITE_ENABLED || importing} onClick={() => void importNpc()}>{importing ? "Đang import…" : "Import và thêm NPC"}</button></div></details>
        <details><summary>Assets</summary><div className="editor-section">{ASSETS.map((asset) => <button key={asset.src + asset.kind} onClick={() => mutate((next) => { const object = createObject(next, asset); next.objects.push(object); setSelectedObjectId(object.id); setSelectedNpcId(null); })}>+ {asset.name}</button>)}</div></details>
        <details open><summary>Scene Objects</summary><div className="editor-section object-list">{document.objects.map((object) => <button className={object.id === selectedObjectId ? "active" : ""} key={object.id} onClick={() => setSelectedObjectId(object.id)}>{object.name} <small>{object.kind}</small></button>)}<div className="row"><button disabled={!selectedObject} onClick={() => selectedObject && mutate((next) => { const copy = clone(selectedObject); copy.id = `${copy.id}-copy-${Date.now().toString(36)}`; copy.name += " bản sao"; delete copy.binding; next.objects.push(copy); setSelectedObjectId(copy.id); })}>Duplicate</button><button disabled={!selectedObject} onClick={() => mutate((next) => { next.objects = next.objects.filter((item) => item.id !== selectedObjectId); setSelectedObjectId(null); })}>Delete</button></div></div></details>
        <details open><summary>Entry points</summary><div className="editor-section object-list">{document.navigation.entryPoints.map((entry) => <button type="button" className={entry.id === selectedEntryPointId ? "active" : ""} key={entry.id} onClick={() => { setSelectedEntryPointId(entry.id); setViewportMode("overlay"); }}>{entry.id} <small>{entry.position.x.toFixed(1)}, {entry.position.z.toFixed(1)}</small></button>)}<div className="row"><button type="button" onClick={() => mutate((next) => { let suffix = next.navigation.entryPoints.length + 1; while (next.navigation.entryPoints.some((entry) => entry.id === `entry-${suffix}`)) suffix += 1; const id = `entry-${suffix}`; next.navigation.entryPoints.push({ id, position: { ...next.navigation.spawn }, facingDeg: 0 }); setSelectedEntryPointId(id); })}>+ Entry point</button><button type="button" disabled={!selectedEntryPoint || document.navigation.entryPoints.length === 1} onClick={() => mutate((next) => { next.navigation.entryPoints = next.navigation.entryPoints.filter((entry) => entry.id !== selectedEntryPointId); setSelectedEntryPointId(next.navigation.entryPoints[0]?.id ?? null); })}>Delete</button></div>{selectedEntryPoint ? <><label><span>ID dùng trong Map Flow</span><input value={selectedEntryPoint.id} onChange={(event) => { const id = event.target.value; mutate((next) => { const entry = next.navigation.entryPoints.find((item) => item.id === selectedEntryPoint.id); if (!entry) return; const previousId = entry.id; entry.id = id; for (const portal of next.portals) if (portal.target.mapId === next.mapId && portal.target.entryPointId === previousId) portal.target.entryPointId = id; }); setSelectedEntryPointId(id); }} /></label><NumberField label="Position X" value={selectedEntryPoint.position.x} onChange={(value) => mutate((next) => { const entry = next.navigation.entryPoints.find((item) => item.id === selectedEntryPoint.id); if (entry) entry.position.x = value; })} /><NumberField label="Position Z" value={selectedEntryPoint.position.z} onChange={(value) => mutate((next) => { const entry = next.navigation.entryPoints.find((item) => item.id === selectedEntryPoint.id); if (entry) entry.position.z = value; })} /><NumberField label="Facing°" value={selectedEntryPoint.facingDeg} onChange={(value) => mutate((next) => { const entry = next.navigation.entryPoints.find((item) => item.id === selectedEntryPoint.id); if (entry) entry.facingDeg = value; })} /><button type="button" disabled={!selectedObject} onClick={setEntryPointFromSelectedObject}>Lấy vị trí từ object đang chọn</button><small>Portal trong Map Flow sẽ teleport người chơi tới đúng ID, tọa độ và hướng này.</small></> : null}</div></details>
        <details open><summary>Portal points</summary><div className="editor-section object-list">{document.portals.length ? document.portals.map((portal) => <button type="button" className={portal.id === selectedPortalId ? "active" : ""} key={portal.id} onClick={() => { setSelectedPortalId(portal.id); setViewportMode("2d"); }}>{portal.id} <small>→ {portal.target.mapId}/{portal.target.entryPointId}</small></button>) : <p>Map này chưa có portal. Tạo kết nối trong tab Map Flow trước.</p>}<button type="button" onClick={() => setTab("flow")}>Mở Map Flow để tạo portal</button>{selectedPortal ? <><label><span>Kích hoạt</span><input type="checkbox" checked={selectedPortal.enabled} onChange={(event) => mutate((next) => { const portal = next.portals.find((item) => item.id === selectedPortal.id); if (portal) portal.enabled = event.target.checked; })} /></label><NumberField label="Portal X" value={selectedPortal.trigger.center.x} onChange={(value) => mutate((next) => { const portal = next.portals.find((item) => item.id === selectedPortal.id); if (portal) portal.trigger.center.x = value; })} /><NumberField label="Portal Z" value={selectedPortal.trigger.center.z} onChange={(value) => mutate((next) => { const portal = next.portals.find((item) => item.id === selectedPortal.id); if (portal) portal.trigger.center.z = value; })} /><NumberField label="Bán kính trigger" value={selectedPortal.trigger.radius} onChange={(value) => mutate((next) => { const portal = next.portals.find((item) => item.id === selectedPortal.id); if (portal) portal.trigger.radius = value; })} /><div className="row"><button type="button" onClick={() => mutate((next) => { const portal = next.portals.find((item) => item.id === selectedPortal.id); if (portal) portal.trigger.center = { ...next.navigation.spawn }; })}>Đặt tại spawn</button><button type="button" disabled={!selectedEntryPoint} onClick={() => selectedEntryPoint && mutate((next) => { const portal = next.portals.find((item) => item.id === selectedPortal.id); if (portal) portal.trigger.center = { ...selectedEntryPoint.position }; })}>Đặt tại entrypoint</button></div><small>Vòng tím trên viewport là vùng nhân vật bước vào để teleport tới {selectedPortal.target.mapId}/{selectedPortal.target.entryPointId}.</small></> : null}</div></details>
        {selectedObject ? <details open><summary>Transform</summary><div className="editor-section"><label><span>Tên</span><input value={selectedObject.name} onChange={(event) => mutateObject((object) => { object.name = event.target.value; })} /></label>{selectedObject.kind === "model3d" ? (["x", "y", "z"] as const).flatMap((axis) => [<NumberField key={`p${axis}`} label={`Position ${axis.toUpperCase()}`} value={selectedObject.transform3d.position[axis]} onChange={(value) => mutateObject((object) => { if (object.kind === "model3d") object.transform3d.position[axis] = value; })} />, <NumberField key={`r${axis}`} label={`Rotation ${axis.toUpperCase()}°`} value={selectedObject.transform3d.rotationDeg[axis]} onChange={(value) => mutateObject((object) => { if (object.kind === "model3d") object.transform3d.rotationDeg[axis] = value; })} />, <NumberField key={`s${axis}`} label={`Scale ${axis.toUpperCase()}`} value={selectedObject.transform3d.scale[axis]} onChange={(value) => mutateObject((object) => { if (object.kind === "model3d") object.transform3d.scale[axis] = value; })} />]) : <>{(["x", "y"] as const).map((axis) => <NumberField key={`p${axis}`} label={`Position ${axis.toUpperCase()}`} value={selectedObject.transform2d.position[axis]} onChange={(value) => mutateObject((object) => { if (object.kind === "sprite2d") object.transform2d.position[axis] = value; })} />)}<NumberField label="Width" value={selectedObject.transform2d.size.width} onChange={(value) => mutateObject((object) => { if (object.kind === "sprite2d") object.transform2d.size.width = value; })} /><NumberField label="Height" value={selectedObject.transform2d.size.height} onChange={(value) => mutateObject((object) => { if (object.kind === "sprite2d") object.transform2d.size.height = value; })} />{(["x", "y"] as const).map((axis) => <NumberField key={`a${axis}`} label={`Anchor ${axis.toUpperCase()}`} value={selectedObject.transform2d.anchor[axis]} onChange={(value) => mutateObject((object) => { if (object.kind === "sprite2d") object.transform2d.anchor[axis] = value; })} />)}<NumberField label="Rotation°" value={selectedObject.transform2d.rotationDeg} onChange={(value) => mutateObject((object) => { if (object.kind === "sprite2d") object.transform2d.rotationDeg = value; })} />{(["x", "y"] as const).map((axis) => <NumberField key={`s${axis}`} label={`Scale ${axis.toUpperCase()}`} value={selectedObject.transform2d.scale[axis]} onChange={(value) => mutateObject((object) => { if (object.kind === "sprite2d") object.transform2d.scale[axis] = value; })} />)}</>}<label><span>Collider</span><select value={selectedObject.collider.type} onChange={(event) => setCollider(event.target.value as Collider["type"])}>{["none", "circle", "rectangle", "polygon"].map((type) => <option key={type}>{type}</option>)}</select></label>{selectedObject.collider.type === "circle" ? <NumberField label="Radius" value={selectedObject.collider.radius} onChange={(value) => mutateObject((object) => { if (object.collider.type === "circle") object.collider.radius = value; })} /> : null}{selectedObject.collider.type === "rectangle" ? <><NumberField label="Width collider" value={selectedObject.collider.width} onChange={(value) => mutateObject((object) => { if (object.collider.type === "rectangle") object.collider.width = value; })} /><NumberField label="Depth collider" value={selectedObject.collider.depth} onChange={(value) => mutateObject((object) => { if (object.collider.type === "rectangle") object.collider.depth = value; })} /><NumberField label="Local rotation°" value={selectedObject.collider.rotationDeg ?? 0} onChange={(value) => mutateObject((object) => { if (object.collider.type === "rectangle") object.collider.rotationDeg = value; })} /></> : null}</div></details> : null}
        <details open><summary>Walkable Area</summary><div className="editor-section"><div className="row"><button disabled={drawing} onClick={() => { setDraftPoints([]); setDrawing(true); setViewportMode("2d"); }}>Vẽ vùng mới</button><button disabled={!drawing || draftPoints.length < 3} onClick={closeDraft}>Đóng polygon</button><button disabled={!drawing} onClick={() => { setDraftPoints([]); setDrawing(false); }}>Hủy</button></div><button onClick={createQuickRectangle}>Tạo chữ nhật quanh spawn</button><select value={selectedPolygonId ?? ""} onChange={(event) => setSelectedPolygonId(event.target.value)}>{document.navigation.walkablePolygons.map((polygon) => <option key={polygon.id} value={polygon.id}>{polygon.id}</option>)}</select>{selectedPolygon ? <div className="point-list">{selectedPolygon.points.map((point, index) => <div className="walkable-point-row" key={index}><NumberField label={`#${index + 1} X`} value={point.x} onChange={(value) => mutate((next) => { const polygon = next.navigation.walkablePolygons.find((item) => item.id === selectedPolygon.id); if (polygon) polygon.points[index].x = value; })} /><NumberField label="Z" value={point.z} onChange={(value) => mutate((next) => { const polygon = next.navigation.walkablePolygons.find((item) => item.id === selectedPolygon.id); if (polygon) polygon.points[index].z = value; })} /><button aria-label={`Xóa point ${index + 1}`} disabled={selectedPolygon.points.length <= 3} onClick={() => mutate((next) => { const polygon = next.navigation.walkablePolygons.find((item) => item.id === selectedPolygon.id); if (polygon && polygon.points.length > 3) polygon.points.splice(index, 1); })}>Xóa</button></div>)}<button onClick={() => mutate((next) => { const polygon = next.navigation.walkablePolygons.find((item) => item.id === selectedPolygon.id); if (!polygon) return; const a = polygon.points.at(-1)!; const b = polygon.points[0]; polygon.points.push({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }); })}>+ Thêm vector point</button></div> : null}</div></details>
        <details open><summary>Map Settings / Save</summary><div className="editor-section"><label><span>Tên map</span><input value={document.metadata.name} onChange={(event) => mutate((next) => { next.metadata.name = event.target.value; })} /></label><label><span>Mô tả</span><textarea value={document.metadata.description} onChange={(event) => mutate((next) => { next.metadata.description = event.target.value; })} /></label><label><span>Background</span><input value={document.background.src} onChange={(event) => mutate((next) => { next.background.src = event.target.value; })} /></label><label><span>Màu fallback</span><input value={document.background.color} onChange={(event) => mutate((next) => { next.background.color = event.target.value; })} /></label><div className="save-row"><span className={dirty || flowOutOfSync ? "dirty" : ""}>{dirty ? "Chưa lưu" : flowOutOfSync ? `Map Flow đang pin r${flowPin?.mapRevision}, active là r${envelope.revision}` : `Revision ${envelope.revision} đã đồng bộ`}</span><button disabled={!WRITE_ENABLED || saving || (!dirty && !flowOutOfSync)} onClick={save}>{saving ? "Đang lưu…" : flowOutOfSync && !dirty ? "Đồng bộ Flow" : "Save"}</button><button disabled={!dirty} onClick={() => { setDocument(clone(envelope.document)); setDraftPoints([]); setDrawing(false); }}>Reset</button></div>{!WRITE_ENABLED ? <small>Save đang tắt bởi NEXT_PUBLIC_MAP_EDITOR_WRITE_ENABLED.</small> : null}</div></details>
        {selectedObject ? <details open><summary>Collider Details</summary><div className="editor-section"><ColliderFields object={selectedObject} mutateObject={mutateObject} setCollider={setCollider} /></div></details> : null}
      </aside>
      <MapViewport key={document.mapId} document={document} mode={viewportMode} onModeChange={setViewportMode} polygonId={selectedPolygonId} onPolygonSelect={setSelectedPolygonId} drawing={drawing} draft={draftPoints} onDraftPoint={(point) => drawing && setDraftPoints((current) => [...current, point])} onPointInsert={(polygonId, index, point) => mutate((next) => { const polygon = next.navigation.walkablePolygons.find((item) => item.id === polygonId); if (polygon) polygon.points.splice(index, 0, point); })} onPointMove={(polygonId, index, point) => mutate((next) => { const polygon = next.navigation.walkablePolygons.find((item) => item.id === polygonId); if (polygon) polygon.points[index] = point; })} selectedEntryPointId={selectedEntryPointId} onEntryPointSelect={setSelectedEntryPointId} onEntryPointMove={(entryPointId, point) => { if (isPositionValid(document, point)) mutate((next) => { const entryPoint = next.navigation.entryPoints.find((item) => item.id === entryPointId); if (entryPoint) entryPoint.position = point; }); }} selectedPortalId={selectedPortalId} onPortalSelect={setSelectedPortalId} onPortalMove={(portalId, point) => { if (isPositionValid(document, point)) mutate((next) => { const portal = next.portals.find((item) => item.id === portalId); if (portal) portal.trigger.center = point; }); }} selectedNpcId={selectedNpcId} onNpcSelect={(id) => { setSelectedNpcId(id); setSelectedObjectId(null); }} onNpcMove={(id, position) => { if (isPositionValid(document, { x: position.x, z: position.z }, 0)) mutateNpc(id, (npc) => { npc.transform.position = position; }); }} /></>}
      <footer>{error ? <p role="alert">{error}</p> : null}{notice ? <p role="status">{notice}</p> : null}{!error && !notice ? <p role="status">{blockingIssues.length ? "Map chưa thể lưu. Chọn một cảnh báo trong inspector để sửa." : repairableIssues.length ? "Map có cảnh báo vị trí; các điểm này sẽ được tự căn khi lưu." : "Không có lỗi validation."}</p> : null}</footer>
      {selectedNpc ? <aside><NpcFields npc={selectedNpc} document={document} issues={issuesByGroup.npc.filter((issue) => issue.npcId === selectedNpc.id)} mutateNpc={(recipe) => mutateNpc(selectedNpc.id, recipe)} /></aside> : null}
    </main>
  );
}
