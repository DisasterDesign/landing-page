"use client";

import { useRef, useEffect, useState, Suspense, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";

// ============================================
// MOUSE TRACKING HOOK
// ============================================
function useMousePosition() {
  const mouse = useRef({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Normalize to -1 to 1
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Smooth interpolation in useFrame
  const update = () => {
    target.current.x += (mouse.current.x - target.current.x) * 0.05;
    target.current.y += (mouse.current.y - target.current.y) * 0.05;
    return target.current;
  };

  return { mouse, target, update };
}

// ============================================
// COSMIC BACKGROUND - Diagonal Gradient
// ============================================
function CosmicBackground() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

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
        ref={materialRef}
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

// TearOverlayPlane removed - using CSS mask instead

// ============================================
// GLASS SPHERE - Large sphere with glow + Big Bang animation
// ============================================
interface GlassSphereProps {
  position: [number, number, number];
  radius: number;
  color: string;
  speed: number;
  phase: number;
  mouseTarget: { x: number; y: number };
  introProgress: number;
  index: number;
}

function GlassSphere({ position, radius, color, speed, phase, mouseTarget, introProgress, index }: GlassSphereProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const finalPos = useRef({
    x: position[0],
    y: position[1],
    z: position[2],
  });

  // Calculate depth-based blur (DOF effect) - STRONG EFFECT
  // Camera is at Z=8, focal point around Z=-15 (close objects sharp)
  // Objects further away get progressively much blurrier
  const zDepth = position[2];
  const focalPoint = -15; // Close objects are sharp
  const dofRange = 30; // Faster blur falloff
  const distanceFromFocal = Math.abs(zDepth - focalPoint);
  const blurAmount = Math.min(1, Math.pow(distanceFromFocal / dofRange, 0.7)); // Exponential falloff

  // Convert blur to material properties - AMPLIFIED VALUES
  const depthRoughness = blurAmount * 0.8; // Max roughness 0.8 for very blurry distant objects
  const depthTransmission = 0.95 - blurAmount * 0.6; // Strongly reduce transmission
  const glowOpacity = 0.5 * (1 - blurAmount * 0.8); // Much less glow for distant

  useFrame((state) => {
    if (meshRef.current && glowRef.current) {
      const time = state.clock.elapsedTime;

      // Minimal stagger for explosive feel (closer spheres appear slightly first)
      const staggerDelay = index * 0.01;
      const localIntro = Math.max(0, Math.min(1, (introProgress - staggerDelay) / (1 - staggerDelay)));

      // Explosive easing - fast start, smooth end (expo out)
      const explosiveEase = (t: number) => {
        return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      };

      const easedIntro = explosiveEase(localIntro);

      // Scale: start small, grow to full size
      const currentScale = easedIntro;
      meshRef.current.scale.setScalar(currentScale);
      glowRef.current.scale.setScalar(currentScale);

      // Position: interpolate from center (0,0,0) to final position
      const currentX = finalPos.current.x * easedIntro;
      const currentY = finalPos.current.y * easedIntro;
      const currentZ = finalPos.current.z * easedIntro;

      // Parallax strength based on Z depth
      const depth = finalPos.current.z;
      const parallaxStrength = (10 - depth) * 0.03;

      // Base floating animation (only after intro)
      const floatMultiplier = localIntro;
      const floatY = Math.sin(time * speed + phase) * 18 * floatMultiplier;
      const floatX = Math.cos(time * speed * 0.7 + phase) * 13.5 * floatMultiplier;

      // Apply position with floating and parallax
      meshRef.current.position.x = currentX + floatX + mouseTarget.x * parallaxStrength * localIntro;
      meshRef.current.position.y = currentY + floatY - mouseTarget.y * parallaxStrength * localIntro;
      meshRef.current.position.z = currentZ;

      // Gentle rotation
      meshRef.current.rotation.y += 0.002;
      meshRef.current.rotation.x = Math.sin(time * 0.3) * 0.1;

      // Sync glow position
      glowRef.current.position.copy(meshRef.current.position);

      // Pulsing glow
      const pulse = 1 + Math.sin(time * 2 + phase) * 0.1;
      glowRef.current.scale.multiplyScalar(pulse);
    }
  });

  return (
    <group>
      {/* Glow effect (behind sphere) - reduced for distant objects */}
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

      {/* Glass sphere - with depth-based blur (higher roughness = blurrier) */}
      <mesh ref={meshRef} position={[0, 0, 0]}>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshPhysicalMaterial
          color={color}
          metalness={0}
          roughness={depthRoughness}
          transmission={depthTransmission}
          thickness={0.8 + blurAmount * 2} // Thicker = more diffuse for distant
          envMapIntensity={1.5 - blurAmount * 1.2} // Much less reflections for distant
          clearcoat={1 - blurAmount * 0.9} // Almost no clearcoat for distant
          clearcoatRoughness={blurAmount * 0.6}
          ior={1.5}
          transparent={true}
          opacity={1 - blurAmount * 0.3} // Slightly fade distant objects
        />
      </mesh>
    </group>
  );
}

// ============================================
// GLASS SPHERES - Extreme depth distribution
// ============================================
function GlassSpheres({ mouseTarget, introProgress }: { mouseTarget: { x: number; y: number }; introProgress: number }) {
  // Camera is at Z=8. Fewer close spheres, more in the distance
  const sphereConfigs = useMemo(() => [
    // === CLOSEST - Near camera, at screen edges ===
    { position: [-28, -4, -8] as [number, number, number], radius: 3.2, color: "#5588ff", speed: 0.025, phase: 1.8 },
    { position: [26, 6, -10] as [number, number, number], radius: 2.8, color: "#6677ff", speed: 0.028, phase: 4.3 },

    // === LARGEST - Much further back ===
    { position: [-12, 4, -15] as [number, number, number], radius: 2.2, color: "#5577ff", speed: 0.030, phase: 0 },
    { position: [14, 8, -18] as [number, number, number], radius: 2.0, color: "#6688ff", speed: 0.035, phase: 5.5 },

    // === LARGE - Also further back ===
    { position: [10, -6, -20] as [number, number, number], radius: 1.6, color: "#4488ff", speed: 0.045, phase: 2.5 },
    { position: [-15, -8, -25] as [number, number, number], radius: 1.5, color: "#5599ff", speed: 0.040, phase: 4.2 },

    // === MEDIUM - (Z: -30 to -25) ===
    { position: [-14, -4, -28] as [number, number, number], radius: 1.2, color: "#6655ff", speed: 0.062, phase: 1.2 },
    { position: [8, 7, -35] as [number, number, number], radius: 1.0, color: "#5566ff", speed: 0.055, phase: 3.8 },
    { position: [16, -3, -32] as [number, number, number], radius: 1.1, color: "#4499ff", speed: 0.050, phase: 0.5 },
    { position: [-10, 10, -38] as [number, number, number], radius: 0.9, color: "#7766ff", speed: 0.058, phase: 2.9 },

    // === SMALLER - Mid distance (Z: -60 to -40) ===
    { position: [-16, 5, -45] as [number, number, number], radius: 0.7, color: "#4477ff", speed: 0.045, phase: 4.5 },
    { position: [12, -7, -55] as [number, number, number], radius: 0.6, color: "#5588ff", speed: 0.038, phase: 0.8 },
    { position: [-8, -9, -65] as [number, number, number], radius: 0.5, color: "#6677ff", speed: 0.040, phase: 2.1 },
    { position: [18, 4, -48] as [number, number, number], radius: 0.65, color: "#5566ff", speed: 0.042, phase: 5.8 },
    { position: [-18, -6, -58] as [number, number, number], radius: 0.55, color: "#4488ff", speed: 0.035, phase: 1.4 },
    { position: [6, 12, -62] as [number, number, number], radius: 0.48, color: "#6699ff", speed: 0.048, phase: 3.2 },

    // === SMALL - Far (Z: -90 to -50) - more centered ===
    { position: [14, 6, -60] as [number, number, number], radius: 0.35, color: "#4466ff", speed: 0.030, phase: 5.2 },
    { position: [-16, -5, -75] as [number, number, number], radius: 0.3, color: "#5577ff", speed: 0.025, phase: 1.6 },
    { position: [8, -10, -85] as [number, number, number], radius: 0.25, color: "#6655ff", speed: 0.028, phase: 3.4 },
    { position: [-12, 8, -70] as [number, number, number], radius: 0.32, color: "#4499ff", speed: 0.032, phase: 4.8 },
    { position: [20, -2, -80] as [number, number, number], radius: 0.28, color: "#5588ff", speed: 0.022, phase: 0.7 },
    { position: [-6, -14, -90] as [number, number, number], radius: 0.22, color: "#7777ff", speed: 0.030, phase: 2.3 },

    // === VERY SMALL - Very far (Z: -130 to -90) - more centered ===
    { position: [-18, 10, -100] as [number, number, number], radius: 0.18, color: "#4488ff", speed: 0.020, phase: 4.0 },
    { position: [16, -4, -115] as [number, number, number], radius: 0.15, color: "#5566ff", speed: 0.018, phase: 0.3 },
    { position: [-10, -12, -125] as [number, number, number], radius: 0.12, color: "#7755ff", speed: 0.015, phase: 2.8 },
    { position: [22, 8, -105] as [number, number, number], radius: 0.16, color: "#4477ff", speed: 0.022, phase: 5.6 },
    { position: [-20, -8, -110] as [number, number, number], radius: 0.14, color: "#6688ff", speed: 0.020, phase: 1.1 },
    { position: [8, 14, -120] as [number, number, number], radius: 0.13, color: "#5599ff", speed: 0.018, phase: 3.9 },

    // === TINY DOTS - Extreme distance (Z: -180 to -130) - more centered ===
    { position: [20, 12, -145] as [number, number, number], radius: 0.08, color: "#5588ff", speed: 0.012, phase: 1.9 },
    { position: [-15, -15, -160] as [number, number, number], radius: 0.06, color: "#4477ff", speed: 0.010, phase: 4.7 },
    { position: [12, 5, -175] as [number, number, number], radius: 0.05, color: "#6666ff", speed: 0.008, phase: 3.1 },
    { position: [-22, 6, -140] as [number, number, number], radius: 0.09, color: "#5577ff", speed: 0.015, phase: 0.6 },
    { position: [18, -10, -155] as [number, number, number], radius: 0.07, color: "#4499ff", speed: 0.012, phase: 2.4 },
    { position: [-8, 18, -165] as [number, number, number], radius: 0.055, color: "#6688ff", speed: 0.010, phase: 5.1 },
    { position: [25, -6, -170] as [number, number, number], radius: 0.045, color: "#5566ff", speed: 0.009, phase: 1.3 },
    { position: [-18, -18, -180] as [number, number, number], radius: 0.04, color: "#7788ff", speed: 0.008, phase: 4.0 },
  ], []);

  return (
    <group>
      {sphereConfigs.map((config, index) => (
        <GlassSphere key={index} {...config} mouseTarget={mouseTarget} introProgress={introProgress} index={index} />
      ))}
    </group>
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
      uPixelRatio: { value: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1 },
    }),
    []
  );

  useFrame((state) => {
    if (pointsRef.current) {
      const material = pointsRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = state.clock.elapsedTime;
    }

    // Subtle star parallax rotation
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
// ANIMATED ATOMS - GLB with glass material and scroll-controlled animation
// ============================================
interface AnimatedAtomsProps {
  introProgress: number; // 0-1, drives frames 0-25
  scrollProgress: number; // 0-1, drives frames 27-100
}

function AnimatedAtoms({ introProgress, scrollProgress }: AnimatedAtomsProps) {
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionRef = useRef<THREE.AnimationAction | null>(null);
  const { scene, animations } = useGLTF("/v2.glb");
  const glowMeshesRef = useRef<THREE.Mesh[]>([]);

  // Apply glass material to all meshes and create glow meshes as children
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

    // Glow shader material
    const createGlowMaterial = () => new THREE.ShaderMaterial({
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

    // First pass: collect all original meshes and apply glass material
    const originalMeshes: THREE.Mesh[] = [];
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        originalMeshes.push(child);
        child.material = glassMaterial;
      }
    });

    // Second pass: create glow meshes for each original mesh
    originalMeshes.forEach((mesh) => {
      const geometry = mesh.geometry;
      if (geometry) {
        geometry.computeBoundingSphere();
        const radius = geometry.boundingSphere?.radius || 1;

        // Create glow sphere larger than original (1.55x)
        const glowGeometry = new THREE.SphereGeometry(radius * 1.55, 32, 32);
        const glowMesh = new THREE.Mesh(glowGeometry, createGlowMaterial());
        glowMesh.renderOrder = -1;

        // Add as child so it follows the parent's transformations
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
      action.paused = true; // We control time manually
      actionRef.current = action;

      return () => {
        mixer.stopAllAction();
        mixer.uncacheRoot(scene);
      };
    }
  }, [animations, scene]);

  // Track loop animation time
  const loopTimeRef = useRef(0);

  // Track continuous rotation (runs independently of scroll)
  const continuousRotationRef = useRef(0);

  // Update animation based on intro and scroll progress
  useFrame((state, delta) => {
    if (!actionRef.current || !mixerRef.current) return;

    const clip = actionRef.current.getClip();
    const totalFrames = 300;
    const duration = clip.duration;

    // Entry animation: introProgress 0-1 maps to frames 0-30
    // Loop animation: frames 30-150 (continuous loop when not scrolling)
    // Scroll animation: scrollProgress 0-1 maps to frames 150-300

    const ENTRY_END_FRAME = 30;
    const LOOP_START_FRAME = 30;
    const LOOP_END_FRAME = 150;
    const SCROLL_START_FRAME = 150;
    const TOTAL_FRAMES = 300;

    let targetFrame: number;

    // Scroll takes priority once user starts scrolling
    if (scrollProgress > 0.01) {
      // Scroll phase: map scrollProgress (0-1) to frames 195-300
      targetFrame = SCROLL_START_FRAME + scrollProgress * (TOTAL_FRAMES - SCROLL_START_FRAME);
      // Reset loop time for when they scroll back up
      loopTimeRef.current = 0;
    } else if (introProgress < 1) {
      // Entry phase: map introProgress (0-1) to frames 0-93
      targetFrame = introProgress * ENTRY_END_FRAME;
    } else {
      // Loop phase: continuously animate between frames 94-194
      const loopDuration = (LOOP_END_FRAME - LOOP_START_FRAME) / totalFrames * duration;
      loopTimeRef.current += delta;
      // Loop back when reaching end
      if (loopTimeRef.current > loopDuration) {
        loopTimeRef.current = loopTimeRef.current % loopDuration;
      }
      const loopProgress = loopTimeRef.current / loopDuration;
      targetFrame = LOOP_START_FRAME + loopProgress * (LOOP_END_FRAME - LOOP_START_FRAME);
    }

    // Convert frame to time
    const timePerFrame = duration / TOTAL_FRAMES;
    const targetTime = targetFrame * timePerFrame;

    actionRef.current.time = targetTime;
    mixerRef.current.update(0);

    // Continuous rotation - runs independently of scroll
    if (groupRef.current) {
      continuousRotationRef.current += delta * 0.15;
      groupRef.current.rotation.y = continuousRotationRef.current;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} scale={2} position={[0, 0, 0]} />
    </group>
  );
}

// ============================================
// WHITE FLASH - Growing light circle at end of scroll animation (screen-space)
// ============================================
function WhiteFlash({ scrollProgress }: { scrollProgress: number }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Frame 180-200 maps to scrollProgress 0.6-1.0 (20 frames)
  const FLASH_START = 0.6;
  const FLASH_END = 1.0;

  const uniforms = useMemo(() => ({
    uProgress: { value: 0 },
  }), []);

  useFrame(() => {
    if (!materialRef.current) return;

    if (scrollProgress < FLASH_START) {
      materialRef.current.uniforms.uProgress.value = 0;
    } else {
      const flashProgress = Math.min(1, (scrollProgress - FLASH_START) / (FLASH_END - FLASH_START));
      materialRef.current.uniforms.uProgress.value = flashProgress;
    }
  });

  return (
    <mesh renderOrder={1000}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        transparent
        depthTest={false}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.9999, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uProgress;
          varying vec2 vUv;

          void main() {
            vec2 center = vec2(0.5, 0.5);
            float dist = distance(vUv, center);

            // Radius grows from 0 to covering everything (0.8 covers corners)
            float radius = uProgress * 0.9;

            // Soft edge glow effect
            float glow = 1.0 - smoothstep(radius - 0.1, radius, dist);

            // Core bright center
            float core = 1.0 - smoothstep(0.0, radius * 0.5, dist);

            // Combine for glowing light ball effect
            float intensity = glow + core * 0.5;

            gl_FragColor = vec4(1.0, 1.0, 1.0, intensity * uProgress);
          }
        `}
      />
    </mesh>
  );
}

// ============================================
// VIGNETTE OVERLAY - Screen-space vignette for depth perception
// ============================================
function VignetteOverlay() {
  return (
    <mesh renderOrder={998}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        transparent
        depthTest={false}
        depthWrite={false}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.998, 1.0);
          }
        `}
        fragmentShader={`
          varying vec2 vUv;

          void main() {
            vec2 center = vec2(0.5, 0.5);
            float dist = distance(vUv, center);

            // Vignette effect - darker at edges
            float vignette = smoothstep(0.2, 0.9, dist);

            // Black with variable alpha for vignette
            gl_FragColor = vec4(0.0, 0.0, 0.0, vignette * 0.5);
          }
        `}
      />
    </mesh>
  );
}

// ============================================
// COSMIC SCENE - Combines all elements with Big Bang intro
// ============================================
function CosmicScene({ sphereIntroProgress, scrollProgress }: { sphereIntroProgress: number; scrollProgress: number }) {
  const { update } = useMousePosition();
  const mouseTargetRef = useRef({ x: 0, y: 0 });

  useFrame(() => {
    const target = update();
    mouseTargetRef.current.x = target.x;
    mouseTargetRef.current.y = target.y;
  });

  return (
    <>
      {/* Lighting for glass spheres - synced with sphere animation */}
      <ambientLight intensity={0.4 * sphereIntroProgress} color="#4466ff" />
      <pointLight position={[5, 5, 5]} intensity={1.2 * sphereIntroProgress} color="#ffffff" />
      <pointLight position={[-5, -5, 5]} intensity={0.6 * sphereIntroProgress} color="#6644ff" />
      <pointLight position={[0, 0, 10]} intensity={1 * sphereIntroProgress} color="#4488ff" />

      {/* Environment map for glass reflections */}
      <Environment files="/rosendal_park_sunset_puresky_1k.hdr" />

      {/* Background - fades in */}
      <group>
        <CosmicBackground />
      </group>

      {/* Subtle background stars with parallax */}
      <SubtleStars mouseTarget={mouseTargetRef.current} />

      {/* Large glass spheres with parallax - animate from center synced with explosion */}
      <GlassSpheres mouseTarget={mouseTargetRef.current} introProgress={sphereIntroProgress} />

      {/* Animated atoms from GLB - entry + scroll controlled */}
      <AnimatedAtoms introProgress={sphereIntroProgress} scrollProgress={scrollProgress} />

      {/* White flash at end of scroll - frames 180-190 */}
      <WhiteFlash scrollProgress={scrollProgress} />

      {/* Vignette overlay for depth perception */}
      <VignetteOverlay />
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
  const scrollTicking = useRef(false);

  // Big Bang entrance animation state - phased approach
  const [phase, setPhase] = useState<'circle' | 'lines' | 'explode'>('circle');
  const [circleProgress, setCircleProgress] = useState(0);
  const [linesProgress, setLinesProgress] = useState(0);
  const [entranceProgress, setEntranceProgress] = useState(0);
  const animationStartTime = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);
  const noiseSeed = 42; // Static seed - no animation to prevent choppy effect
  const [viewportSize, setViewportSize] = useState({ width: 1920, height: 1080 });

  // Animation timing constants
  const ANIMATION_DELAY = 300; // ms before animation starts (time for page to load)
  const CIRCLE_DURATION = 2500; // ms for circle to draw (slow, dramatic buildup)
  const LINES_DURATION = 300; // ms for lines to move to center
  const EXPLOSION_OVERLAP = 300; // ms - explosion starts exactly when lines begin
  const EXPLOSION_DURATION = 800; // ms for explosion to reach 40%
  const ENTRANCE_TARGET = 0.4; // Opens to 40% during entrance

  // Circle dimensions
  const CIRCLE_RADIUS = 48; // vmin (60 * 0.8 = 20% smaller)

  // Track viewport size for vmin calculations
  useEffect(() => {
    const updateSize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Phased entrance animation
  useEffect(() => {
    const startAnimation = () => {
      animationStartTime.current = performance.now();

      const animate = (currentTime: number) => {
        if (animationStartTime.current === null) return;

        const elapsed = currentTime - animationStartTime.current;

        // Phase 1: Circle drawing (0-800ms)
        // Phase 1: Circle drawing
        if (elapsed < CIRCLE_DURATION) {
          const progress = elapsed / CIRCLE_DURATION;
          // Ease out for smooth circle draw
          setCircleProgress(1 - Math.pow(1 - progress, 2));
          setPhase('circle');
        }
        // Phase 2: Lines to center
        else if (elapsed < CIRCLE_DURATION + LINES_DURATION) {
          setCircleProgress(1);
          const linesElapsed = elapsed - CIRCLE_DURATION;
          const progress = linesElapsed / LINES_DURATION;
          // Ease in - accelerate toward center
          setLinesProgress(Math.pow(progress, 2));
          setPhase('lines');

          // Start explosion early (overlap) - begins EXPLOSION_OVERLAP ms before lines finish
          const explosionStart = CIRCLE_DURATION + LINES_DURATION - EXPLOSION_OVERLAP;
          if (elapsed > explosionStart) {
            const explosionElapsed = elapsed - explosionStart;
            const explosionProgress = Math.min(1, explosionElapsed / EXPLOSION_DURATION);
            // Ease-in for smooth hole opening
            const easedProgress = Math.pow(explosionProgress, 2);
            setEntranceProgress(easedProgress * ENTRANCE_TARGET);
          }
        }
        // Phase 3: Explosion continues
        else {
          setCircleProgress(1);
          setLinesProgress(1);
          setPhase('explode');

          const explosionStart = CIRCLE_DURATION + LINES_DURATION - EXPLOSION_OVERLAP;
          const explosionElapsed = elapsed - explosionStart;
          const explosionProgress = Math.min(1, explosionElapsed / EXPLOSION_DURATION);
          // Ease-in for smooth hole opening
          const easedProgress = Math.pow(explosionProgress, 2);
          setEntranceProgress(easedProgress * ENTRANCE_TARGET);

        }

        // Continue animation until explosion is complete
        const explosionStart = CIRCLE_DURATION + LINES_DURATION - EXPLOSION_OVERLAP;
        const totalDuration = explosionStart + EXPLOSION_DURATION;
        if (elapsed < totalDuration) {
          animationRef.current = requestAnimationFrame(animate);
        }
      };

      animationRef.current = requestAnimationFrame(animate);
    };

    const delayTimer = setTimeout(startAnimation, ANIMATION_DELAY);

    return () => {
      clearTimeout(delayTimer);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Scroll handler - continues from entrance progress
  useEffect(() => {
    const handleScroll = () => {
      if (!scrollTicking.current) {
        requestAnimationFrame(() => {
          if (!containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const heroHeight = containerRef.current.offsetHeight;
          const windowHeight = window.innerHeight;

          const progress = Math.min(
            Math.max(-rect.top / (heroHeight - windowHeight), 0),
            1
          );
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

  // Calculate hole size for Big Bang effect
  // Combined progress: entrance animation + scroll continuation
  // Big Bang phase: scrollProgress 0-0.6 (first 60% of scroll)
  const bigBangScrollEnd = 0.6;
  const bigBangScrollProgress = Math.min(1, scrollProgress / bigBangScrollEnd);
  const scrollContribution = bigBangScrollProgress * (1 - ENTRANCE_TARGET);
  const totalProgress = Math.min(1, entranceProgress + scrollContribution);

  // Tear transition: scrollProgress 0.85-1.0 (last 15% of scroll, right before next section)
  const tearStart = 0.85;
  const tearEnd = 1.0;
  const tearProgress = scrollProgress <= tearStart ? 0 : Math.min(1, (scrollProgress - tearStart) / (tearEnd - tearStart));

  // Hole size: 0% = no hole (all black), 100% = full screen (no black)
  const holeSize = totalProgress * 150; // 150vmax covers the screen diagonally
  const holeSizeH = holeSize * 1.3; // Horizontal radius (wider)
  const holeSizeV = holeSize * 0.85; // Vertical radius (shorter)

  // Radial mask: ellipse transparent center (hole), black edges
  // Offset center for asymmetry - not perfectly centered
  const maskImage = `radial-gradient(ellipse ${holeSizeH}vmax ${holeSizeV}vmax at calc(50% + 8vw) calc(50% - 5vh), transparent 100%, black 100%)`;

  // Tear hole size (grows from center, revealing next section)
  const tearHoleSize = tearProgress * 180; // 180vmax to fully cover screen
  const tearHoleSizeH = tearHoleSize * 1.2;
  const tearHoleSizeV = tearHoleSize * 0.9;
  const tearMaskImage = `radial-gradient(ellipse ${tearHoleSizeH}vmax ${tearHoleSizeV}vmax at 50% 50%, transparent 100%, white 100%)`;

  return (
    <section
      id="hero"
      ref={containerRef}
      className="h-[215vh] relative"
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Cosmic Canvas - hidden during tear transition (keep mounted for performance) */}
        <div
          className="absolute inset-0"
          style={{
            visibility: tearProgress === 0 ? 'visible' : 'hidden',
            pointerEvents: tearProgress === 0 ? 'auto' : 'none'
          }}
        >
          <Canvas
            className="absolute inset-0"
            camera={{ position: [0, 0, 8], fov: 65, near: 0.1, far: 300 }}
            gl={{ antialias: true, alpha: true }}
            dpr={[1, 2]}
          >
            <Suspense fallback={null}>
              <CosmicScene sphereIntroProgress={entranceProgress / ENTRANCE_TARGET} scrollProgress={scrollProgress} />
            </Suspense>
          </Canvas>
        </div>

        {/* SVG Filter for noisy, 3D explosion edges */}
        <svg className="absolute" style={{ width: 0, height: 0 }}>
          <defs>
            <filter id="explosion-filter" x="-100%" y="-100%" width="300%" height="300%">
              {/* Huge scale noise - completely destroys symmetry */}
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.002"
                numOctaves="2"
                seed={noiseSeed}
                result="hugeNoise"
              />
              {/* First displacement - massive abstract deformation, asymmetric channels */}
              <feDisplacementMap
                in="SourceGraphic"
                in2="hugeNoise"
                scale={500 + totalProgress * 300}
                xChannelSelector="R"
                yChannelSelector="B"
                result="hugeDisplaced"
              />
              {/* Large scale noise - secondary asymmetry */}
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.005"
                numOctaves="2"
                seed={noiseSeed + 25}
                result="bigNoise"
              />
              {/* Second displacement - different channels for asymmetry */}
              <feDisplacementMap
                in="hugeDisplaced"
                in2="bigNoise"
                scale={200 + totalProgress * 120}
                xChannelSelector="G"
                yChannelSelector="R"
                result="bigDisplaced"
              />
              {/* Medium scale noise for organic detail */}
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.015"
                numOctaves="3"
                seed={noiseSeed + 50}
                result="medNoise"
              />
              {/* Third displacement - fine detail */}
              <feDisplacementMap
                in="bigDisplaced"
                in2="medNoise"
                scale={80 + totalProgress * 40}
                xChannelSelector="B"
                yChannelSelector="G"
              />
            </filter>

            {/* Secondary filter for 3D depth effect on edges */}
            <filter id="edge-3d-filter" x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.012"
                numOctaves="3"
                seed={noiseSeed + 100}
                result="noise3d"
              />
              <feDiffuseLighting
                in="noise3d"
                lightingColor="#ffffff"
                surfaceScale="8"
                diffuseConstant="1"
                result="lighting"
              >
                <feDistantLight azimuth="45" elevation="60" />
              </feDiffuseLighting>
              <feBlend in="SourceGraphic" in2="lighting" mode="overlay" />
            </filter>

            {/* Torn paper filter - organic, rough edges */}
            <filter id="tear-filter" x="-50%" y="-50%" width="200%" height="200%">
              {/* Large scale tears */}
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.008"
                numOctaves="4"
                seed={noiseSeed + 200}
                result="tearNoise1"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="tearNoise1"
                scale={150 + tearProgress * 100}
                xChannelSelector="R"
                yChannelSelector="G"
                result="torn1"
              />
              {/* Medium detail tears */}
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.02"
                numOctaves="3"
                seed={noiseSeed + 250}
                result="tearNoise2"
              />
              <feDisplacementMap
                in="torn1"
                in2="tearNoise2"
                scale={60 + tearProgress * 40}
                xChannelSelector="G"
                yChannelSelector="B"
                result="torn2"
              />
              {/* Fine paper fiber detail */}
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.05"
                numOctaves="2"
                seed={noiseSeed + 300}
                result="tearNoise3"
              />
              <feDisplacementMap
                in="torn2"
                in2="tearNoise3"
                scale={20}
                xChannelSelector="R"
                yChannelSelector="B"
              />
            </filter>
          </defs>
        </svg>

        {/* Big Bang Overlay - Black with expanding circular hole + explosion effect */}
        {totalProgress < 1 && tearProgress === 0 && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 100,
            }}
          >
            {/* Circle and Lines Animation - phases 1 & 2 */}
            {phase !== 'explode' && (
              <svg
                className="absolute inset-0 w-full h-full"
                style={{ zIndex: 110 }}
              >
                {/* Circle being drawn with stroke-dasharray */}
                <circle
                  cx="50%"
                  cy="50%"
                  r={`${CIRCLE_RADIUS}vmin`}
                  fill="none"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  pathLength="100"
                  style={{
                    strokeDasharray: 101, // Slightly more than 100 to ensure full closure
                    strokeDashoffset: 100 * (1 - circleProgress),
                    transition: 'stroke-dashoffset 50ms linear',
                    opacity: phase === 'lines' ? 1 - linesProgress : 1,
                  }}
                />

                {/* 5 lines moving from circle edge to center */}
                {phase === 'lines' && [0, 72, 144, 216, 288].map((angle, i) => {
                  const angleRad = (angle - 90) * Math.PI / 180; // -90 to start from top
                  // Calculate vmin and convert radius to pixels, then to correct percentages
                  const vmin = Math.min(viewportSize.width, viewportSize.height);
                  const radiusPixels = (CIRCLE_RADIUS / 100) * vmin;
                  // Convert pixel offsets to percentages relative to each axis
                  const startX = 50 + (Math.cos(angleRad) * radiusPixels / viewportSize.width * 100);
                  const startY = 50 + (Math.sin(angleRad) * radiusPixels / viewportSize.height * 100);
                  const currentRadiusPixels = radiusPixels * (1 - linesProgress);
                  const endX = 50 + (Math.cos(angleRad) * currentRadiusPixels / viewportSize.width * 100);
                  const endY = 50 + (Math.sin(angleRad) * currentRadiusPixels / viewportSize.height * 100);

                  return (
                    <line
                      key={i}
                      x1={`${startX}%`}
                      y1={`${startY}%`}
                      x2={`${endX}%`}
                      y2={`${endY}%`}
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      style={{
                        opacity: 1 - linesProgress * 0.5,
                      }}
                    />
                  );
                })}
              </svg>
            )}

            {/* Single container with filter - both layers displaced together */}
            <div
              className="absolute"
              style={{
                top: "-20%",
                left: "-20%",
                right: "-20%",
                bottom: "-20%",
                filter: entranceProgress > 0.05 ? "url(#explosion-filter)" : undefined,
              }}
            >
              {/* Main black layer with mask */}
              <div
                className="absolute inset-0 bg-black"
                style={{
                  WebkitMaskImage: entranceProgress > 0.05 ? maskImage : undefined,
                  maskImage: entranceProgress > 0.05 ? maskImage : undefined,
                }}
              />
              {/* Edge highlight layer for 3D depth - greyscale only */}
              {entranceProgress > 0.05 && (
                <div
                  className="absolute inset-0"
                  style={{
                    background: `radial-gradient(ellipse ${holeSizeH}vmax ${holeSizeV}vmax at calc(50% + 8vw) calc(50% - 5vh),
                      transparent 95%,
                      rgba(255, 255, 255, 0.15) 98%,
                      rgba(200, 200, 200, 0.25) 100%,
                      rgba(100, 100, 100, 0.15) 102%,
                      transparent 105%
                    )`,
                    filter: "blur(2px)",
                    mixBlendMode: "screen",
                  }}
                />
              )}
            </div>
          </div>
        )}

        {/* Center space for atoms (placeholder) - hide during tear */}
        {tearProgress === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 rounded-full border border-white/5" />
          </div>
        )}

        {/* Tear Transition Overlay - Fixed position so next section scrolls into view through hole */}
        {tearProgress > 0 && tearProgress < 1 && (
          <div
            className="fixed inset-0 pointer-events-none"
            style={{
              zIndex: 200,
            }}
          >
            {/* Torn paper container with filter */}
            <div
              className="absolute"
              style={{
                top: "-25%",
                left: "-25%",
                right: "-25%",
                bottom: "-25%",
                filter: tearProgress > 0.05 ? "url(#tear-filter)" : undefined,
              }}
            >
              {/* Main white layer with mask (hole in center) */}
              <div
                className="absolute inset-0 bg-white"
                style={{
                  WebkitMaskImage: tearMaskImage,
                  maskImage: tearMaskImage,
                }}
              />
              {/* Torn edge shadow - inner dark edge for depth */}
              <div
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(ellipse ${tearHoleSizeH}vmax ${tearHoleSizeV}vmax at 50% 50%,
                    transparent 92%,
                    rgba(0, 0, 0, 0.15) 96%,
                    rgba(0, 0, 0, 0.25) 98%,
                    rgba(0, 0, 0, 0.1) 100%,
                    transparent 102%
                  )`,
                  filter: "blur(3px)",
                }}
              />
              {/* Paper texture highlight on torn edge */}
              <div
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(ellipse ${tearHoleSizeH}vmax ${tearHoleSizeV}vmax at 50% 50%,
                    transparent 97%,
                    rgba(255, 255, 255, 0.9) 99%,
                    rgba(245, 245, 240, 1) 100%,
                    transparent 101%
                  )`,
                  filter: "blur(1px)",
                }}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
