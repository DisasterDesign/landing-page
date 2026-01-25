"use client";

import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// Import shaders as raw strings
const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
precision mediump float;

uniform sampler2D tHeroCanvas;
uniform float uProgress;
uniform float uTime;
uniform vec2 uResolution;
uniform float uNoiseScale;
uniform float uHasTexture;

varying vec2 vUv;

// Simplex 2D noise
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                      -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                   + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
                          dot(x12.zw,x12.zw)), 0.0);
  m = m*m;
  m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Fractal Brownian Motion for organic edges
float fbm(vec2 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;

  for (int i = 0; i < 4; i++) {
    if (i >= octaves) break;
    value += amplitude * snoise(p * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// Easing function for smooth animation
float easeInOutCubic(float t) {
  return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
}

void main() {
  vec2 uv = vUv;
  vec2 center = vec2(0.5);

  // Aspect ratio correction
  float aspect = uResolution.x / uResolution.y;
  vec2 pos = (uv - center) * vec2(aspect, 1.0);

  // Distance from center
  float dist = length(pos);

  // Angle for noise variation around the tear
  float angle = atan(pos.y, pos.x);

  // Animated noise for organic, irregular edges
  float noiseVal = fbm(vec2(angle * 2.0 + uTime * 0.3, dist * 3.0), 4);

  // Apply easing to progress for smooth animation
  float easedProgress = easeInOutCubic(uProgress);

  // Base radius expands with progress (1.5 covers full screen diagonal)
  float baseRadius = easedProgress * 1.5;

  // Add noise displacement to radius
  float tearEdge = baseRadius + noiseVal * uNoiseScale;

  // Soft edge for anti-aliasing (wider edge for more visible tear effect)
  float edgeWidth = 0.03;
  float alpha = smoothstep(tearEdge - edgeWidth, tearEdge + edgeWidth, dist);

  // Add subtle edge glow/highlight
  float edgeGlow = smoothstep(tearEdge - 0.08, tearEdge, dist) *
                   smoothstep(tearEdge + 0.08, tearEdge, dist);

  // Sample Hero canvas texture or use fallback color
  vec3 fallbackColor = vec3(0.992, 0.957, 0.922); // #FDF4EB
  vec3 heroColor;

  if (uHasTexture > 0.5) {
    // Sample the Hero canvas texture
    vec4 texColor = texture2D(tHeroCanvas, uv);
    heroColor = texColor.rgb;
  } else {
    heroColor = fallbackColor;
  }

  // Add subtle edge shadow for depth
  vec3 finalColor = heroColor - vec3(edgeGlow * 0.15);

  // Output: alpha = 1 outside tear (show Hero), alpha = 0 inside (reveal HowItWorks)
  gl_FragColor = vec4(finalColor, alpha);
}
`;

interface TearMeshProps {
  progress: number;
  isMobile: boolean;
  heroCanvas: HTMLCanvasElement | null;
}

function TearMesh({ progress, isMobile, heroCanvas }: TearMeshProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const { size } = useThree();

  // Create CanvasTexture from Hero's canvas
  useEffect(() => {
    if (heroCanvas && !textureRef.current) {
      const texture = new THREE.CanvasTexture(heroCanvas);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      textureRef.current = texture;

      // Update material uniform
      if (materialRef.current) {
        materialRef.current.uniforms.tHeroCanvas.value = texture;
        materialRef.current.uniforms.uHasTexture.value = 1.0;
      }
    }

    return () => {
      if (textureRef.current) {
        textureRef.current.dispose();
        textureRef.current = null;
      }
    };
  }, [heroCanvas]);

  // Create shader material with uniforms
  const uniforms = useMemo(
    () => ({
      tHeroCanvas: { value: null as THREE.CanvasTexture | null },
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(size.width, size.height) },
      uNoiseScale: { value: isMobile ? 0.08 : 0.12 },
      uHasTexture: { value: 0.0 },
    }),
    [isMobile, size.width, size.height]
  );

  // Update resolution on resize
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uResolution.value.set(size.width, size.height);
    }
  }, [size]);

  // Update progress, time, and texture each frame
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uProgress.value = progress;
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;

      // Update texture from canvas every frame
      if (textureRef.current && heroCanvas) {
        textureRef.current.needsUpdate = true;
      }
    }
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (materialRef.current) {
        materialRef.current.dispose();
      }
    };
  }, []);

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent={true}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

interface TearCanvasProps {
  progress: number;
  isMobile: boolean;
  heroCanvas?: HTMLCanvasElement | null;
}

export default function TearCanvas({ progress, isMobile, heroCanvas = null }: TearCanvasProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 1], fov: 50 }}
      gl={{
        alpha: true,
        antialias: !isMobile,
        powerPreference: "high-performance",
      }}
      dpr={isMobile ? [1, 1.5] : [1, 2]}
      style={{ background: "transparent" }}
    >
      <TearMesh progress={progress} isMobile={isMobile} heroCanvas={heroCanvas} />
    </Canvas>
  );
}
