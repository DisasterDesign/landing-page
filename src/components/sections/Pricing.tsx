"use client";

import { PRICING_TIERS, PRICING_ADDONS } from "@/lib/constants";
import ScrollReveal from "@/components/animations/ScrollReveal";
import Badge from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export default function Pricing() {
  return (
    <section id="pricing" className="relative bg-white py-24 md:py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <ScrollReveal>
          <h2 className="chromatic-hover chromatic-always text-[clamp(2rem,6vw,4.5rem)] font-extrabold text-center text-black w-full mb-20" data-text="מסלולי שירות">
            מסלולי שירות
          </h2>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-16">
          {PRICING_TIERS.map((tier, i) => (
            <ScrollReveal key={tier.id} delay={i * 0.1}>
              <div
                className={cn(
                  "relative bg-white border rounded-2xl p-5 md:p-8 transition-all duration-300 h-full flex flex-col",
                  tier.recommended
                    ? "border-pink shadow-[0_0_40px_rgba(229,3,162,0.18)] md:-translate-y-4"
                    : "border-gray-200 hover:border-gray-400 shadow-sm"
                )}
              >
                {tier.recommended && (
                  <div className="absolute -top-3 right-6">
                    <Badge variant="pink">מומלץ</Badge>
                  </div>
                )}

                <h3 className="text-2xl font-bold mb-2 text-black">{tier.name}</h3>
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-pink">
                    {tier.price}
                  </span>
                  <span className="text-gray-600">{tier.currency} / {tier.period}</span>
                </div>
                <p className="text-sm text-gray-600 mb-6 leading-relaxed">{tier.tagline}</p>

                <div className="space-y-6 mb-8 flex-1">
                  {tier.sections.map((section, s) => (
                    <div key={s}>
                      <h4 className="text-xs uppercase tracking-wider text-pink font-bold mb-3">
                        {section.title}
                      </h4>
                      <ul className="space-y-2.5">
                        {section.items.map((item, j) => (
                          <li key={j} className="flex items-start gap-3">
                            <span className="shrink-0 mt-0.5 text-cyan-dark">✓</span>
                            <span className="text-sm text-gray-700">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}

                  <div className="pt-4 border-t border-gray-200">
                    <h4 className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-2">
                      מתאים ל
                    </h4>
                    <p className="text-sm text-gray-600 leading-relaxed">{tier.suitableFor}</p>
                  </div>
                </div>

                <a
                  href="#contact"
                  className={cn(
                    "block text-center py-3 rounded-full font-bold transition-all duration-300",
                    tier.recommended
                      ? "bg-pink text-white hover:bg-pink-light hover:shadow-[0_0_30px_rgba(229,3,162,0.4)]"
                      : "border-2 border-black text-black hover:border-pink hover:text-pink hover:shadow-[0_0_20px_rgba(229,3,162,0.25)]"
                  )}
                  data-cursor="pointer"
                >
                  {tier.cta}
                </a>
              </div>
            </ScrollReveal>
          ))}
        </div>

        {/* Add-ons */}
        <ScrollReveal>
          <div className="text-center">
            <h3 className="chromatic-hover chromatic-always text-[clamp(1.5rem,4vw,3rem)] font-extrabold text-center text-black w-full mb-6" data-text="בתשלום נוסף">
              בתשלום נוסף
            </h3>
            <div className="flex flex-wrap justify-center gap-3">
              {PRICING_ADDONS.map((addon) => (
                <span
                  key={addon}
                  className="chromatic-hover px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:border-gray-500 transition-all duration-300"
                  data-text={addon}
                >
                  {addon}
                </span>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
