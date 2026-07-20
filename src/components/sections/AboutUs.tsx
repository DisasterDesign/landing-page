"use client";

import { motion } from "framer-motion";
import { useRef, useState, useEffect } from "react";

const values = [
  { number: "01", title: "חדשנות", description: "תמיד בחזית הטכנולוגיה והעיצוב, מביאים פתרונות מתקדמים לכל פרויקט" },
  { number: "02", title: "איכות", description: "ללא פשרות בכל פיקסל ושורת קוד, כי הפרטים הקטנים עושים את ההבדל" },
  { number: "03", title: "שקיפות", description: "תקשורת פתוחה ותהליך עבודה ברור מהיום הראשון ועד ההשקה" },
  { number: "04", title: "תוצאות", description: "מדידה, אופטימיזציה והשגת יעדים עסקיים אמיתיים ומוכחים" },
];

/**
 * Compact values section. Was a sticky-scroll that reserved ~1.5 viewports of
 * scroll runway — that runway read as a big empty band above/below the content
 * (Elad flagged it repeatedly). Now a normal-height section whose active value
 * auto-cycles every 2.5s while on screen: same "one lit at a time" feel, zero
 * dead scroll.
 */
function ValuesStepper() {
  const ref = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    const t = setInterval(() => setActiveIndex((i) => (i + 1) % values.length), 2500);
    return () => clearInterval(t);
  }, [inView]);

  return (
    <div ref={ref}>
      <h3
        className="chromatic-hover chromatic-always text-[clamp(2rem,6vw,4.5rem)] font-extrabold text-center text-black w-full mb-10 md:mb-14"
        data-text="הערכים שלנו"
      >
        הערכים שלנו
      </h3>
      <div className="max-w-6xl mx-auto w-full px-6">
        {/* Horizontal progress line + dots */}
        <div className="hidden md:flex items-center mb-12 px-4">
          {values.map((_, i) => (
            <div key={i} className="flex items-center" style={{ flex: 1 }}>
              <motion.div
                className="rounded-full shrink-0"
                animate={{
                  width: activeIndex === i ? 14 : 6,
                  height: activeIndex === i ? 14 : 6,
                  backgroundColor: activeIndex === i ? "#000" : "rgba(0,0,0,0.15)",
                  boxShadow: activeIndex === i ? "0 0 15px rgba(229,3,162,0.3), 0 0 30px rgba(1,255,255,0.15)" : "none",
                }}
                transition={{ duration: 0.4 }}
              />
              {i < values.length - 1 && (
                <motion.div
                  className="h-[1px] flex-1 mx-2"
                  animate={{
                    background: i < activeIndex
                      ? "linear-gradient(to right, #C80084, #00D0CE)"
                      : "rgba(0,0,0,0.1)",
                  }}
                  transition={{ duration: 0.4 }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Horizontal value cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-8">
          {values.map((value, i) => {
            const isActive = activeIndex === i;
            const isPast = i < activeIndex;

            return (
              <motion.div
                key={value.number}
                className="relative text-center md:text-right"
                animate={{
                  opacity: isActive ? 1 : isPast ? 0.45 : 0.3,
                  scale: isActive ? 1 : 0.97,
                }}
                transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <div className="relative inline-block">
                  {isActive && (
                    <>
                      <span className="absolute text-4xl sm:text-5xl md:text-6xl font-extrabold text-[#C80084] opacity-50" style={{ transform: "translate(-2px, 1px)" }} aria-hidden="true">{value.number}</span>
                      <span className="absolute text-4xl sm:text-5xl md:text-6xl font-extrabold text-[#00D0CE] opacity-50" style={{ transform: "translate(2px, -1px)" }} aria-hidden="true">{value.number}</span>
                    </>
                  )}
                  <span className={`relative text-4xl sm:text-5xl md:text-6xl font-extrabold ${isActive ? "text-black" : "text-black/20"} transition-colors duration-500`}>
                    {value.number}
                  </span>
                </div>

                <h4 className={`text-lg md:text-xl font-bold mt-3 mb-2 transition-colors duration-500 ${isActive ? "text-black" : "text-black/40"}`}>
                  {value.title}
                </h4>
                <p className={`text-[14px] leading-relaxed transition-opacity duration-500 ${isActive ? "text-gray-700" : "text-gray-400"}`}>
                  {value.description}
                </p>

                <motion.div
                  className="h-[2px] mt-4 rounded-full mx-auto md:mr-0 md:ml-auto"
                  animate={{
                    width: isActive ? "40px" : "0px",
                    background: isActive ? "linear-gradient(to right, #C80084, #00D0CE)" : "transparent",
                  }}
                  transition={{ duration: 0.5 }}
                />
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function AboutUs() {
  return (
    <section id="about" className="relative bg-white py-8 md:py-10 px-6">
      <div className="max-w-6xl mx-auto">
        <ValuesStepper />
      </div>
    </section>
  );
}
