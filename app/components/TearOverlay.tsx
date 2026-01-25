"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Fullscreen plane with tear shader
function TearPlane({ progress }: { progress: number }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uProgress.value = progress;
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
        uniforms={{
          uProgress: { value: 0 },
        }}
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

            // Radius grows with progress
            float radius = uProgress * 1.2;

            // alpha = 0 inside hole, alpha = 1 outside
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
      style={{ zIndex: 100 }}
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
