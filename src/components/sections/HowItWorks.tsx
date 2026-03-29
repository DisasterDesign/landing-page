"use client";

import { PROCESS_STEPS } from "@/lib/constants";
import ScrollReveal from "@/components/animations/ScrollReveal";

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="relative bg-black py-24 md:py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <ScrollReveal>
          <h2 className="chromatic-hover text-4xl md:text-5xl lg:text-6xl font-extrabold text-center mb-20" data-text="איך זה עובד?">
            איך זה עובד?
          </h2>
        </ScrollReveal>

        <div className="relative">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-0 bottom-0 right-1/2 w-[2px] bg-gradient-to-b from-pink via-cyan to-pink opacity-20" />

          <div className="space-y-16 md:space-y-24">
            {PROCESS_STEPS.map((step, index) => (
              <ScrollReveal
                key={step.number}
                delay={index * 0.1}
                direction={index % 2 === 0 ? "right" : "left"}
              >
                <div
                  className={`flex flex-col md:flex-row items-center gap-8 ${
                    index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                  }`}
                >
                  <div className="flex-1 text-center md:text-right">
                    <span className="text-5xl md:text-6xl font-extrabold text-white opacity-30">
                      {step.number}
                    </span>
                    <h3 className="chromatic-hover text-2xl md:text-3xl font-bold mt-2 mb-3" data-text={step.title}>
                      {step.title}
                    </h3>
                    <p className="text-gray-400 text-lg max-w-md mx-auto md:mx-0">
                      {step.description}
                    </p>
                  </div>

                  {/* Node */}
                  <div className="relative z-10 w-4 h-4 rounded-full bg-pink shadow-[0_0_20px_rgba(229,3,162,0.5)] hidden md:block" />

                  <div className="flex-1 hidden md:block" />
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
