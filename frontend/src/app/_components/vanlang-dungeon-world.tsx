"use client";

import { colliderFootprint, isPositionValid, type MapDocument, type MapNpc, type MapObject, type Vec2 } from "@van-lang/map-contract";
import { ContactShadows, Html, Line, TransformControls, useAnimations, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, useRef } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, MathUtils, Mesh, Plane, Raycaster, Shape, Vector2, Vector3, type Material } from "three";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { dungeonNpcs } from "./vanlang-mock-data";

type EditorOverlayConfig = {
  selectedPolygonId: string | null;
  selectedEntryPointId?: string | null;
  selectedPortalId?: string | null;
  showAllPolygons?: boolean;
  editablePolygons?: boolean;
  editableNavigation?: boolean;
  drawing?: boolean;
  draft?: Vec2[];
  onPolygonSelect?: (polygonId: string) => void;
  onEntryPointSelect?: (entryPointId: string) => void;
  onPortalSelect?: (portalId: string) => void;
  onPointMove?: (polygonId: string, index: number, point: Vec2) => void;
  onPointInsert?: (polygonId: string, index: number, point: Vec2) => void;
  onDraftPoint?: (point: Vec2) => void;
  onEntryPointMove?: (entryPointId: string, point: Vec2) => void;
  onPortalMove?: (portalId: string, point: Vec2) => void;
  onSpawnMove?: (point: Vec2) => void;
};
type DungeonWorldProps = { mapDocument: MapDocument; portalMapNames?: Record<string, string>; activePortals?: MapDocument["portals"]; lacNhiDialogueCompleted?: boolean; playerPos: { x: number; y: number }; facing: number; isMoving: boolean; puzzleCompleted?: boolean; onSceneReady?: () => void; onSceneError?: () => void; editorOverlay?: EditorOverlayConfig; selectedNpcId?: string | null; onNpcSelect?: (npcId: string) => void; onNpcMove?: (npcId: string, position: { x: number; y: number; z: number }) => void };
const HERO_MODEL = "/models/vanlang-rebirth/hero.runtime.glb";
const radians = (degrees: number) => degrees * Math.PI / 180;
const isLacNhi = (name: string) => name.trim().toLocaleLowerCase("vi") === "lạc nhi";

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

function MapModel({ object, visible = true }: { object: Extract<MapObject, { kind: "model3d" }>; visible?: boolean }) {
  const loaded = useGLTF(object.src);
  const scene = useMemo(() => loaded.scene.clone(true), [loaded.scene]);
  const sceneRef = useRef(scene);
  const opacity = useRef(visible ? 1 : 0);
  useEffect(() => { scene.traverse((node) => { if (node instanceof Mesh) { node.castShadow = object.castShadow; node.receiveShadow = object.receiveShadow; const cloneMaterial = (material: Material) => { const clone = material.clone(); clone.transparent = true; return clone; }; node.material = Array.isArray(node.material) ? node.material.map(cloneMaterial) : cloneMaterial(node.material); } }); }, [object.castShadow, object.receiveShadow, scene]);
  useFrame((_state, delta) => { opacity.current = MathUtils.damp(opacity.current, visible ? 1 : 0, 8, delta); sceneRef.current.visible = opacity.current > 0.01; sceneRef.current.traverse((node) => { if (node instanceof Mesh) for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.opacity = opacity.current; }); });
  const transform = object.transform3d;
  return <group position={[transform.position.x, transform.position.y, transform.position.z]} rotation={[radians(transform.rotationDeg.x), radians(transform.rotationDeg.y), radians(transform.rotationDeg.z)]} scale={[transform.scale.x, transform.scale.y, transform.scale.z]} renderOrder={object.renderOrder}><primitive object={scene} />{visible && object.id === "kinh-duong-vuong-stone" ? <Html center position={[0, 1.75, 0]} distanceFactor={5.5} zIndexRange={[2, 0]}><div className="dungeon-npc-marker" aria-hidden="true"><span className="dungeon-npc-label">{object.name}</span></div></Html> : null}</group>;
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
  return <group position={[position.x, position.y, position.z]}><mesh position={[0, 0.12, 0]} castShadow><cylinderGeometry args={[0.09, 0.14, 0.24, 8]} /><meshStandardMaterial color={isBoss ? "#a73b29" : "#9d7435"} emissive={isBoss ? "#49140d" : "#493117"} /></mesh><mesh position={[0, 0.48, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.14, 0.025, 10, 28]} /><meshBasicMaterial color={isBoss ? "#ff9b73" : "#f4cf83"} /></mesh><Html center position={[0, 0.76, 0]} distanceFactor={5.5} zIndexRange={[2, 0]}><div className={`dungeon-npc-marker ${isBoss ? "is-boss" : ""}${isLacNhi(name) ? " is-lac-nhi" : ""}`} aria-hidden="true"><b className="dungeon-npc-quest-mark">!</b><span className="dungeon-npc-label">{name}</span></div></Html></group>;
}

