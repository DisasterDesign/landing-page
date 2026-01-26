"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

// Logo type
type Logo = {
  id: number;
  name: string;
  src: string;
  projectImage: string;
};

// Placeholder logo data with project images
const logos: Logo[] = [
  { id: 1, name: "Client 1", src: "/placeholder-logo.svg", projectImage: "/placeholder-project.jpg" },
  { id: 2, name: "Client 2", src: "/placeholder-logo.svg", projectImage: "/placeholder-project.jpg" },
  { id: 3, name: "Client 3", src: "/placeholder-logo.svg", projectImage: "/placeholder-project.jpg" },
  { id: 4, name: "Client 4", src: "/placeholder-logo.svg", projectImage: "/placeholder-project.jpg" },
  { id: 5, name: "Client 5", src: "/placeholder-logo.svg", projectImage: "/placeholder-project.jpg" },
  { id: 6, name: "Client 6", src: "/placeholder-logo.svg", projectImage: "/placeholder-project.jpg" },
  { id: 7, name: "Client 7", src: "/placeholder-logo.svg", projectImage: "/placeholder-project.jpg" },
  { id: 8, name: "Client 8", src: "/placeholder-logo.svg", projectImage: "/placeholder-project.jpg" },
];

// Founders data
const founders = [
  {
    id: 1,
    name: "רועי יחזקאל",
    nameSvg: "/roei-name.svg",
    image: "/roei-photo.jpeg",
  },
  {
    id: 2,
    name: "אלעד ניסים",
    nameSvg: "/elad-name.svg",
    image: "/elad-photo.jpg",
  },
];

// Single Logo Item Component
function LogoItem({
  logo,
  onHover,
}: {
  logo: Logo;
  onHover: (logo: Logo | null) => void;
}) {
  return (
    <div
      className="flex-shrink-0 w-24 h-24 mx-6 flex items-center justify-center cursor-pointer
                 grayscale hover:grayscale-0 opacity-40 hover:opacity-100 transition-all duration-300"
      onMouseEnter={() => onHover(logo)}
      onMouseLeave={() => onHover(null)}
    >
      {/* Placeholder - white box with logo name */}
      <div className="w-20 h-20 bg-white/10 rounded-lg flex items-center justify-center border border-white/20">
        <span className="text-white/60 text-xs font-medium">{logo.name}</span>
      </div>
    </div>
  );
}

// Infinite Scrolling Logo Bar Component
function LogoBar({
  logos,
  className,
  direction = "left",
  onLogoHover,
}: {
  logos: Logo[];
  className?: string;
  direction?: "left" | "right";
  onLogoHover: (logo: Logo | null) => void;
}) {
  const animationClass = direction === "left" ? "animate-marquee-left" : "animate-marquee-right";

  return (
    <div className={`overflow-hidden ${className}`}>
      <div className={`flex ${animationClass} hover:[animation-play-state:paused]`}>
        {/* Duplicate logos for seamless infinite scroll */}
        {[...logos, ...logos].map((logo, i) => (
          <LogoItem key={`${logo.id}-${i}`} logo={logo} onHover={onLogoHover} />
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
  const [hoveredLogo, setHoveredLogo] = useState<Logo | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  // Scroll-based visibility
  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;

      const rect = sectionRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      const shouldBeVisible = rect.top < windowHeight * 0.7 && rect.bottom > windowHeight * 0.3;
      setIsVisible(shouldBeVisible);
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
      style={{ backgroundColor: "#080520" }}
    >
      {/* Section Title */}
      <div
        className="flex justify-center mb-20 px-4 transition-all duration-700"
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
      <div className="relative mb-20 md:mb-24">
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
          <LogoBar logos={logos} direction="right" onLogoHover={setHoveredLogo} />
        </div>
      </div>

      {/* Elad Section - Photo + Logo Bar */}
      <div className="relative mb-20 pb-10">
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
          <LogoBar logos={logos} direction="left" onLogoHover={setHoveredLogo} />
        </div>
      </div>

      {/* Project Image Overlay on Logo Hover */}
      {hoveredLogo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="max-w-5xl max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl">
            {/* Placeholder project image */}
            <div className="w-[80vw] max-w-[1000px] h-[50vh] max-h-[600px] bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
              <div className="text-center">
                <p className="text-white/40 text-lg mb-2">Project Preview</p>
                <p className="text-white text-2xl font-bold">{hoveredLogo.name}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
