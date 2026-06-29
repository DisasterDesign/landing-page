"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  ormatSections,
  ormatPricing,
  ormatMeta,
  formatILS,
  type ProposalSection,
} from "@/config/ormat-proposal";
import VideoCarousel from "@/components/ormat/VideoCarousel";
import OrmatSignBlock from "@/components/ormat/OrmatSignBlock";

const OrmatScene = dynamic(() => import("@/components/ormat/OrmatScene"), { ssr: false });

const reveal = {
  initial: { opacity: 0, y: 26 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: "easeOut" },
} as const;

// Frosted-glass panel so dark text stays readable over the chrome scene.
const PANEL =
  "rounded-[2rem] bg-white/90 backdrop-blur-xl border border-black/[0.05] shadow-[0_30px_70px_-30px_rgba(15,23,42,0.25)]";

export default function OrmatProposalClient({ token }: { token: string }) {
  const progressRef = useRef(0);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
        progressRef.current = p;
        if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      className="relative min-h-screen text-gray-900 overflow-x-hidden"
      style={{
        background:
          "radial-gradient(1100px 700px at 82% -8%, rgba(229,3,162,0.07), transparent 60%)," +
          "radial-gradient(1000px 650px at 5% 108%, rgba(1,255,255,0.08), transparent 60%)," +
          "linear-gradient(180deg, #fbfbfd 0%, #f4f5f8 100%)",
      }}
    >
      {/* top scroll-progress rail */}
      <div className="fixed top-0 inset-x-0 h-[3px] z-50 bg-black/[0.06]">
        <div
          ref={barRef}
          className="h-full origin-right bg-gradient-to-l from-pink to-cyan-dark"
          style={{ transform: "scaleX(0)" }}
        />
      </div>

      {/* fixed 3D backdrop */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <OrmatScene progressRef={progressRef} />
      </div>

      {/* content */}
      <div className="relative z-10">
        {ormatSections.map((section) => (
          <Section key={section.id} section={section} token={token} />
        ))}

        <footer className="relative z-10 text-center text-xs text-gray-500 py-10 px-6">
          <div className="mx-auto w-24 h-[2px] mb-4 bg-gradient-to-r from-pink to-cyan-dark" />
          הצעה {ormatMeta.proposalNumber} · Fuzion Webz ·{" "}
          <a href="https://www.fuzionwebz.com" className="hover:text-pink">
            fuzionwebz.com
          </a>
        </footer>
      </div>
    </div>
  );
}

// Clauses render as a formal numbered list — no playful section tags.

function Heading({ section }: { section: ProposalSection }) {
  return (
    <div className="space-y-3">
      <div className="text-[11px] tracking-[0.35em] uppercase text-pink font-semibold">{section.kicker}</div>
      <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-[1.1] text-gray-900">
        {section.title}
      </h2>
      {section.lead && (
        <p className="text-base md:text-lg text-gray-600 leading-relaxed pt-1">{section.lead}</p>
      )}
    </div>
  );
}

function Section({ section, token }: { section: ProposalSection; token: string }) {
  const isHero = section.id === "hero";
  const maxW = isHero ? "max-w-3xl" : section.id === "showcase" ? "max-w-5xl" : "max-w-4xl";

  return (
    <section
      className={`relative px-6 md:px-10 flex flex-col justify-center ${
        isHero ? "min-h-screen" : "min-h-[92vh] py-24"
      }`}
    >
      <motion.div {...reveal} className={`w-full ${maxW} mx-auto`}>
        <div className={`${PANEL} ${isHero ? "p-10 md:p-14 text-center" : "p-7 md:p-12"}`}>
          {isHero ? <HeroBody section={section} /> : <Heading section={section} />}

          {section.points && !isHero && (
            <div className="mt-8 space-y-4">
              {section.points.map((p, i) => (
                <div key={i} className="flex gap-3 md:gap-4 text-gray-700 leading-relaxed">
                  <span className="shrink-0 font-bold text-pink tabular-nums pt-px">
                    {section.clauseNo}.{i + 1}
                  </span>
                  <p>{p}</p>
                </div>
              ))}
            </div>
          )}

          {section.id === "showcase" && (
            <div className="mt-10">
              <VideoCarousel />
            </div>
          )}

          {section.id === "milestones" && <Milestones />}
          {section.id === "price" && <PriceSummary />}

          {section.id === "sign" && (
            <div className="mt-10">
              <OrmatSignBlock token={token} firstPaymentLabel={`${formatILS(ormatPricing.firstPaymentGross)} ₪`} />
            </div>
          )}
        </div>
      </motion.div>
    </section>
  );
}

