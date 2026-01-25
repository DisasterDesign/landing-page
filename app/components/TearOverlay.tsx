"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Fullscreen plane with tear shader
function TearPlane({ progress }: { progress: number }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Create uniforms once with useMemo
  const uniforms = useMemo(
    () => ({
      uProgress: { value: 0 },
    }),
    []
  );

  // Update uniform every frame
  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uProgress.value = progress;
      // Debug log
      if (Math.random() < 0.01) {
        console.log("TearOverlay progress:", progress);
      }
    }
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        transparent={true}
        depthTest={false}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uProgress;
          varying vec2 vUv;

          void main() {
            vec2 center = vec2(0.5, 0.5);
            float dist = distance(vUv, center);

            // Radius starts negative so hole doesn't exist at progress=0
            // progress=0 → radius=-0.2 → no visible hole
            // progress=1 → radius=1.0 → hole covers screen
            float radius = uProgress * 1.2 - 0.2;

            // alpha = 1 outside (orange visible), alpha = 0 inside (hole/transparent)
            float alpha = smoothstep(radius, radius + 0.05, dist);

            // Orange color
            vec3 orangeColor = vec3(0.95, 0.45, 0.15);

            gl_FragColor = vec4(orangeColor, alpha);
          }
        `}
      />
    </mesh>
  );
}

interface TearOverlayProps {
  progress: number;
  visible: boolean;
}

export default function TearOverlay({ progress, visible }: TearOverlayProps) {
  // Don't render if not visible and no progress
  if (!visible && progress === 0) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 3 }}
    >
      <Canvas
        orthographic
        camera={{ position: [0, 0, 1], zoom: 1 }}
        gl={{ alpha: true, antialias: false }}
      >
        <TearPlane progress={progress} />
      </Canvas>
    </div>
  );
}
