"use client";

import { useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface GlowingSphereProps {
  groupRef: React.RefObject<THREE.Group>;
}

function GlowingSphere({ groupRef }: GlowingSphereProps) {
  // יצירת חומר זוהר עם אפקט Fresnel
  const glowMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color("#88bbff") },
        uOpacity: { value: 0.8 },
      },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 1.5);
          gl_FragColor = vec4(uColor, intensity * uOpacity);
        }
      `,
    });
  }, []);

  // הילה חיצונית - יותר גדולה ושקופה
  const haloMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      uniforms: {
        uColor: { value: new THREE.Color("#6699ff") },
        uOpacity: { value: 0.15 },
      },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.5 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          gl_FragColor = vec4(uColor, intensity * uOpacity);
        }
      `,
    });
  }, []);

  useEffect(() => {
    return () => {
      glowMaterial.dispose();
      haloMaterial.dispose();
    };
  }, [glowMaterial, haloMaterial]);

  return (
    <group ref={groupRef}>
      {/* כדור פנימי זוהר */}
      <mesh>
        <sphereGeometry args={[1.0, 64, 64]} />
        <primitive object={glowMaterial} attach="material" />
      </mesh>
      {/* הילה חיצונית */}
      <mesh>
        <sphereGeometry args={[1.8, 32, 32]} />
        <primitive object={haloMaterial} attach="material" />
      </mesh>
    </group>
  );
}

interface OrbitingSpheresProps {
  scrollProgress: number;
}

function OrbitingSpheres({ scrollProgress }: OrbitingSpheresProps) {
  const groupRef = useRef<THREE.Group>(null);
  const sphere1Ref = useRef<THREE.Group>(null);
  const sphere2Ref = useRef<THREE.Group>(null);
  const orbitAngleRef = useRef(0);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // תנועה אופקית יותר - מימין לשמאל עם ירידה קלה
    const travel = scrollProgress * 2 - 0.5;
    const x = 12 - travel * 24;
    const y = 3 - travel * 6;

    groupRef.current.position.x = x;
    groupRef.current.position.y = y;

    // קירוב והרחקה - פולס על רדיוס המסלול
    const baseRadius = 4.0;
    const pulseAmount = 1.5; // כמה להתקרב/להתרחק
    const pulseSpeed = 1.2; // מהירות הפולס
    const orbitRadius = baseRadius + Math.sin(state.clock.elapsedTime * pulseSpeed) * pulseAmount;

    // סיבוב דינמי - מהיר כשקרובים, איטי כשרחוקים
    const minSpeed = 1.0; // מהירות מינימלית (כשרחוקים)
    const maxSpeed = 4.0; // מהירות מקסימלית (כשקרובים)
    const normalizedRadius = (orbitRadius - (baseRadius - pulseAmount)) / (pulseAmount * 2); // 0 = קרוב, 1 = רחוק
    const rotationSpeed = maxSpeed - normalizedRadius * (maxSpeed - minSpeed);
    orbitAngleRef.current += delta * rotationSpeed;
    const angle = orbitAngleRef.current;

    // כדור 1 - סיבוב בציר אופקי (X הוא הציר הראשי)
    if (sphere1Ref.current) {
      sphere1Ref.current.position.x = Math.cos(angle) * orbitRadius;
      sphere1Ref.current.position.y = Math.sin(angle) * orbitRadius * 0.3;
      sphere1Ref.current.position.z = Math.sin(angle * 0.5) * 0.3;

      sphere1Ref.current.rotation.x += delta * 0.5;
      sphere1Ref.current.rotation.y += delta * 0.8;
    }

    // כדור 2 - מול כדור 1
    if (sphere2Ref.current) {
      sphere2Ref.current.position.x = Math.cos(angle + Math.PI) * orbitRadius;
      sphere2Ref.current.position.y = Math.sin(angle + Math.PI) * orbitRadius * 0.3;
      sphere2Ref.current.position.z = Math.sin((angle + Math.PI) * 0.5) * 0.3;

      sphere2Ref.current.rotation.x += delta * 0.6;
      sphere2Ref.current.rotation.y += delta * 0.7;
    }
  });

  return (
    <group ref={groupRef}>
      <GlowingSphere groupRef={sphere1Ref} />
      <GlowingSphere groupRef={sphere2Ref} />

      {/* אור נקודתי כחול חזק */}
      <pointLight color="#5588ff" intensity={8} distance={15} />
      <pointLight color="#88bbff" intensity={4} distance={10} />
    </group>
  );
}

interface CollidingSpheresProps {
  scrollProgress?: number;
}

export default function CollidingSpheres({ scrollProgress = 0 }: CollidingSpheresProps) {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
      <Canvas camera={{ position: [0, 0, 15], fov: 50 }}>
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 5, 5]} intensity={0.5} />

        <OrbitingSpheres scrollProgress={scrollProgress} />
      </Canvas>
    </div>
  );
}
