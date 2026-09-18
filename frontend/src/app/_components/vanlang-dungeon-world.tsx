"use client";

import { colliderFootprint, type MapDocument, type MapNpc, type MapObject, type Vec2 } from "@van-lang/map-contract";
import { ContactShadows, Html, TransformControls, useAnimations, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, useRef } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, MathUtils, Mesh, Plane, Raycaster, Shape, Vector2, Vector3 } from "three";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { dungeonNpcs } from "./vanlang-mock-data";

type EditorOverlayConfig = {
  selectedPolygonId: string | null;
  selectedEntryPointId?: string | null;
  selectedPortalId?: string | null;
  showAllPolygons?: boolean;
  editablePolygons?: boolean;
  onPolygonSelect?: (polygonId: string) => void;
  onEntryPointSelect?: (entryPointId: string) => void;
  onPortalSelect?: (portalId: string) => void;
  onPointMove?: (polygonId: string, index: number, point: Vec2) => void;
  onPointInsert?: (polygonId: string, index: number, point: Vec2) => void;
};
type DungeonWorldProps = { mapDocument: MapDocument; playerPos: { x: number; y: number }; facing: number; isMoving: boolean; onSceneReady?: () => void; onSceneError?: () => void; editorOverlay?: EditorOverlayConfig; selectedNpcId?: string | null; onNpcSelect?: (npcId: string) => void; onNpcMove?: (npcId: string, position: { x: number; y: number; z: number }) => void };
const HERO_MODEL = "/models/vanlang-rebirth/hero.runtime.glb";
const radians = (degrees: number) => degrees * Math.PI / 180;

class SceneErrorBoundary extends Component<{ children: ReactNode; onError?: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
componentDidCatch() { this.props.onError?.(); }
  render() { return this.state.failed ? <div className="dungeon-world-fallback" role="status">Cảnh 3D tạm thời không khả dụng. Bạn vẫn có thể mở nhật ký hoặc trở về Bản đồ Ký Ức.</div> : this.props.children; }
}

function CameraRig({ document }: { document: MapDocument }) {
  const { camera } = useThree();
  useEffect(() => { camera.position.set(document.world.camera.position.x, document.world.camera.position.y, document.world.camera.position.z); camera.lookAt(document.world.camera.target.x, document.world.camera.target.y, document.world.camera.target.z); camera.updateProjectionMatrix(); }, [camera, document]);
  return null;
}

function MapModel({ object }: { object: Extract<MapObject, { kind: "model3d" }> }) {
  const loaded = useGLTF(object.src);
  const scene = useMemo(() => loaded.scene.clone(true), [loaded.scene]);
  useEffect(() => { scene.traverse((node) => { if (node instanceof Mesh) { node.castShadow = object.castShadow; node.receiveShadow = object.receiveShadow; } }); }, [object.castShadow, object.receiveShadow, scene]);
  const transform = object.transform3d;
  return <primitive object={scene} position={[transform.position.x, transform.position.y, transform.position.z]} rotation={[radians(transform.rotationDeg.x), radians(transform.rotationDeg.y), radians(transform.rotationDeg.z)]} scale={[transform.scale.x, transform.scale.y, transform.scale.z]} renderOrder={object.renderOrder} />;
}

function NavmeshSurface({ document }: { document: MapDocument }) {
  const geometry = useMemo(() => {
    const vertices = document.navigation.walkablePolygons.filter((polygon) => polygon.enabled).flatMap((polygon) => {
      const triangles: number[] = [];
      for (let index = 1; index < polygon.points.length - 1; index += 1) {
        for (const point of [polygon.points[0], polygon.points[index], polygon.points[index + 1]]) triangles.push(point.x, document.world.groundY, point.z);
      }
      return triangles;
    });
    const result = new BufferGeometry();
    result.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    result.computeVertexNormals();
    return result;
  }, [document]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} visible={false}><meshBasicMaterial /></mesh>;
}

