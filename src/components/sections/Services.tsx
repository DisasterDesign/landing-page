"use client";

import { useState } from "react";
import { SERVICES } from "@/lib/constants";
import { motion } from "framer-motion";
import { useInView } from "@/hooks/useInView";
import ScrollReveal from "@/components/animations/ScrollReveal";

const icons: Record<string, React.ReactNode> = {
  globe: (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  briefcase: (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  ),
  "shopping-cart": (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  ),
  cube: (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
    </svg>
  ),
  rocket: (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  ),
  settings: (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

function ServiceCard({ service, index }: { service: typeof SERVICES[0]; index: number }) {
  const { ref, isInView } = useInView({ threshold: 0.2 });
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ duration: 0.6, delay: index * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
      className="group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-cursor="pointer"
    >
      <div className="relative h-full">
        {/* Cyan layer — behind, offset */}
        <motion.div
          className="absolute inset-0 rounded-[18px] bg-[#00D0CE]"
          animate={{
            x: hovered ? 0 : 3,
            y: hovered ? 0 : -3,
            opacity: hovered ? 0 : 1,
          }}
          transition={{ duration: 0.4 }}
        />
        {/* Pink layer — behind, offset */}
        <motion.div
          className="absolute inset-0 rounded-[18px] bg-[#C80084]"
          animate={{
            x: hovered ? 0 : -3,
            y: hovered ? 0 : 3,
            opacity: hovered ? 0 : 1,
          }}
          transition={{ duration: 0.4 }}
        />
        {/* Main card */}
        <motion.div
          className="relative bg-black rounded-[18px] p-8 h-full flex flex-col transition-colors duration-400"
          animate={{
            borderColor: hovered ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0)",
            borderWidth: "1px",
          }}
          style={{ borderStyle: "solid" }}
        >
          {/* Default state — service info */}
          <motion.div
            className="flex flex-col flex-1"
            animate={{ opacity: hovered ? 0 : 1, y: hovered ? -10 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="mb-5 opacity-60">{icons[service.icon]}</div>
            <h3 className="text-xl font-bold mb-3">{service.title}</h3>
            <p className="text-gray-500 leading-relaxed text-[15px] flex-1">{service.description}</p>
          </motion.div>

          {/* Hover state — CTA */}
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center p-8"
            animate={{ opacity: hovered ? 1 : 0, y: hovered ? 0 : 10 }}
            transition={{ duration: 0.3 }}
          >
            <span className="text-2xl font-extrabold text-white mb-4">{service.title}</span>
            <span className="text-gray-400 text-sm">נו, אתר בקיצור!</span>
            <a
              href={`/#contact?service=${service.id}`}
              className="mt-6 inline-flex items-center gap-2 border border-white/20 text-white text-sm px-6 py-2.5 rounded-full hover:border-white/50 transition-all duration-300"
            >
              בואו נדבר
              <span className="text-pink">←</span>
            </a>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function Services() {
  return (
    <section id="services" className="relative bg-black py-24 md:py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <ScrollReveal>
          <h2 className="chromatic-hover text-4xl md:text-5xl lg:text-6xl font-extrabold text-center mb-20" data-text="השירותים שלנו">
            השירותים שלנו
          </h2>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {SERVICES.map((service, i) => (
            <ServiceCard key={service.id} service={service} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
