"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";

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

// Founders data with bio info
const founders = [
  {
    id: 1,
    name: "רועי יחזקאל",
    nameSvg: "/roei-name.svg",
    image: "/roy3d.jpg",
    role: "מייסד שותף",
    bio: "מפתח Full Stack עם ניסיון רב בבניית מערכות ואתרים מורכבים. מתמחה בטכנולוגיות מתקדמות ופתרונות יצירתיים.",
  },
  {
    id: 2,
    name: "אלעד ניסים",
    nameSvg: "/elad-name.svg",
    image: "/elad3d.jpg",
    role: "מייסד שותף",
    bio: "מעצב ומפתח עם חזון ליצירת חוויות דיגיטליות ייחודיות. מתמחה בעיצוב UX/UI ופיתוח ממשקים אינטראקטיביים.",
  },
];

// Single Logo Item Component - NOT clickable
function LogoItem({ logo }: { logo: Logo }) {
  return (
    <div
      className="flex-shrink-0 w-28 h-28 mx-6 flex items-center justify-center
                 opacity-60 hover:opacity-100 transition-all duration-300 hover:scale-125"
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

// Founder Modal Component
function FounderModal({
  founder,
  onClose,
}: {
  founder: (typeof founders)[0];
  onClose: () => void;
}) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative z-10 w-full max-w-md p-4 sm:p-6 md:p-8 rounded-3xl"
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.05)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          boxShadow: "0 0 60px rgba(255, 255, 255, 0.2), 0 0 120px rgba(255, 255, 255, 0.1)",
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 w-8 h-8 flex items-center justify-center rounded-full
                     bg-white/10 hover:bg-white/20 transition-colors text-white text-xl"
        >
          ×
        </button>

        {/* Photo */}
        <div className="flex justify-center mb-6">
          <div className="w-32 h-40 rounded-2xl overflow-hidden border-2 border-white/20">
            <Image
              src={founder.image}
              alt={founder.name}
              width={128}
              height={160}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Name */}
        <div className="flex justify-center mb-2">
          <Image
            src={founder.nameSvg}
            alt={founder.name}
            width={150}
            height={40}
            className="h-auto"
            style={{ filter: "brightness(0) invert(1)" }}
          />
        </div>

        {/* Role */}
        <p className="text-center text-white/60 text-sm mb-4">{founder.role}</p>

        {/* Bio */}
        <p className="text-center text-white/80 text-base leading-relaxed" dir="rtl">
          {founder.bio}
        </p>
      </motion.div>
    </motion.div>
  );
}

// Founder Photo Component - Desktop
function FounderPhoto({
  founder,
  position,
  isVisible,
  onClick,
}: {
  founder: (typeof founders)[0];
  position: "top-left" | "bottom-right";
  isVisible: boolean;
  onClick: () => void;
}) {
  const positionStyles =
    position === "top-left"
      ? "top-0 left-[15%] lg:left-[25%]"
      : "top-0 right-[15%] lg:right-[25%]";

  const offsetY = position === "top-left" ? "calc(6rem - 95px)" : "4rem";

  return (
    <div
      className={`absolute ${positionStyles} z-20 transition-all duration-700 cursor-pointer group`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? `translateY(${offsetY})` : `translateY(${position === "top-left" ? "-100px" : "100px"})`,
      }}
      onClick={onClick}
    >
      {/* Photo Container */}
      <div
        className="w-48 h-64 md:w-56 md:h-72 lg:w-64 lg:h-80 rounded-3xl overflow-hidden
                   shadow-2xl shadow-black/50 border-4 border-white/10
                   group-hover:border-white/30 group-hover:scale-105 transition-all duration-300"
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

// Mobile Founder Card Component - Shows all info directly, no click needed
function MobileFounderCard({
  founder,
  isVisible,
  delay,
}: {
  founder: (typeof founders)[0];
  isVisible: boolean;
  delay: number;
}) {
  return (
    <div
      className="flex flex-col items-center text-center px-6 transition-all duration-700"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(50px)",
        transitionDelay: `${delay}ms`,
      }}
    >
      {/* Photo */}
      <div className="w-40 h-52 rounded-2xl overflow-hidden shadow-xl border-2 border-white/20">
        <Image
          src={founder.image}
          alt={founder.name}
          width={160}
          height={208}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Name */}
      <div className="mt-4">
        <Image
          src={founder.nameSvg}
          alt={founder.name}
          width={100}
          height={25}
          className="h-auto"
          style={{ filter: "brightness(0) invert(1)" }}
        />
      </div>

      {/* Role */}
      <p className="text-white/60 text-sm mt-1">{founder.role}</p>

      {/* Bio - Always visible */}
      <p className="text-white/80 text-base leading-relaxed mt-4 max-w-xs" dir="rtl">
        {founder.bio}
      </p>
    </div>
  );
}

// Main Section Component
export default function FoundersSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeFounder, setActiveFounder] = useState<number | null>(null);
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

  const selectedFounder = activeFounder ? founders.find(f => f.id === activeFounder) : null;

  return (
    <section
      ref={sectionRef}
      id="about-us"
      className="relative min-h-screen py-12 sm:py-16 md:py-20"
    >
      {/* 3D Colliding Spheres Background */}
      <CollidingSpheres scrollProgress={scrollProgress} />

      {/* Section Title */}
      <div
        className="relative z-10 flex justify-center mb-6 sm:mb-10 md:mb-20 px-4 transition-all duration-700"
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

      {/* Mobile Layout - Simple stacked, all info visible */}
      <div className="md:hidden relative z-10 flex flex-col items-center gap-8 sm:gap-12 px-4">
        {founders.map((founder, index) => (
          <MobileFounderCard
            key={founder.id}
            founder={founder}
            isVisible={isVisible}
            delay={index * 200}
          />
        ))}

        {/* Optional: Small logo carousel at bottom */}
        <div
          className="w-full mt-4 opacity-40 transition-all duration-700"
          style={{
            opacity: isVisible ? 0.4 : 0,
            transitionDelay: "600ms",
          }}
        >
          <LogoBar logos={logos} direction="left" />
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:block">
        {/* Roey Section - Photo + Logo Bar */}
        <div className="relative z-10 mb-20 md:mb-24">
          {/* Roey's Photo - floating top-left */}
          <FounderPhoto
            founder={founders[0]}
            position="top-left"
            isVisible={isVisible}
            onClick={() => setActiveFounder(founders[0].id)}
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
            onClick={() => setActiveFounder(founders[1].id)}
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
      </div>

      {/* Founder Modal */}
      <AnimatePresence>
        {selectedFounder && (
          <FounderModal
            founder={selectedFounder}
            onClose={() => setActiveFounder(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
