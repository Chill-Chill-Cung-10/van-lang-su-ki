"use client";

import {
  canonicalStringify,
  colliderFootprint,
  validateMapDocument,
  type Collider,
  type MapDocument,
  type MapObject,
  type MapRevisionEnvelope,
  type MapSummary,
  type Vec2,
} from "@van-lang/map-contract";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listMaps, loadMap, MapApiError, saveMap } from "../../_lib/map-api-client";

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

function MapViewport({ document, mode, onModeChange, polygonId, onPointMove, draft, onDraftPoint }: {
  document: MapDocument; mode: "2d" | "3d"; onModeChange: (mode: "2d" | "3d") => void;
  polygonId: string | null; onPointMove: (polygonId: string, index: number, point: Vec2) => void;
  draft: Vec2[]; onDraftPoint: (point: Vec2) => void;
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
    <section className={`map-viewport is-${mode}`} aria-label={mode === "2d" ? "Map viewport 2D" : "Map viewport 3D"}>
      <div className="viewport-mode-switch" role="group" aria-label="Chế độ xem viewport">
        <button type="button" className={mode === "2d" ? "active" : ""} aria-pressed={mode === "2d"} onClick={() => onModeChange("2d")}>2D chỉnh vùng</button>
        <button type="button" className={mode === "3d" ? "active" : ""} aria-pressed={mode === "3d"} onClick={() => { setPreviewReady(false); onModeChange("3d"); }}>3D góc người chơi</button>
      </div>
      {mode === "2d" ? <>
        <Image unoptimized fill src={document.background.src} alt={document.background.alt} style={{ objectFit: document.background.fit }} />
        {document.objects.filter((object): object is Extract<MapObject, { kind: "sprite2d" }> => object.kind === "sprite2d" && object.enabled).map((object) => <Image unoptimized width={1} height={1} className="viewport-sprite" key={object.id} src={object.src} alt={object.alt} style={{ left: `${object.transform2d.position.x * 100}%`, top: `${object.transform2d.position.y * 100}%`, width: `${object.transform2d.size.width * 100}%`, height: `${object.transform2d.size.height * 100}%`, transform: `translate(${-object.transform2d.anchor.x * 100}%, ${-object.transform2d.anchor.y * 100}%) rotate(${object.transform2d.rotationDeg}deg) scale(${object.transform2d.scale.x}, ${object.transform2d.scale.y})` }} />)}
        <svg viewBox="0 0 1000 1000" onPointerMove={(event) => dragging && onPointMove(dragging.polygonId, dragging.index, fromPointer(event))} onPointerUp={() => setDragging(null)} onDoubleClick={(event) => onDraftPoint(fromPointer(event))}>
          {document.navigation.walkablePolygons.filter((polygon) => polygon.enabled).map((polygon) => (
            <g key={polygon.id} className={polygon.id === polygonId ? "selected" : ""}>
              <polygon points={polygon.points.map((point) => { const item = toCanvas(point); return `${item.x},${item.y}`; }).join(" ")} />
              {polygon.points.map((point, index) => { const item = toCanvas(point); return <circle key={index} cx={item.x} cy={item.y} r="10" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDragging({ polygonId: polygon.id, index }); }} />; })}
            </g>
          ))}
          {draft.length ? <polyline className="draft" points={draft.map((point) => { const item = toCanvas(point); return `${item.x},${item.y}`; }).join(" ")} /> : null}
          {footprints.map(({ id, footprint }) => footprint?.type === "circle" ? (() => { const center = toCanvas(footprint.center); return <circle className="collider" key={id} cx={center.x} cy={center.y} r={footprint.radius / 12 * 1000} />; })() : footprint?.type === "polygon" ? <polygon className="collider" key={id} points={footprint.points.map((point) => { const item = toCanvas(point); return `${item.x},${item.y}`; }).join(" ")} /> : null)}
        </svg>
        <p>Double-click viewport để thêm điểm khi đang vẽ. Kéo các nút tròn để di chuyển điểm.</p>
      </> : <div className="viewport-3d">
        <Image unoptimized fill className="viewport-3d-background" src={document.background.src} alt="" aria-hidden="true" style={{ objectFit: document.background.fit }} />
        <DungeonPreview mapDocument={document} playerPos={{ x: document.navigation.spawn.x, y: document.navigation.spawn.z }} facing={0} isMoving={false} onSceneReady={markPreviewReady} />
        {previewReady
          ? <p role="status">Preview 3D đã sẵn sàng. Camera, GLB và transform đang dùng đúng cấu hình runtime.</p>
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

export function MapEditorShell() {
  const [maps, setMaps] = useState<MapSummary[]>([]);
  const [envelope, setEnvelope] = useState<MapRevisionEnvelope | null>(null);
  const [document, setDocument] = useState<MapDocument | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedPolygonId, setSelectedPolygonId] = useState<string | null>(null);
  const [viewportMode, setViewportMode] = useState<"2d" | "3d">("2d");
  const [draftPoints, setDraftPoints] = useState<Vec2[]>([]);
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
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  const mutate = (recipe: (next: MapDocument) => void) => setDocument((current) => { if (!current) return current; const next = clone(current); recipe(next); return next; });
  const mutateObject = (recipe: (object: MapObject) => void) => mutate((next) => { const object = next.objects.find((item) => item.id === selectedObjectId); if (object) recipe(object); });
  const confirmDiscard = () => !dirty || window.confirm("Map có thay đổi chưa lưu. Bạn có muốn bỏ thay đổi?");
  const selectMap = (mapId: string) => { if (!confirmDiscard()) return; void openMap(mapId); };
  const save = async () => {
    if (!document || !envelope || saveInFlight.current) return;
    setError(""); setNotice("");
    if (draftPoints.length) { setError("Polygon đang vẽ chưa được đóng."); return; }
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

  return (
    <main id="noi-dung-chinh" className="map-editor-shell">
      <header><div><p>Admin · Editor Mode</p><h1>Map Editor</h1></div><label>Map<select value={document.mapId} onChange={(event) => selectMap(event.target.value)}>{maps.map((map) => <option key={map.mapId} value={map.mapId}>{map.name} · r{map.activeRevision}</option>)}</select></label><Link href="/" onClick={(event) => { if (!confirmDiscard()) event.preventDefault(); }}>Về game</Link></header>
      <aside>
        <details open><summary>Assets</summary><div className="editor-section">{ASSETS.map((asset) => <button key={asset.src + asset.kind} onClick={() => mutate((next) => { const object = createObject(next, asset); next.objects.push(object); setSelectedObjectId(object.id); })}>+ {asset.name}</button>)}</div></details>
        <details open><summary>Scene Objects</summary><div className="editor-section object-list">{document.objects.map((object) => <button className={object.id === selectedObjectId ? "active" : ""} key={object.id} onClick={() => setSelectedObjectId(object.id)}>{object.name} <small>{object.kind}</small></button>)}<div className="row"><button disabled={!selectedObject} onClick={() => selectedObject && mutate((next) => { const copy = clone(selectedObject); copy.id = `${copy.id}-copy-${Date.now().toString(36)}`; copy.name += " bản sao"; delete copy.binding; next.objects.push(copy); setSelectedObjectId(copy.id); })}>Duplicate</button><button disabled={!selectedObject} onClick={() => mutate((next) => { next.objects = next.objects.filter((item) => item.id !== selectedObjectId); setSelectedObjectId(null); })}>Delete</button></div></div></details>
        {selectedObject ? <details open><summary>Transform</summary><div className="editor-section"><label><span>Tên</span><input value={selectedObject.name} onChange={(event) => mutateObject((object) => { object.name = event.target.value; })} /></label>{selectedObject.kind === "model3d" ? (["x", "y", "z"] as const).flatMap((axis) => [<NumberField key={`p${axis}`} label={`Position ${axis.toUpperCase()}`} value={selectedObject.transform3d.position[axis]} onChange={(value) => mutateObject((object) => { if (object.kind === "model3d") object.transform3d.position[axis] = value; })} />, <NumberField key={`r${axis}`} label={`Rotation ${axis.toUpperCase()}°`} value={selectedObject.transform3d.rotationDeg[axis]} onChange={(value) => mutateObject((object) => { if (object.kind === "model3d") object.transform3d.rotationDeg[axis] = value; })} />, <NumberField key={`s${axis}`} label={`Scale ${axis.toUpperCase()}`} value={selectedObject.transform3d.scale[axis]} onChange={(value) => mutateObject((object) => { if (object.kind === "model3d") object.transform3d.scale[axis] = value; })} />]) : <>{(["x", "y"] as const).map((axis) => <NumberField key={`p${axis}`} label={`Position ${axis.toUpperCase()}`} value={selectedObject.transform2d.position[axis]} onChange={(value) => mutateObject((object) => { if (object.kind === "sprite2d") object.transform2d.position[axis] = value; })} />)}<NumberField label="Width" value={selectedObject.transform2d.size.width} onChange={(value) => mutateObject((object) => { if (object.kind === "sprite2d") object.transform2d.size.width = value; })} /><NumberField label="Height" value={selectedObject.transform2d.size.height} onChange={(value) => mutateObject((object) => { if (object.kind === "sprite2d") object.transform2d.size.height = value; })} />{(["x", "y"] as const).map((axis) => <NumberField key={`a${axis}`} label={`Anchor ${axis.toUpperCase()}`} value={selectedObject.transform2d.anchor[axis]} onChange={(value) => mutateObject((object) => { if (object.kind === "sprite2d") object.transform2d.anchor[axis] = value; })} />)}<NumberField label="Rotation°" value={selectedObject.transform2d.rotationDeg} onChange={(value) => mutateObject((object) => { if (object.kind === "sprite2d") object.transform2d.rotationDeg = value; })} />{(["x", "y"] as const).map((axis) => <NumberField key={`s${axis}`} label={`Scale ${axis.toUpperCase()}`} value={selectedObject.transform2d.scale[axis]} onChange={(value) => mutateObject((object) => { if (object.kind === "sprite2d") object.transform2d.scale[axis] = value; })} />)}</>}<label><span>Collider</span><select value={selectedObject.collider.type} onChange={(event) => setCollider(event.target.value as Collider["type"])}>{["none", "circle", "rectangle", "polygon"].map((type) => <option key={type}>{type}</option>)}</select></label>{selectedObject.collider.type === "circle" ? <NumberField label="Radius" value={selectedObject.collider.radius} onChange={(value) => mutateObject((object) => { if (object.collider.type === "circle") object.collider.radius = value; })} /> : null}{selectedObject.collider.type === "rectangle" ? <><NumberField label="Width collider" value={selectedObject.collider.width} onChange={(value) => mutateObject((object) => { if (object.collider.type === "rectangle") object.collider.width = value; })} /><NumberField label="Depth collider" value={selectedObject.collider.depth} onChange={(value) => mutateObject((object) => { if (object.collider.type === "rectangle") object.collider.depth = value; })} /><NumberField label="Local rotation°" value={selectedObject.collider.rotationDeg ?? 0} onChange={(value) => mutateObject((object) => { if (object.collider.type === "rectangle") object.collider.rotationDeg = value; })} /></> : null}</div></details> : null}
        <details open><summary>Walkable Area</summary><div className="editor-section"><div className="row"><button onClick={() => setDraftPoints([{ x: 0, z: 0 }])}>Vẽ vùng mới</button><button disabled={draftPoints.length < 3} onClick={() => { mutate((next) => { const id = `walkable-${Date.now().toString(36)}`; next.navigation.walkablePolygons.push({ id, enabled: true, points: draftPoints }); setSelectedPolygonId(id); }); setDraftPoints([]); }}>Đóng polygon</button><button disabled={!draftPoints.length} onClick={() => setDraftPoints([])}>Hủy</button></div><select value={selectedPolygonId ?? ""} onChange={(event) => setSelectedPolygonId(event.target.value)}>{document.navigation.walkablePolygons.map((polygon) => <option key={polygon.id} value={polygon.id}>{polygon.id}</option>)}</select>{selectedPolygon ? <div className="point-list">{selectedPolygon.points.map((point, index) => <div className="row" key={index}><span>#{index + 1} {point.x.toFixed(2)}, {point.z.toFixed(2)}</span><button onClick={() => mutate((next) => { const polygon = next.navigation.walkablePolygons.find((item) => item.id === selectedPolygon.id); if (polygon && polygon.points.length > 3) polygon.points.splice(index, 1); })}>Xóa</button></div>)}<button onClick={() => mutate((next) => { const polygon = next.navigation.walkablePolygons.find((item) => item.id === selectedPolygon.id); if (!polygon) return; const a = polygon.points.at(-1)!; const b = polygon.points[0]; polygon.points.push({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }); })}>+ Thêm vector point</button></div> : null}</div></details>
        <details open><summary>Map Settings / Save</summary><div className="editor-section"><label><span>Tên map</span><input value={document.metadata.name} onChange={(event) => mutate((next) => { next.metadata.name = event.target.value; })} /></label><label><span>Mô tả</span><textarea value={document.metadata.description} onChange={(event) => mutate((next) => { next.metadata.description = event.target.value; })} /></label><label><span>Background</span><input value={document.background.src} onChange={(event) => mutate((next) => { next.background.src = event.target.value; })} /></label><label><span>Màu fallback</span><input value={document.background.color} onChange={(event) => mutate((next) => { next.background.color = event.target.value; })} /></label><div className="save-row"><span className={dirty ? "dirty" : ""}>{dirty ? "Chưa lưu" : `Revision ${envelope.revision}`}</span><button disabled={!WRITE_ENABLED || saving || !dirty} onClick={save}>{saving ? "Đang lưu…" : "Save"}</button><button disabled={!dirty} onClick={() => setDocument(clone(envelope.document))}>Reset</button></div>{!WRITE_ENABLED ? <small>Save đang tắt bởi NEXT_PUBLIC_MAP_EDITOR_WRITE_ENABLED.</small> : null}</div></details>
        {selectedObject ? <details open><summary>Collider Details</summary><div className="editor-section"><ColliderFields object={selectedObject} mutateObject={mutateObject} setCollider={setCollider} /></div></details> : null}
      </aside>
      <MapViewport key={document.mapId} document={document} mode={viewportMode} onModeChange={setViewportMode} polygonId={selectedPolygonId} draft={draftPoints} onDraftPoint={(point) => draftPoints.length && setDraftPoints((current) => [...current, point])} onPointMove={(polygonId, index, point) => mutate((next) => { const polygon = next.navigation.walkablePolygons.find((item) => item.id === polygonId); if (polygon) polygon.points[index] = point; })} />
      <footer>{error ? <p role="alert">{error}</p> : null}{notice ? <p role="status">{notice}</p> : null}{validation && !validation.success ? <ul>{validation.issues.slice(0, 6).map((issue, index) => <li key={`${issue.path}-${index}`}>{issue.path}: {issue.message}</li>)}</ul> : null}</footer>
    </main>
  );
}
