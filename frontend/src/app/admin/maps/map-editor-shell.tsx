"use client";

import {
  canonicalStringify,
  colliderFootprint,
  isPositionValid,
  nearestValidPoint,
  validateMapDocument,
  getNpcDialogueChain,
  type Collider,
  type DirectedPortal,
  type MapDocument,
  type MapFlowEnvelope,
  type MapNpc,
  type MapNpcDialogueStep,
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
import { cloneFlowMap, importGlb, importImage, listMaps, loadFlowMap, loadMap, loadMapFlow, MapApiError, saveMap, saveMapFlow } from "../../_lib/map-api-client";
import { NpcDialogueChainEditor } from "./npc-dialogue-chain-editor";

const WRITE_ENABLED = process.env.NEXT_PUBLIC_MAP_EDITOR_WRITE_ENABLED === "true";
const DungeonPreview = dynamic(
  () => import("../../_components/vanlang-dungeon-world").then((module) => module.VanlangDungeonWorld),
  { ssr: false, loading: () => null },
);
const ASSETS = [
  { kind: "model3d" as const, name: "Đấu trường 3D", src: "/models/vanlang-rebirth/arena.runtime.glb" },
  { kind: "model3d" as const, name: "Viễn Chinh Môn", src: "/models/vanlang-rebirth/temple-gate.glb" },
  { kind: "sprite2d" as const, name: "Nền Văn Lang", src: "/vanlang-rebirth-arena.png" },
];
const clone = <T,>(value: T): T => structuredClone(value);
const numberValue = (value: string) => Number.isFinite(Number(value)) ? Number(value) : 0;
type ViewportMode = "2d" | "3d" | "overlay";
type EditorTab = "map" | "npc" | "flow";
type ValidationGroup = "geometry" | "spawn" | "entry" | "portal" | "npc" | "map";

const issueGroup = (issue: MapValidationIssue): ValidationGroup => issue.npcId ? "npc"
  : issue.portalId || issue.path.startsWith("portals.") ? "portal"
  : issue.code === "INVALID_SPAWN" || issue.path === "navigation.spawn" ? "spawn"
  : issue.path.startsWith("navigation.entryPoints.") ? "entry"
  : issue.polygonId || issue.objectId || issue.path.includes("collider") || issue.path.startsWith("navigation.walkablePolygons.") ? "geometry"
  : "map";
const issueKey = (issue: MapValidationIssue) => `${issue.code}:${issue.path}`;

function prepareDocumentForSave(document: MapDocument) {
  const repaired = clone(document);
  const adjustedEntryPointIds: string[] = [];
  const adjustedPortalIds: string[] = [];
  let adjustedSpawn = false;
  if (!isPositionValid(repaired, repaired.navigation.spawn)) {
    const position = nearestValidPoint(repaired, repaired.navigation.spawn);
    if (position) {
      repaired.navigation.spawn = position;
      adjustedSpawn = true;
    }
  }
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
  return { repaired, adjustedEntryPointIds, adjustedPortalIds, adjustedSpawn };
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

function NumberField({ label, value, onChange, step = "0.1", min, max }: { label: string; value: number; onChange: (value: number) => void; step?: string | number; min?: number; max?: number }) {
  return <label><span>{label}</span><input type="number" step={step} min={min} max={max} value={value} onChange={(event) => onChange(numberValue(event.target.value))} /></label>;
}

function MapViewport({ document, mode, onModeChange, polygonId, onPolygonSelect, onPointMove, onPointInsert, drawing, draft, onDraftPoint, selectedEntryPointId, onEntryPointSelect, onEntryPointMove, selectedPortalId, onPortalSelect, onPortalMove, selectedNpcId, onNpcSelect, onNpcMove, onSpawnMove }: {
  document: MapDocument; mode: ViewportMode; onModeChange: (mode: ViewportMode) => void;
  polygonId: string | null; onPolygonSelect: (polygonId: string) => void;
  onPointMove: (polygonId: string, index: number, point: Vec2) => void;
  onPointInsert: (polygonId: string, index: number, point: Vec2) => void;
  drawing: boolean; draft: Vec2[]; onDraftPoint: (point: Vec2) => void;
  selectedEntryPointId: string | null; onEntryPointSelect: (entryPointId: string) => void; onEntryPointMove: (entryPointId: string, point: Vec2) => void;
  selectedPortalId: string | null; onPortalSelect: (portalId: string) => void; onPortalMove: (portalId: string, point: Vec2) => void;
  selectedNpcId: string | null; onNpcSelect: (npcId: string) => void; onNpcMove: (npcId: string, position: MapNpc["transform"]["position"]) => void;
  onSpawnMove: (point: Vec2) => void;
}) {
  const [dragging, setDragging] = useState<{ polygonId: string; index: number } | null>(null);
  const [draggingEntryPointId, setDraggingEntryPointId] = useState<string | null>(null);
  const [draggingPortalId, setDraggingPortalId] = useState<string | null>(null);
  const [draggingNpcId, setDraggingNpcId] = useState<string | null>(null);
  const [draggingSpawn, setDraggingSpawn] = useState(false);
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
  const spawnValid = isPositionValid(document, document.navigation.spawn);
  const spawnFacingRadians = document.navigation.spawnFacingDeg * Math.PI / 180;
  const spawnFacingMarker = toCanvas({ x: document.navigation.spawn.x + Math.sin(spawnFacingRadians) * 0.45, z: document.navigation.spawn.z + Math.cos(spawnFacingRadians) * 0.45 });
  return (
    <section className={`map-viewport is-${mode}`} aria-label={mode === "2d" ? "Map viewport 2D" : mode === "overlay" ? "Map viewport Overlay" : "Map viewport 3D"}>
      <div className="viewport-mode-switch" role="group" aria-label="Chế độ xem viewport">
        <button type="button" className={mode === "3d" ? "active" : ""} aria-pressed={mode === "3d"} onClick={() => { setPreviewReady(false); onModeChange("3d"); }}>3D góc người chơi</button>
        <button type="button" className={mode === "overlay" ? "active" : ""} aria-pressed={mode === "overlay"} onClick={() => { setPreviewReady(false); onModeChange("overlay"); }}>Overlay vùng</button>
      </div>
      {mode === "2d" ? <>
        <Image unoptimized fill src={document.background.src} alt={document.background.alt} style={{ objectFit: document.background.fit }} />
        {document.objects.filter((object): object is Extract<MapObject, { kind: "sprite2d" }> => object.kind === "sprite2d" && object.enabled).map((object) => <Image unoptimized width={1} height={1} className="viewport-sprite" key={object.id} src={object.src} alt={object.alt} style={{ left: `${object.transform2d.position.x * 100}%`, top: `${object.transform2d.position.y * 100}%`, width: `${object.transform2d.size.width * 100}%`, height: `${object.transform2d.size.height * 100}%`, transform: `translate(${-object.transform2d.anchor.x * 100}%, ${-object.transform2d.anchor.y * 100}%) rotate(${object.transform2d.rotationDeg}deg) scale(${object.transform2d.scale.x}, ${object.transform2d.scale.y})` }} />)}
        <svg className={drawing ? "is-drawing" : ""} viewBox="0 0 1000 1000" onPointerMove={(event) => { const point = fromPointer(event); if (dragging) onPointMove(dragging.polygonId, dragging.index, point); if (draggingEntryPointId) onEntryPointMove(draggingEntryPointId, point); if (draggingPortalId) onPortalMove(draggingPortalId, point); if (draggingNpcId) onNpcMove(draggingNpcId, { x: point.x, y: document.world.groundY, z: point.z }); if (draggingSpawn) onSpawnMove(point); }} onPointerUp={() => { setDragging(null); setDraggingEntryPointId(null); setDraggingPortalId(null); setDraggingNpcId(null); setDraggingSpawn(false); }} onPointerCancel={() => { setDragging(null); setDraggingEntryPointId(null); setDraggingPortalId(null); setDraggingNpcId(null); setDraggingSpawn(false); }} onClick={(event) => { if (drawing) onDraftPoint(fromPointer(event)); }}>
          {document.navigation.walkablePolygons.filter((polygon) => polygon.enabled).map((polygon) => (
            <g key={polygon.id} className={polygon.id === polygonId ? "selected" : ""} onClick={(event) => { if (!drawing) { event.stopPropagation(); onPolygonSelect(polygon.id); } }}>
              <polygon className="walkable-shape" points={polygon.points.map((point) => { const item = toCanvas(point); return `${item.x},${item.y}`; }).join(" ")} />
              {polygon.points.map((point, index) => { const item = toCanvas(point); return <circle className="point-handle" key={index} cx={item.x} cy={item.y} r="10" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); onPolygonSelect(polygon.id); setDragging({ polygonId: polygon.id, index }); }} />; })}
              {polygon.id === polygonId && !drawing ? polygon.points.map((point, index) => { const next = polygon.points[(index + 1) % polygon.points.length]; const item = toCanvas({ x: (point.x + next.x) / 2, z: (point.z + next.z) / 2 }); return <circle className="insert-handle" key={`insert-${index}`} cx={item.x} cy={item.y} r="7" onClick={(event) => { event.stopPropagation(); onPointInsert(polygon.id, index + 1, { x: (point.x + next.x) / 2, z: (point.z + next.z) / 2 }); }} />; }) : null}
            </g>
          ))}
          {draft.length ? <polyline className="draft" points={draft.map((point) => { const item = toCanvas(point); return `${item.x},${item.y}`; }).join(" ")} /> : null}
          {footprints.map(({ id, footprint }) => footprint?.type === "circle" ? (() => { const center = toCanvas(footprint.center); return <circle className="collider" key={id} cx={center.x} cy={center.y} r={footprint.radius / 12 * 1000} />; })() : footprint?.type === "polygon" ? <polygon className="collider" key={id} points={footprint.points.map((point) => { const item = toCanvas(point); return `${item.x},${item.y}`; }).join(" ")} /> : null)}
          {document.portals.filter((portal) => portal.enabled).map((portal) => { const center = toCanvas(portal.trigger.center); return <g key={portal.id} className={`portal-trigger${portal.id === selectedPortalId ? " selected" : ""}`} onClick={(event) => { event.stopPropagation(); onPortalSelect(portal.id); }}><circle className="portal-radius" cx={center.x} cy={center.y} r={portal.trigger.radius / 12 * 1000} /><circle className="portal-handle" cx={center.x} cy={center.y} r="13" role="button" aria-label={`Di chuyển portal ${portal.id}`} onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); onPortalSelect(portal.id); setDraggingPortalId(portal.id); }} /><text x={center.x} y={center.y + 28} textAnchor="middle" className="viewport-portal-label">➔ {portal.target.mapId} ({portal.id})</text></g>; })}
          <g className={`spawn-marker${!spawnValid ? " is-invalid" : ""}`} role="button" aria-label={spawnValid ? "Di chuyển điểm spawn" : "Spawn không hợp lệ: ngoài vùng đi lại hoặc va chạm vật cản"} onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setDraggingSpawn(true); }}><circle className="spawn-radius-preview" cx={spawnMarker.x} cy={spawnMarker.y} r={document.navigation.playerRadius / 12 * 1000} /><line x1={spawnMarker.x} y1={spawnMarker.y} x2={spawnFacingMarker.x} y2={spawnFacingMarker.y} /><circle cx={spawnMarker.x} cy={spawnMarker.y} r="15" /><path d={`M ${spawnMarker.x} ${spawnMarker.y - 24} L ${spawnMarker.x} ${spawnMarker.y + 24} M ${spawnMarker.x - 24} ${spawnMarker.y} L ${spawnMarker.x + 24} ${spawnMarker.y}`} /></g>
          {document.navigation.entryPoints.map((entryPoint) => { const center = toCanvas(entryPoint.position); const radians = entryPoint.facingDeg * Math.PI / 180; const facing = toCanvas({ x: entryPoint.position.x + Math.sin(radians) * 0.45, z: entryPoint.position.z + Math.cos(radians) * 0.45 }); return <g key={entryPoint.id} className={`entry-point-marker${entryPoint.id === selectedEntryPointId ? " selected" : ""}`} aria-label={`Entrypoint ${entryPoint.id}`} onClick={(event) => { event.stopPropagation(); onEntryPointSelect(entryPoint.id); }}><line x1={center.x} y1={center.y} x2={facing.x} y2={facing.y} /><circle cx={center.x} cy={center.y} r="13" role="button" aria-label={`Di chuyển entrypoint ${entryPoint.id}`} onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); onEntryPointSelect(entryPoint.id); setDraggingEntryPointId(entryPoint.id); }} /></g>; })}
          {document.npcs.map((npc) => { const center = toCanvas({ x: npc.transform.position.x, z: npc.transform.position.z }); return <g key={npc.id} className={`npc-position-marker${npc.id === selectedNpcId ? " selected" : ""}`} aria-label={`NPC ${npc.name}`} onClick={(event) => { event.stopPropagation(); onNpcSelect(npc.id); }}><circle cx={center.x} cy={center.y} r="13" role="button" aria-label={`Di chuyển NPC ${npc.name}`} onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); onNpcSelect(npc.id); setDraggingNpcId(npc.id); }} /><text x={center.x} y={center.y - 20} textAnchor="middle">{npc.name}</text></g>; })}
        </svg>
        <p>{drawing ? "Click trên viewport để đặt điểm; đủ 3 điểm thì đóng polygon." : "Giữ và kéo spawn, entrypoint, NPC hoặc tâm portal để đặt nhanh vị trí."}</p>
      </> : <div className="viewport-3d">
        <Image unoptimized fill className="viewport-3d-background" src={document.background.src} alt="" aria-hidden="true" style={{ objectFit: document.background.fit }} />
        <DungeonPreview key={mode} mapDocument={document} playerPos={{ x: selectedEntryPoint?.position.x ?? document.navigation.spawn.x, y: selectedEntryPoint?.position.z ?? document.navigation.spawn.z }} facing={(selectedEntryPoint?.facingDeg ?? document.navigation.spawnFacingDeg) * Math.PI / 180} isMoving={false} onSceneReady={markPreviewReady} selectedNpcId={selectedNpcId} onNpcSelect={onNpcSelect} onNpcMove={onNpcMove} editorOverlay={{ selectedPolygonId: polygonId, selectedEntryPointId, selectedPortalId, showAllPolygons: mode === "overlay", editablePolygons: true, editableNavigation: true, drawing, draft, onPolygonSelect, onEntryPointSelect, onPortalSelect, onPointMove, onPointInsert, onDraftPoint, onEntryPointMove, onPortalMove, onSpawnMove }} />
        {previewReady
          ? <p role="status">{drawing ? "Click trực tiếp trên scene để đặt điểm; đủ 3 điểm thì đóng polygon." : mode === "overlay" ? "Overlay đã sẵn sàng: kéo điểm lớn để chỉnh vùng, spawn, entrypoint hoặc portal; xanh là walkable, vàng là vùng đang chọn, đỏ là collider." : "Preview 3D đã sẵn sàng: vùng đang chọn, spawn, entrypoint, portal và NPC đều có thể chỉnh trực tiếp theo đúng runtime."}</p>
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

function NpcFields({ npc, document, issues, mutateNpc, uploadingPortrait, onPortraitUpload }: { npc: MapNpc; document: MapDocument; issues: MapValidationIssue[]; mutateNpc: (recipe: (npc: MapNpc) => void) => void; uploadingPortrait: boolean; onPortraitUpload: (file: File) => void }) {
  const uniformScale = npc.transform.scale?.x ?? 1;
  return <details open><summary>NPC</summary><div className="editor-section">
    <ValidationMessages issues={issues} />
    <label><span>NPC ID</span><input readOnly value={npc.id} /></label>
    <label><span>Tên</span><input value={npc.name} onChange={(event) => mutateNpc((item) => { item.name = event.target.value; })} /></label>
    <label><span>Runtime GLB</span><input readOnly value={npc.src} /></label>
    <label><span>Ảnh đại diện</span><input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploadingPortrait} onChange={(event) => { const file = event.target.files?.[0]; if (file) onPortraitUpload(file); event.currentTarget.value = ""; }} /></label>
    {npc.portraitSrc ? <div className="portrait-preview"><Image src={npc.portraitSrc} alt={`Ảnh đại diện ${npc.name}`} width={160} height={160} /><button type="button" onClick={() => mutateNpc((item) => { delete item.portraitSrc; })}>Gỡ ảnh</button></div> : <small>Chưa có ảnh đại diện. Khung hội thoại sẽ để trống.</small>}
    <NpcDialogueChainEditor
      chain={getNpcDialogueChain(npc)}
      defaultSpeaker={npc.name}
      onChange={(nextChain) => mutateNpc((item) => {
        item.dialogueChain = nextChain;
        item.dialogue = nextChain[0]?.text ?? "";
      })}
    />
    {(["x", "y", "z"] as const).map((axis) => <NumberField key={axis} label={`Position ${axis.toUpperCase()}`} value={npc.transform.position[axis]} onChange={(value) => mutateNpc((item) => {
      const position = { ...item.transform.position, [axis]: value };
      if (axis === "y" || isPositionValid(document, { x: position.x, z: position.z }, 0)) item.transform.position = position;
    })} />)}
    <NumberField label="Facing°" value={npc.transform.rotationDeg?.y ?? 0} step={5} onChange={(value) => mutateNpc((item) => {
      item.transform.rotationDeg = { ...(item.transform.rotationDeg ?? { x: 0, y: 0, z: 0 }), y: value };
    })} />
    <NumberField label="Scale" value={uniformScale} step={0.1} min={0.01} onChange={(value) => {
      const safe = Math.max(0.01, value);
      mutateNpc((item) => { item.transform.scale = { x: safe, y: safe, z: safe }; });
    }} />
    {(["x", "y", "z"] as const).map((axis) => <NumberField key={`scale-${axis}`} label={`Scale ${axis.toUpperCase()}`} value={npc.transform.scale?.[axis] ?? 1} step={0.1} min={0.01} onChange={(value) => mutateNpc((item) => {
      item.transform.scale = { ...(item.transform.scale ?? { x: 1, y: 1, z: 1 }), [axis]: Math.max(0.01, value) };
    })} />)}
    {(["x", "z"] as const).map((axis) => <NumberField key={`rot-${axis}`} label={`Rotation ${axis.toUpperCase()}°`} value={npc.transform.rotationDeg?.[axis] ?? 0} step={5} onChange={(value) => mutateNpc((item) => {
      item.transform.rotationDeg = { ...(item.transform.rotationDeg ?? { x: 0, y: 0, z: 0 }), [axis]: value };
    })} />)}
  </div></details>;
}

