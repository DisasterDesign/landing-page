"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Image from "next/image";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";

// Animation constants
const FPS = 25;
const ENTRANCE_END_FRAME = 40;

// Mouse position hook for parallax
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

// Phone 3D Model component
function PhoneModel({
  isVisible,
  mouse,
}: {
  isVisible: boolean;
  mouse: { x: number; y: number };
}) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF("/phone.glb?v=4");
  const { mixer } = useAnimations(animations, group);
  const [entranceComplete, setEntranceComplete] = useState(false);
  const entranceTime = useRef(0);
  const actionRef = useRef<THREE.AnimationAction | null>(null);

  const entranceEndTime = ENTRANCE_END_FRAME / FPS;

  // Initialize animation
  useEffect(() => {
    if (!mixer || !animations.length) return;

    const clip = animations[0];
    const action = mixer.clipAction(clip);

    action.clampWhenFinished = true;
    action.setLoop(THREE.LoopOnce, 1);
    action.paused = false;
    action.enabled = true;
    action.setEffectiveWeight(1);
    action.play();

    actionRef.current = action;
    mixer.setTime(0);
  }, [mixer, animations]);

  // Control animation + parallax
  useFrame((_, delta) => {
    if (!mixer || !isVisible) return;

    if (actionRef.current) {
      actionRef.current.paused = false;
      actionRef.current.enabled = true;
    }

    // Entrance animation: frames 0-40
    if (!entranceComplete) {
      entranceTime.current += delta;

      if (entranceTime.current >= entranceEndTime) {
        entranceTime.current = entranceEndTime;
        setEntranceComplete(true);
      }

      mixer.setTime(Math.min(entranceTime.current, entranceEndTime));
    }

    // Mouse parallax effect
    if (group.current) {
      group.current.rotation.y = THREE.MathUtils.lerp(
        group.current.rotation.y,
        mouse.x * 0.3,
        0.05
      );
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x,
        mouse.y * 0.15,
        0.05
      );
    }
  });

  return (
    <group ref={group}>
      <primitive object={scene} scale={15} />
    </group>
  );
}

// Scene wrapper
function PhoneScene({ isVisible }: { isVisible: boolean }) {
  const mouse = useMousePosition();
  return <PhoneModel isVisible={isVisible} mouse={mouse} />;
}

