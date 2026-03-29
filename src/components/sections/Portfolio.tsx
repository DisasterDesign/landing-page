"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { PORTFOLIO_PROJECTS } from "@/lib/constants";
import ScrollReveal from "@/components/animations/ScrollReveal";

gsap.registerPlugin(ScrollTrigger);

export default function Portfolio() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const scrollEl = scrollRef.current;
    if (!container || !scrollEl) return;

    const totalScroll = scrollEl.scrollWidth - window.innerWidth;

    const ctx = gsap.context(() => {
      gsap.to(scrollEl, {
        x: -totalScroll,
        ease: "none",
        scrollTrigger: {
          trigger: container,
          start: "top top",
          end: () => `+=${totalScroll}`,
          scrub: 1,
          pin: true,
          anticipatePin: 1,
        },
      });
    }, container);

    return () => ctx.revert();
  }, []);

  return (
    <section id="portfolio" className="relative bg-black py-24 md:py-32">
      <div className="px-6 mb-16 max-w-7xl mx-auto">
        <ScrollReveal>
          <h2 className="chromatic-hover text-4xl md:text-5xl lg:text-6xl font-extrabold text-center" data-text="העבודות שלנו">
            העבודות שלנו
          </h2>
        </ScrollReveal>
      </div>

      <div ref={containerRef} className="overflow-hidden" data-cursor="drag">
        <div ref={scrollRef} className="flex gap-8 px-6 will-change-transform">
          {PORTFOLIO_PROJECTS.map((project) => (
            <div
              key={project.id}
              className="group shrink-0 w-[80vw] md:w-[60vw] lg:w-[40vw]"
            >
              <div className="relative aspect-[4/3] bg-gray-900 rounded-2xl overflow-hidden mb-4" data-cursor="view">
                {/* Placeholder gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-pink/20 to-cyan/20 group-hover:from-pink/30 group-hover:to-cyan/30 transition-all duration-500" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl font-extrabold text-white/20 group-hover:text-white/40 transition-all duration-500 group-hover:scale-105">
                    {project.title}
                  </span>
                </div>
              </div>
              <span className="text-xs text-white/60 font-bold uppercase tracking-wider">{project.category}</span>
              <h3 className="text-2xl font-bold mt-1">{project.title}</h3>
              <p className="text-gray-400 mt-1">{project.description}</p>
            </div>
          ))}

          {/* View all link */}
          <div className="shrink-0 w-[40vw] flex items-center justify-center">
            <a
              href="/portfolio"
              className="chromatic-hover text-2xl font-bold text-white transition-colors group"
              data-text="לכל העבודות ←"
              data-cursor="pointer"
            >
              לכל העבודות
              <span className="inline-block mr-2 transition-transform group-hover:-translate-x-2">←</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