function FlowMiniMap({
  document,
  selectedPortalId,
  onPortalSelect,
  onPortalMove,
  selectedEntryPointId,
  onEntryPointSelect,
  onEntryPointMove,
}: {
  document: MapDocument;
  selectedPortalId: string | null;
  onPortalSelect: (portalId: string) => void;
  onPortalMove: (portalId: string, point: Vec2) => void;
  selectedEntryPointId: string | null;
  onEntryPointSelect: (entryPointId: string) => void;
  onEntryPointMove: (entryPointId: string, point: Vec2) => void;
}) {
  const [draggingPortalId, setDraggingPortalId] = useState<string | null>(null);
  const [draggingEntryPointId, setDraggingEntryPointId] = useState<string | null>(null);

  const toCanvas = (point: Vec2) => ({ x: ((point.x + 6) / 12) * 1000, y: ((point.z + 6) / 12) * 1000 });
  const fromPointer = (event: { currentTarget: SVGSVGElement; clientX: number; clientY: number }) => {
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return { x: 0, z: 0 };
    const pointer = event.currentTarget.createSVGPoint();
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    const canvas = pointer.matrixTransform(matrix.inverse());
    return {
      x: Math.max(-6, Math.min(6, (canvas.x / 1000) * 12 - 6)),
      z: Math.max(-6, Math.min(6, (canvas.y / 1000) * 12 - 6)),
    };
  };

  const spawnMarker = toCanvas(document.navigation.spawn);
  const footprints = document.objects
    .map((object) => ({ id: object.id, footprint: colliderFootprint(object) }))
    .filter((item) => item.footprint);

  return (
    <div className="flow-mini-map-container">
      <svg
        viewBox="0 0 1000 1000"
        onPointerMove={(event) => {
          const point = fromPointer(event);
          if (draggingPortalId) onPortalMove(draggingPortalId, point);
          if (draggingEntryPointId) onEntryPointMove(draggingEntryPointId, point);
        }}
        onPointerUp={() => {
          setDraggingPortalId(null);
          setDraggingEntryPointId(null);
        }}
        onPointerCancel={() => {
          setDraggingPortalId(null);
          setDraggingEntryPointId(null);
        }}
      >
        {document.navigation.walkablePolygons
          .filter((polygon) => polygon.enabled)
          .map((polygon) => (
            <polygon
              key={polygon.id}
              className="walkable-shape"
              points={polygon.points.map((point) => { const item = toCanvas(point); return `${item.x},${item.y}`; }).join(" ")}
            />
          ))}
        {footprints.map(({ id, footprint }) =>
          footprint?.type === "circle" ? (
            <circle
              className="collider"
              key={id}
              cx={toCanvas(footprint.center).x}
              cy={toCanvas(footprint.center).y}
              r={(footprint.radius / 12) * 1000}
            />
          ) : footprint?.type === "polygon" ? (
            <polygon
              className="collider"
              key={id}
              points={footprint.points.map((point) => { const item = toCanvas(point); return `${item.x},${item.y}`; }).join(" ")}
            />
          ) : null
        )}
        <circle cx={spawnMarker.x} cy={spawnMarker.y} r="12" fill="#58e6ff" stroke="#123d4a" strokeWidth="4" />
        {document.navigation.entryPoints.map((entryPoint) => {
          const center = toCanvas(entryPoint.position);
          const isSelected = entryPoint.id === selectedEntryPointId;
          return (
            <g
              key={entryPoint.id}
              className={`entry-point-marker${isSelected ? " selected" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                onEntryPointSelect(entryPoint.id);
              }}
            >
              <circle
                cx={center.x}
                cy={center.y}
                r="16"
                role="button"
                aria-label={`Di chuyển entrypoint ${entryPoint.id}`}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  onEntryPointSelect(entryPoint.id);
                  setDraggingEntryPointId(entryPoint.id);
                }}
              />
              <text x={center.x} y={center.y - 18} textAnchor="middle" fill="#7de3ff" fontSize="32" fontWeight="bold">
                {entryPoint.id}
              </text>
            </g>
          );
        })}
        {document.portals
          .filter((portal) => portal.enabled)
          .map((portal) => {
            const center = toCanvas(portal.trigger.center);
            const isSelected = portal.id === selectedPortalId;
            return (
              <g
                key={portal.id}
                className={`portal-trigger${isSelected ? " selected" : ""}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onPortalSelect(portal.id);
                }}
              >
                <circle className="portal-radius" cx={center.x} cy={center.y} r={(portal.trigger.radius / 12) * 1000} />
                <circle
                  className="portal-handle"
                  cx={center.x}
                  cy={center.y}
                  r="18"
                  role="button"
                  aria-label={`Di chuyển portal ${portal.id}`}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    onPortalSelect(portal.id);
                    setDraggingPortalId(portal.id);
                  }}
                />
                <text x={center.x} y={center.y + 36} textAnchor="middle" className="flow-mini-portal-text">
                  ➔ {portal.target.mapId} ({portal.id})
                </text>
              </g>
            );
          })}
      </svg>
      <p className="flow-mini-hint">💡 Kéo chấm tím (Portal Trigger) hoặc chấm xanh (Entry Point) để đổi vị trí trực tiếp.</p>
    </div>
  );
}

