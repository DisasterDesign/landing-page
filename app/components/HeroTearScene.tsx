"use client";

import { useRef, useEffect, useState, Suspense, useMemo } from "react";
import { Canvas, useFrame, useThree, createPortal } from "@react-three/fiber";
import { useGLTF, useAnimations, useFBO } from "@react-three/drei";
import * as THREE from "three";
import Image from "next/image";
import NoiseParticles from "./NoiseParticles";

// Animation constants
const FPS = 25;
const DESKTOP_ENTRANCE_END_FRAME = 60;
const DESKTOP_SCROLL_END_FRAME = 120;
const MOBILE_ENTRANCE_END_FRAME = 40;
const MOBILE_SCROLL_END_FRAME = 120;
const MOBILE_BREAKPOINT = 768;

// Dynamic FOV for responsive desktop screens
function getResponsiveFOV(width: number): number {
  if (width >= 1920) return 50;
  if (width <= 768) return 65;
  return 65 - ((width - 768) / (1920 - 768)) * 15;
}

// Mouse position hook
function useMousePosition() {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouse({
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -(e.clientY / window.innerHeight) * 2 + 1,
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return mouse;
}

// Concrete background plane with procedural texture
function ConcreteBackground({ introProgress }: { introProgress: number }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uIntro: { value: 0 },
    }),
    []
  );

  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uIntro.value = introProgress;
    }
  });

  return (
    <mesh position={[0, 0, -5]}>
      <planeGeometry args={[50, 50]} />
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
          uniform float uIntro;
          varying vec2 vUv;

          // Simplex noise functions
          vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
          vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
          vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

          float snoise(vec2 v) {
            const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
            vec2 i  = floor(v + dot(v, C.yy));
            vec2 x0 = v - i + dot(i, C.xx);
            vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
            vec4 x12 = x0.xyxy + C.xxzz;
            x12.xy -= i1;
            i = mod289(i);
            vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
            vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
            m = m*m; m = m*m;
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

          float fbm(vec2 uv) {
            float value = 0.0;
            float amplitude = 0.5;
            for (int i = 0; i < 5; i++) {
              value += amplitude * snoise(uv);
              uv *= 2.0;
              amplitude *= 0.5;
            }
            return value;
          }

          void main() {
            // Base cream color
            vec3 baseColor = vec3(0.961, 0.941, 0.910); // #F5F0E8

            // Multi-layered concrete texture
            vec2 uv = vUv * 8.0;

            // Large scale variations (stains, patches)
            float largeNoise = fbm(uv * 0.3) * 0.08;

            // Medium detail (concrete grain)
            float mediumNoise = fbm(uv * 1.5) * 0.04;

            // Fine detail (surface roughness)
            float fineNoise = snoise(uv * 4.0) * 0.02;

            // Combine noise layers
            float noise = largeNoise + mediumNoise + fineNoise;

            // Apply noise to color
            vec3 color = baseColor + vec3(noise * 0.8, noise * 0.75, noise * 0.7);

            // Subtle vignette
            vec2 center = vUv - 0.5;
            float vignette = 1.0 - dot(center, center) * 0.3;
            color *= vignette;

            // Intro fade effect
            float alpha = uIntro;

            gl_FragColor = vec4(color, alpha);
          }
        `}
        transparent={true}
      />
    </mesh>
  );
}

// Animated Logo component
function AnimatedLogo({
  mouse,
  scrollProgress,
  onEntranceComplete,
  modelPath,
  isMobile,
}: {
  mouse: { x: number; y: number };
  scrollProgress: number;
  onEntranceComplete: () => void;
  modelPath: string;
  isMobile: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(modelPath);
  const { mixer } = useAnimations(animations, group);
  const [entranceComplete, setEntranceComplete] = useState(false);
  const entranceTime = useRef(0);
  const actionRef = useRef<THREE.AnimationAction | null>(null);

  const entranceEndFrame = isMobile ? MOBILE_ENTRANCE_END_FRAME : DESKTOP_ENTRANCE_END_FRAME;
  const scrollEndFrame = isMobile ? MOBILE_SCROLL_END_FRAME : DESKTOP_SCROLL_END_FRAME;
  const entranceEndTime = entranceEndFrame / FPS;
  const scrollEndTime = scrollEndFrame / FPS;

  useEffect(() => {
    if (!mixer || !animations.length) return;

    const clip = animations[0];
    const action = mixer.clipAction(clip);
    action.clampWhenFinished = false;
    action.setLoop(THREE.LoopOnce, 1);
    action.paused = false;
    action.enabled = true;
    action.setEffectiveWeight(1);
    action.play();
    actionRef.current = action;
    mixer.setTime(0);
  }, [mixer, animations, entranceEndTime, scrollEndTime]);

  useFrame((_, delta) => {
    if (!mixer) return;

    if (actionRef.current) {
      actionRef.current.paused = false;
      actionRef.current.enabled = true;
    }

    let targetTime: number;

    if (!entranceComplete) {
      entranceTime.current += delta;
      if (entranceTime.current >= entranceEndTime) {
        entranceTime.current = entranceEndTime;
        if (!entranceComplete) {
          setEntranceComplete(true);
          onEntranceComplete();
        }
      }
      targetTime = Math.min(entranceTime.current, entranceEndTime);
    } else {
      targetTime = entranceEndTime + (scrollProgress * (scrollEndTime - entranceEndTime));
    }

    mixer.setTime(targetTime);

    if (group.current) {
      group.current.rotation.y = THREE.MathUtils.lerp(
        group.current.rotation.y,
        mouse.x * 0.1,
        0.05
      );
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x,
        mouse.y * 0.05,
        0.05
      );
    }
  });

  return (
    <group ref={group}>
      <primitive object={scene} scale={isMobile ? 24 : 36} />
    </group>
  );
}

// Hero Scene - renders to texture
function HeroScene({
  scrollProgress,
  isMobile,
  onEntranceComplete,
  introProgress,
}: {
  scrollProgress: number;
  isMobile: boolean;
  onEntranceComplete: () => void;
  introProgress: number;
}) {
  const mouse = useMousePosition();
  const modelPath = isMobile ? "/moblie.glb?v=3" : "/final.glb?v=2";

  return (
    <>
      <ambientLight intensity={0.8 * introProgress} />
      <directionalLight position={[5, 5, 5]} intensity={1.5 * introProgress} />
      <pointLight position={[-5, -5, 5]} intensity={0.8 * introProgress} color="#F37021" />
      <pointLight position={[0, 3, 3]} intensity={0.5 * introProgress} color="#ffffff" />

      <ConcreteBackground introProgress={introProgress} />

      <group scale={0.8 + introProgress * 0.2}>
        <AnimatedLogo
          mouse={mouse}
          scrollProgress={scrollProgress}
          onEntranceComplete={onEntranceComplete}
          modelPath={modelPath}
          isMobile={isMobile}
        />
      </group>
    </>
  );
}

// Tear effect plane that samples from hero render target
function TearPlane({
  heroTexture,
  tearProgress
}: {
  heroTexture: THREE.Texture;
  tearProgress: number;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uProgress: { value: 0 },
      tHero: { value: heroTexture },
    }),
    [heroTexture]
  );

  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uProgress.value = tearProgress;
      materialRef.current.uniforms.tHero.value = heroTexture;
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
          uniform sampler2D tHero;
          varying vec2 vUv;

          // Noise functions for torn paper effect
          float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
          }

          float noise(vec2 st) {
            vec2 i = floor(st);
            vec2 f = fract(st);
            float a = random(i);
            float b = random(i + vec2(1.0, 0.0));
            float c = random(i + vec2(0.0, 1.0));
            float d = random(i + vec2(1.0, 1.0));
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
          }

          float fbm(vec2 st) {
            float value = 0.0;
            float amplitude = 0.5;
            for (int i = 0; i < 4; i++) {
              value += amplitude * noise(st);
              st *= 2.0;
              amplitude *= 0.5;
            }
            return value;
          }

          void main() {
            vec2 center = vec2(0.5, 0.5);
            float dist = distance(vUv, center);

            // Multi-scale noise for organic torn edges
            float edgeNoise = fbm(vUv * 20.0) * 0.12;
            edgeNoise += noise(vUv * 40.0) * 0.04;

            // Radius calculation
            // progress=0 → radius=-0.2 → no visible hole
            // progress=1 → radius=1.0 → hole covers screen
            float radius = uProgress * 1.3 - 0.2;
            float edge = dist + edgeNoise;

            // Three layers for torn paper effect:
            // 1. The hole (fully transparent)
            // 2. White torn edge (paper fibers)
            // 3. The hero image with shadow

            // Main hole mask
            float hole = smoothstep(radius - 0.01, radius, edge);

            // White torn edge - narrow band at the tear
            float whiteEdgeInner = smoothstep(radius, radius + 0.015, edge);
            float whiteEdgeOuter = smoothstep(radius + 0.04, radius + 0.015, edge);
            float whiteEdge = whiteEdgeInner * whiteEdgeOuter;

            // Inner shadow near the edge (depth effect)
            float innerShadow = smoothstep(radius, radius + 0.08, edge);

            // Sample the hero texture
            vec4 heroColor = texture2D(tHero, vUv);

            // Apply inner shadow to darken near the edge
            vec3 shadedColor = heroColor.rgb * (0.7 + innerShadow * 0.3);

            // White edge color (slightly off-white for paper)
            vec3 paperWhite = vec3(0.98, 0.97, 0.95);

            // Blend white edge on top
            vec3 finalColor = mix(shadedColor, paperWhite, whiteEdge * 0.9);

            // Output with alpha
            gl_FragColor = vec4(finalColor, hole * heroColor.a);
          }
        `}
      />
    </mesh>
  );
}

