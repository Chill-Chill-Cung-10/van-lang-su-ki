"use client";

import {
  canonicalStringify,
  colliderFootprint,
  validateMapDocument,
  type Collider,
  type DirectedPortal,
  type MapDocument,
  type MapFlowEnvelope,
  type MapObject,
  type MapRevisionEnvelope,
  type MapSummary,
  type Vec2,
} from "@van-lang/map-contract";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { cloneFlowMap, listMaps, loadFlowMap, loadMap, loadMapFlow, MapApiError, saveMap, saveMapFlow } from "../../_lib/map-api-client";

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

function MapViewport({ document, mode, onModeChange, polygonId, onPolygonSelect, onPointMove, onPointInsert, drawing, draft, onDraftPoint }: {
  document: MapDocument; mode: ViewportMode; onModeChange: (mode: ViewportMode) => void;
  polygonId: string | null; onPolygonSelect: (polygonId: string) => void;
  onPointMove: (polygonId: string, index: number, point: Vec2) => void;
  onPointInsert: (polygonId: string, index: number, point: Vec2) => void;
  drawing: boolean; draft: Vec2[]; onDraftPoint: (point: Vec2) => void;
}) {
  const [dragging, setDragging] = useState<{ polygonId: string; index: number } | null>(null);
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
  return (
    <section className={`map-viewport is-${mode}`} aria-label={mode === "2d" ? "Map viewport 2D" : mode === "overlay" ? "Map viewport Overlay" : "Map viewport 3D"}>
      <div className="viewport-mode-switch" role="group" aria-label="Chế độ xem viewport">
        <button type="button" className={mode === "2d" ? "active" : ""} aria-pressed={mode === "2d"} onClick={() => onModeChange("2d")}>2D chỉnh vùng</button>
        <button type="button" className={mode === "3d" ? "active" : ""} aria-pressed={mode === "3d"} onClick={() => { setPreviewReady(false); onModeChange("3d"); }}>3D góc người chơi</button>
        <button type="button" className={mode === "overlay" ? "active" : ""} aria-pressed={mode === "overlay"} onClick={() => { setPreviewReady(false); onModeChange("overlay"); }}>Overlay vùng</button>
      </div>
      {mode === "2d" ? <>
        <Image unoptimized fill src={document.background.src} alt={document.background.alt} style={{ objectFit: document.background.fit }} />
        {document.objects.filter((object): object is Extract<MapObject, { kind: "sprite2d" }> => object.kind === "sprite2d" && object.enabled).map((object) => <Image unoptimized width={1} height={1} className="viewport-sprite" key={object.id} src={object.src} alt={object.alt} style={{ left: `${object.transform2d.position.x * 100}%`, top: `${object.transform2d.position.y * 100}%`, width: `${object.transform2d.size.width * 100}%`, height: `${object.transform2d.size.height * 100}%`, transform: `translate(${-object.transform2d.anchor.x * 100}%, ${-object.transform2d.anchor.y * 100}%) rotate(${object.transform2d.rotationDeg}deg) scale(${object.transform2d.scale.x}, ${object.transform2d.scale.y})` }} />)}
        <svg className={drawing ? "is-drawing" : ""} viewBox="0 0 1000 1000" onPointerMove={(event) => dragging && onPointMove(dragging.polygonId, dragging.index, fromPointer(event))} onPointerUp={() => setDragging(null)} onClick={(event) => { if (drawing) onDraftPoint(fromPointer(event)); }}>
          {document.navigation.walkablePolygons.filter((polygon) => polygon.enabled).map((polygon) => (
            <g key={polygon.id} className={polygon.id === polygonId ? "selected" : ""} onClick={(event) => { if (!drawing) { event.stopPropagation(); onPolygonSelect(polygon.id); } }}>
              <polygon className="walkable-shape" points={polygon.points.map((point) => { const item = toCanvas(point); return `${item.x},${item.y}`; }).join(" ")} />
              {polygon.points.map((point, index) => { const item = toCanvas(point); return <circle className="point-handle" key={index} cx={item.x} cy={item.y} r="10" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); onPolygonSelect(polygon.id); setDragging({ polygonId: polygon.id, index }); }} />; })}
              {polygon.id === polygonId && !drawing ? polygon.points.map((point, index) => { const next = polygon.points[(index + 1) % polygon.points.length]; const item = toCanvas({ x: (point.x + next.x) / 2, z: (point.z + next.z) / 2 }); return <circle className="insert-handle" key={`insert-${index}`} cx={item.x} cy={item.y} r="7" onClick={(event) => { event.stopPropagation(); onPointInsert(polygon.id, index + 1, { x: (point.x + next.x) / 2, z: (point.z + next.z) / 2 }); }} />; }) : null}
            </g>
          ))}
          {draft.length ? <polyline className="draft" points={draft.map((point) => { const item = toCanvas(point); return `${item.x},${item.y}`; }).join(" ")} /> : null}
          {footprints.map(({ id, footprint }) => footprint?.type === "circle" ? (() => { const center = toCanvas(footprint.center); return <circle className="collider" key={id} cx={center.x} cy={center.y} r={footprint.radius / 12 * 1000} />; })() : footprint?.type === "polygon" ? <polygon className="collider" key={id} points={footprint.points.map((point) => { const item = toCanvas(point); return `${item.x},${item.y}`; }).join(" ")} /> : null)}
        </svg>
        <p>{drawing ? "Click trên viewport để đặt điểm; đủ 3 điểm thì đóng polygon." : "Click polygon để chọn. Kéo nút lớn để di chuyển; click nút nhỏ giữa cạnh để chèn điểm."}</p>
      </> : <div className="viewport-3d">
        <Image unoptimized fill className="viewport-3d-background" src={document.background.src} alt="" aria-hidden="true" style={{ objectFit: document.background.fit }} />
        <DungeonPreview key={mode} mapDocument={document} playerPos={{ x: document.navigation.spawn.x, y: document.navigation.spawn.z }} facing={0} isMoving={false} onSceneReady={markPreviewReady} editorOverlay={mode === "overlay" ? { selectedPolygonId: polygonId, onPolygonSelect, onPointMove, onPointInsert } : undefined} />
        {previewReady
          ? <p role="status">{mode === "overlay" ? "Overlay đã sẵn sàng: kéo điểm lớn để chỉnh vùng, click điểm nhỏ để chèn; xanh là walkable, vàng là vùng đang chọn, đỏ là collider." : "Preview 3D đã sẵn sàng. Camera, GLB và transform đang dùng đúng cấu hình runtime."}</p>
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
  const [cloneId, setCloneId] = useState("");
  const [cloneName, setCloneName] = useState("");

  const dirtyMaps = useMemo(() => Object.keys(documents).filter((mapId) => envelopes[mapId] && canonicalStringify(documents[mapId]) !== canonicalStringify(envelopes[mapId].document)), [documents, envelopes]);
  const layoutDirty = Boolean(flow && flow.document.nodes.some((node) => canonicalStringify(node.position) !== canonicalStringify(positions[node.mapId])));
  const dirty = layoutDirty || dirtyMaps.length > 0;
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

  const connect = (targetMapId: string) => {
    if (!linkSource || linkSource === targetMapId || !documents[linkSource] || !documents[targetMapId]) { setLinkSource(null); return; }
    const targetEntry = documents[targetMapId].navigation.entryPoints[0];
    if (!targetEntry) return;
    mutateDocument(linkSource, (document) => {
      let suffix = 1;
      while (document.portals.some((portal) => portal.id === `portal-${targetMapId}-${suffix}`)) suffix += 1;
      const portal: DirectedPortal = { id: `portal-${targetMapId}-${suffix}`, enabled: true, trigger: { type: "circle", center: { ...document.navigation.spawn }, radius: 0.8 }, target: { mapId: targetMapId, entryPointId: targetEntry.id } };
      document.portals.push(portal);
      setSelectedMapId(linkSource);
      setSelectedPortalId(portal.id);
    });
    setLinkSource(null);
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

  const createClone = async () => {
    if (!flow || !selectedMapId || !cloneId || !cloneName || dirty) { if (dirty) setError("Hãy Save Flow trước khi clone map."); return; }
    setSaving(true); setError("");
    try {
      const created = await cloneFlowMap(flow.flowId, { sourceMapId: selectedMapId, mapId: cloneId, metadata: { name: cloneName, description: documents[selectedMapId].metadata.description }, nodePosition: { x: 0.75, y: 0.5 }, expectedSourceMapEtag: envelopes[selectedMapId].etag }, flow.etag);
      setFlow(created.flow);
      setPositions((current) => ({ ...current, [created.map.mapId]: { x: 0.75, y: 0.5 } }));
      setEnvelopes((current) => ({ ...current, [created.map.mapId]: created.map }));
      setDocuments((current) => ({ ...current, [created.map.mapId]: clone(created.map.document) }));
      setSelectedMapId(created.map.mapId); setCloneId(""); setCloneName(""); onMapCreated(created.map);
      setNotice(`Đã clone ${created.map.mapId} revision 1 và switch sang map mới.`);
    } catch (caught) { if (caught instanceof MapApiError && caught.code === "MAP_ALREADY_EXISTS") await hydrate(); setError(caught instanceof Error ? caught.message : "Clone map thất bại."); }
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
        {flow.document.nodes.map((node) => <article key={node.mapId} className={`map-flow-node${selectedMapId === node.mapId ? " selected" : ""}`} style={{ left: `${positions[node.mapId]?.x * 100}%`, top: `${positions[node.mapId]?.y * 100}%` }} onPointerDown={(event) => { if ((event.target as HTMLElement).closest("button")) return; setDragging(node.mapId); setSelectedMapId(node.mapId); }}>
          <button className="flow-input" aria-label={`Input ${node.mapId}`} onPointerUp={() => connect(node.mapId)} onClick={() => connect(node.mapId)} />
          <button className="flow-node-body" onClick={() => setSelectedMapId(node.mapId)}><strong>{documents[node.mapId]?.metadata.name ?? node.mapId}</strong><small>{node.mapId} · r{node.mapRevision}</small></button>
          <button className="flow-output" aria-label={`Output ${node.mapId}`} aria-pressed={linkSource === node.mapId} onPointerDown={() => setLinkSource(node.mapId)} onClick={() => setLinkSource(node.mapId)} />
        </article>)}
        {linkSource ? <p className="flow-link-hint">Chọn input của map đích để tạo portal một chiều.</p> : null}
      </div>
      <aside className="map-flow-inspector">
        <h2>Flow Inspector</h2>
        <label><span>Map đang chọn</span><select value={selectedMapId} onChange={(event) => { setSelectedMapId(event.target.value); setSelectedPortalId(null); }}>{flow.document.nodes.map((node) => <option key={node.mapId}>{node.mapId}</option>)}</select></label>
        {positions[selectedMapId] ? <div className="flow-form-grid"><NumberField label="Node X" value={positions[selectedMapId].x} onChange={(value) => setPositions((current) => ({ ...current, [selectedMapId]: { ...current[selectedMapId], x: Math.max(0, Math.min(1, value)) } }))} /><NumberField label="Node Y" value={positions[selectedMapId].y} onChange={(value) => setPositions((current) => ({ ...current, [selectedMapId]: { ...current[selectedMapId], y: Math.max(0, Math.min(1, value)) } }))} /></div> : null}
        <fieldset><legend>Clone map hiện tại</legend><label><span>Map ID mới</span><input value={cloneId} onChange={(event) => setCloneId(event.target.value)} /></label><label><span>Display name mới</span><input value={cloneName} onChange={(event) => setCloneName(event.target.value)} /></label><button disabled={!WRITE_ENABLED || saving || !cloneId || !cloneName} onClick={createClone}>Clone map</button></fieldset>
        {selectedDocument ? <><fieldset><legend>Entry points</legend>{selectedDocument.navigation.entryPoints.map((entry, index) => <div className="flow-form-grid" key={entry.id}><label><span>ID</span><input value={entry.id} onChange={(event) => mutateDocument(selectedMapId, (document) => { document.navigation.entryPoints[index].id = event.target.value; })} /></label><NumberField label="X" value={entry.position.x} onChange={(value) => mutateDocument(selectedMapId, (document) => { document.navigation.entryPoints[index].position.x = value; })} /><NumberField label="Z" value={entry.position.z} onChange={(value) => mutateDocument(selectedMapId, (document) => { document.navigation.entryPoints[index].position.z = value; })} /><NumberField label="Facing°" value={entry.facingDeg} onChange={(value) => mutateDocument(selectedMapId, (document) => { document.navigation.entryPoints[index].facingDeg = value; })} /></div>)}<button onClick={() => mutateDocument(selectedMapId, (document) => { let suffix = document.navigation.entryPoints.length + 1; while (document.navigation.entryPoints.some((entry) => entry.id === `entry-${suffix}`)) suffix += 1; document.navigation.entryPoints.push({ id: `entry-${suffix}`, position: { ...document.navigation.spawn }, facingDeg: 0 }); })}>+ Entry point</button></fieldset>
        <fieldset><legend>Portal / edge</legend><select aria-label="Portal" value={selectedPortalId ?? ""} onChange={(event) => setSelectedPortalId(event.target.value || null)}><option value="">Chọn portal</option>{selectedDocument.portals.map((portal) => <option key={portal.id} value={portal.id}>{portal.id} → {portal.target.mapId}</option>)}</select>{selectedPortal ? <div className="flow-form-grid"><label><span>Portal ID</span><input value={selectedPortal.id} onChange={(event) => mutateDocument(selectedMapId, (document) => { document.portals.find((portal) => portal.id === selectedPortal.id)!.id = event.target.value; setSelectedPortalId(event.target.value); })} /></label><NumberField label="Trigger X" value={selectedPortal.trigger.center.x} onChange={(value) => mutateDocument(selectedMapId, (document) => { document.portals.find((portal) => portal.id === selectedPortal.id)!.trigger.center.x = value; })} /><NumberField label="Trigger Z" value={selectedPortal.trigger.center.z} onChange={(value) => mutateDocument(selectedMapId, (document) => { document.portals.find((portal) => portal.id === selectedPortal.id)!.trigger.center.z = value; })} /><NumberField label="Radius" value={selectedPortal.trigger.radius} onChange={(value) => mutateDocument(selectedMapId, (document) => { document.portals.find((portal) => portal.id === selectedPortal.id)!.trigger.radius = value; })} /><label><span>Target map</span><select value={selectedPortal.target.mapId} onChange={(event) => mutateDocument(selectedMapId, (document) => { const portal = document.portals.find((item) => item.id === selectedPortal.id)!; portal.target.mapId = event.target.value; portal.target.entryPointId = documents[event.target.value].navigation.entryPoints[0]?.id ?? ""; })}>{flow.document.nodes.map((node) => <option key={node.mapId}>{node.mapId}</option>)}</select></label><label><span>Entry point đích</span><select value={selectedPortal.target.entryPointId} onChange={(event) => mutateDocument(selectedMapId, (document) => { document.portals.find((portal) => portal.id === selectedPortal.id)!.target.entryPointId = event.target.value; })}>{documents[selectedPortal.target.mapId]?.navigation.entryPoints.map((entry) => <option key={entry.id}>{entry.id}</option>)}</select></label><button onClick={() => { mutateDocument(selectedMapId, (document) => { document.portals = document.portals.filter((portal) => portal.id !== selectedPortal.id); }); setSelectedPortalId(null); }}>Xóa portal</button></div> : null}</fieldset></> : null}
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
  const [selectedPolygonId, setSelectedPolygonId] = useState<string | null>(null);
  const [viewportMode, setViewportMode] = useState<ViewportMode>("2d");
  const [draftPoints, setDraftPoints] = useState<Vec2[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const saveInFlight = useRef(false);
  const dirty = Boolean(document && envelope && canonicalStringify(document) !== canonicalStringify(envelope.document));
  const validation = useMemo(() => document ? validateMapDocument(document) : null, [document]);
  const selectedObject = document?.objects.find((object) => object.id === selectedObjectId) ?? null;
  const selectedPolygon = document?.navigation.walkablePolygons.find((polygon) => polygon.id === selectedPolygonId) ?? null;

  const openMap = async (mapId: string) => {
    setLoading(true); setError(""); setNotice("");
    try {
      const loaded = await loadMap(mapId);
      setEnvelope(loaded); setDocument(clone(loaded.document));
      setSelectedObjectId(loaded.document.objects[0]?.id ?? null);
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
  const confirmDiscard = () => (!dirty && !flowDirty) || window.confirm("Map Flow có thay đổi chưa lưu. Bạn có muốn bỏ thay đổi?");
  const selectMap = (mapId: string) => { if (!confirmDiscard()) return; void openMap(mapId); };
  const save = async () => {
    if (!document || !envelope || saveInFlight.current) return;
    setError(""); setNotice("");
    if (drawing) { setError("Polygon đang vẽ chưa được đóng."); return; }
    if (!validation?.success) { setError("Map còn lỗi validation. Hãy sửa trước khi lưu."); return; }
    const submitted = clone(validation.document);
    const submittedCanonical = canonicalStringify(submitted);
    saveInFlight.current = true;
    setSaving(true);
    try {
      const saved = await saveMap(submitted.mapId, submitted, envelope.etag);
      setEnvelope(saved);
      setDocument((current) => current && canonicalStringify(current) === submittedCanonical ? clone(saved.document) : current);
      setNotice(`Đã lưu revision ${saved.revision}.`);
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

  return (
    <main id="noi-dung-chinh" className="map-editor-shell">
      <header><div><p>Admin · Editor Mode</p><h1>Map Editor</h1></div><nav className="editor-tabs" aria-label="Editor tabs"><button className={tab === "map" ? "active" : ""} onClick={() => setTab("map")}>Map</button><button className={tab === "flow" ? "active" : ""} onClick={() => setTab("flow")}>Map Flow</button></nav>{tab === "map" ? <><label>Map<select value={document.mapId} onChange={(event) => selectMap(event.target.value)}>{maps.map((map) => <option key={map.mapId} value={map.mapId}>{map.name} · r{map.activeRevision}</option>)}</select></label><div className="header-save-controls"><span className={dirty ? "dirty" : ""}>{dirty ? "Chưa lưu" : `Revision ${envelope.revision}`}</span><button type="button" className="header-save-button" disabled={!WRITE_ENABLED || saving || !dirty} aria-busy={saving} onClick={save}>{saving ? "Đang lưu…" : "Lưu map"}</button></div></> : null}<Link href="/" onClick={(event) => { if (!confirmDiscard()) event.preventDefault(); }}>Về game</Link></header>
      {tab === "flow" ? <MapFlowPanel onDirtyChange={setFlowDirty} onMapCreated={(created) => { setMaps((current) => [...current, { mapId: created.mapId, name: created.document.metadata.name, description: created.document.metadata.description, activeRevision: created.revision, updatedAt: created.activatedAt }]); setEnvelope(created); setDocument(clone(created.document)); }} /> : <><aside>
        <details open><summary>Assets</summary><div className="editor-section">{ASSETS.map((asset) => <button key={asset.src + asset.kind} onClick={() => mutate((next) => { const object = createObject(next, asset); next.objects.push(object); setSelectedObjectId(object.id); })}>+ {asset.name}</button>)}</div></details>
        <details open><summary>Scene Objects</summary><div className="editor-section object-list">{document.objects.map((object) => <button className={object.id === selectedObjectId ? "active" : ""} key={object.id} onClick={() => setSelectedObjectId(object.id)}>{object.name} <small>{object.kind}</small></button>)}<div className="row"><button disabled={!selectedObject} onClick={() => selectedObject && mutate((next) => { const copy = clone(selectedObject); copy.id = `${copy.id}-copy-${Date.now().toString(36)}`; copy.name += " bản sao"; delete copy.binding; next.objects.push(copy); setSelectedObjectId(copy.id); })}>Duplicate</button><button disabled={!selectedObject} onClick={() => mutate((next) => { next.objects = next.objects.filter((item) => item.id !== selectedObjectId); setSelectedObjectId(null); })}>Delete</button></div></div></details>
        {selectedObject ? <details open><summary>Transform</summary><div className="editor-section"><label><span>Tên</span><input value={selectedObject.name} onChange={(event) => mutateObject((object) => { object.name = event.target.value; })} /></label>{selectedObject.kind === "model3d" ? (["x", "y", "z"] as const).flatMap((axis) => [<NumberField key={`p${axis}`} label={`Position ${axis.toUpperCase()}`} value={selectedObject.transform3d.position[axis]} onChange={(value) => mutateObject((object) => { if (object.kind === "model3d") object.transform3d.position[axis] = value; })} />, <NumberField key={`r${axis}`} label={`Rotation ${axis.toUpperCase()}°`} value={selectedObject.transform3d.rotationDeg[axis]} onChange={(value) => mutateObject((object) => { if (object.kind === "model3d") object.transform3d.rotationDeg[axis] = value; })} />, <NumberField key={`s${axis}`} label={`Scale ${axis.toUpperCase()}`} value={selectedObject.transform3d.scale[axis]} onChange={(value) => mutateObject((object) => { if (object.kind === "model3d") object.transform3d.scale[axis] = value; })} />]) : <>{(["x", "y"] as const).map((axis) => <NumberField key={`p${axis}`} label={`Position ${axis.toUpperCase()}`} value={selectedObject.transform2d.position[axis]} onChange={(value) => mutateObject((object) => { if (object.kind === "sprite2d") object.transform2d.position[axis] = value; })} />)}<NumberField label="Width" value={selectedObject.transform2d.size.width} onChange={(value) => mutateObject((object) => { if (object.kind === "sprite2d") object.transform2d.size.width = value; })} /><NumberField label="Height" value={selectedObject.transform2d.size.height} onChange={(value) => mutateObject((object) => { if (object.kind === "sprite2d") object.transform2d.size.height = value; })} />{(["x", "y"] as const).map((axis) => <NumberField key={`a${axis}`} label={`Anchor ${axis.toUpperCase()}`} value={selectedObject.transform2d.anchor[axis]} onChange={(value) => mutateObject((object) => { if (object.kind === "sprite2d") object.transform2d.anchor[axis] = value; })} />)}<NumberField label="Rotation°" value={selectedObject.transform2d.rotationDeg} onChange={(value) => mutateObject((object) => { if (object.kind === "sprite2d") object.transform2d.rotationDeg = value; })} />{(["x", "y"] as const).map((axis) => <NumberField key={`s${axis}`} label={`Scale ${axis.toUpperCase()}`} value={selectedObject.transform2d.scale[axis]} onChange={(value) => mutateObject((object) => { if (object.kind === "sprite2d") object.transform2d.scale[axis] = value; })} />)}</>}<label><span>Collider</span><select value={selectedObject.collider.type} onChange={(event) => setCollider(event.target.value as Collider["type"])}>{["none", "circle", "rectangle", "polygon"].map((type) => <option key={type}>{type}</option>)}</select></label>{selectedObject.collider.type === "circle" ? <NumberField label="Radius" value={selectedObject.collider.radius} onChange={(value) => mutateObject((object) => { if (object.collider.type === "circle") object.collider.radius = value; })} /> : null}{selectedObject.collider.type === "rectangle" ? <><NumberField label="Width collider" value={selectedObject.collider.width} onChange={(value) => mutateObject((object) => { if (object.collider.type === "rectangle") object.collider.width = value; })} /><NumberField label="Depth collider" value={selectedObject.collider.depth} onChange={(value) => mutateObject((object) => { if (object.collider.type === "rectangle") object.collider.depth = value; })} /><NumberField label="Local rotation°" value={selectedObject.collider.rotationDeg ?? 0} onChange={(value) => mutateObject((object) => { if (object.collider.type === "rectangle") object.collider.rotationDeg = value; })} /></> : null}</div></details> : null}
        <details open><summary>Walkable Area</summary><div className="editor-section"><div className="row"><button disabled={drawing} onClick={() => { setDraftPoints([]); setDrawing(true); setViewportMode("2d"); }}>Vẽ vùng mới</button><button disabled={!drawing || draftPoints.length < 3} onClick={closeDraft}>Đóng polygon</button><button disabled={!drawing} onClick={() => { setDraftPoints([]); setDrawing(false); }}>Hủy</button></div><button onClick={createQuickRectangle}>Tạo chữ nhật quanh spawn</button><select value={selectedPolygonId ?? ""} onChange={(event) => setSelectedPolygonId(event.target.value)}>{document.navigation.walkablePolygons.map((polygon) => <option key={polygon.id} value={polygon.id}>{polygon.id}</option>)}</select>{selectedPolygon ? <div className="point-list">{selectedPolygon.points.map((point, index) => <div className="walkable-point-row" key={index}><NumberField label={`#${index + 1} X`} value={point.x} onChange={(value) => mutate((next) => { const polygon = next.navigation.walkablePolygons.find((item) => item.id === selectedPolygon.id); if (polygon) polygon.points[index].x = value; })} /><NumberField label="Z" value={point.z} onChange={(value) => mutate((next) => { const polygon = next.navigation.walkablePolygons.find((item) => item.id === selectedPolygon.id); if (polygon) polygon.points[index].z = value; })} /><button aria-label={`Xóa point ${index + 1}`} disabled={selectedPolygon.points.length <= 3} onClick={() => mutate((next) => { const polygon = next.navigation.walkablePolygons.find((item) => item.id === selectedPolygon.id); if (polygon && polygon.points.length > 3) polygon.points.splice(index, 1); })}>Xóa</button></div>)}<button onClick={() => mutate((next) => { const polygon = next.navigation.walkablePolygons.find((item) => item.id === selectedPolygon.id); if (!polygon) return; const a = polygon.points.at(-1)!; const b = polygon.points[0]; polygon.points.push({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }); })}>+ Thêm vector point</button></div> : null}</div></details>
        <details open><summary>Map Settings / Save</summary><div className="editor-section"><label><span>Tên map</span><input value={document.metadata.name} onChange={(event) => mutate((next) => { next.metadata.name = event.target.value; })} /></label><label><span>Mô tả</span><textarea value={document.metadata.description} onChange={(event) => mutate((next) => { next.metadata.description = event.target.value; })} /></label><label><span>Background</span><input value={document.background.src} onChange={(event) => mutate((next) => { next.background.src = event.target.value; })} /></label><label><span>Màu fallback</span><input value={document.background.color} onChange={(event) => mutate((next) => { next.background.color = event.target.value; })} /></label><div className="save-row"><span className={dirty ? "dirty" : ""}>{dirty ? "Chưa lưu" : `Revision ${envelope.revision}`}</span><button disabled={!WRITE_ENABLED || saving || !dirty} onClick={save}>{saving ? "Đang lưu…" : "Save"}</button><button disabled={!dirty} onClick={() => { setDocument(clone(envelope.document)); setDraftPoints([]); setDrawing(false); }}>Reset</button></div>{!WRITE_ENABLED ? <small>Save đang tắt bởi NEXT_PUBLIC_MAP_EDITOR_WRITE_ENABLED.</small> : null}</div></details>
        {selectedObject ? <details open><summary>Collider Details</summary><div className="editor-section"><ColliderFields object={selectedObject} mutateObject={mutateObject} setCollider={setCollider} /></div></details> : null}
      </aside>
      <MapViewport key={document.mapId} document={document} mode={viewportMode} onModeChange={setViewportMode} polygonId={selectedPolygonId} onPolygonSelect={setSelectedPolygonId} drawing={drawing} draft={draftPoints} onDraftPoint={(point) => drawing && setDraftPoints((current) => [...current, point])} onPointInsert={(polygonId, index, point) => mutate((next) => { const polygon = next.navigation.walkablePolygons.find((item) => item.id === polygonId); if (polygon) polygon.points.splice(index, 0, point); })} onPointMove={(polygonId, index, point) => mutate((next) => { const polygon = next.navigation.walkablePolygons.find((item) => item.id === polygonId); if (polygon) polygon.points[index] = point; })} /></>}
      <footer>{error ? <p role="alert">{error}</p> : null}{notice ? <p role="status">{notice}</p> : null}{validation && !validation.success ? <ul>{validation.issues.slice(0, 6).map((issue, index) => <li key={`${issue.path}-${index}`}>{issue.path}: {issue.message}</li>)}</ul> : null}</footer>
    </main>
  );
}
