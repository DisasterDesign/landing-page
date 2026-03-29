"use client";

import { SERVICES } from "@/lib/constants";
import ScrollReveal from "@/components/animations/ScrollReveal";
import Card from "@/components/ui/Card";

const icons: Record<string, React.ReactNode> = {
  globe: (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#01FFFF" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  briefcase: (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#01FFFF" strokeWidth="1.5">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  ),
  "shopping-cart": (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#01FFFF" strokeWidth="1.5">
      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  ),
  cube: (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#01FFFF" strokeWidth="1.5">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
    </svg>
  ),
  rocket: (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#01FFFF" strokeWidth="1.5">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  ),
  settings: (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#01FFFF" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

export default function Services() {
  return (
    <section id="services" className="relative bg-black py-24 md:py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <ScrollReveal>
          <h2 className="chromatic-hover text-4xl md:text-5xl lg:text-6xl font-extrabold text-center mb-20" data-text="השירותים שלנו">
            השירותים שלנו
          </h2>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SERVICES.map((service, i) => (
            <ScrollReveal key={service.id} delay={i * 0.1}>
              <Card className="h-full" data-cursor="pointer">
                <div className="mb-4">{icons[service.icon]}</div>
                <h3 className="text-xl font-bold mb-3">{service.title}</h3>
                <p className="text-gray-400 leading-relaxed">{service.description}</p>
                <a
                  href={`/#contact?service=${service.id}`}
                  className="chromatic-hover inline-block mt-4 text-white text-sm font-bold transition-colors group"
                  data-text="לפרטים נוספים ←"
                >
                  לפרטים נוספים
                  <span className="inline-block mr-1 transition-transform group-hover:-translate-x-1">←</span>
                </a>
              </Card>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
