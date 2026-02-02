"use client";

import { useRef, useEffect, useState, Suspense, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ============================================
// MOUSE TRACKING HOOK
// ============================================
function useMousePosition() {
  const target = useRef({ x: 0, y: 0 });
  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const update = () => {
    target.current.x += (mouse.current.x - target.current.x) * 0.05;
    target.current.y += (mouse.current.y - target.current.y) * 0.05;
    return target.current;
  };

  return { update };
}

// ============================================
// COSMIC BACKGROUND - Diagonal Gradient
// ============================================
function CosmicBackground() {
  const uniforms = useMemo(
    () => ({
      uColor1: { value: new THREE.Color("#0f0a35") },
      uColor2: { value: new THREE.Color("#2a3a9e") },
      uColor3: { value: new THREE.Color("#0a1545") },
    }),
    []
  );

  return (
    <mesh position={[0, 0, -250]}>
      <planeGeometry args={[1200, 800]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 uColor1;
          uniform vec3 uColor2;
          uniform vec3 uColor3;
          varying vec2 vUv;

          void main() {
            vec2 uv = vUv;
            float diagonal = uv.x * 0.7 + uv.y * 0.3;
            vec3 color = mix(uColor1, uColor2, smoothstep(0.0, 0.5, diagonal));
            color = mix(color, uColor3, smoothstep(0.5, 1.0, diagonal));
            gl_FragColor = vec4(color, 1.0);
          }
        `}
      />
    </mesh>
  );
}

// ============================================
// SUBTLE STARS - Background stars with parallax
// ============================================
function SubtleStars({ mouseTarget }: { mouseTarget: { x: number; y: number } }) {
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const COUNT = 250;

  const { positions, sizes } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const sizes = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 2] = -15 - Math.random() * 15;
      sizes[i] = Math.random() * 1.2 + 0.4;
    }

    return { positions, sizes };
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1 },
    }),
    []
  );

  useFrame((state) => {
    if (pointsRef.current) {
      const material = pointsRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = state.clock.elapsedTime;
    }

    if (groupRef.current) {
      groupRef.current.rotation.x = mouseTarget.y * 0.08;
      groupRef.current.rotation.y = mouseTarget.x * 0.08;
    }
  });

  return (
    <group ref={groupRef}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={COUNT}
            array={positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-aSize"
            count={COUNT}
            array={sizes}
            itemSize={1}
          />
        </bufferGeometry>
        <shaderMaterial
          uniforms={uniforms}
          transparent={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          vertexShader={`
            attribute float aSize;
            uniform float uPixelRatio;
            void main() {
              vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
              gl_PointSize = aSize * uPixelRatio * (250.0 / -mvPosition.z);
              gl_Position = projectionMatrix * mvPosition;
            }
          `}
          fragmentShader={`
            uniform float uTime;
            void main() {
              float dist = length(gl_PointCoord - 0.5);
              if (dist > 0.5) discard;
              float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
              float twinkle = sin(uTime * 1.5 + gl_FragCoord.x * 0.1) * 0.2 + 0.8;
              gl_FragColor = vec4(1.0, 1.0, 1.0, alpha * 0.5 * twinkle);
            }
          `}
        />
      </points>
    </group>
  );
}

// ============================================
// SCENE - Background + Stars only
// ============================================
function Scene() {
  const { update } = useMousePosition();
  const mouseTargetRef = useRef({ x: 0, y: 0 });

  useFrame(() => {
    const target = update();
    mouseTargetRef.current.x = target.x;
    mouseTargetRef.current.y = target.y;
  });

  return (
    <>
      <CosmicBackground />
      <SubtleStars mouseTarget={mouseTargetRef.current} />
    </>
  );
}

// ============================================
// MAIN COMPONENT - Fixed background for entire page
// ============================================
export default function CosmicFixedBackground() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Small delay to ensure smooth fade-in after mount
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="fixed inset-0 -z-10 transition-opacity duration-1000 ease-out"
      style={{ opacity: isVisible ? 1 : 0 }}
    >
      <Canvas
        camera={{ position: [0, 0, 8], fov: 65, near: 0.1, far: 300 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}
