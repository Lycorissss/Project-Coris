'use client';

import React, { useRef, Suspense, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Float, Grid, ContactShadows, Text, RoundedBox } from '@react-three/drei';
import { EffectComposer, Bloom, N8AO, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { HandTrackingData } from './HandTracking';

// --- 3D FACTORY ---
interface MaterialProps {
  roughness?: number;
  metalness?: number;
  clearcoat?: number;
  transmission?: number;
  thickness?: number;
  envMapIntensity?: number;
}

interface ComponentData {
  id: string;
  type: string;
  position: number[];
  scale: number[];
  color: string;
  material?: MaterialProps;
}

interface AdaptiveComponentProps {
  data: ComponentData;
}

function AdaptiveComponent({ data }: AdaptiveComponentProps) {
  const { type, position, scale, color, material } = data;
  const pos: [number, number, number] = Array.isArray(position) && position.length === 3 
    ? [position[0], position[1], position[2]] 
    : [0, 0, 0];
  const scl: [number, number, number] = Array.isArray(scale) && scale.length === 3 
    ? [scale[0], scale[1], scale[2]] 
    : [1, 1, 1];

  // Parse material properties with new high-fidelity options
  const roughness = material?.roughness ?? 0.2;
  const metalness = material?.metalness ?? 0.6;
  const clearcoat = material?.clearcoat ?? 0.5;
  const transmission = material?.transmission ?? 0; // For glass-like materials
  const thickness = material?.thickness ?? 0; // For subsurface scattering effect
  const envMapIntensity = material?.envMapIntensity ?? 1;

  // Check if material should be transparent/glass-like
  const isGlass = transmission > 0;

  return (
    <mesh position={pos} scale={scl} castShadow receiveShadow>
      {type?.toLowerCase() === 'box' && (
        <RoundedBox args={[1, 1, 1]} radius={0.02} smoothness={4} />
      )}
      {type?.toLowerCase() === 'sphere' && <sphereGeometry args={[1, 64, 64]} />}
      {type?.toLowerCase() === 'cylinder' && <cylinderGeometry args={[1, 1, 1, 64]} />}
      {type?.toLowerCase() === 'cone' && <coneGeometry args={[1, 2, 64]} />}
      {type?.toLowerCase() === 'pyramid' && <coneGeometry args={[1, 1.5, 4]} />}
      
      <meshPhysicalMaterial
        color={color || '#22d3ee'}
        roughness={roughness}
        metalness={metalness}
        clearcoat={clearcoat}
        clearcoatRoughness={0.1}
        transmission={transmission}
        thickness={thickness}
        envMapIntensity={envMapIntensity}
        ior={isGlass ? 1.5 : 1} // Index of refraction for glass
        transparent={isGlass}
        opacity={isGlass ? 0.9 : 1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

interface SceneContentProps {
  handData: HandTrackingData;
  assemblyList: ComponentData[];
}

// Separate component for content inside Canvas to use R3F hooks
const SceneContent: React.FC<SceneContentProps> = ({ handData, assemblyList }) => {
  const groupRef = useRef<THREE.Group>(null);
  const { gl } = useThree();
  const initialized = useRef(false);

  // Configure tone mapping for high-fidelity rendering
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!initialized.current) {
      gl.toneMapping = THREE.ACESFilmicToneMapping;
      gl.toneMappingExposure = 1.2;
      gl.shadowMap.enabled = true;
      gl.shadowMap.type = THREE.PCFSoftShadowMap;
      initialized.current = true;
    }
  }, [gl]);

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
      {/* High-fidelity lighting setup */}
      <ambientLight intensity={0.3} />
      
      {/* Main directional light with shadows */}
      <directionalLight
        position={[10, 15, 10]}
        intensity={2.5}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      >
        <orthographicCamera attach="shadow-camera" args={[-20, 20, 20, -20]} />
      </directionalLight>

      {/* Rim light for edge highlighting */}
      <spotLight
        position={[-10, 10, -10]}
        intensity={1.5}
        color="#00ffff"
        angle={0.3}
        penumbra={1}
      />

      {/* Fill light for shadows */}
      <pointLight position={[-10, 5, -10]} intensity={0.8} color="#ff00ff" />

      <Suspense fallback={null}>
        <group ref={groupRef}>
          <Float speed={2} rotationIntensity={0.3} floatIntensity={0.3}>
            {assemblyList.length > 0 ? (
              assemblyList.map((item, i) => (
                <AdaptiveComponent key={item.id + i} data={item} />
              ))
            ) : (
              <mesh castShadow receiveShadow>
                <torusKnotGeometry args={[1, 0.3, 128, 64]} />
                <meshPhysicalMaterial
                  color="#06b6d4"
                  metalness={0.9}
                  roughness={0.1}
                  clearcoat={1}
                  clearcoatRoughness={0.1}
                  emissive="#0891b2"
                  emissiveIntensity={0.3}
                  envMapIntensity={1.5}
                />
              </mesh>
            )}
          </Float>
        </group>

        {/* High-quality contact shadows with blur */}
        <ContactShadows
          position={[0, -1.5, 0]}
          opacity={0.6}
          scale={20}
          blur={2.5}
          far={4.5}
          color="#000000"
          resolution={512}
          frames={1}
        />

        {/* HDRI Environment for realistic reflections */}
        <Environment preset="city" background={false} blur={0.8} />

        {/* Hand connection indicator */}
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

      {/* Infinite grid with subtle styling */}
      <Grid
        infiniteGrid
        sectionSize={1}
        cellSize={0.5}
        fadeDistance={30}
        fadeStrength={2}
        sectionColor="#1e293b"
        cellColor="#0f172a"
        position={[0, -1.5, 0]}
      />

      {/* Post-processing for high-fidelity rendering */}
      <EffectComposer>
        {/* Bloom with intensity 0.5 */}
        <Bloom
          luminanceThreshold={0.8}
          mipmapBlur
          intensity={0.5}
          radius={0.4}
          levels={9}
        />

        {/* N8AO for ambient occlusion and shadow crevices */}
        <N8AO
          intensity={1.2}
          aoRadius={1.5}
        />

        {/* Subtle vignette for depth */}
        <Vignette
          darkness={0.3}
          offset={0.5}
        />
      </EffectComposer>

      {/* Orbit controls with limits */}
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        makeDefault
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 2}
        minDistance={3}
        maxDistance={15}
        enableDamping
        dampingFactor={0.05}
      />
    </>
  );
};

interface ARSceneProps {
  handData: HandTrackingData;
  assemblyList: ComponentData[];
}

export const ARScene: React.FC<ARSceneProps> = ({ handData, assemblyList }) => {
  return (
    <Canvas
      camera={{ position: [0, 2, 5], fov: 45 }}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
      }}
      dpr={[1, 2]}
      shadows
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
      }}
      style={{ background: 'transparent' }}
    >
      <SceneContent handData={handData} assemblyList={assemblyList} />
    </Canvas>
  );
};