// Main renderer that uses FBO for render-to-texture
function MainRenderer({
  scrollProgress,
  tearProgress,
  isMobile,
  screenWidth,
}: {
  scrollProgress: number;
  tearProgress: number;
  isMobile: boolean;
  screenWidth: number;
}) {
  const { gl, size } = useThree();

  // Intro animation progress (0 to 1)
  const introRef = useRef(0);
  const [introProgress, setIntroProgress] = useState(0);
  const introStartTime = useRef<number | null>(null);
  const INTRO_DURATION = 1.5; // seconds

  // Create hero scene for rendering to texture
  const heroScene = useMemo(() => new THREE.Scene(), []);

  // Create camera for hero scene
  const heroCamera = useMemo(() => {
    const cam = new THREE.PerspectiveCamera(
      isMobile ? 60 : getResponsiveFOV(screenWidth),
      size.width / size.height,
      0.1,
      1000
    );
    cam.position.set(isMobile ? 0 : -2, isMobile ? -2 : 0, 10);
    return cam;
  }, [isMobile, screenWidth, size.width, size.height]);

  // Create FBO (Frame Buffer Object) for render target
  const renderTarget = useFBO(size.width, size.height, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    stencilBuffer: false,
  });

  // Update camera aspect on resize
  useEffect(() => {
    heroCamera.aspect = size.width / size.height;
    heroCamera.fov = isMobile ? 60 : getResponsiveFOV(screenWidth);
    heroCamera.position.set(isMobile ? 0 : -2, isMobile ? -2 : 0, 10);
    heroCamera.updateProjectionMatrix();
  }, [heroCamera, size.width, size.height, isMobile, screenWidth]);

  useFrame((state) => {
    // Intro animation
    if (introStartTime.current === null) {
      introStartTime.current = state.clock.elapsedTime;
    }
    const elapsed = state.clock.elapsedTime - introStartTime.current;
    const newIntro = Math.min(1, elapsed / INTRO_DURATION);

    // Easing function (ease out cubic)
    const eased = 1 - Math.pow(1 - newIntro, 3);

    if (eased !== introRef.current) {
      introRef.current = eased;
      setIntroProgress(eased);
    }

    // Step 1: Render hero scene to FBO
    gl.setRenderTarget(renderTarget);
    gl.clear();
    gl.render(heroScene, heroCamera);

    // Step 2: Render tear effect to screen (done by R3F automatically with TearPlane)
    gl.setRenderTarget(null);
  });

  return (
    <>
      {/* Portal hero content into the heroScene */}
      {createPortal(
        <HeroScene
          scrollProgress={scrollProgress}
          isMobile={isMobile}
          onEntranceComplete={() => {}}
          introProgress={introProgress}
        />,
        heroScene
      )}

      {/* Tear plane that uses the rendered texture */}
      <TearPlane heroTexture={renderTarget.texture} tearProgress={tearProgress} />
    </>
  );
}