function HeroBody({ section }: { section: ProposalSection }) {
  return (
    <div className="text-center">
      <div className="text-xs tracking-[0.4em] uppercase text-[#0e7490] mb-6 font-semibold">{section.kicker}</div>
      <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.06] text-gray-900">
        {section.title}
      </h1>
      <div className="mt-4 text-sm text-gray-500">
        הצעה מס׳ {ormatMeta.proposalNumber} · {ormatMeta.date}
      </div>
      <p className="mt-7 text-base md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">{section.lead}</p>
      <div className="mt-11 flex flex-col items-center gap-3 text-gray-500">
        <span className="text-xs tracking-[0.3em] uppercase">גללו לעיון בהסכם</span>
        <svg className="w-5 h-5 animate-bounce text-pink" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    </div>
  );
}

function Milestones() {
  return (
    <div className="mt-8">
      <div className="text-[11px] text-gray-500 mb-3 text-left">מחירים לפני מע״מ · המחיר בהצעה המקורית מסומן בקו</div>
      <div className="space-y-3">
        {ormatPricing.stages.map((s) => {
          const cut = s.oldNet !== s.newNet;
          return (
            <div
              key={s.n}
              className="flex items-center gap-4 bg-white/80 border border-black/[0.06] rounded-2xl px-5 py-4 shadow-sm"
            >
              <div className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-br from-pink to-cyan-dark text-white font-extrabold flex items-center justify-center">
                {s.n}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm md:text-base text-gray-800">{s.title}</div>
                {s.nonRefundable && <div className="text-[11px] text-pink mt-0.5 font-medium">מקדמה · אינה מוחזרת</div>}
              </div>
              <div className="text-left shrink-0 flex items-baseline gap-2 tabular-nums">
                {cut && <span className="text-sm text-gray-400 line-through">{formatILS(s.oldNet)}</span>}
                <span className="font-bold text-gray-900">{formatILS(s.newNet)} ₪</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 px-5 pt-4 mt-1 border-t border-black/[0.06]">
        <div className="flex-1 text-sm md:text-base font-semibold text-gray-900">סך הכל לפני מע״מ</div>
        <div className="text-left shrink-0 flex items-baseline gap-2 tabular-nums">
          <span className="text-sm text-gray-400 line-through">{formatILS(ormatPricing.oldNetTotal)}</span>
          <span className="text-lg font-extrabold text-gray-900">{formatILS(ormatPricing.netTotal)} ₪</span>
        </div>
      </div>
    </div>
  );
}

function PriceSummary() {
  const p = ormatPricing;
  const vatAmount = p.grossTotal - p.netTotal;
  return (
    <div className="mt-10 max-w-xl">
      <div className="bg-white/85 border border-black/[0.06] rounded-3xl p-7 md:p-9 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-500 text-sm">סך הפרויקט (לפני מע״מ)</span>
          <span className="tabular-nums flex items-baseline gap-2">
            <span className="text-sm text-gray-400 line-through">{formatILS(p.oldNetTotal)} ₪</span>
            <span className="font-semibold text-gray-800">{formatILS(p.netTotal)} ₪</span>
          </span>
        </div>
        <Row label={`מע״מ ${p.vatRate}%`} value={`${formatILS(vatAmount)} ₪`} />
        <div className="h-px bg-black/10" />
        <Row label="סה״כ כולל מע״מ" value={`${formatILS(p.grossTotal)} ₪`} strong />
        <div className="mt-2 rounded-2xl bg-gradient-to-r from-pink/10 to-cyan/10 border border-black/[0.05] px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-700">תשלום ראשון · נגבה כעת</div>
            <div className="text-[11px] text-gray-500">שלב המודלינג · עם החתימה</div>
          </div>
          <div className="text-2xl md:text-3xl font-extrabold tabular-nums text-gray-900">
            {formatILS(p.firstPaymentGross)} <span className="text-base text-gray-500">₪</span>
          </div>
        </div>
        <p className="text-[11px] text-gray-500 pt-1">
          יתר השלבים נגבים בכל אבן דרך בנפרד. ניתן לעצור את העבודה לאחר כל שלב.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={strong ? "text-gray-900 font-semibold" : "text-gray-500 text-sm"}>{label}</span>
      <span className={`tabular-nums ${strong ? "text-xl font-extrabold text-gray-900" : "text-gray-800"}`}>{value}</span>
    </div>
  );
}
