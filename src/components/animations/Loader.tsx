"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

export default function Loader() {
  const [show, setShow] = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const pinkRef = useRef<HTMLImageElement>(null);
  const cyanRef = useRef<HTMLImageElement>(null);
  const mainRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (sessionStorage.getItem("fuzion-loaded")) {
      setShow(false);
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      sessionStorage.setItem("fuzion-loaded", "true");
      setShow(false);
      return;
    }

    const tl = gsap.timeline({
      onComplete: () => {
        sessionStorage.setItem("fuzion-loaded", "true");
        setShow(false);
      },
    });

    tl.fromTo(
      mainRef.current,
      { opacity: 0, scale: 0.8 },
      { opacity: 1, scale: 1, duration: 0.8, ease: "power2.out" }
    );

    tl.to(pinkRef.current, { opacity: 0.7, x: -4, y: 2, duration: 0.3, ease: "power2.out" }, "+=0.2");
    tl.to(cyanRef.current, { opacity: 0.7, x: 4, y: -2, duration: 0.3, ease: "power2.out" }, "<");
    tl.to([pinkRef.current, cyanRef.current], { opacity: 0, x: 0, y: 0, duration: 0.3, ease: "power2.in" }, "+=0.3");

    tl.to(logoRef.current, {
      scale: 0.15,
      x: "30vw",
      y: "-35vh",
      duration: 0.8,
      ease: "power3.inOut",
    }, "+=0.1");

    tl.to(overlayRef.current, { opacity: 0, duration: 0.4, ease: "power2.out" }, "-=0.2");

    return () => { tl.kill(); };
  }, []);

  if (!show) return null;

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
      <div ref={logoRef} className="relative w-[200px] h-[200px] md:w-[280px] md:h-[280px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={pinkRef} src="/logo-white.svg" alt="" className="absolute inset-0 w-full h-full object-contain opacity-0" style={{ filter: "brightness(0) saturate(100%) invert(15%) sepia(95%) saturate(6000%) hue-rotate(310deg) brightness(95%) contrast(105%)" }} aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={cyanRef} src="/logo-white.svg" alt="" className="absolute inset-0 w-full h-full object-contain opacity-0" style={{ filter: "brightness(0) saturate(100%) invert(80%) sepia(60%) saturate(5000%) hue-rotate(140deg) brightness(105%) contrast(105%)" }} aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={mainRef} src="/logo-white.svg" alt="Fuzion Webz" className="absolute inset-0 w-full h-full object-contain opacity-0" />
      </div>
    </div>
  );
}