// Props interface
interface HeroTearSceneProps {
  onTearProgressChange?: (progress: number) => void;
  onTearVisibilityChange?: (visible: boolean) => void;
}

// Main exported component
export default function HeroTearScene({
  onTearProgressChange,
  onTearVisibilityChange,
}: HeroTearSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [tearProgress, setTearProgress] = useState(0);
  const [textLoaded, setTextLoaded] = useState(false);
  const [textColor, setTextColor] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [screenWidth, setScreenWidth] = useState(1920);
  const [borderLoaded, setBorderLoaded] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 1920, height: 1080 });
  const scrollTicking = useRef(false);

  // Mobile detection and screen width tracking
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width < MOBILE_BREAKPOINT);
      setScreenWidth(width);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Border animation and viewport tracking
  useEffect(() => {
    const updateViewport = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    const timer = setTimeout(() => setBorderLoaded(true), 100);
    return () => {
      window.removeEventListener("resize", updateViewport);
      clearTimeout(timer);
    };
  }, []);

  // Webz text animation
  useEffect(() => {
    const loadTimer = setTimeout(() => setTextLoaded(true), 200);
    const colorTimer = setTimeout(() => setTextColor(true), 1600);
    return () => {
      clearTimeout(loadTimer);
      clearTimeout(colorTimer);
    };
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

          const progress = Math.min(
            Math.max(-rect.top / (heroHeight - windowHeight), 0),
            1
          );
          setScrollProgress(progress);

          // Tear progress: starts at 20% scroll, completes at 80%
          const tearStart = 0.2;
          const tearEnd = 0.8;
          const rawTear = (progress - tearStart) / (tearEnd - tearStart);
          const clampedTear = Math.max(0, Math.min(1, rawTear));
          setTearProgress(clampedTear);

          onTearProgressChange?.(clampedTear);
          onTearVisibilityChange?.(progress < 1);

          scrollTicking.current = false;
        });
        scrollTicking.current = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [onTearProgressChange, onTearVisibilityChange]);

  return (
    <section
      id="hero"
      ref={containerRef}
      className="h-[300vh] relative"
    >
      <div className="sticky top-0 h-screen overflow-hidden z-[5]">
        {/* Animated Border */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-[4]"
          style={{ overflow: "visible" }}
        >
          <line
            x1="0"
            y1="0.5"
            x2={viewportSize.width}
            y2="0.5"
            stroke="rgba(31,31,31,0.3)"
            strokeWidth="1"
            style={{
              strokeDasharray: viewportSize.width,
              strokeDashoffset: borderLoaded ? 0 : viewportSize.width,
              transition: "stroke-dashoffset 1.2s ease-out",
            }}
          />
          <line
            x1={viewportSize.width - 0.5}
            y1="0"
            x2={viewportSize.width - 0.5}
            y2={viewportSize.height}
            stroke="rgba(31,31,31,0.3)"
            strokeWidth="1"
            style={{
              strokeDasharray: viewportSize.height,
              strokeDashoffset: borderLoaded ? 0 : viewportSize.height,
              transition: "stroke-dashoffset 1.2s ease-out",
            }}
          />
          <line
            x1="0.5"
            y1={viewportSize.height}
            x2="0.5"
            y2="0"
            stroke="rgba(31,31,31,0.3)"
            strokeWidth="1"
            style={{
              strokeDasharray: viewportSize.height,
              strokeDashoffset: borderLoaded ? 0 : viewportSize.height,
              transition: "stroke-dashoffset 1.2s ease-out",
            }}
          />
        </svg>

        {/* Noise Particles */}
        <NoiseParticles />

        {/* Main Canvas with Render-to-Texture */}
        <Canvas
          className="absolute inset-0 z-[2]"
          gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
          orthographic
          camera={{ position: [0, 0, 1], zoom: 1 }}
        >
          <Suspense fallback={null}>
            <MainRenderer
              scrollProgress={scrollProgress}
              tearProgress={tearProgress}
              isMobile={isMobile}
              screenWidth={screenWidth}
            />
          </Suspense>
        </Canvas>

        {/* Webz Logo */}
        <div
          className="absolute z-[3] select-none"
          style={{
            bottom: "60px",
            right: "18%",
            opacity: textLoaded
              ? (scrollProgress > 0.15 ? Math.max(0, 1 - (scrollProgress - 0.15) * 4) : 1)
              : 0,
            filter: (textColor && scrollProgress <= 0.05)
              ? "none"
              : "brightness(0) invert(1)",
            transition: `filter 1.4s ease-out${!textLoaded ? ", opacity 1.5s ease-out" : ""}${scrollProgress > 0 ? ", opacity 0.8s ease-out" : ""}`,
          }}
        >
          <div className="relative overflow-hidden">
            <Image
              src="/webz.svg"
              alt="Webz"
              width={294}
              height={74}
              style={{
                width: "clamp(225px, 22.5vw, 375px)",
                height: "auto",
              }}
              priority
            />
            <span
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)",
                transform: "skewX(-20deg)",
                animation: "lightning-sweep 4s infinite",
                WebkitMaskImage: "url(/webz.svg)",
                WebkitMaskSize: "100% 100%",
                WebkitMaskRepeat: "no-repeat",
                maskImage: "url(/webz.svg)",
                maskSize: "100% 100%",
                maskRepeat: "no-repeat",
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// Preload the models
useGLTF.preload("/final.glb?v=2");
useGLTF.preload("/moblie.glb?v=3");
