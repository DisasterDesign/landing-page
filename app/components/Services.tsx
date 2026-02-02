"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

const services = [
  { svg: "/אתר אינטרנט.svg", alt: "אתר אינטרנט" },
  { svg: "/אתר לעסק.svg", alt: "אתר לעסק" },
  { svg: "/אתר מכירות.svg", alt: "אתר מכירות" },
  { svg: "/אתר תלת מימדי.svg", alt: "אתר תלת מימדי" },
  { svg: "/דף נחיתה.svg", alt: "דף נחיתה" },
  { svg: "/website.svg", alt: "Website" },
];

const glassStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  border: "1px solid rgba(255,255,255,0.2)",
  boxShadow: `
    0 0 30px rgba(255, 255, 255, 0.2),
    0 0 60px rgba(255, 255, 255, 0.1),
    0 8px 24px rgba(0, 0, 0, 0.15)
  `,
};

export default function Services() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  const scrollToContact = () => {
    const contactSection = document.getElementById("contact");
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Scroll-based visibility
  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      setIsVisible(rect.top < windowHeight * 0.75);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section
      ref={sectionRef}
      id="services"
      className="min-h-[70vh] relative overflow-hidden py-20"
    >
      {/* Section Title */}
      <div
        className="flex justify-center mb-32 px-4 transition-all duration-700"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "translateY(0)" : "translateY(-30px)",
        }}
      >
        <Image
          src="/השירותים -בניית אתרים יעני.svg"
          alt="השירותים - בניית אתרים יעני"
          width={800}
          height={100}
          className="w-auto h-auto max-w-[95vw] md:max-w-[700px] lg:max-w-[900px]"
          style={{ filter: "brightness(0) invert(1)" }}
          unoptimized
        />
      </div>

      {/* Services Container */}
      <div
        className="w-full px-4 md:px-8 lg:px-16 flex flex-col items-center justify-center gap-6 md:gap-8"
        style={{ perspective: "1000px" }}
      >
        {/* First row - 3 cards */}
        <div className="flex flex-wrap justify-center gap-6 md:gap-8 w-full max-w-6xl">
          {services.slice(0, 3).map((service, i) => (
            <div
              key={i}
              className="relative cursor-pointer flex-1 min-w-[280px] max-w-[380px]"
              style={{
                height: "clamp(160px, 22vw, 220px)",
                transformStyle: "preserve-3d",
                transition: "transform 0.6s ease-out, opacity 0.6s ease-out",
                transform: hoveredIndex === i ? "rotateX(180deg)" : "rotateX(0deg)",
                opacity: isVisible ? 1 : 0,
                transitionDelay: isVisible ? `${i * 100}ms` : "0ms",
              }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={scrollToContact}
            >
              {/* Front side - service SVG */}
              <div
                className="absolute inset-0 rounded-2xl flex items-center justify-center"
                style={{
                  ...glassStyle,
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  padding: "2rem",
                }}
              >
                <Image
                  src={service.svg}
                  alt={service.alt}
                  width={300}
                  height={80}
                  className="w-auto h-auto max-w-[45%] max-h-[30%]"
                  style={{ filter: "brightness(0) invert(1)" }}
                  unoptimized
                />
              </div>

              {/* Back side - punchline SVG */}
              <div
                className="absolute inset-0 rounded-2xl flex items-center justify-center"
                style={{
                  ...glassStyle,
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  transform: "rotateX(180deg)",
                  padding: "2rem",
                  background: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)",
                  border: "1px solid rgba(255,255,255,0.25)",
                }}
              >
                <Image
                  src="/בקיצור אתר נו.svg"
                  alt="בקיצור אתר נו"
                  width={300}
                  height={80}
                  className="w-auto h-auto max-w-[70%] max-h-[55%]"
                  style={{ filter: "brightness(0) invert(1)" }}
                  unoptimized
                />
              </div>
            </div>
          ))}
        </div>

        {/* Second row - 3 cards */}
        <div className="flex flex-wrap justify-center gap-6 md:gap-8 w-full max-w-6xl">
          {services.slice(3).map((service, i) => (
            <div
              key={i + 3}
              className="relative cursor-pointer flex-1 min-w-[280px] max-w-[380px]"
              style={{
                height: "clamp(160px, 22vw, 220px)",
                transformStyle: "preserve-3d",
                transition: "transform 0.6s ease-out, opacity 0.6s ease-out",
                transform: hoveredIndex === i + 3 ? "rotateX(180deg)" : "rotateX(0deg)",
                opacity: isVisible ? 1 : 0,
                transitionDelay: isVisible ? `${(i + 3) * 100}ms` : "0ms",
              }}
              onMouseEnter={() => setHoveredIndex(i + 3)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={scrollToContact}
            >
              {/* Front side - service SVG */}
              <div
                className="absolute inset-0 rounded-2xl flex items-center justify-center"
                style={{
                  ...glassStyle,
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  padding: "2rem",
                }}
              >
                <Image
                  src={service.svg}
                  alt={service.alt}
                  width={300}
                  height={80}
                  className="w-auto h-auto max-w-[45%] max-h-[30%]"
                  style={{ filter: "brightness(0) invert(1)" }}
                  unoptimized
                />
              </div>

              {/* Back side - punchline SVG */}
              <div
                className="absolute inset-0 rounded-2xl flex items-center justify-center"
                style={{
                  ...glassStyle,
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  transform: "rotateX(180deg)",
                  padding: "2rem",
                  background: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)",
                  border: "1px solid rgba(255,255,255,0.25)",
                }}
              >
                <Image
                  src="/בקיצור אתר נו.svg"
                  alt="בקיצור אתר נו"
                  width={300}
                  height={80}
                  className="w-auto h-auto max-w-[70%] max-h-[55%]"
                  style={{ filter: "brightness(0) invert(1)" }}
                  unoptimized
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
