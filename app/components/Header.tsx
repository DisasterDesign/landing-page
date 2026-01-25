"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function Header() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [showColor, setShowColor] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isOverDarkSection, setIsOverDarkSection] = useState(false);

  useEffect(() => {
    // Start fade in
    const loadTimer = setTimeout(() => {
      setIsLoaded(true);
    }, 200);

    // Transition to final color after fade in
    const colorTimer = setTimeout(() => {
      setShowColor(true);
    }, 1600);

    return () => {
      clearTimeout(loadTimer);
      clearTimeout(colorTimer);
    };
  }, []);

  // Check if header is over dark section (founders left panel)
  useEffect(() => {
    const handleScroll = () => {
      const foundersSection = document.getElementById("founders");
      if (!foundersSection) return;

      const rect = foundersSection.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // Check if founders section is in view (same logic as FoundersSection)
      const sectionTop = rect.top;
      const sectionBottom = rect.bottom;
      const isFoundersVisible = sectionTop < windowHeight * 0.5 && sectionBottom > windowHeight * 0.2;

      setIsOverDarkSection(isFoundersVisible);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const whatsappLink = "https://wa.me/972547136666";

  return (
    <header className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between px-8 py-6">
      {/* CTA Button */}
      <a
        href={whatsappLink}
        target="_blank"
        rel="noopener noreferrer"
        className="px-5 py-2 rounded-full flex items-center justify-center transition-all duration-300"
        style={{
          opacity: isLoaded ? 1 : 0,
          backgroundColor: isHovered ? "#1E1E1E" : "transparent",
          border: "1px solid #1E1E1E",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Image
          src="/צור קשר.svg"
          alt="צור קשר"
          width={54}
          height={11}
          style={{
            marginTop: 2,
            filter: isHovered ? "brightness(0) invert(1)" : "none",
            transition: "filter 300ms",
          }}
        />
      </a>

      {/* Logo */}
      <img
        src="/logo.svg"
        alt="Logo"
        className="h-10 w-auto transition-all duration-500"
        style={{
          opacity: isLoaded ? 1 : 0,
          filter: isOverDarkSection ? "brightness(0) invert(1)" : (showColor ? "none" : "brightness(0) invert(1)"),
        }}
      />
    </header>
  );
}
