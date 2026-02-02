"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";

const CollidingSpheres = dynamic(() => import("./CollidingSpheres"), {
  ssr: false,
});

// Logo type
type Logo = {
  id: number;
  name: string;
  src: string;
  url: string | null;
};

// Client logos
const logos: Logo[] = [
  { id: 1, name: "Inner Cosmos", src: "/clients/innercosmos.png", url: "https://innercosmos.ai/" },
  { id: 2, name: "Aquatis", src: "/clients/aquatis.png", url: "https://aquatis.ai/" },
  { id: 3, name: "Titans", src: "/clients/titans.svg", url: "https://titans.global/" },
  { id: 4, name: "Third Eye", src: "/clients/thirdeye.svg", url: "https://3i.titans.global/" },
];

// Founders data
const founders = [
  {
    id: 1,
    name: "רועי יחזקאל",
    nameSvg: "/roei-name.svg",
    image: "/roy3d.jpg",
  },
  {
    id: 2,
    name: "אלעד ניסים",
    nameSvg: "/elad-name.svg",
    image: "/elad3d.jpg",
  },
];

// Single Logo Item Component
function LogoItem({ logo }: { logo: Logo }) {
  const handleClick = () => {
    if (logo.url) {
      window.open(logo.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      className="flex-shrink-0 w-28 h-28 mx-6 flex items-center justify-center cursor-pointer
                 opacity-60 hover:opacity-100 transition-all duration-300 hover:scale-125"
      onClick={handleClick}
    >
      <Image
        src={logo.src}
        alt={logo.name}
        width={80}
        height={80}
        className="object-contain max-h-16 w-auto"
        style={{ filter: "brightness(0) invert(1)" }}
        unoptimized
      />
    </div>
  );
}

// Infinite Scrolling Logo Bar Component
function LogoBar({
  logos,
  className,
  direction = "left",
}: {
  logos: Logo[];
  className?: string;
  direction?: "left" | "right";
}) {
  const animationClass = direction === "left" ? "animate-marquee-left" : "animate-marquee-right";

  return (
    <div className={`overflow-hidden ${className}`}>
      <div className={`flex ${animationClass} hover:[animation-play-state:paused]`}>
        {/* Duplicate logos for seamless infinite scroll */}
        {[...logos, ...logos].map((logo, i) => (
          <LogoItem key={`${logo.id}-${i}`} logo={logo} />
        ))}
      </div>
    </div>
  );
}

// Founder Photo Component
function FounderPhoto({
  founder,
  position,
  isVisible,
}: {
  founder: (typeof founders)[0];
  position: "top-left" | "bottom-right";
  isVisible: boolean;
}) {
  const positionStyles =
    position === "top-left"
      ? "top-0 left-[15%] lg:left-[25%]"
      : "top-0 right-[15%] lg:right-[25%]";

  const offsetY = position === "top-left" ? "calc(6rem - 95px)" : "4rem";

  return (
    <div
      className={`absolute ${positionStyles} z-20 transition-all duration-700`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? `translateY(${offsetY})` : `translateY(${position === "top-left" ? "-100px" : "100px"})`,
      }}
    >
      {/* Photo Container */}
      <div
        className="w-48 h-64 md:w-56 md:h-72 lg:w-64 lg:h-80 rounded-3xl overflow-hidden
                   shadow-2xl shadow-black/50 border-4 border-white/10"
      >
        <Image
          src={founder.image}
          alt={founder.name}
          width={256}
          height={320}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Name - Outside and below the photo */}
      <div className="flex justify-center mt-6">
        <Image
          src={founder.nameSvg}
          alt={founder.name}
          width={120}
          height={30}
          className="h-auto w-auto max-w-[100px] md:max-w-[120px]"
          style={{ filter: "brightness(0) invert(1)" }}
        />
      </div>
    </div>
  );
}

// Main Section Component
export default function FoundersSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);

  // Scroll-based visibility and progress
  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;

      const rect = sectionRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      const shouldBeVisible = rect.top < windowHeight * 0.7 && rect.bottom > windowHeight * 0.3;
      setIsVisible(shouldBeVisible);

      // Calculate scroll progress (0-1)
      const sectionHeight = rect.height;
      const scrolled = windowHeight - rect.top;
      const progress = Math.max(0, Math.min(1, scrolled / (sectionHeight + windowHeight * 0.5)));
      setScrollProgress(progress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section
      ref={sectionRef}
      id="about-us"
      className="relative min-h-screen py-20"
    >
      {/* 3D Colliding Spheres Background */}
      <CollidingSpheres scrollProgress={scrollProgress} />

      {/* Section Title */}
      <div
        className="relative z-10 flex justify-center mb-20 px-4 transition-all duration-700"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "translateY(0)" : "translateY(-30px)",
        }}
      >
        <Image
          src="/מי אנחנו%3F המקום להשוויץ.svg"
          alt="מי אנחנו? המקום להשוויץ"
          width={876}
          height={68}
          className="w-auto h-auto max-w-[90vw] md:max-w-[600px] lg:max-w-[876px]"
          style={{ filter: "brightness(0) invert(1)" }}
          unoptimized
        />
      </div>

      {/* Roey Section - Photo + Logo Bar */}
      <div className="relative z-10 mb-20 md:mb-24">
        {/* Roey's Photo - floating top-left */}
        <FounderPhoto
          founder={founders[0]}
          position="top-left"
          isVisible={isVisible}
        />

        {/* Logo Bar behind Roey - moves RIGHT - aligned with top of photo */}
        <div
          className="transition-all duration-700"
          style={{
            opacity: isVisible ? 1 : 0,
            transitionDelay: "200ms",
          }}
        >
          <LogoBar logos={logos} direction="right" />
        </div>
      </div>

      {/* Elad Section - Photo + Logo Bar */}
      <div className="relative z-10 mb-20 pb-10">
        {/* Elad's Photo - floating bottom-right */}
        <FounderPhoto
          founder={founders[1]}
          position="bottom-right"
          isVisible={isVisible}
        />

        {/* Logo Bar behind Elad - moves LEFT - aligned with bottom of photo */}
        <div
          className="pt-56 md:pt-64 lg:pt-72 transition-all duration-700"
          style={{
            opacity: isVisible ? 1 : 0,
            transitionDelay: "400ms",
          }}
        >
          <LogoBar logos={logos} direction="left" />
        </div>
      </div>
    </section>
  );
}
