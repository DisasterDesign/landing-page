"use client";

import { useRef, useEffect, useState, Suspense, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";

// ============================================
// ANIMATED ATOMS - v5.glb with scroll animation
// ============================================
interface AnimatedAtomsProps {
  introProgress: number;
  scrollProgress: number;
}

function AnimatedAtoms({ introProgress, scrollProgress }: AnimatedAtomsProps) {
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionRef = useRef<THREE.AnimationAction | null>(null);
  const { scene, animations } = useGLTF("/v5.glb");
  const glowMeshesRef = useRef<THREE.Mesh[]>([]);
  const continuousRotationRef = useRef(0);

  // Apply glass material and create glow meshes
  useEffect(() => {
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: "#5588ff",
      metalness: 0,
      roughness: 0,
      transmission: 0.9,
      thickness: 0.8,
      envMapIntensity: 1.2,
      clearcoat: 1.0,
      clearcoatRoughness: 0,
      ior: 1.5,
      transparent: true,
    });

    const createGlowMaterial = () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uColor: { value: new THREE.Color("#5588ff") },
          uOpacity: { value: 0.4 },
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
          float intensity = pow(0.6 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          gl_FragColor = vec4(uColor, intensity * uOpacity);
        }
      `,
      });

    const glowMeshes: THREE.Mesh[] = [];
    const originalMeshes: THREE.Mesh[] = [];

    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        originalMeshes.push(child);
        child.material = glassMaterial;
      }
    });

    originalMeshes.forEach((mesh) => {
      const geometry = mesh.geometry;
      if (geometry) {
        geometry.computeBoundingSphere();
        const radius = geometry.boundingSphere?.radius || 1;
        const glowGeometry = new THREE.SphereGeometry(radius * 1.55, 32, 32);
        const glowMesh = new THREE.Mesh(glowGeometry, createGlowMaterial());
        glowMesh.renderOrder = -1;
        mesh.add(glowMesh);
        glowMeshes.push(glowMesh);
      }
    });

    glowMeshesRef.current = glowMeshes;

    return () => {
      glassMaterial.dispose();
      glowMeshes.forEach((glow) => {
        glow.geometry.dispose();
        (glow.material as THREE.Material).dispose();
        glow.parent?.remove(glow);
      });
    };
  }, [scene]);

  // Set up animation mixer
  useEffect(() => {
    if (animations.length > 0 && scene) {
      const mixer = new THREE.AnimationMixer(scene);
      mixerRef.current = mixer;

      const clip = animations[0];
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      action.paused = true;
      actionRef.current = action;

      return () => {
        mixer.stopAllAction();
        mixer.uncacheRoot(scene);
      };
    }
  }, [animations, scene]);

  // Update animation based on intro and scroll progress
  useFrame((_, delta) => {
    if (!actionRef.current || !mixerRef.current) return;

    const clip = actionRef.current.getClip();
    const duration = clip.duration;

    // v5.glb frame structure: 0-10 entry, 11-80 scroll, 81-100 tail
    const TOTAL_FRAMES = 100;
    const ENTRY_END = 10;
    const SCROLL_END = 80;

    const timePerFrame = duration / TOTAL_FRAMES;
    let targetFrame: number;

    if (scrollProgress > 0.01) {
      // Scroll phase: frames 11-80, complete at 50% scroll
      const scrollEnd = 0.50;
      const clampedScroll = Math.min(scrollProgress, scrollEnd) / scrollEnd;
      targetFrame = ENTRY_END + clampedScroll * (SCROLL_END - ENTRY_END);
    } else if (introProgress < 1) {
      // Entry phase: frames 0-10
      targetFrame = introProgress * ENTRY_END;
    } else {
      // Idle: stay at frame 10
      targetFrame = ENTRY_END;
    }

    const targetTime = targetFrame * timePerFrame;
    actionRef.current.time = targetTime;
    mixerRef.current.update(0);

    // Continuous rotation
    if (groupRef.current) {
      continuousRotationRef.current += delta * 0.15;
      groupRef.current.rotation.y = continuousRotationRef.current;

      // Fade out atoms after collision (35% scroll)
      const fadeStart = 0.35;
      const fadeEnd = 0.45;
      let opacity = 1;
      if (scrollProgress > fadeStart) {
        opacity = 1 - Math.min(1, (scrollProgress - fadeStart) / (fadeEnd - fadeStart));
      }

      // Apply opacity to all meshes in the scene
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const mat = child.material as THREE.Material;
          if ('opacity' in mat) {
            (mat as THREE.MeshPhysicalMaterial).opacity = opacity;
            mat.transparent = true;
          }
        }
      });

      // Also fade glow meshes
      glowMeshesRef.current.forEach((glow) => {
        const mat = glow.material as THREE.ShaderMaterial;
        if (mat.uniforms && mat.uniforms.uOpacity) {
          mat.uniforms.uOpacity.value = 0.4 * opacity;
        }
      });
    }
  });

  // Hide completely after fade
  const isVisible = scrollProgress < 0.45;

  if (!isVisible) return null;

  return (
    <group ref={groupRef}>
      <primitive object={scene} scale={2} position={[0, 0, 0]} />
    </group>
  );
}

// ============================================
// GLASS SPHERE - Large sphere with glow + floating animation
// Transitions to galaxy orbit mode after collision
// ============================================
interface GlassSphereProps {
  position: [number, number, number];
  radius: number;
  color: string;
  speed: number;
  phase: number;
  mouseTarget: { x: number; y: number };
  introProgress: number;
  scrollProgress: number;
  index: number;
  orbitRadius: number;
  orbitSpeed: number;
}

function GlassSphere({ position, radius, color, speed, phase, mouseTarget, introProgress, scrollProgress, index, orbitRadius, orbitSpeed }: GlassSphereProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const finalPos = useRef({
    x: position[0],
    y: position[1],
    z: position[2],
  });

  // Random scatter direction for dispersal effect
  const scatterDir = useRef({
    x: (Math.random() - 0.5) * 2,
    y: (Math.random() - 0.5) * 2,
    z: Math.random() * 0.5 + 0.5, // Mostly forward (towards camera)
  });

  // Depth-based blur (DOF effect)
  const zDepth = position[2];
  const focalPoint = -15;
  const dofRange = 30;
  const distanceFromFocal = Math.abs(zDepth - focalPoint);
  const blurAmount = Math.min(1, Math.pow(distanceFromFocal / dofRange, 0.7));

  const depthRoughness = blurAmount * 0.8;
  const depthTransmission = 0.95 - blurAmount * 0.6;
  const glowOpacity = 0.5 * (1 - blurAmount * 0.8);

  useFrame((state) => {
    if (meshRef.current && glowRef.current) {
      const time = state.clock.elapsedTime;

      // Galaxy mode transition (starts at 45% scroll, complete at 60%)
      const galaxyStart = 0.45;
      const galaxyEnd = 0.60;
      const galaxyProgress = scrollProgress < galaxyStart ? 0 :
        Math.min(1, (scrollProgress - galaxyStart) / (galaxyEnd - galaxyStart));
      const easedGalaxy = 1 - Math.pow(1 - galaxyProgress, 3);

      // Scatter phase (starts at 70% scroll, complete at 95%)
      const scatterStart = 0.70;
      const scatterEnd = 0.95;
      const scatterProgress = scrollProgress < scatterStart ? 0 :
        Math.min(1, (scrollProgress - scatterStart) / (scatterEnd - scatterStart));
      const easedScatter = scatterProgress * scatterProgress; // Quadratic ease-in

      const staggerDelay = index * 0.01;
      const localIntro = Math.max(0, Math.min(1, (introProgress - staggerDelay) / (1 - staggerDelay)));

      const explosiveEase = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
      const easedIntro = explosiveEase(localIntro);

      // Size: normal -> 10% in galaxy mode -> fade out in scatter mode
      const normalScale = easedIntro;
      const galaxyScale = easedIntro * 0.1;
      const preScatterScale = normalScale + (galaxyScale - normalScale) * easedGalaxy;
      const currentScale = preScatterScale * (1 - easedScatter);
      meshRef.current.scale.setScalar(currentScale);
      glowRef.current.scale.setScalar(currentScale);

      // Normal floating position
      const currentX = finalPos.current.x * easedIntro;
      const currentY = finalPos.current.y * easedIntro;
      const currentZ = finalPos.current.z * easedIntro;

      const depth = finalPos.current.z;
      const parallaxStrength = (10 - depth) * 0.03;

      const floatMultiplier = localIntro;
      const floatY = Math.sin(time * speed + phase) * 18 * floatMultiplier;
      const floatX = Math.cos(time * speed * 0.7 + phase) * 13.5 * floatMultiplier;

      const normalPosX = currentX + floatX + mouseTarget.x * parallaxStrength * localIntro;
      const normalPosY = currentY + floatY - mouseTarget.y * parallaxStrength * localIntro;
      const normalPosZ = currentZ;

      // Galaxy orbit position - tilted ring around sun (10 degrees tilt like galaxy particles)
      const orbitAngle = -time * orbitSpeed + phase; // Negative to match galaxy particles rotation direction
      const tiltAngle = 10 * (Math.PI / 180); // 10 degrees tilt
      const galaxyPosX = Math.cos(orbitAngle) * orbitRadius;
      const baseZ = Math.sin(orbitAngle) * orbitRadius;
      // Rotate around X axis by tiltAngle
      const galaxyPosY = -baseZ * Math.sin(tiltAngle);
      const galaxyPosZ = baseZ * Math.cos(tiltAngle);

      // Interpolate between normal and galaxy positions
      const posX = normalPosX + (galaxyPosX - normalPosX) * easedGalaxy;
      const posY = normalPosY + (galaxyPosY - normalPosY) * easedGalaxy;
      const posZ = normalPosZ + (galaxyPosZ - normalPosZ) * easedGalaxy;

      // Add scatter offset - fly outward from center
      const scatterDistance = 80 * easedScatter; // How far to scatter
      meshRef.current.position.x = posX + scatterDir.current.x * scatterDistance;
      meshRef.current.position.y = posY + scatterDir.current.y * scatterDistance;
      meshRef.current.position.z = posZ + scatterDir.current.z * scatterDistance;

      meshRef.current.rotation.y += 0.002;
      meshRef.current.rotation.x = Math.sin(time * 0.3) * 0.1;

      glowRef.current.position.copy(meshRef.current.position);

      const pulse = 1 + Math.sin(time * 2 + phase) * 0.1;
      glowRef.current.scale.multiplyScalar(pulse);
    }
  });

  // Hide completely after scatter is done (optimization)
  if (scrollProgress >= 0.95) return null;

  return (
    <group>
      <mesh ref={glowRef} position={[0, 0, 0]}>
        <sphereGeometry args={[radius * 1.6, 32, 32]} />
        <shaderMaterial
          transparent={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          uniforms={{
            uColor: { value: new THREE.Color(color) },
            uOpacity: { value: glowOpacity },
          }}
          vertexShader={`
            varying vec3 vNormal;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform vec3 uColor;
            uniform float uOpacity;
            varying vec3 vNormal;
            void main() {
              float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.5);
              gl_FragColor = vec4(uColor, intensity * uOpacity);
            }
          `}
        />
      </mesh>

      <mesh ref={meshRef} position={[0, 0, 0]}>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshPhysicalMaterial
          color={color}
          metalness={0}
          roughness={depthRoughness}
          transmission={depthTransmission}
          thickness={0.8 + blurAmount * 2}
          envMapIntensity={1.5 - blurAmount * 1.2}
          clearcoat={1 - blurAmount * 0.9}
          clearcoatRoughness={blurAmount * 0.6}
          ior={1.5}
          transparent={true}
          opacity={1 - blurAmount * 0.3}
        />
      </mesh>
    </group>
  );
}

// ============================================
// GLASS SPHERES - Depth distribution + Galaxy mode
// ============================================
function GlassSpheres({ mouseTarget, introProgress, scrollProgress }: { mouseTarget: { x: number; y: number }; introProgress: number; scrollProgress: number }) {
  const colors = ["#5588ff", "#6677ff", "#5577ff", "#6688ff", "#4488ff", "#5599ff", "#6655ff", "#5566ff", "#4499ff", "#7766ff", "#4477ff", "#7777ff", "#7755ff", "#6699ff", "#4466ff", "#7788ff"];

  const sphereConfigs = useMemo(() => {
    const configs: Array<{
      position: [number, number, number];
      radius: number;
      color: string;
      speed: number;
      phase: number;
      orbitRadius: number;
      orbitSpeed: number;
    }> = [];

    // Original spheres (36)
    const originalSpheres = [
      { position: [-28, -4, -8] as [number, number, number], radius: 3.2, speed: 0.025, phase: 1.8 },
      { position: [26, 6, -10] as [number, number, number], radius: 2.8, speed: 0.028, phase: 4.3 },
      { position: [-12, 4, -15] as [number, number, number], radius: 2.2, speed: 0.030, phase: 0 },
      { position: [14, 8, -18] as [number, number, number], radius: 2.0, speed: 0.035, phase: 5.5 },
      { position: [10, -6, -20] as [number, number, number], radius: 1.6, speed: 0.045, phase: 2.5 },
      { position: [-15, -8, -25] as [number, number, number], radius: 1.5, speed: 0.040, phase: 4.2 },
      { position: [-14, -4, -28] as [number, number, number], radius: 1.2, speed: 0.062, phase: 1.2 },
      { position: [8, 7, -35] as [number, number, number], radius: 1.0, speed: 0.055, phase: 3.8 },
      { position: [16, -3, -32] as [number, number, number], radius: 1.1, speed: 0.050, phase: 0.5 },
      { position: [-10, 10, -38] as [number, number, number], radius: 0.9, speed: 0.058, phase: 2.9 },
      { position: [-16, 5, -45] as [number, number, number], radius: 0.7, speed: 0.045, phase: 4.5 },
      { position: [12, -7, -55] as [number, number, number], radius: 0.6, speed: 0.038, phase: 0.8 },
      { position: [-8, -9, -65] as [number, number, number], radius: 0.5, speed: 0.040, phase: 2.1 },
      { position: [18, 4, -48] as [number, number, number], radius: 0.65, speed: 0.042, phase: 5.8 },
      { position: [-18, -6, -58] as [number, number, number], radius: 0.55, speed: 0.035, phase: 1.4 },
      { position: [6, 12, -62] as [number, number, number], radius: 0.48, speed: 0.048, phase: 3.2 },
      { position: [14, 6, -60] as [number, number, number], radius: 0.35, speed: 0.030, phase: 5.2 },
      { position: [-16, -5, -75] as [number, number, number], radius: 0.3, speed: 0.025, phase: 1.6 },
      { position: [8, -10, -85] as [number, number, number], radius: 0.25, speed: 0.028, phase: 3.4 },
      { position: [-12, 8, -70] as [number, number, number], radius: 0.32, speed: 0.032, phase: 4.8 },
      { position: [20, -2, -80] as [number, number, number], radius: 0.28, speed: 0.022, phase: 0.7 },
      { position: [-6, -14, -90] as [number, number, number], radius: 0.22, speed: 0.030, phase: 2.3 },
      { position: [-18, 10, -100] as [number, number, number], radius: 0.18, speed: 0.020, phase: 4.0 },
      { position: [16, -4, -115] as [number, number, number], radius: 0.15, speed: 0.018, phase: 0.3 },
      { position: [-10, -12, -125] as [number, number, number], radius: 0.12, speed: 0.015, phase: 2.8 },
      { position: [22, 8, -105] as [number, number, number], radius: 0.16, speed: 0.022, phase: 5.6 },
      { position: [-20, -8, -110] as [number, number, number], radius: 0.14, speed: 0.020, phase: 1.1 },
      { position: [8, 14, -120] as [number, number, number], radius: 0.13, speed: 0.018, phase: 3.9 },
      { position: [20, 12, -145] as [number, number, number], radius: 0.08, speed: 0.012, phase: 1.9 },
      { position: [-15, -15, -160] as [number, number, number], radius: 0.06, speed: 0.010, phase: 4.7 },
      { position: [12, 5, -175] as [number, number, number], radius: 0.05, speed: 0.008, phase: 3.1 },
      { position: [-22, 6, -140] as [number, number, number], radius: 0.09, speed: 0.015, phase: 0.6 },
      { position: [18, -10, -155] as [number, number, number], radius: 0.07, speed: 0.012, phase: 2.4 },
      { position: [-8, 18, -165] as [number, number, number], radius: 0.055, speed: 0.010, phase: 5.1 },
      { position: [25, -6, -170] as [number, number, number], radius: 0.045, speed: 0.009, phase: 1.3 },
      { position: [-18, -18, -180] as [number, number, number], radius: 0.04, speed: 0.008, phase: 4.0 },
    ];

    // Add original spheres with orbit parameters - random radii (minimum 6 units from sun)
    originalSpheres.forEach((sphere, i) => {
      const orbitRadius = 6 + Math.random() * 12; // Random: 6-18 units from sun
      const orbitSpeed = 0.05; // Same speed for all
      configs.push({
        ...sphere,
        color: colors[i % colors.length],
        orbitRadius,
        orbitSpeed,
      });
    });

    // Add 3x more spheres (total 4x = 144 spheres) - random radii
    for (let i = 0; i < 108; i++) {
      const angle = Math.random() * Math.PI * 2;
      const x = Math.cos(angle) * (10 + Math.random() * 30);
      const y = (Math.random() - 0.5) * 40;
      const z = -10 - Math.random() * 170;

      // Random orbit radius (minimum 6 units from sun)
      const orbitRadius = 6 + Math.random() * 12; // 6-18 units from sun
      const orbitSpeed = 0.05; // Same speed

      configs.push({
        position: [x, y, z] as [number, number, number],
        radius: 0.03 + Math.random() * 0.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        speed: 0.01 + Math.random() * 0.05,
        phase: Math.random() * Math.PI * 2,
        orbitRadius,
        orbitSpeed,
      });
    }

    return configs;
  }, []);

  return (
    <group>
      {sphereConfigs.map((config, index) => (
        <GlassSphere
          key={index}
          {...config}
          mouseTarget={mouseTarget}
          introProgress={introProgress}
          scrollProgress={scrollProgress}
          index={index}
        />
      ))}
    </group>
  );
}

// ============================================
// GALAXY PARTICLES - Particle disk around sun
// ============================================
function GalaxyParticles({ scrollProgress }: { scrollProgress: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const PARTICLE_COUNT = 3000;

  // Galaxy appears after collision
  const appearStart = 0.45;
  const appearEnd = 0.65;
  const progress = scrollProgress < appearStart ? 0 :
    Math.min(1, (scrollProgress - appearStart) / (appearEnd - appearStart));
  const easedProgress = 1 - Math.pow(1 - progress, 3);

  // Scatter phase (starts at 70% scroll, complete at 95%)
  const scatterStart = 0.70;
  const scatterEnd = 0.95;
  const scatterProgress = scrollProgress < scatterStart ? 0 :
    Math.min(1, (scrollProgress - scatterStart) / (scatterEnd - scatterStart));
  const easedScatter = scatterProgress * scatterProgress;

  // Create particles distributed in a disk
  const { positions, colors, sizes } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Spiral galaxy distribution
      const radius = 3 + Math.random() * 20; // 3-23 units from center
      const angle = Math.random() * Math.PI * 2;
      const spiralOffset = radius * 0.3; // Spiral arms
      const finalAngle = angle + spiralOffset;

      positions[i * 3] = Math.cos(finalAngle) * radius;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 0.5; // Thin disk
      positions[i * 3 + 2] = Math.sin(finalAngle) * radius;

      // Color gradient: brighter near center
      const brightness = 1 - (radius / 23) * 0.5;
      colors[i * 3] = 0.4 + brightness * 0.4; // R
      colors[i * 3 + 1] = 0.5 + brightness * 0.3; // G
      colors[i * 3 + 2] = 0.9 + brightness * 0.1; // B

      sizes[i] = 0.5 + Math.random() * 1.5;
    }

    return { positions, colors, sizes };
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uPixelRatio: { value: typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1 },
    }),
    []
  );

  useFrame((state) => {
    if (pointsRef.current) {
      const material = pointsRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = state.clock.elapsedTime;
      // Fade out during scatter
      material.uniforms.uOpacity.value = easedProgress * (1 - easedScatter);

      // Tilt galaxy by 10 degrees on X axis
      pointsRef.current.rotation.x = 10 * (Math.PI / 180); // 10 degrees tilt

      // Slow rotation of entire galaxy
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.02;

      // Expand outward during scatter
      const scatterScale = 1 + easedScatter * 3; // Expand to 4x size
      pointsRef.current.scale.setScalar(scatterScale);
    }
  });

  // Hide before appearing or after scatter is done (optimization)
  if (progress <= 0 || scrollProgress >= 0.95) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={PARTICLE_COUNT}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={PARTICLE_COUNT}
          array={colors}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aSize"
          count={PARTICLE_COUNT}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        uniforms={uniforms}
        transparent={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexColors={true}
        vertexShader={`
          attribute float aSize;
          uniform float uPixelRatio;
          uniform float uOpacity;
          varying vec3 vColor;
          void main() {
            vColor = color;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * uPixelRatio * (200.0 / -mvPosition.z) * uOpacity;
            gl_Position = projectionMatrix * mvPosition;
          }
        `}
        fragmentShader={`
          uniform float uOpacity;
          varying vec3 vColor;
          void main() {
            float dist = length(gl_PointCoord - 0.5);
            if (dist > 0.5) discard;
            float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
            gl_FragColor = vec4(vColor, alpha * uOpacity * 0.6);
          }
        `}
      />
    </points>
  );
}

// ============================================
// GALAXY CENTER - Sun-like glowing core that appears after collision
// ============================================
function GalaxyCenter({ scrollProgress }: { scrollProgress: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  // Sun appears after 35% scroll (when atoms collide)
  const appearStart = 0.35;
  const appearEnd = 0.50;
  const progress = scrollProgress < appearStart ? 0 :
    Math.min(1, (scrollProgress - appearStart) / (appearEnd - appearStart));

  // Eased progress for smooth growth
  const easedProgress = 1 - Math.pow(1 - progress, 3);

  // Scatter phase (starts at 70% scroll, complete at 95%)
  const scatterStart = 0.70;
  const scatterEnd = 0.95;
  const scatterProgress = scrollProgress < scatterStart ? 0 :
    Math.min(1, (scrollProgress - scatterStart) / (scatterEnd - scatterStart));
  const easedScatter = scatterProgress * scatterProgress;

  // Subtle pulsation animation + scatter fade
  useFrame((state) => {
    timeRef.current = state.clock.elapsedTime;
    if (groupRef.current && progress > 0) {
      const pulse = 1 + Math.sin(timeRef.current * 2) * 0.03;
      // Shrink and fade during scatter
      const scatterFade = 1 - easedScatter;
      groupRef.current.scale.setScalar(easedProgress * pulse * scatterFade);
    }
  });

  // Hide before appearing or after scatter is done (optimization)
  if (scrollProgress < 0.35 || scrollProgress >= 0.95) return null;

  // Glow from CENTER outward (not rim glow!)
  const createGlowMaterial = (color: string, baseOpacity: number) =>
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: baseOpacity * easedProgress },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vec3 viewDir = normalize(vViewPosition);
          // Bright in center, fades to edge
          float facing = abs(dot(vNormal, viewDir));
          float intensity = pow(facing, 0.5);
          gl_FragColor = vec4(uColor * 1.5, intensity * uOpacity);
        }
      `,
    });

  // Don't render if not visible
  if (progress <= 0) return null;

  // Radial gradient material - smooth transition from center
  const createRadialGlowMaterial = () =>
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uOpacity: { value: easedProgress },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          vec2 center = vec2(0.5, 0.5);
          float dist = length(vUv - center) * 2.0;

          // Smooth gradient: white center -> yellow -> orange -> red
          vec3 white = vec3(1.0, 1.0, 1.0);
          vec3 yellow = vec3(1.0, 0.95, 0.6);
          vec3 orange = vec3(1.0, 0.65, 0.25);
          vec3 red = vec3(1.0, 0.4, 0.12);

          vec3 color;
          if (dist < 0.3) {
            color = mix(white, yellow, dist * 3.33);
          } else if (dist < 0.55) {
            color = mix(yellow, orange, (dist - 0.3) * 4.0);
          } else if (dist < 0.85) {
            color = mix(orange, red, (dist - 0.55) * 3.33);
          } else {
            color = red;
          }

          // Fade out at edges
          float alpha = (1.0 - smoothstep(0.3, 1.0, dist));

          gl_FragColor = vec4(color * 1.2, alpha * uOpacity);
        }
      `,
    });

  return (
    <group ref={groupRef} scale={easedProgress}>
      {/* GLOWING WHITE CENTER - multiple additive layers for brightness */}
      <mesh renderOrder={10}>
        <sphereGeometry args={[0.2, 32, 32]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh renderOrder={9}>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.9} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh renderOrder={8}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshBasicMaterial color="#ffffee" transparent opacity={0.8} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh renderOrder={7}>
        <sphereGeometry args={[0.7, 32, 32]} />
        <meshBasicMaterial color="#ffffcc" transparent opacity={0.6} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh renderOrder={6}>
        <sphereGeometry args={[0.9, 32, 32]} />
        <meshBasicMaterial color="#ffff99" transparent opacity={0.4} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* SMOOTH RADIAL GRADIENT GLOW */}
      <mesh renderOrder={1}>
        <planeGeometry args={[8, 8]} />
        <primitive object={createRadialGlowMaterial()} attach="material" />
      </mesh>

      {/* Additional glow layers for depth */}
      <mesh>
        <sphereGeometry args={[2.5, 32, 32]} />
        <primitive object={createGlowMaterial("#ff6622", 0.4)} attach="material" />
      </mesh>
      <mesh>
        <sphereGeometry args={[3.5, 32, 32]} />
        <primitive object={createGlowMaterial("#ff3311", 0.25)} attach="material" />
      </mesh>
      <mesh>
        <sphereGeometry args={[4.5, 32, 32]} />
        <primitive object={createGlowMaterial("#ee1100", 0.12)} attach="material" />
      </mesh>

      {/* LIGHTING */}
      <pointLight position={[0, 0, 0]} intensity={150 * easedProgress} color="#ffffff" decay={1.2} distance={25} />
      <pointLight position={[0, 0, 0]} intensity={80 * easedProgress} color="#ffaa44" decay={1.5} distance={20} />
    </group>
  );
}

// ============================================
// MOUSE TRACKING HOOK
// ============================================
function useMousePosition() {
  const mouse = useRef({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });

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
// SCENE
// ============================================
function Scene({ introProgress, scrollProgress }: { introProgress: number; scrollProgress: number }) {
  const { update } = useMousePosition();
  const mouseTargetRef = useRef({ x: 0, y: 0 });

  useFrame(() => {
    const target = update();
    mouseTargetRef.current.x = target.x;
    mouseTargetRef.current.y = target.y;
  });

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} color="#4466ff" />
      <pointLight position={[5, 5, 5]} intensity={1.2} color="#ffffff" />
      <pointLight position={[-5, -5, 5]} intensity={0.6} color="#6644ff" />
      <pointLight position={[0, 0, 10]} intensity={1} color="#4488ff" />

      {/* Environment map for glass reflections */}
      <Environment files="/rosendal_park_sunset_puresky_1k.hdr" />

      {/* Galaxy center - appears after collision */}
      <GalaxyCenter scrollProgress={scrollProgress} />

      {/* Galaxy particle disk */}
      <GalaxyParticles scrollProgress={scrollProgress} />

      {/* Animated atoms from v5.glb */}
      <AnimatedAtoms introProgress={introProgress} scrollProgress={scrollProgress} />

      {/* Glass spheres with depth and parallax */}
      <GlassSpheres mouseTarget={mouseTargetRef.current} introProgress={introProgress} scrollProgress={scrollProgress} />

          </>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================
interface CosmicHeroProps {
  onScrollProgress?: (progress: number) => void;
}

export default function CosmicHero({ onScrollProgress }: CosmicHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [introProgress, setIntroProgress] = useState(0);
  const scrollTicking = useRef(false);

  // Simple entry animation
  useEffect(() => {
    const startTime = performance.now();
    const duration = 1500;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setIntroProgress(eased);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    const timer = setTimeout(() => {
      requestAnimationFrame(animate);
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  // Scroll handler
  useEffect(() => {
    const handleScroll = () => {
      if (!scrollTicking.current) {
        requestAnimationFrame(() => {
          if (!containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const heroHeight = containerRef.current.offsetHeight;
          const windowHeight = window.innerHeight;

          const progress = Math.min(Math.max(-rect.top / (heroHeight - windowHeight), 0), 1);
          setScrollProgress(progress);
          onScrollProgress?.(progress);

          scrollTicking.current = false;
        });
        scrollTicking.current = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [onScrollProgress]);

  return (
    <section id="hero" ref={containerRef} className="h-[220vh] relative">
      <div className="sticky top-0 h-screen overflow-hidden">
        <Canvas
          className="absolute inset-0"
          camera={{ position: [0, 0, 8], fov: 65, near: 0.1, far: 300 }}
          gl={{ antialias: true, alpha: true }}
          dpr={[1, 2]}
        >
          <Suspense fallback={null}>
            <Scene introProgress={introProgress} scrollProgress={scrollProgress} />
          </Suspense>
        </Canvas>
      </div>
    </section>
  );
}
