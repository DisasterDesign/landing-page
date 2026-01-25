"use client";

import { useRef, useEffect, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";
import Image from "next/image";
import NoiseParticles from "./NoiseParticles";

// Animation constants
const FPS = 25;
// Desktop: entrance 0-60, scroll 60-120
const DESKTOP_ENTRANCE_END_FRAME = 60;
const DESKTOP_SCROLL_END_FRAME = 120;
// Mobile: entrance 0-40, scroll 40-120
const MOBILE_ENTRANCE_END_FRAME = 40;
const MOBILE_SCROLL_END_FRAME = 120;
const MOBILE_BREAKPOINT = 768;

// Dynamic FOV for responsive desktop screens
// Wider screens (1920px+) → 50 FOV (no zoom out needed)
// Narrower screens (768px) → 65 FOV (zoom out to prevent clipping)
function getResponsiveFOV(width: number): number {
  if (width >= 1920) return 50;
  if (width <= 768) return 65;
  // Linear interpolation between 768-1920
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

  // Calculate time values based on device
  const entranceEndFrame = isMobile ? MOBILE_ENTRANCE_END_FRAME : DESKTOP_ENTRANCE_END_FRAME;
  const scrollEndFrame = isMobile ? MOBILE_SCROLL_END_FRAME : DESKTOP_SCROLL_END_FRAME;
  const entranceEndTime = entranceEndFrame / FPS;
  const scrollEndTime = scrollEndFrame / FPS;

  // Initialize animation
  useEffect(() => {
    if (!mixer || !animations.length) return;

    const clip = animations[0];
    const action = mixer.clipAction(clip);

    // Setup for manual time control - don't clamp so we can go backwards
    action.clampWhenFinished = false;
    action.setLoop(THREE.LoopOnce, 1);
    action.paused = false;
    action.enabled = true;
    action.setEffectiveWeight(1);
    action.play();

    // Store reference for frame updates
    actionRef.current = action;

    // Set initial time to 0
    mixer.setTime(0);

    console.log("Animation loaded, total duration:", clip.duration);
    console.log("Entrance end time:", entranceEndTime, "Scroll end time:", scrollEndTime);
  }, [mixer, animations, entranceEndTime, scrollEndTime]);

  // Control animation frame by frame
  useFrame((_, delta) => {
    if (!mixer) return;

    // Ensure action stays enabled for reverse playback
    if (actionRef.current) {
      actionRef.current.paused = false;
      actionRef.current.enabled = true;
    }

    let targetTime: number;

    if (!entranceComplete) {
      // Entrance phase: advance time manually, stop at frame 60
      entranceTime.current += delta;

      if (entranceTime.current >= entranceEndTime) {
        entranceTime.current = entranceEndTime;
        if (!entranceComplete) {
          setEntranceComplete(true);
          onEntranceComplete();
          console.log("Entrance complete at time:", entranceEndTime);
        }
      }

      targetTime = Math.min(entranceTime.current, entranceEndTime);
    } else {
      // Scroll phase: map scrollProgress to frames 60-120
      targetTime = entranceEndTime + (scrollProgress * (scrollEndTime - entranceEndTime));
    }

    // Set time directly for proper reverse playback
    mixer.setTime(targetTime);

    // Mouse parallax on the logo
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

// Main Scene
function Scene({
  scrollProgress,
  isMobile,
  onEntranceComplete
}: {
  scrollProgress: number;
  isMobile: boolean;
  onEntranceComplete: () => void;
}) {
  const mouse = useMousePosition();
  const modelPath = isMobile ? "/moblie.glb?v=3" : "/final.glb?v=2";

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 5, 5]} intensity={1.5} />
      <pointLight position={[-5, -5, 5]} intensity={0.8} color="#F37021" />
      <pointLight position={[0, 3, 3]} intensity={0.5} color="#ffffff" />

      <AnimatedLogo
        mouse={mouse}
        scrollProgress={scrollProgress}
        onEntranceComplete={onEntranceComplete}
        modelPath={modelPath}
        isMobile={isMobile}
      />
    </>
  );
}

// Props interface
interface Hero3DProps {
  onTearProgressChange?: (progress: number) => void;
  onTearVisibilityChange?: (visible: boolean) => void;
}

// Main Hero component
export default function Hero3D({
  onTearProgressChange,
  onTearVisibilityChange,
}: Hero3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [tearProgress, setTearProgress] = useState(0);
  const [textLoaded, setTextLoaded] = useState(false);
  const [textColor, setTextColor] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [screenWidth, setScreenWidth] = useState(1920);
  const [borderLoaded, setBorderLoaded] = useState(false); // For animated border
  const [viewportSize, setViewportSize] = useState({ width: 1920, height: 1080 });

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

  // Optimized scroll handler with requestAnimationFrame throttling
  const scrollTicking = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      if (!scrollTicking.current) {
        requestAnimationFrame(() => {
          if (!containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const heroHeight = containerRef.current.offsetHeight;
          const windowHeight = window.innerHeight;

          // General scroll progress (0-1 over the full hero section)
          const progress = Math.min(
            Math.max(-rect.top / (heroHeight - windowHeight), 0),
            1
          );
          setScrollProgress(progress);

          // Tear progress: starts at 20% scroll, completes at 80%
          // This makes the tear animation slower and more gradual
          const tearStart = 0.2;
          const tearEnd = 0.8;
          const rawTear = (progress - tearStart) / (tearEnd - tearStart);
          const clampedTear = Math.max(0, Math.min(1, rawTear));
          setTearProgress(clampedTear);

          // Notify parent of tear progress
          onTearProgressChange?.(clampedTear);
          onTearVisibilityChange?.(progress < 1);

          scrollTicking.current = false;
        });
        scrollTicking.current = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);


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
          {/* Top edge */}
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
          {/* Right edge */}
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
          {/* Left edge */}
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

        {/* Transparent - HowItWorks section is visible through the tear */}

        {/* Noise Particles - above background */}
        <NoiseParticles />

        {/* 3D Canvas - logo animation only */}
        <Canvas
          camera={{
            position: isMobile ? [0, -2, 10] : [-2, 0, 10],
            fov: isMobile ? 60 : getResponsiveFOV(screenWidth)
          }}
          className="absolute inset-0 z-[2]"
          gl={{ alpha: true, antialias: true }}
        >
          <Suspense fallback={null}>
            <Scene
              scrollProgress={scrollProgress}
              isMobile={isMobile}
              onEntranceComplete={() => {}}
            />
          </Suspense>
        </Canvas>

        {/* Webz Logo */}
        <div
          className="absolute z-[3] select-none"
          style={{
            bottom: "60px",
            right: "18%",
            // Exit animation: first change to white (scrollProgress > 0.05), then fade out (scrollProgress > 0.15)
            opacity: textLoaded
              ? (scrollProgress > 0.15 ? Math.max(0, 1 - (scrollProgress - 0.15) * 4) : 1)
              : 0,
            // Color: white initially, then original color, then back to white on exit
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
            {/* Lightning flash effect - masked to SVG shape */}
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