function NpcBeacon({ name, position, isBoss }: { name: string; position: { x: number; y: number; z: number }; isBoss: boolean }) {
  return <group position={[position.x, position.y, position.z]}><mesh position={[0, 0.12, 0]} castShadow><cylinderGeometry args={[0.09, 0.14, 0.24, 8]} /><meshStandardMaterial color={isBoss ? "#a73b29" : "#9d7435"} emissive={isBoss ? "#49140d" : "#493117"} /></mesh><mesh position={[0, 0.48, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.14, 0.025, 10, 28]} /><meshBasicMaterial color={isBoss ? "#ff9b73" : "#f4cf83"} /></mesh><Html center position={[0, 0.76, 0]} distanceFactor={5.5} zIndexRange={[2, 0]}><span className={`dungeon-npc-label ${isBoss ? "is-boss" : ""}`} aria-hidden="true">{name}</span></Html></group>;
}

function RuntimeNpcModel({ npc, selected, onSelect, onMove }: { npc: MapNpc; selected: boolean; onSelect?: () => void; onMove?: (position: { x: number; y: number; z: number }) => void }) {
  const loaded = useGLTF(npc.src);
  const scene = useMemo(() => cloneSkeleton(loaded.scene), [loaded.scene]);
  const group = useRef<Group>(null);
  const content = <group ref={group} name={`npc-${npc.id}`} position={[npc.transform.position.x, npc.transform.position.y, npc.transform.position.z]} rotation={[radians(npc.transform.rotationDeg.x), radians(npc.transform.rotationDeg.y), radians(npc.transform.rotationDeg.z)]} scale={[npc.transform.scale.x, npc.transform.scale.y, npc.transform.scale.z]} onClick={(event) => { event.stopPropagation(); onSelect?.(); }}><primitive object={scene} /></group>;
  return selected && onMove
    ? <TransformControls mode="translate" onObjectChange={() => { const position = group.current?.position; if (position) onMove({ x: position.x, y: position.y, z: position.z }); }}>{content}</TransformControls>
    : content;
}

function PlayerAvatar({ mapDocument, playerPos, facing, isMoving }: DungeonWorldProps) {
  const group = useRef<Group>(null);
  const initialized = useRef(false);
  const locomotionSpeed = useRef(0);
  const { scene, animations } = useGLTF(HERO_MODEL);
  const { actions } = useAnimations(animations, group);
  useEffect(() => { scene.traverse((node) => { if (node instanceof Mesh) { node.castShadow = true; node.receiveShadow = true; } }); }, [scene]);
  useEffect(() => { const idle = actions.Idle; const walk = actions.Walk; const run = actions.Run; idle?.reset().setEffectiveWeight(1).play(); walk?.reset().setEffectiveWeight(0).play(); run?.reset().setEffectiveWeight(0).play(); return () => { idle?.stop(); walk?.stop(); run?.stop(); }; }, [actions]);
  useFrame((_, delta) => {
    if (!group.current) return;
    const avatar = group.current;
    if (!initialized.current) { avatar.position.set(playerPos.x, mapDocument.world.groundY, playerPos.y); avatar.rotation.y = facing; initialized.current = true; return; }
    const previousX = avatar.position.x; const previousZ = avatar.position.z;
    avatar.position.x = MathUtils.damp(avatar.position.x, playerPos.x, 12, delta);
    avatar.position.z = MathUtils.damp(avatar.position.z, playerPos.y, 12, delta);
    const frameSpeed = Math.hypot(avatar.position.x - previousX, avatar.position.z - previousZ) / Math.max(delta, 0.001);
    locomotionSpeed.current = MathUtils.damp(locomotionSpeed.current, isMoving ? frameSpeed : 0, 10, delta);
    const idleWeight = 1 - MathUtils.smoothstep(locomotionSpeed.current, 0.08, 0.42);
    const runWeight = MathUtils.smoothstep(locomotionSpeed.current, 1.35, 2.2);
    actions.Idle?.setEffectiveWeight(idleWeight);
    actions.Walk?.setEffectiveWeight(Math.max(0, 1 - idleWeight - runWeight)).setEffectiveTimeScale(MathUtils.clamp(locomotionSpeed.current / 1.15, 0.65, 1.25));
    actions.Run?.setEffectiveWeight(runWeight).setEffectiveTimeScale(MathUtils.clamp(locomotionSpeed.current / 2.4, 0.72, 1.18));
    const rotationDelta = Math.atan2(Math.sin(facing - avatar.rotation.y), Math.cos(facing - avatar.rotation.y));
    avatar.rotation.y += rotationDelta * (1 - Math.exp(-18 * delta));
  });
  return <group ref={group} position={[0, mapDocument.world.groundY, 0]} scale={0.54}><primitive object={scene} /></group>;
}

