"use client";

import { Clone, ContactShadows, useAnimations, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { dungeonNpcs } from "./vanlang-mock-data";

type Vector3 = [number, number, number];

type DungeonWorldProps = {
  playerPos: { x: number; y: number };
  selectedCharacterId: string;
  motionKey: number;
};

type PropSpec = {
  src: string;
  position: Vector3;
  rotation?: Vector3;
  scale?: number;
};

const modelRoot = "/models/vanlang";

const scenery: PropSpec[] = [
  { src: `${modelRoot}/tree-high.glb`, position: [-5.4, 0, -4.2], scale: 1.4 },
  { src: `${modelRoot}/tree.glb`, position: [-3.8, 0, -4.7], rotation: [0, 0.8, 0], scale: 1.2 },
  { src: `${modelRoot}/tree-high.glb`, position: [4.9, 0, -4], rotation: [0, -0.5, 0], scale: 1.25 },
  { src: `${modelRoot}/tree.glb`, position: [5.6, 0, 3.8], rotation: [0, 1.2, 0], scale: 1.25 },
  { src: `${modelRoot}/tree.glb`, position: [-5.5, 0, 3.8], rotation: [0, -1, 0], scale: 1.35 },
  { src: `${modelRoot}/rock-large.glb`, position: [-4.7, 0, 1.7], rotation: [0, 0.6, 0], scale: 1.1 },
  { src: `${modelRoot}/rock-wide.glb`, position: [4.3, 0, 2.4], rotation: [0, -0.4, 0], scale: 1.05 },
  { src: `${modelRoot}/fence.glb`, position: [-2.7, 0, 4.6], rotation: [0, 1.57, 0], scale: 1.2 },
  { src: `${modelRoot}/fence.glb`, position: [-1.2, 0, 4.6], rotation: [0, 1.57, 0], scale: 1.2 },
  { src: `${modelRoot}/fence-gate.glb`, position: [0.4, 0, 4.6], rotation: [0, 1.57, 0], scale: 1.2 },
  { src: `${modelRoot}/cart.glb`, position: [3.2, 0, -2.8], rotation: [0, -0.75, 0], scale: 1.1 },
];

const worldPosition = (x: number, y: number): Vector3 => [(x - 3.5) * 1.05, 0, (y - 3.5) * 0.92];

function CameraRig() {
  const { camera } = useThree();

  useFrame(() => {
    camera.lookAt(0, 0.45, 0);
  });

  return null;
}

function SceneryProp({ src, position, rotation = [0, 0, 0], scale = 1 }: PropSpec) {
  const { scene } = useGLTF(src);

  return <Clone object={scene} position={position} rotation={rotation} scale={scale} castShadow receiveShadow />;
}

function VillageHouse({ position, rotation = 0 }: { position: Vector3; rotation?: number }) {
  const { scene: wall } = useGLTF(`${modelRoot}/wall-wood-block.glb`);
  const { scene: roof } = useGLTF(`${modelRoot}/roof-gable.glb`);

  return (
    <group position={position} rotation={[0, rotation, 0]} scale={1.3}>
      <Clone object={wall} castShadow receiveShadow />
      <Clone object={roof} position={[0, 1.25, 0]} castShadow receiveShadow />
    </group>
  );
}

function NpcBeacon({ position, isBoss }: { position: Vector3; isBoss: boolean }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.24, 0.3, 8]} />
        <meshStandardMaterial color={isBoss ? "#c99a40" : "#4bb7ad"} emissive={isBoss ? "#4d2f08" : "#0a403b"} />
      </mesh>
      <mesh position={[0, 0.72, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.035, 10, 24]} />
        <meshBasicMaterial color={isBoss ? "#ffd978" : "#9bf6ee"} />
      </mesh>
    </group>
  );
}

function PlayerAvatar({ source, position, motionKey }: { source: string; position: Vector3; motionKey: number }) {
  const group = useRef<Group>(null);
  const { scene, animations } = useGLTF(source);
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    scene.traverse((node) => {
      node.castShadow = true;
      node.receiveShadow = true;
    });
  }, [scene]);

  useEffect(() => {
    const idle = actions.combat_idle;
    idle?.reset().fadeIn(0.2).play();

    return () => {
      idle?.fadeOut(0.15);
    };
  }, [actions]);

  useEffect(() => {
    if (!motionKey) return;

    const run = actions.combat_run;
    const idle = actions.combat_idle;
    run?.reset().fadeIn(0.1).play();
    const timer = window.setTimeout(() => {
      run?.fadeOut(0.12);
      idle?.reset().fadeIn(0.12).play();
    }, 360);

    return () => window.clearTimeout(timer);
  }, [actions, motionKey]);

  return (
    <group ref={group} position={[position[0], 0.96, position[2]]} rotation={[0, Math.PI, 0]} scale={1.18}>
      <primitive object={scene} />
    </group>
  );
}

function VillageScene({ playerPos, selectedCharacterId, motionKey }: DungeonWorldProps) {
  const playerSource = useMemo(
    () =>
      selectedCharacterId === "hero-linh"
        ? "/models/ve-binh-ao-luc.optimized.glb"
        : "/models/chien-binh-giap-do.optimized.glb",
    [selectedCharacterId],
  );

  return (
    <>
      <color attach="background" args={["#071616"]} />
      <fog attach="fog" args={["#071616", 12, 23]} />
      <hemisphereLight intensity={1.1} color="#d6f6e9" groundColor="#102c26" />
      <directionalLight position={[7, 10, 6]} intensity={2.3} color="#ffd99a" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight position={[-5, 4, -3]} intensity={0.8} color="#72dad1" />
      <CameraRig />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[8.3, 64]} />
        <meshStandardMaterial color="#375b3e" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.012, -0.45]} rotation={[-Math.PI / 2, 0.08, 0]} receiveShadow>
        <planeGeometry args={[12, 1.45]} />
        <meshStandardMaterial color="#2c8680" roughness={0.35} metalness={0.1} />
      </mesh>

      <Suspense fallback={null}>
        {scenery.map((prop) => (
          <SceneryProp key={`${prop.src}-${prop.position.join("-")}`} {...prop} />
        ))}
        <VillageHouse position={[-2.8, 0, -1.7]} rotation={0.35} />
        <VillageHouse position={[1.8, 0, 2.55]} rotation={-0.55} />
        {dungeonNpcs.map((npc) => (
          <NpcBeacon key={npc.id} position={worldPosition(npc.x, npc.y)} isBoss={npc.role === "boss"} />
        ))}
        <PlayerAvatar key={playerSource} source={playerSource} position={worldPosition(playerPos.x, playerPos.y)} motionKey={motionKey} />
      </Suspense>

      <ContactShadows position={[0, 0.01, 0]} opacity={0.36} scale={13} blur={2.4} far={5} />
    </>
  );
}

export function VanlangDungeonWorld(props: DungeonWorldProps) {
  return (
    <div className="dungeon-world" aria-label="Phó bản 3D Văn Lang">
      <Canvas
        shadows
        dpr={[1, 1.25]}
        camera={{ position: [8.8, 8.2, 10.5], fov: 38 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      >
        <VillageScene {...props} />
      </Canvas>
    </div>
  );
}