function RuntimePortalMarker({ portal, groundY, targetName }: { portal: MapDocument["portals"][number]; groundY: number; targetName: string }) {
  const outerRingRef = useRef<Mesh>(null);
  const innerRingRef = useRef<Mesh>(null);
  const sunDiscRef = useRef<Mesh>(null);
  const pulseRingRef = useRef<Mesh>(null);
  const pillarRef = useRef<Mesh>(null);
  const particlesGroupRef = useRef<Group>(null);
  const pulseScale = useRef(0.25);
  const pulseOpacity = useRef(0.9);

  useFrame((_state, delta) => {
    // 1. Vòng trận hoa văn ngoài xoay thuận chiều
    if (outerRingRef.current) {
      outerRingRef.current.rotation.z += delta * 0.35;
    }
    // 2. Vòng thái dương bên trong xoay nghịch chiều (tạo xoáy linh khí thôi miên)
    if (innerRingRef.current) {
      innerRingRef.current.rotation.z -= delta * 0.5;
    }
    // 3. Tâm mặt trời xoay nhẹ
    if (sunDiscRef.current) {
      sunDiscRef.current.rotation.z += delta * 0.2;
    }
    // 4. Sóng linh khí lan tỏa từ tâm ra biên
    pulseScale.current += delta * 0.65;
    pulseOpacity.current = Math.max(0, 1 - pulseScale.current);
    if (pulseScale.current >= 1.0) {
      pulseScale.current = 0.25;
      pulseOpacity.current = 0.9;
    }
    if (pulseRingRef.current) {
      pulseRingRef.current.scale.set(pulseScale.current, pulseScale.current, 1);
      const mat = pulseRingRef.current.material as Material & { opacity: number };
      if (mat) mat.opacity = pulseOpacity.current * 0.85;
    }
    // 5. Cột linh quang thẳng đứng có nhịp thở (breathing beacon)
    if (pillarRef.current) {
      const time = _state.clock.elapsedTime;
      const breath = Math.sin(time * 2.2);
      pillarRef.current.scale.y = 1 + breath * 0.08;
      const mat = pillarRef.current.material as Material & { opacity: number };
      if (mat) mat.opacity = 0.26 + breath * 0.08;
    }
    // 6. Linh hạt vàng kim xoay quanh bán kính cổng
    if (particlesGroupRef.current) {
      particlesGroupRef.current.rotation.y += delta * 0.75;
    }
  });

  const r = portal.trigger.radius;

  return (
    <group position={[portal.trigger.center.x, groundY + 0.03, portal.trigger.center.z]}>
      {/* Nền trận pháp đồng thau đen bóng */}
      <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={20}>
        <circleGeometry args={[r, 48]} />
        <meshBasicMaterial color="#1f140a" transparent opacity={0.4} side={DoubleSide} depthWrite={false} />
      </mesh>

      {/* Vòng ngoài thanh mảnh (xoay thuận) */}
      <mesh ref={outerRingRef} position={[0, 0.006, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={21}>
        <ringGeometry args={[Math.max(0.1, r - 0.045), r, 48]} />
        <meshBasicMaterial color="#e8a83e" transparent opacity={0.88} side={DoubleSide} depthWrite={false} />
      </mesh>

      {/* Vòng đồng tâm giữa thanh nhã */}
      <mesh position={[0, 0.009, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={21}>
        <ringGeometry args={[Math.max(0.08, r * 0.62), Math.max(0.1, r * 0.66), 44]} />
        <meshBasicMaterial color="#ffd470" transparent opacity={0.65} side={DoubleSide} depthWrite={false} />
      </mesh>

      {/* Vòng thái dương bên trong (xoay nghịch) */}
      <mesh ref={innerRingRef} position={[0, 0.013, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={22}>
        <ringGeometry args={[Math.max(0.06, r * 0.3), Math.max(0.08, r * 0.36), 32]} />
        <meshBasicMaterial color="#f7cf7c" transparent opacity={0.9} side={DoubleSide} depthWrite={false} />
      </mesh>

      {/* Tâm Thái Dương nhỏ nhắn tinh tế */}
      <mesh ref={sunDiscRef} position={[0, 0.016, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={22}>
        <circleGeometry args={[Math.max(0.04, r * 0.12), 16]} />
        <meshBasicMaterial color="#fff3bd" transparent opacity={0.95} side={DoubleSide} depthWrite={false} />
      </mesh>

      {/* Sóng xung kích linh khí lan tỏa nhẹ nhàng */}
      <mesh ref={pulseRingRef} position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={23}>
        <ringGeometry args={[Math.max(0.04, r - 0.08), r, 40]} />
        <meshBasicMaterial color="#ffe48f" transparent opacity={0.7} side={DoubleSide} depthWrite={false} />
      </mesh>

      {/* Cột Linh Quang thanh thoát (Ethereal Beacon) */}
      <mesh ref={pillarRef} position={[0, 0.7, 0]} renderOrder={24}>
        <cylinderGeometry args={[Math.max(0.1, r * 0.35), Math.max(0.16, r * 0.52), 1.4, 24, 1, true]} />
        <meshBasicMaterial color="#ffd978" transparent opacity={0.2} side={DoubleSide} depthWrite={false} />
      </mesh>

      {/* Linh hạt phát quang bay lơ lửng quanh cổng */}
      <group ref={particlesGroupRef} position={[0, 0.22, 0]}>
        {[0, 1, 2, 3].map((i) => {
          const angle = (i * Math.PI) / 2;
          const dist = r * 0.55;
          return (
            <mesh key={i} position={[Math.cos(angle) * dist, 0.1 + (i % 2) * 0.1, Math.sin(angle) * dist]}>
              <octahedronGeometry args={[0.03, 0]} />
              <meshBasicMaterial color="#fff4b8" />
            </mesh>
          );
        })}
      </group>

      {/* Thanh Thông Tin Linh Môn tinh gọn 1 dòng (Sleek Horizontal Gamified Info Bar) */}
      <Html center position={[0, 0.45, 0]} distanceFactor={5.5} zIndexRange={[3, 1]}>
        <div className="dungeon-portal-marker" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="dungeon-portal-sun" aria-hidden="true">
            <circle cx="12" cy="12" r="3.2" fill="#ffd978" />
            <path d="M12 2 L13.2 8.5 L19 4 L15.5 9.8 L22 12 L15.5 14.2 L19 20 L13.2 15.5 L12 22 L10.8 15.5 L5 20 L8.5 14.2 L2 12 L8.5 9.8 L5 4 L10.8 8.5 Z" fill="#f5cf83" />
          </svg>
          <strong className="dungeon-portal-title">{targetName}</strong>
          <span className="dungeon-portal-sep" aria-hidden="true">·</span>
          <span className="dungeon-portal-action">Bước vào ▼</span>
        </div>
      </Html>
    </group>
  );
}

function RuntimeNpcModel({ npc, selected, visible = true, showQuestMark = true, onSelect, onMove }: { npc: MapNpc; selected: boolean; visible?: boolean; showQuestMark?: boolean; onSelect?: () => void; onMove?: (position: { x: number; y: number; z: number }) => void }) {
  const loaded = useGLTF(npc.src);
  const scene = useMemo(() => cloneSkeleton(loaded.scene), [loaded.scene]);
  const sceneRef = useRef(scene);
  const opacity = useRef(visible ? 1 : 0);
  useEffect(() => { scene.traverse((node) => { if (node instanceof Mesh) { const cloneMaterial = (material: Material) => { const clone = material.clone(); clone.transparent = true; return clone; }; node.material = Array.isArray(node.material) ? node.material.map(cloneMaterial) : cloneMaterial(node.material); } }); }, [scene]);
  useFrame((_state, delta) => { opacity.current = MathUtils.damp(opacity.current, visible ? 1 : 0, 8, delta); sceneRef.current.visible = opacity.current > 0.01; sceneRef.current.traverse((node) => { if (node instanceof Mesh) for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.opacity = opacity.current; }); });
  const group = useRef<Group>(null);
  const dragPlane = useRef(new Plane());
  const dragOffset = useRef(new Vector3());
  const dragging = useRef(false);
  const rot = npc.transform.rotationDeg ?? { x: 0, y: 0, z: 0 };
  const scl = npc.transform.scale ?? { x: 1, y: 1, z: 1 };
  const pointOnDragPlane = (event: ThreeEvent<PointerEvent>) => {
    const parent = group.current?.parent;
    if (!parent) return null;
    const worldPoint = event.ray.intersectPlane(dragPlane.current, new Vector3());
    return worldPoint ? parent.worldToLocal(worldPoint) : null;
  };
  const content = <group
    ref={group}
    name={`npc-${npc.id}`}
    position={[npc.transform.position.x, npc.transform.position.y, npc.transform.position.z]}
    rotation={[radians(rot.x), radians(rot.y), radians(rot.z)]}
    scale={[scl.x, scl.y, scl.z]}
    onClick={(event) => { event.stopPropagation(); onSelect?.(); }}
    onPointerDown={(event) => {
      if (!onMove || event.button !== 0 || !group.current?.parent) return;
      event.stopPropagation();
      onSelect?.();
      group.current.parent.updateWorldMatrix(true, false);
      dragPlane.current.set(new Vector3(0, 1, 0), -npc.transform.position.y).applyMatrix4(group.current.parent.matrixWorld);
      const point = pointOnDragPlane(event);
      if (!point) return;
      dragOffset.current.set(point.x - npc.transform.position.x, 0, point.z - npc.transform.position.z);
      dragging.current = true;
      (event.target as Element).setPointerCapture(event.pointerId);
    }}
    onPointerMove={(event) => {
      if (!onMove || !dragging.current) return;
      event.stopPropagation();
      const point = pointOnDragPlane(event);
      if (point) onMove({ x: point.x - dragOffset.current.x, y: npc.transform.position.y, z: point.z - dragOffset.current.z });
    }}
    onPointerUp={(event) => {
      if (!dragging.current) return;
      event.stopPropagation();
      dragging.current = false;
      (event.target as Element).releasePointerCapture(event.pointerId);
    }}
  ><primitive object={scene} />{visible ? <Html center position={[0, 1.75, 0]} distanceFactor={5.5} zIndexRange={[2, 0]}><div className={`dungeon-npc-marker${isLacNhi(npc.name) ? " is-lac-nhi" : ""}`} aria-hidden="true">{showQuestMark ? <b className="dungeon-npc-quest-mark">!</b> : null}<span className="dungeon-npc-label">{npc.name}</span></div></Html> : null}</group>;
  return selected && onMove
    ? <TransformControls mode="translate" onObjectChange={() => { const position = group.current?.position; if (position) onMove({ x: position.x, y: position.y, z: position.z }); }}>{content}</TransformControls>
    : content;
}

function PlayerAvatar({ mapDocument, playerPos, facing, isMoving }: DungeonWorldProps) {
  const group = useRef<Group>(null);
  const initialized = useRef(false);
  const locomotionSpeed = useRef(0);
  const { scene: loadedScene, animations } = useGLTF(HERO_MODEL);
  const scene = useMemo(() => cloneSkeleton(loadedScene), [loadedScene]);
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
  return <mesh position={[0, groundY + 0.035, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={1000} onClick={onSelect ? (event) => { event.stopPropagation(); onSelect(); } : undefined}><shapeGeometry args={[shape]} /><meshBasicMaterial color={color} transparent opacity={0.42} side={DoubleSide} depthWrite={false} polygonOffset polygonOffsetFactor={-2} /></mesh>;
}

function OverlayDraft({ points, groundY }: { points: Vec2[]; groundY: number }) {
  return <group name="map-editor-draft">
    {points.length > 1 ? <Line points={points.map((point) => [point.x, groundY + 0.09, point.z])} color="#58e6ff" lineWidth={3} renderOrder={1006} depthTest={false} /> : null}
    {points.map((point, index) => <mesh key={index} position={[point.x, groundY + 0.095, point.z]} rotation={[Math.PI / 2, 0, 0]} renderOrder={1007}><circleGeometry args={[0.09, 24]} /><meshBasicMaterial color="#58e6ff" depthTest={false} depthWrite={false} /></mesh>)}
  </group>;
}

function OverlayDraftSurface({ groundY, rootRef, onPoint }: { groundY: number; rootRef: RefObject<Group | null>; onPoint: (point: Vec2) => void }) {
  return <mesh
    name="map-editor-draft-surface"
    position={[0, groundY + 0.02, 0]}
    rotation={[-Math.PI / 2, 0, 0]}
    renderOrder={999}
    onClick={(event) => {
      event.stopPropagation();
      const root = rootRef.current;
      if (!root) return;
      const local = root.worldToLocal(event.point.clone());
      onPoint({ x: local.x, z: local.z });
    }}
  >
    <planeGeometry args={[20_000, 20_000]} />
    <meshBasicMaterial transparent opacity={0} depthWrite={false} />
  </mesh>;
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
  return <Html center position={[point.x, groundY + 0.12, point.z]} zIndexRange={[60, 51]}>
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
  const spawnValid = isPositionValid(document, spawn);
  const editableNavigation = config.editableNavigation && !config.drawing;
  const polygons = config.showAllPolygons
    ? document.navigation.walkablePolygons.filter((polygon) => polygon.enabled)
    : document.navigation.walkablePolygons.filter((polygon) => polygon.enabled && polygon.id === config.selectedPolygonId);
  return <group name="map-editor-overlay">
    {config.drawing && config.onDraftPoint ? <OverlayDraftSurface groundY={document.world.groundY} rootRef={rootRef} onPoint={config.onDraftPoint} /> : null}
    {config.draft?.length ? <OverlayDraft points={config.draft} groundY={document.world.groundY} /> : null}
    <Html center position={[spawn.x, document.world.groundY + 0.22, spawn.z]} zIndexRange={[40, 31]}><div className={`overlay-spawn-marker${!spawnValid ? " is-invalid" : ""}`} role="img" aria-label="Spawn point">{spawnValid ? "Spawn" : "Spawn không hợp lệ!"}</div></Html>
    <mesh name="spawn-point-marker" position={[spawn.x, document.world.groundY + 0.065, spawn.z]} rotation={[Math.PI / 2, 0, 0]} renderOrder={1002}><ringGeometry args={[0.16, 0.25, 32]} /><meshBasicMaterial color={spawnValid ? "#58e6ff" : "#ff4d4d"} transparent opacity={0.95} side={DoubleSide} depthWrite={false} /></mesh>
    <mesh position={[spawn.x, document.world.groundY + 0.063, spawn.z]} rotation={[Math.PI / 2, 0, 0]} renderOrder={1001}><ringGeometry args={[Math.max(0.05, document.navigation.playerRadius - 0.03), document.navigation.playerRadius, 32]} /><meshBasicMaterial color={spawnValid ? "#58e6ff" : "#ff4d4d"} transparent opacity={spawnValid ? 0.35 : 0.75} side={DoubleSide} depthWrite={false} /></mesh>
    {editableNavigation ? <OverlayPointHandle point={spawn} groundY={document.world.groundY} rootRef={rootRef} label={spawnValid ? "Di chuyển điểm spawn" : "Di chuyển điểm spawn (đang ngoài vùng hợp lệ)"} onSelect={() => {}} onMove={(point) => config.onSpawnMove?.(point)} /> : null}
    {document.navigation.entryPoints.map((entryPoint) => {
      const selected = entryPoint.id === config.selectedEntryPointId;
      return <group key={entryPoint.id}>
        <group position={[entryPoint.position.x, document.world.groundY + 0.075, entryPoint.position.z]} rotation={[0, entryPoint.facingDeg * Math.PI / 180, 0]} onClick={!config.drawing ? (event) => { event.stopPropagation(); config.onEntryPointSelect?.(entryPoint.id); } : undefined}>
          <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={1003}><ringGeometry args={[0.18, selected ? 0.34 : 0.29, 32]} /><meshBasicMaterial color={selected ? "#fff2a8" : "#58e6ff"} transparent opacity={0.98} side={DoubleSide} depthWrite={false} /></mesh>
          <mesh position={[0, 0, 0.34]} rotation={[Math.PI / 2, 0, 0]} renderOrder={1003}><coneGeometry args={[0.12, 0.28, 3]} /><meshBasicMaterial color={selected ? "#fff2a8" : "#58e6ff"} transparent opacity={0.98} depthWrite={false} /></mesh>
          <Html center position={[0, 0.28, 0]} zIndexRange={[40, 31]}><button type="button" className="overlay-navigation-label" aria-label={`Entrypoint ${entryPoint.id}`}>{entryPoint.id}</button></Html>
        </group>
        {editableNavigation ? <OverlayPointHandle point={entryPoint.position} groundY={document.world.groundY} rootRef={rootRef} label={`Di chuyển entrypoint ${entryPoint.id}`} onSelect={() => config.onEntryPointSelect?.(entryPoint.id)} onMove={(point) => config.onEntryPointMove?.(entryPoint.id, point)} /> : null}
      </group>;
    })}
    {document.portals.filter((portal) => portal.enabled).map((portal) => {
      const selected = portal.id === config.selectedPortalId;
      return <group key={portal.id}>
        <group position={[portal.trigger.center.x, document.world.groundY + 0.06, portal.trigger.center.z]} onClick={!config.drawing ? (event) => { event.stopPropagation(); config.onPortalSelect?.(portal.id); } : undefined}>
          <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={1003}><circleGeometry args={[portal.trigger.radius, 48]} /><meshBasicMaterial color={selected ? "#e8a83e" : "#87531d"} transparent opacity={selected ? 0.48 : 0.28} side={DoubleSide} depthWrite={false} /></mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={1004}><ringGeometry args={[Math.max(0.04, portal.trigger.radius - 0.06), portal.trigger.radius, 48]} /><meshBasicMaterial color={selected ? "#fff2a8" : "#ffd066"} transparent opacity={0.98} side={DoubleSide} depthWrite={false} /></mesh>
          <Html center position={[0, 0.28, 0]} zIndexRange={[40, 31]}><button type="button" className="overlay-navigation-label is-portal" aria-label={`Portal ${portal.id} tới ${portal.target.mapId}`}>➔ {portal.target.mapId} ({portal.id})</button></Html>
        </group>
        {editableNavigation ? <OverlayPointHandle point={portal.trigger.center} groundY={document.world.groundY} rootRef={rootRef} label={`Di chuyển portal ${portal.id}`} onSelect={() => config.onPortalSelect?.(portal.id)} onMove={(point) => config.onPortalMove?.(portal.id, point)} /> : null}
      </group>;
    })}
    {polygons.map((polygon) => <group key={polygon.id}>
      <OverlayPolygon points={polygon.points} color={polygon.id === config.selectedPolygonId ? "#ffc55b" : "#48e692"} groundY={document.world.groundY} onSelect={config.drawing ? undefined : () => config.onPolygonSelect?.(polygon.id)} />
      {config.editablePolygons && !config.drawing ? polygon.points.map((point, index) => <OverlayPointHandle key={index} point={point} groundY={document.world.groundY} rootRef={rootRef} label={`Di chuyển điểm ${index + 1} của ${polygon.id}`} onSelect={() => config.onPolygonSelect?.(polygon.id)} onMove={(next) => config.onPointMove?.(polygon.id, index, next)} />) : null}
      {config.editablePolygons && !config.drawing && polygon.id === config.selectedPolygonId ? polygon.points.map((point, index) => {
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
  return <><ambientLight intensity={1.8} color="#f7e1ba" /><hemisphereLight intensity={1.5} color="#fff0d0" groundColor="#2b1d16" /><directionalLight position={[5, 10, 7]} intensity={2.6} color="#ffe0a3" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} /><CameraRig document={document} /><group ref={rootRef} position={[root.position.x, root.position.y, root.position.z]} rotation={[radians(root.rotationDeg.x), radians(root.rotationDeg.y), radians(root.rotationDeg.z)]} scale={[root.scale.x, root.scale.y, root.scale.z]}><NavmeshSurface document={document} /><Suspense fallback={null}>{models.filter((object) => !object.binding).map((object) => <MapModel key={object.id} object={object} visible={object.id !== "kinh-duong-vuong-stone" || !props.puzzleCompleted} />)}{models.filter((object) => object.binding).map((object) => { const npc = dungeonNpcs.find((item) => item.id === object.binding?.entityId); return npc ? <NpcBeacon key={object.id} name={npc.name} isBoss={npc.role === "boss"} position={object.transform3d.position} /> : null; })}{document.npcs.map((npc) => <RuntimeNpcModel key={npc.id} npc={npc} selected={props.selectedNpcId === npc.id} visible={Boolean(props.editorOverlay) || npc.id !== "kinh-duong-vuong" || Boolean(props.puzzleCompleted)} showQuestMark={!isLacNhi(npc.name) || !props.lacNhiDialogueCompleted} onSelect={props.onNpcSelect ? () => props.onNpcSelect?.(npc.id) : undefined} onMove={props.onNpcMove ? (position) => props.onNpcMove?.(npc.id, position) : undefined} />)}{!props.editorOverlay ? (props.activePortals ?? document.portals).filter((portal) => portal.enabled).map((portal) => <RuntimePortalMarker key={portal.id} portal={portal} groundY={document.world.groundY} targetName={props.portalMapNames?.[portal.target.mapId] ?? portal.target.mapId} />) : null}<PlayerAvatar {...props} /><SceneReady onReady={props.onSceneReady} /></Suspense>{props.editorOverlay ? <EditorOverlay document={document} config={props.editorOverlay} rootRef={rootRef} /> : null}<ContactShadows position={[0, document.world.groundY + 0.01, 0]} opacity={0.32} scale={11} blur={2.2} far={4} /></group></>;
}

export function VanlangDungeonWorld(props: DungeonWorldProps) {
  const camera = props.mapDocument.world.camera;
  return <SceneErrorBoundary onError={props.onSceneError}><div className="dungeon-world" aria-label="Đấu trường chuyển sinh Văn Lang 3D"><Canvas style={props.onNpcMove ? { touchAction: "none" } : undefined} shadows dpr={[1, 1.35]} camera={{ position: [camera.position.x, camera.position.y, camera.position.z], fov: camera.fovDeg, near: camera.near, far: camera.far }} gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }} onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}><RebirthArena {...props} /></Canvas></div></SceneErrorBoundary>;
}

useGLTF.preload(HERO_MODEL);
