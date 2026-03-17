'use client';

import React, { useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Float, Grid, ContactShadows, Text } from '@react-three/drei';
import * as THREE from 'three';
import { HandTrackingData } from './HandTracking';

// --- 3D FACTORY ---
function AdaptiveComponent({ data }: any) {
  const { type, position, scale, color, material } = data;
  const pos = Array.isArray(position) ? position : [0, 0, 0];
  const scl = Array.isArray(scale) ? scale : [1, 1, 1];

  return (
    <mesh position={pos as any} scale={scl as any}>
      {type?.toLowerCase() === 'box' && <boxGeometry args={[1, 1, 1]} />}
      {type?.toLowerCase() === 'sphere' && <sphereGeometry args={[1, 32, 32]} />}
      {type?.toLowerCase() === 'cylinder' && <cylinderGeometry args={[1, 1, 1, 32]} />}
      {type?.toLowerCase() === 'cone' && <coneGeometry args={[1, 2, 32]} />}
      <meshPhysicalMaterial
        color={color || '#22d3ee'}
        roughness={material?.roughness ?? 0.1}
        metalness={material?.metalness ?? 0.8}
        clearcoat={material?.clearcoat ?? 1}
        clearcoatRoughness={0.1}
      />
    </mesh>
  );
}

interface SceneContentProps {
  handData: HandTrackingData;
  assemblyList: any[];
}

// Separate component for content inside Canvas to use R3F hooks
const SceneContent: React.FC<SceneContentProps> = ({ handData, assemblyList }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;

    if (handData.isHandDetected && handData.landmarks) {
      // Use middle finger MCP (landmark 9) for stable rotation
      const palm = handData.landmarks[9];
      
      // Target rotation based on hand position
      // Normalized coordinates from HandTracking (0-1)
      const targetRotY = (palm.x - 0.5) * 4; 
      const targetRotX = (palm.y - 0.5) * 2;

      // Smooth interpolation
      groupRef.current.rotation.y += (targetRotY - groupRef.current.rotation.y) * 0.1;
      groupRef.current.rotation.x += (targetRotX - groupRef.current.rotation.x) * 0.1;
    }
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <spotLight position={[10, 10, 10]} intensity={2} color="#00ffff" />
      <pointLight position={[-10, -10, -10]} intensity={1} color="#ff00ff" />
      
      <Suspense fallback={null}>
        <group ref={groupRef}>
          <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
            {assemblyList.length > 0 ? (
              assemblyList.map((item, i) => (
                <AdaptiveComponent key={item.id + i} data={item} />
              ))
            ) : (
              <mesh>
                <torusKnotGeometry args={[1, 0.3, 128, 16]} />
                <meshPhysicalMaterial 
                  color="#06b6d4" 
                  metalness={0.9} 
                  roughness={0.1} 
                  emissive="#0891b2" 
                  emissiveIntensity={0.5} 
                />
              </mesh>
            )}
          </Float>
        </group>
        
        <ContactShadows position={[0, -1.5, 0]} opacity={0.4} scale={20} blur={2} far={4.5} />
        <Environment preset="city" />
        
        {handData.isPinching && (
          <Text
            position={[0, 4, 0]}
            fontSize={0.3}
            color="#22d3ee"
            anchorX="center"
            anchorY="middle"
          >
            HAND CONNECTED
          </Text>
        )}
      </Suspense>

      <Grid 
        infiniteGrid 
        sectionSize={1} 
        cellSize={0.5} 
        fadeDistance={25} 
        sectionColor="#1e293b" 
        cellColor="#0f172a" 
        position={[0, -1.5, 0]} 
      />
      
      <OrbitControls 
        enablePan={false} 
        enableZoom={true} 
        makeDefault 
        minPolarAngle={Math.PI / 4} 
        maxPolarAngle={Math.PI / 2} 
      />
    </>
  );
};

interface ARSceneProps {
  handData: HandTrackingData;
  assemblyList: any[];
}

export const ARScene: React.FC<ARSceneProps> = ({ handData, assemblyList }) => {
  return (
    <Canvas
      camera={{ position: [0, 2, 5], fov: 45 }}
      gl={{ alpha: true, antialias: true }}
      dpr={[1, 2]}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
      }}
      style={{ background: 'transparent' }}
    >
      <SceneContent handData={handData} assemblyList={assemblyList} />
    </Canvas>
  );
};
