"use client";

import { Environment, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";

function PlaceholderAvatar() {
  return (
    <group position={[0, -0.8, 0]}>
      <mesh position={[0, 1.45, 0]} castShadow>
        <sphereGeometry args={[0.42, 32, 32]} />
        <meshStandardMaterial color="#d8a86b" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.45, 0]} castShadow>
        <capsuleGeometry args={[0.55, 1.2, 8, 24]} />
        <meshStandardMaterial color="#8f2635" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.58, 0.48]} rotation={[0.1, 0, 0]} castShadow>
        <boxGeometry args={[0.65, 0.15, 0.08]} />
        <meshStandardMaterial color="#e3a52f" metalness={0.35} roughness={0.45} />
      </mesh>
    </group>
  );
}

export function AvatarPreview() {
  return (
    <div className="avatar-stage">
      <Canvas camera={{ position: [0, 1.2, 4.5], fov: 42 }} shadows dpr={[1, 1.5]}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[3, 5, 4]} intensity={2.2} castShadow />
        <PlaceholderAvatar />
        <Environment preset="sunset" />
        <OrbitControls enablePan={false} minDistance={3} maxDistance={6} />
      </Canvas>
    </div>
  );
}