function SceneReady({ onReady }: { onReady?: () => void }) {
  useEffect(() => { onReady?.(); }, [onReady]);
  return null;
}

function OverlayPolygon({ points, color, groundY, onSelect }: { points: Vec2[]; color: string; groundY: number; onSelect?: () => void }) {
  const shape = useMemo(() => {
    const result = new Shape();
    points.forEach((point, index) => index === 0 ? result.moveTo(point.x, point.z) : result.lineTo(point.x, point.z));
    result.closePath();
    return result;
  }, [points]);
  return <mesh position={[0, groundY + 0.035, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={1000} onClick={(event) => { event.stopPropagation(); onSelect?.(); }}><shapeGeometry args={[shape]} /><meshBasicMaterial color={color} transparent opacity={0.42} side={DoubleSide} depthWrite={false} polygonOffset polygonOffsetFactor={-2} /></mesh>;
}

function OverlayPointHandle({ point, groundY, rootRef, label, midpoint = false, onSelect, onMove, onInsert }: {
  point: Vec2;
  groundY: number;
  rootRef: RefObject<Group | null>;
  label: string;
  midpoint?: boolean;
  onSelect: () => void;
  onMove?: (point: Vec2) => void;
  onInsert?: () => void;
}) {
  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new Raycaster(), []);
  const pointer = useMemo(() => new Vector2(), []);
  const worldHit = useMemo(() => new Vector3(), []);
  const plane = useMemo(() => new Plane(), []);
  const planeA = useMemo(() => new Vector3(), []);
  const planeB = useMemo(() => new Vector3(), []);
  const planeC = useMemo(() => new Vector3(), []);
  const pointFromPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const root = rootRef.current;
    if (!root) return null;
    const bounds = gl.domElement.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    root.updateWorldMatrix(true, false);
    planeA.set(0, groundY, 0).applyMatrix4(root.matrixWorld);
    planeB.set(1, groundY, 0).applyMatrix4(root.matrixWorld);
    planeC.set(0, groundY, 1).applyMatrix4(root.matrixWorld);
    plane.setFromCoplanarPoints(planeA, planeB, planeC);
    if (!raycaster.ray.intersectPlane(plane, worldHit)) return null;
    const local = root.worldToLocal(worldHit.clone());
    return { x: local.x, z: local.z };
  };
  return <Html center position={[point.x, groundY + 0.12, point.z]} zIndexRange={[30, 20]}>
    <button
      type="button"
      className={`overlay-point-handle${midpoint ? " is-midpoint" : ""}`}
      aria-label={label}
      onClick={(event) => { event.stopPropagation(); if (midpoint) onInsert?.(); else onSelect(); }}
      onPointerDown={(event) => { event.stopPropagation(); onSelect(); if (!midpoint) event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={(event) => { if (midpoint || !event.currentTarget.hasPointerCapture(event.pointerId)) return; const next = pointFromPointer(event); if (next) onMove?.(next); }}
      onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
    />
  </Html>;
}

function EditorOverlay({ document, config, rootRef }: { document: MapDocument; config: EditorOverlayConfig; rootRef: RefObject<Group | null> }) {
  const footprints = document.objects.map((object) => ({ id: object.id, footprint: colliderFootprint(object) })).filter((item) => item.footprint);
  const spawn = document.navigation.spawn;
  const polygons = config.showAllPolygons
    ? document.navigation.walkablePolygons.filter((polygon) => polygon.enabled)
    : document.navigation.walkablePolygons.filter((polygon) => polygon.enabled && polygon.id === config.selectedPolygonId);
  return <group name="map-editor-overlay">
    <Html center position={[spawn.x, document.world.groundY + 0.22, spawn.z]} zIndexRange={[40, 31]}><div className="overlay-spawn-marker" role="img" aria-label="Spawn point">Spawn</div></Html>
    <mesh name="spawn-point-marker" position={[spawn.x, document.world.groundY + 0.065, spawn.z]} rotation={[Math.PI / 2, 0, 0]} renderOrder={1002}><ringGeometry args={[0.16, 0.25, 32]} /><meshBasicMaterial color="#58e6ff" transparent opacity={0.95} side={DoubleSide} depthWrite={false} /></mesh>
    {document.navigation.entryPoints.map((entryPoint) => {
      const selected = entryPoint.id === config.selectedEntryPointId;
      return <group key={entryPoint.id} position={[entryPoint.position.x, document.world.groundY + 0.075, entryPoint.position.z]} rotation={[0, entryPoint.facingDeg * Math.PI / 180, 0]} onClick={(event) => { event.stopPropagation(); config.onEntryPointSelect?.(entryPoint.id); }}>
        <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={1003}><ringGeometry args={[0.18, selected ? 0.34 : 0.29, 32]} /><meshBasicMaterial color={selected ? "#fff2a8" : "#58e6ff"} transparent opacity={0.98} side={DoubleSide} depthWrite={false} /></mesh>
        <mesh position={[0, 0, 0.34]} rotation={[Math.PI / 2, 0, 0]} renderOrder={1003}><coneGeometry args={[0.12, 0.28, 3]} /><meshBasicMaterial color={selected ? "#fff2a8" : "#58e6ff"} transparent opacity={0.98} depthWrite={false} /></mesh>
        <Html center position={[0, 0.28, 0]} zIndexRange={[40, 31]}><button type="button" className="overlay-navigation-label" aria-label={`Entrypoint ${entryPoint.id}`}>{entryPoint.id}</button></Html>
      </group>;
    })}
    {document.portals.filter((portal) => portal.enabled).map((portal) => {
      const selected = portal.id === config.selectedPortalId;
      return <group key={portal.id} position={[portal.trigger.center.x, document.world.groundY + 0.06, portal.trigger.center.z]} onClick={(event) => { event.stopPropagation(); config.onPortalSelect?.(portal.id); }}>
        <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={1003}><circleGeometry args={[portal.trigger.radius, 48]} /><meshBasicMaterial color="#ad58ff" transparent opacity={selected ? 0.48 : 0.28} side={DoubleSide} depthWrite={false} /></mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={1004}><ringGeometry args={[Math.max(0.04, portal.trigger.radius - 0.06), portal.trigger.radius, 48]} /><meshBasicMaterial color={selected ? "#fff2a8" : "#d9a7ff"} transparent opacity={0.98} side={DoubleSide} depthWrite={false} /></mesh>
        <Html center position={[0, 0.28, 0]} zIndexRange={[40, 31]}><button type="button" className="overlay-navigation-label is-portal" aria-label={`Portal ${portal.id}`}>{portal.id}</button></Html>
      </group>;
    })}
    {polygons.map((polygon) => <group key={polygon.id}>
      <OverlayPolygon points={polygon.points} color={polygon.id === config.selectedPolygonId ? "#ffc55b" : "#48e692"} groundY={document.world.groundY} onSelect={() => config.onPolygonSelect?.(polygon.id)} />
      {config.editablePolygons ? polygon.points.map((point, index) => <OverlayPointHandle key={index} point={point} groundY={document.world.groundY} rootRef={rootRef} label={`Di chuyển điểm ${index + 1} của ${polygon.id}`} onSelect={() => config.onPolygonSelect?.(polygon.id)} onMove={(next) => config.onPointMove?.(polygon.id, index, next)} />) : null}
      {config.editablePolygons && polygon.id === config.selectedPolygonId ? polygon.points.map((point, index) => {
        const next = polygon.points[(index + 1) % polygon.points.length];
        const midpoint = { x: (point.x + next.x) / 2, z: (point.z + next.z) / 2 };
        return <OverlayPointHandle key={`insert-${index}`} point={midpoint} groundY={document.world.groundY} rootRef={rootRef} label={`Chèn điểm sau điểm ${index + 1} của ${polygon.id}`} midpoint onSelect={() => config.onPolygonSelect?.(polygon.id)} onInsert={() => config.onPointInsert?.(polygon.id, index + 1, midpoint)} />;
      }) : null}
    </group>)}
    {footprints.map(({ id, footprint }) => footprint?.type === "circle"
      ? <mesh key={id} position={[footprint.center.x, document.world.groundY + 0.055, footprint.center.z]} rotation={[Math.PI / 2, 0, 0]} renderOrder={1001}><circleGeometry args={[footprint.radius, 48]} /><meshBasicMaterial color="#ff5757" transparent opacity={0.58} side={DoubleSide} depthWrite={false} /></mesh>
      : footprint?.type === "polygon" ? <OverlayPolygon key={id} points={footprint.points} color="#ff5757" groundY={document.world.groundY + 0.02} /> : null)}
  </group>;
}

function RebirthArena(props: DungeonWorldProps) {
  const document = props.mapDocument;
  const root = document.world.rootTransform;
  const rootRef = useRef<Group>(null);
  const models = document.objects.filter((object): object is Extract<MapObject, { kind: "model3d" }> => object.kind === "model3d" && object.enabled).sort((a, b) => a.renderOrder - b.renderOrder || a.id.localeCompare(b.id));
  return <><ambientLight intensity={1.8} color="#f7e1ba" /><hemisphereLight intensity={1.5} color="#fff0d0" groundColor="#2b1d16" /><directionalLight position={[5, 10, 7]} intensity={2.6} color="#ffe0a3" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} /><CameraRig document={document} /><group ref={rootRef} position={[root.position.x, root.position.y, root.position.z]} rotation={[radians(root.rotationDeg.x), radians(root.rotationDeg.y), radians(root.rotationDeg.z)]} scale={[root.scale.x, root.scale.y, root.scale.z]}><NavmeshSurface document={document} /><Suspense fallback={null}>{models.filter((object) => !object.binding).map((object) => <MapModel key={object.id} object={object} />)}{models.filter((object) => object.binding).map((object) => { const npc = dungeonNpcs.find((item) => item.id === object.binding?.entityId); return npc ? <NpcBeacon key={object.id} name={npc.name} isBoss={npc.role === "boss"} position={object.transform3d.position} /> : null; })}{document.npcs.map((npc) => <RuntimeNpcModel key={npc.id} npc={npc} selected={props.selectedNpcId === npc.id} onSelect={props.onNpcSelect ? () => props.onNpcSelect?.(npc.id) : undefined} onMove={props.onNpcMove ? (position) => props.onNpcMove?.(npc.id, position) : undefined} />)}<PlayerAvatar {...props} /><SceneReady onReady={props.onSceneReady} /></Suspense>{props.editorOverlay ? <EditorOverlay document={document} config={props.editorOverlay} rootRef={rootRef} /> : null}<ContactShadows position={[0, document.world.groundY + 0.01, 0]} opacity={0.32} scale={11} blur={2.2} far={4} /></group></>;
}

export function VanlangDungeonWorld(props: DungeonWorldProps) {
  const camera = props.mapDocument.world.camera;
  return <SceneErrorBoundary onError={props.onSceneError}><div className="dungeon-world" aria-label="Đấu trường chuyển sinh Văn Lang 3D"><Canvas shadows dpr={[1, 1.35]} camera={{ position: [camera.position.x, camera.position.y, camera.position.z], fov: camera.fovDeg, near: camera.near, far: camera.far }} gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }} onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}><RebirthArena {...props} /></Canvas></div></SceneErrorBoundary>;
}

useGLTF.preload(HERO_MODEL);