// Wave layers with parallax effect
function WaveLayers({ isVisible }: { isVisible: boolean }) {
  const mouse = useMousePosition();
  const [hasEntered, setHasEntered] = useState(false);

  // Track when entrance animation completes
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => setHasEntered(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  return (
    <>
      {/* Wave 1 - lighter beige, back layer */}
      <div
        className={`absolute left-0 right-0 bottom-0 w-full ${
          hasEntered ? "" : "transition-all duration-1000 ease-out"
        }`}
        style={{
          transform: `translateY(${isVisible ? 0 : 100}%) translateX(${hasEntered ? mouse.x * 10 : 0}px)`,
          opacity: isVisible ? 1 : 0,
        }}
      >
        <Image
          src="/contact-wave-1.svg"
          alt=""
          width={1728}
          height={313}
          className="w-full h-auto"
          style={{ display: "block" }}
        />
      </div>
      {/* Wave 2 - darker beige, front layer */}
      <div
        className={`absolute left-0 right-0 bottom-0 w-full ${
          hasEntered ? "" : "transition-all duration-1000 ease-out delay-150"
        }`}
        style={{
          transform: `translateY(${isVisible ? 0 : 100}%) translateX(${hasEntered ? mouse.x * 20 : 0}px)`,
          opacity: isVisible ? 1 : 0,
        }}
      >
        <Image
          src="/contact-wave-2.svg"
          alt=""
          width={1728}
          height={275}
          className="w-full h-auto"
          style={{ display: "block" }}
        />
      </div>
    </>
  );
}

export default function Contact() {
  const [formData, setFormData] = useState({ name: "", message: "" });
  const [isVisible, setIsVisible] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const sectionRef = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Intersection Observer for entrance animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  // Get form dimensions for SVG border
  useEffect(() => {
    if (formRef.current) {
      const updateDimensions = () => {
        if (formRef.current) {
          setDimensions({
            width: formRef.current.offsetWidth,
            height: formRef.current.offsetHeight,
          });
        }
      };
      updateDimensions();
      window.addEventListener("resize", updateDimensions);
      return () => window.removeEventListener("resize", updateDimensions);
    }
  }, [isVisible]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const text = `שלום, פנייה חדשה מהאתר:
שם: ${formData.name}
הודעה: ${formData.message || "לא צוינה הודעה"}`;

    const whatsappUrl = `https://wa.me/972XXXXXXXXX?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, "_blank");
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const perimeter = 2 * (dimensions.width + dimensions.height);

  return (
    <section
      ref={sectionRef}
      id="contact"
      className="min-h-screen relative overflow-hidden py-20"
    >
      {/* Wave layers with waterfall animation and parallax */}
      <WaveLayers isVisible={isVisible} />

      <div className="container mx-auto px-8 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 min-h-[80vh] relative z-10">
        {/* Form Side */}
        <div className="w-full lg:w-1/2 max-w-[500px] order-2 lg:order-1">
          {/* SVG Title */}
          <div
            className={`mb-12 transition-all duration-700 ${
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 -translate-y-8"
            }`}
          >
            <Image
              src="/צור קשר סקשן.svg"
              alt="צור קשר"
              width={231}
              height={50}
              className="h-auto"
            />
          </div>

          {/* Contact Form with animated border */}
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="relative p-8 flex flex-col gap-6"
          >
            {/* Animated SVG Border */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ overflow: "visible" }}
            >
              <rect
                x="0.5"
                y="0.5"
                width={dimensions.width ? dimensions.width - 1 : "100%"}
                height={dimensions.height ? dimensions.height - 1 : "100%"}
                fill="none"
                stroke="rgba(31,31,31,0.3)"
                strokeWidth="1"
                style={{
                  strokeDasharray: perimeter || 1000,
                  strokeDashoffset: isVisible ? 0 : perimeter || 1000,
                  transition: "stroke-dashoffset 1.2s ease-out",
                }}
              />
            </svg>

            {/* Name Field */}
            <div
              className={`transition-all duration-500 ${
                isVisible
                  ? "opacity-100 translate-y-0 rotate-0"
                  : "opacity-0 translate-y-4 rotate-[-2deg]"
              }`}
              style={{ transitionDelay: "200ms" }}
            >
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-4 bg-transparent border-b-2 border-white/20 text-white text-right text-lg outline-none transition-all duration-300 focus:border-[#F37021] placeholder:text-white/40"
                placeholder="מה השם שלך?"
              />
            </div>

            {/* Message Field */}
            <div
              className={`transition-all duration-500 ${
                isVisible
                  ? "opacity-100 translate-y-0 rotate-0"
                  : "opacity-0 translate-y-4 rotate-[2deg]"
              }`}
              style={{ transitionDelay: "350ms" }}
            >
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                rows={5}
                className="w-full px-4 py-4 bg-transparent border-b-2 border-white/20 text-white text-right text-lg outline-none transition-all duration-300 focus:border-[#F37021] placeholder:text-white/40 resize-none"
                placeholder="ספר לנו הכל..."
              />
            </div>

            {/* Submit Button */}
            <div
              className={`transition-all duration-500 ${
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: "500ms" }}
            >
              <button
                type="submit"
                className="w-full mt-4 px-8 py-4 bg-[#F37021] text-white text-lg font-medium transition-all duration-300 hover:bg-[#1E1E1E] hover:shadow-[0_0_30px_rgba(243,112,33,0.3)] relative overflow-hidden group"
              >
                <span className="relative z-10">בואו נדבר</span>
                {/* Sweep effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              </button>
            </div>
          </form>
        </div>

        {/* 3D Phone Model */}
        <div
          className={`w-full lg:w-1/2 h-[350px] lg:h-[600px] order-1 lg:order-2 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-12"
          }`}
        >
          <Canvas
            camera={{ position: [0, 0, 4], fov: 45 }}
            gl={{ alpha: true, antialias: true }}
            style={{ background: "transparent" }}
          >
            <Suspense fallback={null}>
              <ambientLight intensity={0.8} />
              <directionalLight position={[5, 5, 5]} intensity={1.2} />
              <pointLight
                position={[-3, -3, 3]}
                intensity={0.6}
                color="#F37021"
              />
              <PhoneScene isVisible={isVisible} />
            </Suspense>
          </Canvas>
        </div>
      </div>
    </section>
  );
}

// Preload the phone model
useGLTF.preload("/phone.glb?v=4");
