"use client";

import { PRICING_TIERS, PRICING_ADDONS } from "@/lib/constants";
import ScrollReveal from "@/components/animations/ScrollReveal";
import Badge from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export default function Pricing() {
  return (
    <section id="pricing" className="relative bg-black py-24 md:py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <ScrollReveal>
          <h2 className="chromatic-hover text-4xl md:text-5xl lg:text-6xl font-extrabold text-center mb-20" data-text="מסלולי שירות">
            מסלולי שירות
          </h2>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-16">
          {PRICING_TIERS.map((tier, i) => (
            <ScrollReveal key={tier.id} delay={i * 0.1}>
              <div
                className={cn(
                  "relative bg-gray-900 border rounded-2xl p-5 md:p-8 transition-all duration-300 h-full flex flex-col",
                  tier.recommended
                    ? "border-pink shadow-[0_0_40px_rgba(229,3,162,0.2)] md:-translate-y-4"
                    : "border-gray-800 hover:border-gray-700"
                )}
              >
                {tier.recommended && (
                  <div className="absolute -top-3 right-6">
                    <Badge variant="pink">מומלץ</Badge>
                  </div>
                )}

                <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-pink">
                    {tier.price}
                  </span>
                  <span className="text-gray-400">{tier.currency}/{tier.period}</span>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {tier.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-3">
                      <span className={cn(
                        "shrink-0 mt-0.5",
                        feature.included ? "text-cyan" : "text-gray-600"
                      )}>
                        {feature.included ? "✓" : "✗"}
                      </span>
                      <span className={cn(
                        "text-sm",
                        feature.included ? "text-gray-300" : "text-gray-600 line-through"
                      )}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <a
                  href="#contact"
                  className={cn(
                    "block text-center py-3 rounded-full font-bold transition-all duration-300",
                    tier.recommended
                      ? "bg-pink text-white hover:bg-pink-light hover:shadow-[0_0_30px_rgba(229,3,162,0.4)]"
                      : "border-2 border-white text-white hover:border-cyan hover:text-cyan"
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
            <h3 className="chromatic-hover text-2xl font-bold mb-6" data-text="בתשלום נוסף">
              בתשלום נוסף
            </h3>
            <div className="flex flex-wrap justify-center gap-3">
              {PRICING_ADDONS.map((addon) => (
                <span
                  key={addon}
                  className="chromatic-hover px-4 py-2 bg-gray-900 border border-gray-800 rounded-full text-sm text-gray-300 hover:border-gray-600 transition-all duration-300"
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
