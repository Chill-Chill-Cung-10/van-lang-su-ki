"use client";

import type { MapDocument, MapObject } from "@van-lang/map-contract";
import { ContactShadows, Html, useAnimations, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { BufferGeometry, Float32BufferAttribute, Group, MathUtils, Mesh } from "three";
import { dungeonNpcs } from "./vanlang-mock-data";

type DungeonWorldProps = { mapDocument: MapDocument; playerPos: { x: number; y: number }; facing: number; isMoving: boolean; onSceneReady?: () => void };
const HERO_MODEL = "/models/vanlang-rebirth/hero.runtime.glb";
const radians = (degrees: number) => degrees * Math.PI / 180;

class SceneErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* Static background remains visible. */ }
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

function RebirthArena(props: DungeonWorldProps) {
  const document = props.mapDocument;
  const root = document.world.rootTransform;
  const models = document.objects.filter((object): object is Extract<MapObject, { kind: "model3d" }> => object.kind === "model3d" && object.enabled).sort((a, b) => a.renderOrder - b.renderOrder || a.id.localeCompare(b.id));
  return <><ambientLight intensity={1.8} color="#f7e1ba" /><hemisphereLight intensity={1.5} color="#fff0d0" groundColor="#2b1d16" /><directionalLight position={[5, 10, 7]} intensity={2.6} color="#ffe0a3" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} /><CameraRig document={document} /><group position={[root.position.x, root.position.y, root.position.z]} rotation={[radians(root.rotationDeg.x), radians(root.rotationDeg.y), radians(root.rotationDeg.z)]} scale={[root.scale.x, root.scale.y, root.scale.z]}><NavmeshSurface document={document} /><Suspense fallback={null}>{models.filter((object) => !object.binding).map((object) => <MapModel key={object.id} object={object} />)}{models.filter((object) => object.binding).map((object) => { const npc = dungeonNpcs.find((item) => item.id === object.binding?.entityId); return npc ? <NpcBeacon key={object.id} name={npc.name} isBoss={npc.role === "boss"} position={object.transform3d.position} /> : null; })}<PlayerAvatar {...props} /><SceneReady onReady={props.onSceneReady} /></Suspense><ContactShadows position={[0, document.world.groundY + 0.01, 0]} opacity={0.32} scale={11} blur={2.2} far={4} /></group></>;
}

export function VanlangDungeonWorld(props: DungeonWorldProps) {
  const camera = props.mapDocument.world.camera;
  return <SceneErrorBoundary><div className="dungeon-world" aria-label="Đấu trường chuyển sinh Văn Lang 3D"><Canvas shadows dpr={[1, 1.35]} camera={{ position: [camera.position.x, camera.position.y, camera.position.z], fov: camera.fovDeg, near: camera.near, far: camera.far }} gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }} onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}><RebirthArena {...props} /></Canvas></div></SceneErrorBoundary>;
}

useGLTF.preload(HERO_MODEL);
