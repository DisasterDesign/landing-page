"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function Header() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    // Start fade in
    const loadTimer = setTimeout(() => {
      setIsLoaded(true);
    }, 200);

    return () => {
      clearTimeout(loadTimer);
    };
  }, []);

  const whatsappLink = "https://wa.me/972547136666";

  return (
    <header className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between px-8 py-6">
      {/* CTA Button */}
      <a
        href={whatsappLink}
        target="_blank"
        rel="noopener noreferrer"
        className="px-5 py-2 rounded-full flex items-center justify-center transition-all duration-500"
        style={{
          opacity: isLoaded ? 1 : 0,
          backgroundColor: isHovered ? "#ffffff" : "transparent",
          border: "1px solid #ffffff",
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
            // White text, black on hover
            filter: isHovered ? "none" : "brightness(0) invert(1)",
            transition: "filter 300ms",
          }}
        />
      </a>

      {/* Logo - white over dark sections, dark otherwise */}
      <img
        src="/logo.svg"
        alt="Logo"
        className="h-10 w-auto transition-all duration-500"
        style={{
          opacity: isLoaded ? 1 : 0,
          filter: "brightness(0) invert(1)",
        }}
      />
    </header>
  );
}