function MapFlowPanel({
  onDirtyChange,
  onMapCreated,
  onOpenMapPortal,
}: {
  onDirtyChange: (dirty: boolean) => void;
  onMapCreated: (map: MapRevisionEnvelope) => void;
  onOpenMapPortal?: (mapId: string, portalId: string) => void;
}) {
  const [flow, setFlow] = useState<MapFlowEnvelope | null>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [envelopes, setEnvelopes] = useState<Record<string, MapRevisionEnvelope>>({});
  const [documents, setDocuments] = useState<Record<string, MapDocument>>({});
  const [selectedMapId, setSelectedMapId] = useState("");
  const [selectedPortalId, setSelectedPortalId] = useState<string | null>(null);
  const [selectedEntryPointId, setSelectedEntryPointId] = useState<string | null>(null);
  const [linkSource, setLinkSource] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<{ sourceMapId: string; current: { x: number; y: number } } | null>(null);
  const [hoverTargetMapId, setHoverTargetMapId] = useState<string | null>(null);
  const [connectModal, setConnectModal] = useState<{ sourceMapId: string; targetMapId: string; x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [templateMapId, setTemplateMapId] = useState("");
  const [newMapId, setNewMapId] = useState("");
  const [newMapName, setNewMapName] = useState("");
  const [portalTargetMapId, setPortalTargetMapId] = useState("");
  const [baseNodeIds, setBaseNodeIds] = useState<string[]>([]);

  const dirtyMaps = useMemo(() => Object.keys(documents).filter((mapId) => envelopes[mapId] && canonicalStringify(documents[mapId]) !== canonicalStringify(envelopes[mapId].document)), [documents, envelopes]);
  const layoutDirty = Boolean(flow && flow.document.nodes.some((node) => canonicalStringify(node.position) !== canonicalStringify(positions[node.mapId])));
  const nodesListDirty = Boolean(flow && (baseNodeIds.length !== flow.document.nodes.length || baseNodeIds.some((id, idx) => flow.document.nodes[idx]?.mapId !== id)));
  const dirty = layoutDirty || dirtyMaps.length > 0 || nodesListDirty;
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
    setBaseNodeIds(loadedFlow.document.nodes.map((node) => node.mapId));
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
  const edges = useMemo(() => Object.values(documents).flatMap((document) => document.portals.map((portal) => ({ sourceMapId: document.mapId, portal }))), [documents]);

  const addPortal = (sourceMapId: string, targetMapId: string) => {
    if (sourceMapId === targetMapId || !documents[sourceMapId] || !documents[targetMapId]) return;
    const targetEntry = documents[targetMapId].navigation.entryPoints[0];
    if (!targetEntry) return;
    mutateDocument(sourceMapId, (document) => {
      let suffix = 1;
      const basePrefix = `portal-${sourceMapId}-to-${targetMapId}`;
      while (document.portals.some((portal) => portal.id === `${basePrefix}-${suffix}`)) suffix += 1;
      const portal: DirectedPortal = { id: `${basePrefix}-${suffix}`, enabled: true, trigger: { type: "circle", center: { ...document.navigation.spawn }, radius: 0.8 }, target: { mapId: targetMapId, entryPointId: targetEntry.id } };
      document.portals.push(portal);
      setSelectedMapId(sourceMapId);
      setSelectedPortalId(portal.id);
    });
    setNotice(`Đã tạo portal một chiều ${sourceMapId} → ${targetMapId}. Đặt trigger rồi Save Flow.`);
  };

  const addBidirectionalPortal = (sourceMapId: string, targetMapId: string) => {
    if (sourceMapId === targetMapId || !documents[sourceMapId] || !documents[targetMapId]) return;
    const targetEntry = documents[targetMapId].navigation.entryPoints[0];
    const sourceEntry = documents[sourceMapId].navigation.entryPoints[0];
    if (!targetEntry || !sourceEntry) return;

    let createdId = "";
    setDocuments((current) => {
      const docSource = current[sourceMapId];
      const docTarget = current[targetMapId];
      if (!docSource || !docTarget) return current;
      const nextSource = clone(docSource);
      const nextTarget = clone(docTarget);

      let suffix1 = 1;
      const prefix1 = `portal-${sourceMapId}-to-${targetMapId}`;
      while (nextSource.portals.some((p) => p.id === `${prefix1}-${suffix1}`)) suffix1 += 1;
      const portal1Center = { ...sourceEntry.position };
      const portal1: DirectedPortal = {
        id: `${prefix1}-${suffix1}`,
        enabled: true,
        trigger: { type: "circle", center: portal1Center, radius: 0.8 },
        target: { mapId: targetMapId, entryPointId: targetEntry.id },
      };
      nextSource.portals.push(portal1);
      createdId = portal1.id;

      let suffix2 = 1;
      const prefix2 = `portal-${targetMapId}-to-${sourceMapId}`;
      while (nextTarget.portals.some((p) => p.id === `${prefix2}-${suffix2}`)) suffix2 += 1;
      const portal2Center = { ...targetEntry.position };
      const portal2: DirectedPortal = {
        id: `${prefix2}-${suffix2}`,
        enabled: true,
        trigger: { type: "circle", center: portal2Center, radius: 0.8 },
        target: { mapId: sourceMapId, entryPointId: sourceEntry.id },
      };
      nextTarget.portals.push(portal2);

      return { ...current, [sourceMapId]: nextSource, [targetMapId]: nextTarget };
    });

    setSelectedMapId(sourceMapId);
    if (createdId) setSelectedPortalId(createdId);
    setNotice(`Đã tạo liên kết 2 chiều giữa ${sourceMapId} ⇄ ${targetMapId} trùng vị trí Entrypoint đón tương ứng.`);
  };

  const getReturnPortal = (sourceMapId: string, portal: DirectedPortal): DirectedPortal | null => {
    const targetDoc = documents[portal.target.mapId];
    if (!targetDoc) return null;
    return targetDoc.portals.find((p) => p.target.mapId === sourceMapId) ?? null;
  };

  const addReturnPortal = (sourceMapId: string, portal: DirectedPortal) => {
    const targetMapId = portal.target.mapId;
    const targetDoc = documents[targetMapId];
    const sourceEntry = documents[sourceMapId]?.navigation.entryPoints[0];
    if (!targetDoc || !sourceEntry) return;

    mutateDocument(targetMapId, (doc) => {
      let suffix = 1;
      const returnPrefix = `portal-${targetMapId}-to-${sourceMapId}`;
      while (doc.portals.some((p) => p.id === `${returnPrefix}-${suffix}`)) suffix += 1;
      const targetEntry = doc.navigation.entryPoints.find((e) => e.id === portal.target.entryPointId) ?? doc.navigation.entryPoints[0];
      const center = targetEntry ? { ...targetEntry.position } : { ...doc.navigation.spawn };
      doc.portals.push({
        id: `${returnPrefix}-${suffix}`,
        enabled: true,
        trigger: { type: "circle", center, radius: 0.8 },
        target: { mapId: sourceMapId, entryPointId: sourceEntry.id },
      });
    });
    setNotice(`Đã bổ sung portal chiều về ${targetMapId} → ${sourceMapId} trùng vị trí điểm đón.`);
  };

  const deleteBidirectionalPortal = (sourceMapId: string, portal: DirectedPortal) => {
    const returnPortal = getReturnPortal(sourceMapId, portal);
    mutateDocument(sourceMapId, (doc) => {
      doc.portals = doc.portals.filter((p) => p.id !== portal.id);
    });
    if (returnPortal) {
      mutateDocument(portal.target.mapId, (doc) => {
        doc.portals = doc.portals.filter((p) => p.id !== returnPortal.id);
      });
    }
    setSelectedPortalId(null);
    setNotice(`Đã xóa liên kết 2 chiều giữa ${sourceMapId} và ${portal.target.mapId}.`);
  };

  const connect = (targetMapId: string) => {
    if (!linkSource || linkSource === targetMapId) { setLinkSource(null); return; }
    setConnectModal({
      sourceMapId: linkSource,
      targetMapId,
      x: positions[targetMapId]?.x ?? 0.5,
      y: positions[targetMapId]?.y ?? 0.5,
    });
    setLinkSource(null);
  };

  const getEdgePath = (sourceMapId: string, portal: DirectedPortal) => {
    const source = positions[sourceMapId];
    const target = positions[portal.target.mapId];
    if (!source || !target) return "";

    const x1 = source.x * 1000;
    const y1 = source.y * 1000;
    const x2 = target.x * 1000;
    const y2 = target.y * 1000;

    const hasReturn = documents[portal.target.mapId]?.portals.some((p) => p.target.mapId === sourceMapId);
    if (!hasReturn) {
      return `M ${x1} ${y1} L ${x2} ${y2}`;
    }

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const curveOffset = 42;
    const mx = (x1 + x2) / 2 + nx * curveOffset;
    const my = (y1 + y2) / 2 + ny * curveOffset;

    return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
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

  const deleteMapFromFlow = (mapId: string) => {
    if (mapId === "vanlang" || !flow) return;
    const mapName = documents[mapId]?.metadata.name ?? mapId;
    if (!window.confirm(`Bạn có chắc muốn xóa node '${mapName}' (${mapId}) khỏi Map Flow?`)) return;

    setFlow((curr) => {
      if (!curr) return curr;
      return {
        ...curr,
        document: {
          ...curr.document,
          nodes: curr.document.nodes.filter((n) => n.mapId !== mapId),
        },
      };
    });

    setPositions((curr) => {
      const next = { ...curr };
      delete next[mapId];
      return next;
    });

    setDocuments((curr) => {
      const next = { ...curr };
      delete next[mapId];
      for (const id of Object.keys(next)) {
        const doc = next[id];
        if (doc.portals.some((p) => p.target.mapId === mapId)) {
          next[id] = {
            ...doc,
            portals: doc.portals.filter((p) => p.target.mapId !== mapId),
          };
        }
      }
      return next;
    });

    setEnvelopes((curr) => {
      const next = { ...curr };
      delete next[mapId];
      return next;
    });

    if (selectedMapId === mapId) {
      const remainingNode = flow.document.nodes.find((n) => n.mapId !== mapId);
      setSelectedMapId(remainingNode?.mapId ?? "vanlang");
      setSelectedPortalId(null);
    }
    setNotice(`Đã xóa node '${mapName}' khỏi flow. Nhấn 'Save Flow' để lưu thay đổi.`);
  };

  const save = async () => {
    if (!flow || saving || !dirty) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await saveMapFlow(flow.flowId, { schemaVersion: 1, flowId: flow.flowId, nodes: flow.document.nodes.map((node) => ({ mapId: node.mapId, position: positions[node.mapId] })) }, dirtyMaps.map((mapId) => ({ mapId, expectedEtag: envelopes[mapId].etag, document: documents[mapId] })), flow.etag);
      const nextEnvelopes = { ...envelopes };
      for (const item of result.maps) nextEnvelopes[item.mapId] = item;
      setFlow(result.flow); setEnvelopes(nextEnvelopes);
      setBaseNodeIds(result.flow.document.nodes.map((node) => node.mapId));
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
      setBaseNodeIds(created.flow.document.nodes.map((node) => node.mapId));
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
    const bounds = event.currentTarget.getBoundingClientRect();
    if (dragging) {
      setPositions((current) => ({ ...current, [dragging]: { x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)), y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)) } }));
    }
    if (connecting) {
      setConnecting((curr) => curr ? { ...curr, current: { x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)), y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)) } } : null);
    }
  };

  const handleCanvasPointerUp = () => {
    setDragging(null);
    if (connecting) {
      if (hoverTargetMapId && hoverTargetMapId !== connecting.sourceMapId) {
        setConnectModal({
          sourceMapId: connecting.sourceMapId,
          targetMapId: hoverTargetMapId,
          x: connecting.current.x,
          y: connecting.current.y,
        });
      }
      setConnecting(null);
      setHoverTargetMapId(null);
    }
  };

  const pairedPortal = selectedPortal && selectedDocument ? getReturnPortal(selectedMapId, selectedPortal) : null;
  const closeEntry = selectedPortal && selectedDocument ? selectedDocument.navigation.entryPoints.find((entry) => {
    const dist = Math.hypot(selectedPortal.trigger.center.x - entry.position.x, selectedPortal.trigger.center.z - entry.position.z);
    return dist < selectedPortal.trigger.radius + 0.6;
  }) : null;
  const closeEntryDist = closeEntry && selectedPortal ? Math.hypot(selectedPortal.trigger.center.x - closeEntry.position.x, selectedPortal.trigger.center.z - closeEntry.position.z) : null;
  const isCoLocated = closeEntryDist !== null && closeEntryDist <= 0.2;

  return <section className="map-flow-panel" aria-label="Map Flow editor">
    <div className="map-flow-toolbar">
      <strong>Map Flow · r{flow.revision}</strong>
      <span className={dirty ? "dirty" : ""}>{dirty ? `${dirtyMaps.length} map + layout chưa lưu` : "Đã đồng bộ"}</span>
      <button disabled={!WRITE_ENABLED || !dirty || saving} onClick={save}>{saving ? "Đang lưu…" : "Save Flow"}</button>
      <button disabled={dirty || saving} onClick={() => void hydrate()}>Reload</button>
    </div>
    <div className="map-flow-layout">
      <div className="map-flow-canvas" onPointerMove={moveNode} onPointerUp={handleCanvasPointerUp}>
        <svg aria-hidden="true" viewBox="0 0 1000 1000" preserveAspectRatio="none">
          <defs>
            <marker id="flow-arrow" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#d8a95d" />
            </marker>
            <marker id="flow-arrow-selected" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#77c9ff" />
            </marker>
            <marker id="flow-arrow-live" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#ffe082" />
            </marker>
          </defs>
          {edges.map(({ sourceMapId, portal }) => {
            const d = getEdgePath(sourceMapId, portal);
            if (!d) return null;
            const isSelected = sourceMapId === selectedMapId && portal.id === selectedPortalId;
            return (
              <path
                key={`${sourceMapId}-${portal.id}`}
                d={d}
                className={`flow-edge${isSelected ? " selected" : ""}`}
                markerEnd={isSelected ? "url(#flow-arrow-selected)" : "url(#flow-arrow)"}
                onClick={() => {
                  setSelectedMapId(sourceMapId);
                  setSelectedPortalId(portal.id);
                }}
              />
            );
          })}
          {connecting && positions[connecting.sourceMapId] ? (
            <path
              className="flow-edge-live"
              d={`M ${positions[connecting.sourceMapId].x * 1000} ${positions[connecting.sourceMapId].y * 1000} L ${connecting.current.x * 1000} ${connecting.current.y * 1000}`}
              markerEnd="url(#flow-arrow-live)"
            />
          ) : null}
        </svg>
        {flow.document.nodes.map((node) => (
          <article
            key={node.mapId}
            className={`map-flow-node${selectedMapId === node.mapId ? " selected" : ""}${hoverTargetMapId === node.mapId && connecting ? " drop-target" : ""}`}
            style={{ left: `${(positions[node.mapId]?.x ?? 0.5) * 100}%`, top: `${(positions[node.mapId]?.y ?? 0.5) * 100}%` }}
            onPointerEnter={() => { if (connecting && connecting.sourceMapId !== node.mapId) setHoverTargetMapId(node.mapId); }}
            onPointerLeave={() => { if (hoverTargetMapId === node.mapId) setHoverTargetMapId(null); }}
            onPointerDown={(event) => {
              if ((event.target as HTMLElement).closest(".flow-input, .flow-output, .flow-node-delete")) return;
              setDragging(node.mapId);
              setSelectedMapId(node.mapId);
            }}
          >
            {node.mapId !== "vanlang" ? (
              <button
                type="button"
                className="flow-node-delete"
                title={`Xóa node ${documents[node.mapId]?.metadata.name ?? node.mapId} khỏi flow`}
                aria-label={`Xóa node ${node.mapId}`}
                onClick={(e) => {
                  e.stopPropagation();
                  deleteMapFromFlow(node.mapId);
                }}
              >
                ×
              </button>
            ) : null}
            <button
              className="flow-input"
              aria-label={`Input ${node.mapId}`}
              onPointerEnter={() => { if (connecting && connecting.sourceMapId !== node.mapId) setHoverTargetMapId(node.mapId); }}
              onPointerUp={() => {
                if (connecting && connecting.sourceMapId !== node.mapId) {
                  setConnectModal({ sourceMapId: connecting.sourceMapId, targetMapId: node.mapId, x: positions[node.mapId]?.x ?? 0.5, y: positions[node.mapId]?.y ?? 0.5 });
                  setConnecting(null);
                } else {
                  connect(node.mapId);
                }
              }}
              onClick={() => connect(node.mapId)}
            />
            <button className="flow-node-body" onClick={() => setSelectedMapId(node.mapId)}>
              <strong>{documents[node.mapId]?.metadata.name ?? node.mapId}</strong>
              <small>{node.mapId} · r{node.mapRevision}</small>
            </button>
            <button
              className="flow-output"
              aria-label={`Output ${node.mapId}`}
              aria-pressed={linkSource === node.mapId || connecting?.sourceMapId === node.mapId}
              onPointerDown={(event) => {
                event.stopPropagation();
                setConnecting({ sourceMapId: node.mapId, current: positions[node.mapId] ?? { x: 0.5, y: 0.5 } });
                setLinkSource(node.mapId);
              }}
              onClick={() => setLinkSource(node.mapId)}
            />
          </article>
        ))}
        {connecting ? <p className="flow-link-hint">Đang kéo dây: Thả vào node hoặc input đích để tạo kết nối.</p> : linkSource ? <p className="flow-link-hint">Chọn input của map đích để tạo portal.</p> : null}
        {connectModal ? (
          <div className="flow-connect-modal" style={{ left: `${connectModal.x * 100}%`, top: `${connectModal.y * 100}%` }}>
            <h4>Kết nối {connectModal.sourceMapId} → {connectModal.targetMapId}</h4>
            <button
              type="button"
              className="primary"
              onClick={() => {
                addBidirectionalPortal(connectModal.sourceMapId, connectModal.targetMapId);
                setConnectModal(null);
                setLinkSource(null);
              }}
            >
              ⇄ Tạo liên kết 2 chiều ({connectModal.sourceMapId} ⇄ {connectModal.targetMapId})
            </button>
            <button
              type="button"
              onClick={() => {
                addPortal(connectModal.sourceMapId, connectModal.targetMapId);
                setConnectModal(null);
                setLinkSource(null);
              }}
            >
              → Tạo liên kết 1 chiều ({connectModal.sourceMapId} → {connectModal.targetMapId})
            </button>
            <button type="button" onClick={() => setConnectModal(null)}>Hủy</button>
          </div>
        ) : null}
      </div>
      <aside className="map-flow-inspector">
        <h2>Flow Inspector</h2>
        <label><span>Map đang chọn</span><select value={selectedMapId} onChange={(event) => { const mapId = event.target.value; setSelectedMapId(mapId); setSelectedPortalId(null); setPortalTargetMapId(flow.document.nodes.find((node) => node.mapId !== mapId)?.mapId ?? ""); }}>{flow.document.nodes.map((node) => <option key={node.mapId} value={node.mapId}>{documents[node.mapId]?.metadata.name ?? node.mapId} ({node.mapId})</option>)}</select></label>
        {selectedDocument ? <label><span>Tên map</span><input value={selectedDocument.metadata.name} onChange={(event) => mutateDocument(selectedMapId, (document) => { document.metadata.name = event.target.value; })} /><small>Map ID <strong>{selectedMapId}</strong> được giữ nguyên để không ảnh hưởng portal.</small></label> : null}
        {positions[selectedMapId] ? <div className="flow-form-grid"><NumberField label="Node X" value={positions[selectedMapId].x} onChange={(value) => setPositions((current) => ({ ...current, [selectedMapId]: { ...current[selectedMapId], x: Math.max(0, Math.min(1, value)) } }))} /><NumberField label="Node Y" value={positions[selectedMapId].y} onChange={(value) => setPositions((current) => ({ ...current, [selectedMapId]: { ...current[selectedMapId], y: Math.max(0, Math.min(1, value)) } }))} /></div> : null}
        {selectedMapId && selectedMapId !== "vanlang" ? (
          <div className="flow-node-danger-zone">
            <button
              type="button"
              className="danger-btn"
              onClick={() => deleteMapFromFlow(selectedMapId)}
            >
              🗑️ Xóa node &quot;{documents[selectedMapId]?.metadata.name ?? selectedMapId}&quot; khỏi Flow
            </button>
          </div>
        ) : null}
        <fieldset className="create-map-fieldset"><legend>1. Tạo map mới</legend><p>Map mới sao chép asset và vùng di chuyển từ map mẫu, nhưng không sao chép portal.</p><label><span>Map mẫu</span><select value={templateMapId} onChange={(event) => setTemplateMapId(event.target.value)}>{flow.document.nodes.map((node) => <option key={node.mapId} value={node.mapId}>{documents[node.mapId]?.metadata.name ?? node.mapId}</option>)}</select></label><label><span>Map ID mới</span><input value={newMapId} aria-describedby="new-map-id-hint" aria-invalid={Boolean(newMapId) && !newMapIdValid} placeholder="vi-du: thanh-co-loa" onChange={(event) => setNewMapId(event.target.value)} /></label><small id="new-map-id-hint">Chỉ dùng chữ thường, số và dấu gạch ngang.</small><label><span>Tên hiển thị</span><input value={newMapName} onChange={(event) => setNewMapName(event.target.value)} /></label><button disabled={!WRITE_ENABLED || dirty || saving || !newMapIdValid || !newMapName.trim()} onClick={createMap}>{saving ? "Đang tạo…" : "Tạo map"}</button>{dirty ? <small>Save Flow trước khi tạo map mới.</small> : null}</fieldset>
        {selectedDocument ? <><fieldset><legend>2. Entrypoint của map</legend><p>Nhân vật xuất hiện tại entrypoint này khi đi qua portal.</p>{selectedDocument.navigation.entryPoints.map((entry, index) => <div className="flow-form-grid" key={index}><label><span>ID</span><input value={entry.id} onChange={(event) => renameEntryPoint(selectedMapId, index, event.target.value)} /></label><NumberField label="X" value={entry.position.x} onChange={(value) => mutateDocument(selectedMapId, (document) => { document.navigation.entryPoints[index].position.x = value; })} /><NumberField label="Z" value={entry.position.z} onChange={(value) => mutateDocument(selectedMapId, (document) => { document.navigation.entryPoints[index].position.z = value; })} /><NumberField label="Hướng (°)" value={entry.facingDeg} onChange={(value) => mutateDocument(selectedMapId, (document) => { document.navigation.entryPoints[index].facingDeg = value; })} /><button type="button" onClick={() => mutateDocument(selectedMapId, (document) => { document.navigation.entryPoints[index].position = { ...document.navigation.spawn }; })}>Đặt tại spawn</button></div>)}<button onClick={() => mutateDocument(selectedMapId, (document) => { let suffix = document.navigation.entryPoints.length + 1; while (document.navigation.entryPoints.some((entry) => entry.id === `entry-${suffix}`)) suffix += 1; document.navigation.entryPoints.push({ id: `entry-${suffix}`, position: { ...document.navigation.spawn }, facingDeg: 0 }); })}>+ Thêm entrypoint</button></fieldset>
        <fieldset><legend>3. Portal / Map Flow</legend><p>Portal là kết nối có hướng. Khi nối 2 chiều, hệ thống tạo 2 portal đối ứng.</p><div className="flow-add-portal"><label><span>Map đích</span><select value={portalTargetMapId} onChange={(event) => setPortalTargetMapId(event.target.value)}>{flow.document.nodes.filter((node) => node.mapId !== selectedMapId).map((node) => <option key={node.mapId} value={node.mapId}>{documents[node.mapId]?.metadata.name ?? node.mapId} ({node.mapId})</option>)}</select></label><div className="row"><button disabled={!portalTargetMapId || portalTargetMapId === selectedMapId} onClick={() => addPortal(selectedMapId, portalTargetMapId)}>+ 1 chiều</button><button className="flow-btn-bidirectional" disabled={!portalTargetMapId || portalTargetMapId === selectedMapId} onClick={() => addBidirectionalPortal(selectedMapId, portalTargetMapId)}>⇄ 2 chiều (A ⇄ B)</button></div></div><select aria-label="Portal" value={selectedPortalId ?? ""} onChange={(event) => setSelectedPortalId(event.target.value || null)}><option value="">-- Chọn portal ({selectedDocument.portals.length} portal trên map này) --</option>{selectedDocument.portals.map((portal) => { const sourceName = selectedDocument.metadata.name || selectedMapId; const targetDoc = documents[portal.target.mapId]; const targetName = targetDoc?.metadata.name || portal.target.mapId; const entryText = portal.target.entryPointId ? ` ➔ Entry: ${portal.target.entryPointId}` : ""; return <option key={portal.id} value={portal.id}>[{sourceName} ➔ {targetName}] · {portal.id}{entryText}</option>; })}</select>{selectedPortal ? <div className="flow-form-grid"><div className="flow-portal-route-card"><div className="route-header"><span className="route-tag">Hành trình cổng</span><code className="portal-code">{selectedPortal.id}</code></div><div className="route-steps"><div className="route-step source"><span className="step-label">Từ map</span><strong className="step-title">{selectedDocument.metadata.name || selectedMapId}</strong><small className="step-id">ID: {selectedMapId}</small></div><div className="route-arrow" aria-hidden="true">➔</div><div className="route-step destination"><span className="step-label">Tới map</span><strong className="step-title">{documents[selectedPortal.target.mapId]?.metadata.name || selectedPortal.target.mapId}</strong><small className="step-id">ID: {selectedPortal.target.mapId}</small></div></div><div className="route-arrival"><span className="arrival-label">🎯 Xuất hiện tại đích:</span><strong className="arrival-entry">{selectedPortal.target.entryPointId ? `Entrypoint "${selectedPortal.target.entryPointId}"` : "(Chưa chọn entrypoint)"}</strong></div></div><div className="flow-paired-section">{pairedPortal ? <div className="flow-badge-pair is-paired"><span>✓ Đã liên kết 2 chiều với portal <strong>{pairedPortal.id}</strong> ở map {selectedPortal.target.mapId}</span><button type="button" onClick={() => { setSelectedMapId(selectedPortal.target.mapId); setSelectedPortalId(pairedPortal.id); }}>Chuyển sang cổng về ({selectedPortal.target.mapId})</button></div> : <div className="flow-badge-pair is-single"><span>Đang là kết nối 1 chiều ({selectedMapId} → {selectedPortal.target.mapId})</span><button type="button" className="flow-btn-bidirectional" onClick={() => addReturnPortal(selectedMapId, selectedPortal)}>⇄ Bổ sung portal chiều về ({selectedPortal.target.mapId} → {selectedMapId})</button></div>}</div><label><span>Portal ID</span><input value={selectedPortal.id} onChange={(event) => mutateDocument(selectedMapId, (document) => { document.portals.find((portal) => portal.id === selectedPortal.id)!.id = event.target.value; setSelectedPortalId(event.target.value); })} /></label><NumberField label="Trigger X" value={selectedPortal.trigger.center.x} onChange={(value) => mutateDocument(selectedMapId, (document) => { document.portals.find((portal) => portal.id === selectedPortal.id)!.trigger.center.x = value; })} /><NumberField label="Trigger Z" value={selectedPortal.trigger.center.z} onChange={(value) => mutateDocument(selectedMapId, (document) => { document.portals.find((portal) => portal.id === selectedPortal.id)!.trigger.center.z = value; })} /><NumberField label="Bán kính" value={selectedPortal.trigger.radius} onChange={(value) => mutateDocument(selectedMapId, (document) => { document.portals.find((portal) => portal.id === selectedPortal.id)!.trigger.radius = value; })} /><label><span>Map đích</span><select value={selectedPortal.target.mapId} onChange={(event) => mutateDocument(selectedMapId, (document) => { const portal = document.portals.find((item) => item.id === selectedPortal.id)!; portal.target.mapId = event.target.value; portal.target.entryPointId = documents[event.target.value]?.navigation.entryPoints[0]?.id ?? ""; })}>{flow.document.nodes.map((node) => <option key={node.mapId} value={node.mapId}>{documents[node.mapId]?.metadata.name ?? node.mapId} ({node.mapId})</option>)}</select></label><label><span>Entrypoint đích</span><select value={selectedPortal.target.entryPointId} onChange={(event) => mutateDocument(selectedMapId, (document) => { document.portals.find((portal) => portal.id === selectedPortal.id)!.target.entryPointId = event.target.value; })}>{documents[selectedPortal.target.mapId]?.navigation.entryPoints.map((entry) => <option key={entry.id} value={entry.id}>{entry.id} (X: {entry.position.x.toFixed(1)}, Z: {entry.position.z.toFixed(1)})</option>)}</select></label>{closeEntry ? (
  isCoLocated ? (
    <div className="flow-colocation-badge" role="status">
      <strong>✓ Cổng &amp; Entrypoint &quot;{closeEntry.id}&quot; trùng vị trí chuẩn 2 chiều</strong>
      <p>Cơ chế game: Khi nhân vật vừa tới từ map khác, portal quay lại này sẽ tự động bị bỏ qua cho tới khi nhân vật rời khỏi vùng kích hoạt.</p>
    </div>
  ) : (
    <div className="flow-colocation-actions">
      <p>⚠️ Portal đang gần Entrypoint &quot;{closeEntry.id}&quot; (lệch {closeEntryDist?.toFixed(2)}m). Bạn có thể căn trùng nhau:</p>
      <div className="row">
        <button
          type="button"
          onClick={() => mutateDocument(selectedMapId, (doc) => {
            const p = doc.portals.find((item) => item.id === selectedPortal.id);
            if (p) p.trigger.center = { ...closeEntry.position };
          })}
        >
          🎯 Căn Cổng trùng Entrypoint &quot;{closeEntry.id}&quot;
        </button>
        <button
          type="button"
          onClick={() => mutateDocument(selectedMapId, (doc) => {
            const e = doc.navigation.entryPoints.find((item) => item.id === closeEntry.id);
            if (e) e.position = { ...selectedPortal.trigger.center };
          })}
        >
          📍 Đặt Entrypoint trùng Cổng
        </button>
        <button
          type="button"
          onClick={() => mutateDocument(selectedMapId, (doc) => {
            const p = doc.portals.find((item) => item.id === selectedPortal.id);
            if (p) {
              const offsetCenter = { x: closeEntry.position.x + 2.0, z: closeEntry.position.z + 2.0 };
              p.trigger.center = isPositionValid(doc, offsetCenter) ? offsetCenter : { x: closeEntry.position.x + 1.5, z: closeEntry.position.z };
            }
          })}
        >
          Tách ra (+2.0m)
        </button>
      </div>
    </div>
  )
) : null}<div className="row"><button onClick={() => { mutateDocument(selectedMapId, (document) => { document.portals.filter((portal) => portal.id !== selectedPortal.id); document.portals = document.portals.filter((portal) => portal.id !== selectedPortal.id); }); setSelectedPortalId(null); }}>Xóa portal này</button>{pairedPortal ? <button type="button" onClick={() => deleteBidirectionalPortal(selectedMapId, selectedPortal)}>Xóa cả 2 chiều</button> : null}</div>{onOpenMapPortal ? <button type="button" onClick={() => onOpenMapPortal(selectedMapId, selectedPortal.id)}>🔍 Mở toàn màn hình trên Tab Map</button> : null}</div> : null}</fieldset><fieldset><legend>4. Kéo thả Portal & Entrypoint trên Map</legend><p>Kéo chấm tím để đặt vị trí Trigger của cổng, hoặc kéo chấm xanh để đặt vị trí Entrypoint:</p><FlowMiniMap document={selectedDocument} selectedPortalId={selectedPortalId} onPortalSelect={setSelectedPortalId} onPortalMove={(portalId, point) => { if (isPositionValid(selectedDocument, point)) mutateDocument(selectedMapId, (doc) => { const p = doc.portals.find((item) => item.id === portalId); if (p) { const prev = { ...p.trigger.center }; p.trigger.center = point; const coEntry = doc.navigation.entryPoints.find((e) => Math.hypot(e.position.x - prev.x, e.position.z - prev.z) <= 0.3); if (coEntry) coEntry.position = { ...point }; } }); }} selectedEntryPointId={selectedEntryPointId} onEntryPointSelect={setSelectedEntryPointId} onEntryPointMove={(entryPointId, point) => { if (isPositionValid(selectedDocument, point)) mutateDocument(selectedMapId, (doc) => { const e = doc.navigation.entryPoints.find((item) => item.id === entryPointId); if (e) e.position = point; }); }} /></fieldset></> : null}
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
  const [npcPortraitFile, setNpcPortraitFile] = useState<File | null>(null);
  const [npcId, setNpcId] = useState("");
  const [npcName, setNpcName] = useState("");
  const [npcDialogueChain, setNpcDialogueChain] = useState<MapNpcDialogueStep[]>([{ text: "" }]);
  const [npcScale, setNpcScale] = useState(1);
  const [npcFacing, setNpcFacing] = useState(0);
  const [importing, setImporting] = useState(false);
  const [uploadingPortrait, setUploadingPortrait] = useState(false);
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
  const issuesByGroup = Object.fromEntries((["geometry", "spawn", "entry", "portal", "npc", "map"] as const).map((group) => [group, validationIssues.filter((issue) => issueGroup(issue) === group)])) as Record<ValidationGroup, MapValidationIssue[]>;
  const saveBlocked = drawing || blockingIssues.length > 0;
  const selectedObject = document?.objects.find((object) => object.id === selectedObjectId) ?? null;
  const selectedEntryPoint = document?.navigation.entryPoints.find((entry) => entry.id === selectedEntryPointId) ?? null;
  const selectedPortal = document?.portals.find((portal) => portal.id === selectedPortalId) ?? null;
  const selectedNpc = document?.npcs.find((npc) => npc.id === selectedNpcId) ?? null;
  const selectedPolygon = document?.navigation.walkablePolygons.find((polygon) => polygon.id === selectedPolygonId) ?? null;
  const flowOutOfSync = Boolean(flowPin && envelope && flowPin.mapRevision !== envelope.revision);
  const spawnValid = document ? isPositionValid(document, document.navigation.spawn) : true;
  const nearestSpawn = useMemo(() => document && !spawnValid ? nearestValidPoint(document, document.navigation.spawn) : null, [document, spawnValid]);

  const focusIssue = (issue: MapValidationIssue) => {
    setTab(issue.npcId ? "npc" : "map");
    if (issue.objectId) { setSelectedObjectId(issue.objectId); setSelectedNpcId(null); setViewportMode("overlay"); }
    if (issue.npcId) { setSelectedNpcId(issue.npcId); setSelectedObjectId(null); setViewportMode("overlay"); }
    if (issue.polygonId) { setSelectedPolygonId(issue.polygonId); setViewportMode("overlay"); }
    if (issue.portalId) { setSelectedPortalId(issue.portalId); setViewportMode("overlay"); }
    const entryIndex = issue.path.match(/^navigation\.entryPoints\.(\d+)/)?.[1];
    if (entryIndex !== undefined) {
      setSelectedEntryPointId(document?.navigation.entryPoints[Number(entryIndex)]?.id ?? null);
      setViewportMode("overlay");
    }
    if (issue.code === "INVALID_SPAWN" || issue.path === "navigation.spawn") {
      setViewportMode("overlay");
    }
  };

  const openMap = async (mapId: string) => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const [loaded, loadedFlow] = await Promise.all([
        loadMap(mapId),
        loadMapFlow("vanlang").catch((caught) => {
          if (caught instanceof MapApiError && caught.status === 404) return null;
          throw caught;
        }),
      ]);
      const flowNode = loadedFlow?.document.nodes.find((node) => node.mapId === mapId);
      setEnvelope(loaded);
      setDocument(clone(loaded.document));
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
    const trimmedChain = npcDialogueChain
      .map((step) => ({ ...step, text: step.text.trim(), speaker: step.speaker?.trim() || undefined }))
      .filter((step) => step.text.length > 0);
    if (!npcFile || !npcId || !npcName || trimmedChain.length === 0 || importing) {
      setError("Chọn GLB và nhập đủ NPC ID, tên, hội thoại.");
      return;
    }
    setImporting(true); setError(""); setNotice("");
    try {
      const [asset, portrait] = await Promise.all([importGlb(npcFile), npcPortraitFile ? importImage(npcPortraitFile) : Promise.resolve(null)]);
      if (document?.npcs.some((npc) => npc.id === npcId)) throw new Error("NPC ID đã tồn tại.");
      const safeScale = Math.max(0.01, npcScale);
      mutate((next) => next.npcs.push({
        id: npcId,
        name: npcName,
        dialogue: trimmedChain[0].text,
        dialogueChain: trimmedChain,
        src: asset.src,
        ...(portrait ? { portraitSrc: portrait.src } : {}),
        transform: {
          position: { x: next.navigation.spawn.x, y: next.world.groundY, z: next.navigation.spawn.z },
          rotationDeg: { x: 0, y: npcFacing, z: 0 },
          scale: { x: safeScale, y: safeScale, z: safeScale },
        },
      }));
      setSelectedNpcId(npcId); setSelectedObjectId(null); setViewportMode("3d");
      setNotice(`Đã import và thêm NPC ${npcName}; nhấn Save để tạo revision.`);
      setNpcId("");
      setNpcName("");
      setNpcDialogueChain([{ text: "" }]);
      setNpcPortraitFile(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Import GLB thất bại."); }
    finally { setImporting(false); }
  };
  const uploadPortrait = async (file: File, npcId?: string) => {
    if (uploadingPortrait) return;
    setUploadingPortrait(true); setError(""); setNotice("");
    try {
      const asset = await importImage(file);
      if (npcId) mutateNpc(npcId, (npc) => { npc.portraitSrc = asset.src; });
      else mutate((next) => { next.metadata.playerPortraitSrc = asset.src; });
      setNotice(`Đã tải ảnh đại diện ${npcId ? "NPC" : "người chơi"}; nhấn Lưu map để tạo revision.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Tải ảnh đại diện thất bại."); }
    finally { setUploadingPortrait(false); }
  };
  const deleteNpc = (id: string) => {
    const npc = document?.npcs.find((item) => item.id === id);
    if (!npc || !window.confirm(`Xóa NPC “${npc.name}” khỏi map?`)) return;
    mutate((next) => { next.npcs = next.npcs.filter((item) => item.id !== id); });
    setSelectedNpcId((current) => current === id ? null : current);
    setNotice(`Đã xóa NPC ${npc.name}; nhấn Lưu map để tạo revision.`);
  };
  const confirmDiscard = () => (!dirty && !flowDirty) || window.confirm("Map Flow có thay đổi chưa lưu. Bạn có muốn bỏ thay đổi?");
  const selectMap = (mapId: string) => { if (!confirmDiscard()) return; void openMap(mapId); };
  const save = async () => {
    if (!document || !envelope || saveInFlight.current || (!dirty && !flowOutOfSync)) return;
    setError(""); setNotice("");
    if (drawing) { setError("Polygon đang vẽ chưa được đóng."); return; }
    const sourceCanonical = canonicalStringify(document);
    const { repaired, adjustedEntryPointIds, adjustedPortalIds, adjustedSpawn } = prepareDocumentForSave(document);
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
      const adjustedSpawnNotice = adjustedSpawn ? " Đã tự đưa spawn point vào vị trí hợp lệ gần nhất." : "";
      const adjustedEntriesNotice = adjustedEntryPointIds.length ? ` Đã tự đưa entry point ${adjustedEntryPointIds.join(", ")} vào vị trí hợp lệ gần nhất.` : "";
      const adjustedPortalsNotice = adjustedPortalIds.length ? ` Đã tự đưa portal ${adjustedPortalIds.join(", ")} vào vị trí hợp lệ gần nhất.` : "";
      setNotice((savedFlowRevision ? `Đã lưu map r${saved.revision} và đồng bộ Map Flow r${savedFlowRevision}.` : `Đã lưu revision ${saved.revision}.`) + adjustedSpawnNotice + adjustedEntriesNotice + adjustedPortalsNotice);
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
    <main id="noi-dung-chinh" className={`map-editor-shell${tab === "npc" && selectedNpc ? " has-npc-inspector" : ""}`}>
      <header><div><p>Admin · Editor Mode</p><h1>Map Editor</h1></div><nav className="editor-tabs" aria-label="Editor tabs"><button className={tab === "map" ? "active" : ""} onClick={() => setTab("map")}>Map</button><button className={tab === "npc" ? "active" : ""} onClick={() => setTab("npc")}>NPC</button><button className={tab === "flow" ? "active" : ""} onClick={() => setTab("flow")}>Map Flow</button></nav>{tab !== "flow" ? <><button type="button" className="create-map-button" onClick={() => setTab("flow")}>+ Tạo map mới</button><label>Map<select value={document.mapId} onChange={(event) => selectMap(event.target.value)}>{maps.map((map) => <option key={map.mapId} value={map.mapId}>{map.name} · r{map.activeRevision}</option>)}</select></label><div className="header-save-controls"><span className={blockingIssues.length ? "invalid" : dirty || flowOutOfSync ? "dirty" : ""}>{blockingIssues.length ? `${blockingIssues.length} lỗi chặn lưu` : dirty ? "Chưa lưu" : flowOutOfSync ? `Flow đang ở r${flowPin?.mapRevision}` : `Revision ${envelope.revision}`}</span><button type="button" className="header-save-button" disabled={!WRITE_ENABLED || saving || saveBlocked || (!dirty && !flowOutOfSync)} title={saveBlocked ? drawing ? "Đóng hoặc hủy polygon đang vẽ trước khi lưu." : "Sửa các lỗi validation trước khi lưu." : undefined} aria-busy={saving} onClick={save}>{saving ? "Đang lưu…" : flowOutOfSync && !dirty ? "Đồng bộ Flow" : "Lưu map"}</button></div></> : null}<Link href="/" onClick={(event) => { if (!confirmDiscard()) event.preventDefault(); }}>Về game</Link></header>
      {tab === "flow" ? <MapFlowPanel onDirtyChange={setFlowDirty} onMapCreated={(created) => { setMaps((current) => [...current, { mapId: created.mapId, name: created.document.metadata.name, description: created.document.metadata.description, activeRevision: created.revision, updatedAt: created.activatedAt }]); setEnvelope(created); setDocument(clone(created.document)); setSelectedEntryPointId(created.document.navigation.entryPoints[0]?.id ?? null); }} onOpenMapPortal={(mapId, portalId) => { void openMap(mapId); setSelectedPortalId(portalId); setTab("map"); }} /> : <><aside className={tab === "npc" ? "npc-sidebar" : "map-sidebar"}>
        {tab === "npc" ? <div className="npc-tab-panel">
          <section className="editor-section npc-player-portrait"><h2>Ảnh người chơi</h2><label><span>Chọn PNG, JPEG hoặc WebP</span><input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploadingPortrait} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadPortrait(file); event.currentTarget.value = ""; }} /></label>{document.metadata.playerPortraitSrc ? <div className="portrait-preview"><Image src={document.metadata.playerPortraitSrc} alt="Ảnh đại diện người chơi" width={160} height={160} /><button type="button" onClick={() => mutate((next) => { delete next.metadata.playerPortraitSrc; })}>Gỡ ảnh</button></div> : <small>Ảnh này xuất hiện khi lượt thoại thuộc về Người chơi.</small>}</section>
          <section className="editor-section"><h2>NPC trong map <span className="npc-count">{document.npcs.length}</span></h2><div className="npc-list">{document.npcs.length ? document.npcs.map((npc) => <div className={`npc-list-item${npc.id === selectedNpcId ? " active" : ""}`} key={npc.id}><button type="button" className="npc-select-button" onClick={() => { setSelectedNpcId(npc.id); setSelectedObjectId(null); setViewportMode("overlay"); }}><span>{npc.name}</span><small>{npc.id}</small></button><button type="button" className="npc-delete-button" aria-label={`Xóa NPC ${npc.name}`} onClick={() => deleteNpc(npc.id)}>Xóa</button></div>) : <p>Map chưa có NPC.</p>}</div></section>
          <details open><summary>+ Thêm NPC</summary><div className="editor-section"><label><span>GLB</span><input aria-label="NPC GLB" type="file" accept=".glb,model/gltf-binary" onChange={(event) => setNpcFile(event.target.files?.[0] ?? null)} /></label><label><span>Ảnh đại diện (không bắt buộc)</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setNpcPortraitFile(event.target.files?.[0] ?? null)} /></label><label><span>NPC ID</span><input value={npcId} onChange={(event) => setNpcId(event.target.value)} /></label><label><span>Tên</span><input value={npcName} onChange={(event) => setNpcName(event.target.value)} /></label><NpcDialogueChainEditor chain={npcDialogueChain} onChange={setNpcDialogueChain} defaultSpeaker={npcName} /><NumberField label="Scale" value={npcScale} step={0.1} min={0.01} onChange={(value) => setNpcScale(Math.max(0.01, value))} /><NumberField label="Facing°" value={npcFacing} step={5} onChange={setNpcFacing} /><button type="button" disabled={!WRITE_ENABLED || importing} onClick={() => void importNpc()}>{importing ? "Đang import…" : "Import và thêm NPC"}</button></div></details>
        </div> : null}
        <section className={`editor-validation-summary ${saveBlocked ? "has-errors" : validationIssues.length ? "has-warnings" : "is-valid"}`} aria-live="polite" aria-atomic="false">
          <div><strong>{drawing ? "Polygon chưa đóng đang chặn lưu" : blockingIssues.length ? `${blockingIssues.length} lỗi đang chặn lưu` : validationIssues.length ? `${validationIssues.length} cảnh báo sẽ được tự căn khi lưu` : "Map hợp lệ, sẵn sàng lưu"}</strong>{repairableIssues.length ? <small>Entry point, spawn hoặc portal ngoài vùng hợp lệ sẽ được đưa về điểm gần nhất.</small> : null}</div>
          {validationIssues.length ? <ul>{validationIssues.map((issue, index) => <li key={`${issueKey(issue)}-${index}`}><button type="button" onClick={() => focusIssue(issue)}><span>{issueGroup(issue) === "geometry" ? "Vùng / Collider" : issueGroup(issue) === "spawn" ? "Spawn point" : issueGroup(issue) === "entry" ? "Entry point" : issueGroup(issue) === "portal" ? "Portal" : issueGroup(issue) === "npc" ? "NPC" : "Map"}</span>{issue.message}</button></li>)}</ul> : null}
          {drawing ? <p>Polygon đang vẽ chưa được đóng. Đóng hoặc hủy polygon để có thể lưu.</p> : null}
        </section>
        <details><summary>Assets</summary><div className="editor-section">{ASSETS.map((asset) => <button key={asset.src + asset.kind} onClick={() => mutate((next) => { const object = createObject(next, asset); next.objects.push(object); setSelectedObjectId(object.id); setSelectedNpcId(null); })}>+ {asset.name}</button>)}</div></details>
        <details open><summary>Scene Objects</summary><div className="editor-section object-list">{document.objects.map((object) => <button className={object.id === selectedObjectId ? "active" : ""} key={object.id} onClick={() => setSelectedObjectId(object.id)}>{object.name} <small>{object.kind}</small></button>)}<div className="row"><button disabled={!selectedObject} onClick={() => selectedObject && mutate((next) => { const copy = clone(selectedObject); copy.id = `${copy.id}-copy-${Date.now().toString(36)}`; copy.name += " bản sao"; delete copy.binding; next.objects.push(copy); setSelectedObjectId(copy.id); })}>Duplicate</button><button disabled={!selectedObject} onClick={() => mutate((next) => { next.objects = next.objects.filter((item) => item.id !== selectedObjectId); setSelectedObjectId(null); })}>Delete</button></div></div></details>
        <details open><summary>Entry points</summary><div className="editor-section object-list">{document.navigation.entryPoints.map((entry) => <button type="button" className={entry.id === selectedEntryPointId ? "active" : ""} key={entry.id} onClick={() => { setSelectedEntryPointId(entry.id); setViewportMode("overlay"); }}>{entry.id} <small>{entry.position.x.toFixed(1)}, {entry.position.z.toFixed(1)}</small></button>)}<div className="row"><button type="button" onClick={() => mutate((next) => { let suffix = next.navigation.entryPoints.length + 1; while (next.navigation.entryPoints.some((entry) => entry.id === `entry-${suffix}`)) suffix += 1; const id = `entry-${suffix}`; next.navigation.entryPoints.push({ id, position: { ...next.navigation.spawn }, facingDeg: 0 }); setSelectedEntryPointId(id); })}>+ Entry point</button><button type="button" disabled={!selectedEntryPoint || document.navigation.entryPoints.length === 1} onClick={() => mutate((next) => { next.navigation.entryPoints = next.navigation.entryPoints.filter((entry) => entry.id !== selectedEntryPointId); setSelectedEntryPointId(next.navigation.entryPoints[0]?.id ?? null); })}>Delete</button></div>{selectedEntryPoint ? <><label><span>ID dùng trong Map Flow</span><input value={selectedEntryPoint.id} onChange={(event) => { const id = event.target.value; mutate((next) => { const entry = next.navigation.entryPoints.find((item) => item.id === selectedEntryPoint.id); if (!entry) return; const previousId = entry.id; entry.id = id; for (const portal of next.portals) if (portal.target.mapId === next.mapId && portal.target.entryPointId === previousId) portal.target.entryPointId = id; }); setSelectedEntryPointId(id); }} /></label><NumberField label="Position X" value={selectedEntryPoint.position.x} onChange={(value) => mutate((next) => { const entry = next.navigation.entryPoints.find((item) => item.id === selectedEntryPoint.id); if (entry) entry.position.x = value; })} /><NumberField label="Position Z" value={selectedEntryPoint.position.z} onChange={(value) => mutate((next) => { const entry = next.navigation.entryPoints.find((item) => item.id === selectedEntryPoint.id); if (entry) entry.position.z = value; })} /><NumberField label="Facing°" value={selectedEntryPoint.facingDeg} onChange={(value) => mutate((next) => { const entry = next.navigation.entryPoints.find((item) => item.id === selectedEntryPoint.id); if (entry) entry.facingDeg = value; })} /><button type="button" disabled={!selectedObject} onClick={setEntryPointFromSelectedObject}>Lấy vị trí từ object đang chọn</button><button type="button" disabled={!selectedPortal} onClick={() => selectedPortal && mutate((next) => { const entry = next.navigation.entryPoints.find((item) => item.id === selectedEntryPoint.id); if (entry) entry.position = { ...selectedPortal.trigger.center }; })}>🎯 Căn trùng Portal đang chọn {selectedPortal ? `(${selectedPortal.id})` : ""}</button><small>Portal trong Map Flow sẽ teleport người chơi tới đúng ID, tọa độ và hướng này.</small></> : null}</div></details>
        <details open><summary>Portal points</summary><div className="editor-section object-list">{document.portals.length ? document.portals.map((portal) => { const targetName = maps.find((m) => m.mapId === portal.target.mapId)?.name || portal.target.mapId; return <button type="button" className={`portal-list-btn${portal.id === selectedPortalId ? " active" : ""}`} key={portal.id} onClick={() => { setSelectedPortalId(portal.id); setViewportMode("2d"); }}><strong>{portal.id}</strong><small>➔ {targetName} ({portal.target.entryPointId})</small></button>; }) : <p>Map này chưa có portal. Tạo kết nối trong tab Map Flow trước.</p>}<button type="button" onClick={() => setTab("flow")}>Mở Map Flow để tạo portal</button>{selectedPortal ? <><label><span>Kích hoạt</span><input type="checkbox" checked={selectedPortal.enabled} onChange={(event) => mutate((next) => { const portal = next.portals.find((item) => item.id === selectedPortal.id); if (portal) portal.enabled = event.target.checked; })} /></label><NumberField label="Portal X" value={selectedPortal.trigger.center.x} onChange={(value) => mutate((next) => { const portal = next.portals.find((item) => item.id === selectedPortal.id); if (portal) portal.trigger.center.x = value; })} /><NumberField label="Portal Z" value={selectedPortal.trigger.center.z} onChange={(value) => mutate((next) => { const portal = next.portals.find((item) => item.id === selectedPortal.id); if (portal) portal.trigger.center.z = value; })} /><NumberField label="Bán kính trigger" value={selectedPortal.trigger.radius} onChange={(value) => mutate((next) => { const portal = next.portals.find((item) => item.id === selectedPortal.id); if (portal) portal.trigger.radius = value; })} /><div className="row"><button type="button" onClick={() => mutate((next) => { const portal = next.portals.find((item) => item.id === selectedPortal.id); if (portal) portal.trigger.center = { ...next.navigation.spawn }; })}>Đặt tại spawn</button><button type="button" disabled={!selectedEntryPoint} onClick={() => selectedEntryPoint && mutate((next) => { const portal = next.portals.find((item) => item.id === selectedPortal.id); if (portal) portal.trigger.center = { ...selectedEntryPoint.position }; })}>🎯 Căn trùng Entrypoint {selectedEntryPoint ? `(${selectedEntryPoint.id})` : ""}</button></div><small>Vòng tím trên viewport là vùng nhân vật bước vào để teleport tới {selectedPortal.target.mapId}/{selectedPortal.target.entryPointId}.</small></> : null}</div></details>
        {selectedObject ? <details open><summary>Transform</summary><div className="editor-section"><label><span>Tên</span><input value={selectedObject.name} onChange={(event) => mutateObject((object) => { object.name = event.target.value; })} /></label>{selectedObject.kind === "model3d" ? (["x", "y", "z"] as const).flatMap((axis) => [<NumberField key={`p${axis}`} label={`Position ${axis.toUpperCase()}`} value={selectedObject.transform3d.position[axis]} onChange={(value) => mutateObject((object) => { if (object.kind === "model3d") object.transform3d.position[axis] = value; })} />, <NumberField key={`r${axis}`} label={`Rotation ${axis.toUpperCase()}°`} value={selectedObject.transform3d.rotationDeg[axis]} onChange={(value) => mutateObject((object) => { if (object.kind === "model3d") object.transform3d.rotationDeg[axis] = value; })} />, <NumberField key={`s${axis}`} label={`Scale ${axis.toUpperCase()}`} value={selectedObject.transform3d.scale[axis]} onChange={(value) => mutateObject((object) => { if (object.kind === "model3d") object.transform3d.scale[axis] = value; })} />]) : <>{(["x", "y"] as const).map((axis) => <NumberField key={`p${axis}`} label={`Position ${axis.toUpperCase()}`} value={selectedObject.transform2d.position[axis]} onChange={(value) => mutateObject((object) => { if (object.kind === "sprite2d") object.transform2d.position[axis] = value; })} />)}<NumberField label="Width" value={selectedObject.transform2d.size.width} onChange={(value) => mutateObject((object) => { if (object.kind === "sprite2d") object.transform2d.size.width = value; })} /><NumberField label="Height" value={selectedObject.transform2d.size.height} onChange={(value) => mutateObject((object) => { if (object.kind === "sprite2d") object.transform2d.size.height = value; })} />{(["x", "y"] as const).map((axis) => <NumberField key={`a${axis}`} label={`Anchor ${axis.toUpperCase()}`} value={selectedObject.transform2d.anchor[axis]} onChange={(value) => mutateObject((object) => { if (object.kind === "sprite2d") object.transform2d.anchor[axis] = value; })} />)}<NumberField label="Rotation°" value={selectedObject.transform2d.rotationDeg} onChange={(value) => mutateObject((object) => { if (object.kind === "sprite2d") object.transform2d.rotationDeg = value; })} />{(["x", "y"] as const).map((axis) => <NumberField key={`s${axis}`} label={`Scale ${axis.toUpperCase()}`} value={selectedObject.transform2d.scale[axis]} onChange={(value) => mutateObject((object) => { if (object.kind === "sprite2d") object.transform2d.scale[axis] = value; })} />)}</>}<label><span>Collider</span><select value={selectedObject.collider.type} onChange={(event) => setCollider(event.target.value as Collider["type"])}>{["none", "circle", "rectangle", "polygon"].map((type) => <option key={type}>{type}</option>)}</select></label>{selectedObject.collider.type === "circle" ? <NumberField label="Radius" value={selectedObject.collider.radius} onChange={(value) => mutateObject((object) => { if (object.collider.type === "circle") object.collider.radius = value; })} /> : null}{selectedObject.collider.type === "rectangle" ? <><NumberField label="Width collider" value={selectedObject.collider.width} onChange={(value) => mutateObject((object) => { if (object.collider.type === "rectangle") object.collider.width = value; })} /><NumberField label="Depth collider" value={selectedObject.collider.depth} onChange={(value) => mutateObject((object) => { if (object.collider.type === "rectangle") object.collider.depth = value; })} /><NumberField label="Local rotation°" value={selectedObject.collider.rotationDeg ?? 0} onChange={(value) => mutateObject((object) => { if (object.collider.type === "rectangle") object.collider.rotationDeg = value; })} /></> : null}</div></details> : null}
        <details open><summary>Walkable Area</summary><div className="editor-section"><div className="row"><button disabled={drawing} onClick={() => { setDraftPoints([]); setDrawing(true); setViewportMode("2d"); }}>Vẽ vùng mới</button><button disabled={!drawing || draftPoints.length < 3} onClick={closeDraft}>Đóng polygon</button><button disabled={!drawing} onClick={() => { setDraftPoints([]); setDrawing(false); }}>Hủy</button></div><button onClick={createQuickRectangle}>Tạo chữ nhật quanh spawn</button><select value={selectedPolygonId ?? ""} onChange={(event) => setSelectedPolygonId(event.target.value)}>{document.navigation.walkablePolygons.map((polygon) => <option key={polygon.id} value={polygon.id}>{polygon.id}</option>)}</select>{selectedPolygon ? <div className="point-list">{selectedPolygon.points.map((point, index) => <div className="walkable-point-row" key={index}><NumberField label={`#${index + 1} X`} value={point.x} onChange={(value) => mutate((next) => { const polygon = next.navigation.walkablePolygons.find((item) => item.id === selectedPolygon.id); if (polygon) polygon.points[index].x = value; })} /><NumberField label="Z" value={point.z} onChange={(value) => mutate((next) => { const polygon = next.navigation.walkablePolygons.find((item) => item.id === selectedPolygon.id); if (polygon) polygon.points[index].z = value; })} /><button aria-label={`Xóa point ${index + 1}`} disabled={selectedPolygon.points.length <= 3} onClick={() => mutate((next) => { const polygon = next.navigation.walkablePolygons.find((item) => item.id === selectedPolygon.id); if (polygon && polygon.points.length > 3) polygon.points.splice(index, 1); })}>Xóa</button></div>)}<button onClick={() => mutate((next) => { const polygon = next.navigation.walkablePolygons.find((item) => item.id === selectedPolygon.id); if (!polygon) return; const a = polygon.points.at(-1)!; const b = polygon.points[0]; polygon.points.push({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }); })}>+ Thêm vector point</button></div> : null}</div></details>
        <details open><summary>Map Settings / Save</summary><div className="editor-section"><label><span>Tên map</span><input value={document.metadata.name} onChange={(event) => mutate((next) => { next.metadata.name = event.target.value; })} /></label><label><span>Mô tả</span><textarea value={document.metadata.description} onChange={(event) => mutate((next) => { next.metadata.description = event.target.value; })} /></label><NumberField label="Spawn X" value={document.navigation.spawn.x} onChange={(value) => mutate((next) => { next.navigation.spawn.x = value; })} /><NumberField label="Spawn Z" value={document.navigation.spawn.z} onChange={(value) => mutate((next) => { next.navigation.spawn.z = value; })} /><NumberField label="Hướng nhìn khi spawn (°)" value={document.navigation.spawnFacingDeg} step={5} onChange={(value) => mutate((next) => { next.navigation.spawnFacingDeg = value; })} /><small>Hướng này được áp dụng khi nhân vật xuất hiện tại Spawn Point; đường trên marker spawn thể hiện hướng đang chọn.</small><div className={`spawn-status-banner ${spawnValid ? "is-valid" : "is-invalid"}`} role={spawnValid ? "status" : "alert"}><strong>{spawnValid ? "✓ Vị trí spawn hợp lệ" : "⚠️ Vị trí spawn không hợp lệ"}</strong><p>{spawnValid ? `Tọa độ (${document.navigation.spawn.x.toFixed(1)}, ${document.navigation.spawn.z.toFixed(1)}) nằm an toàn trong vùng đi lại (cách mép và vật cản tối thiểu ${document.navigation.playerRadius}m).` : `Tọa độ (${document.navigation.spawn.x.toFixed(1)}, ${document.navigation.spawn.z.toFixed(1)}) không hợp lệ. Vị trí cho phép: phải nằm hoàn toàn trong vùng Walkable (xanh lá) và cách vật cản (đỏ) / mép tối thiểu ${document.navigation.playerRadius}m.`}</p>{!spawnValid && nearestSpawn ? <div className="spawn-repair-action"><small>Gợi ý điểm hợp lệ gần nhất: X={nearestSpawn.x.toFixed(2)}, Z={nearestSpawn.z.toFixed(2)}</small><button type="button" className="spawn-snap-button" onClick={() => mutate((next) => { next.navigation.spawn = { ...nearestSpawn }; })}>Đưa về vị trí hợp lệ gần nhất</button></div> : null}</div><label><span>Background</span><input value={document.background.src} onChange={(event) => mutate((next) => { next.background.src = event.target.value; })} /></label><label><span>Màu fallback</span><input value={document.background.color} onChange={(event) => mutate((next) => { next.background.color = event.target.value; })} /></label><div className="save-row"><span className={dirty || flowOutOfSync ? "dirty" : ""}>{dirty ? "Chưa lưu" : flowOutOfSync ? `Map Flow đang pin r${flowPin?.mapRevision}, active là r${envelope.revision}` : `Revision ${envelope.revision} đã đồng bộ`}</span><button disabled={!WRITE_ENABLED || saving || (!dirty && !flowOutOfSync)} onClick={save}>{saving ? "Đang lưu…" : flowOutOfSync && !dirty ? "Đồng bộ Flow" : "Save"}</button><button disabled={!dirty} onClick={() => { setDocument(clone(envelope.document)); setDraftPoints([]); setDrawing(false); }}>Reset</button></div>{!WRITE_ENABLED ? <small>Save đang tắt bởi NEXT_PUBLIC_MAP_EDITOR_WRITE_ENABLED.</small> : null}</div></details>
        {selectedObject ? <details open><summary>Collider Details</summary><div className="editor-section"><ColliderFields object={selectedObject} mutateObject={mutateObject} setCollider={setCollider} /></div></details> : null}
      </aside>
      <MapViewport key={document.mapId} document={document} mode={viewportMode} onModeChange={setViewportMode} polygonId={selectedPolygonId} onPolygonSelect={setSelectedPolygonId} drawing={drawing} draft={draftPoints} onDraftPoint={(point) => drawing && setDraftPoints((current) => [...current, point])} onPointInsert={(polygonId, index, point) => mutate((next) => { const polygon = next.navigation.walkablePolygons.find((item) => item.id === polygonId); if (polygon) polygon.points.splice(index, 0, point); })} onPointMove={(polygonId, index, point) => mutate((next) => { const polygon = next.navigation.walkablePolygons.find((item) => item.id === polygonId); if (polygon) polygon.points[index] = point; })} selectedEntryPointId={selectedEntryPointId} onEntryPointSelect={setSelectedEntryPointId} onEntryPointMove={(entryPointId, point) => { if (isPositionValid(document, point)) mutate((next) => { const entryPoint = next.navigation.entryPoints.find((item) => item.id === entryPointId); if (entryPoint) entryPoint.position = point; }); }} selectedPortalId={selectedPortalId} onPortalSelect={setSelectedPortalId} onPortalMove={(portalId, point) => { if (isPositionValid(document, point)) mutate((next) => { const portal = next.portals.find((item) => item.id === portalId); if (portal) { const prev = { ...portal.trigger.center }; portal.trigger.center = point; const coEntry = next.navigation.entryPoints.find((e) => Math.hypot(e.position.x - prev.x, e.position.z - prev.z) <= 0.3); if (coEntry) coEntry.position = { ...point }; } }); }} selectedNpcId={selectedNpcId} onNpcSelect={(id) => { setSelectedNpcId(id); setSelectedObjectId(null); }} onNpcMove={(id, position) => { if (isPositionValid(document, { x: position.x, z: position.z }, 0)) mutateNpc(id, (npc) => { npc.transform.position = position; }); }} onSpawnMove={(point) => { if (isPositionValid(document, point)) mutate((next) => { next.navigation.spawn = point; }); }} /></>}
      <footer>{error ? <p role="alert">{error}</p> : null}{notice ? <p role="status">{notice}</p> : null}{!error && !notice ? <p role="status">{blockingIssues.length ? "Map chưa thể lưu. Chọn một cảnh báo trong inspector để sửa." : repairableIssues.length ? "Map có cảnh báo vị trí; các điểm này sẽ được tự căn khi lưu." : "Không có lỗi validation."}</p> : null}</footer>
      {tab === "npc" && selectedNpc ? <aside aria-label="NPC Inspector"><NpcFields npc={selectedNpc} document={document} issues={issuesByGroup.npc.filter((issue) => issue.npcId === selectedNpc.id)} mutateNpc={(recipe) => mutateNpc(selectedNpc.id, recipe)} uploadingPortrait={uploadingPortrait} onPortraitUpload={(file) => void uploadPortrait(file, selectedNpc.id)} /></aside> : null}
    </main>
  );
}
