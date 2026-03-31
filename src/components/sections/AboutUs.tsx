"use client";

import { TEAM_MEMBERS } from "@/lib/constants";
import { motion, useScroll, useTransform } from "framer-motion";
import { useInView } from "@/hooks/useInView";
import { useRef, useState, useEffect } from "react";
import ScrollReveal from "@/components/animations/ScrollReveal";

function ChromaticCard({ member, index }: { member: typeof TEAM_MEMBERS[0]; index: number }) {
  const { ref, isInView } = useInView({ threshold: 0.2 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 60, scale: 0.95 }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ duration: 0.7, delay: index * 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      className="group"
    >
      <div className="relative">
        <div
          className="absolute inset-0 rounded-[18px] bg-[#00D0CE] transition-transform duration-500 group-hover:translate-x-[5px] group-hover:-translate-y-[5px]"
          style={{ transform: "translate(3px, -3px)" }}
        />
        <div
          className="absolute inset-0 rounded-[18px] bg-[#C80084] transition-transform duration-500 group-hover:-translate-x-[5px] group-hover:translate-y-[5px]"
          style={{ transform: "translate(-3px, 3px)" }}
        />
        <div className="relative bg-black rounded-[18px] border border-gray-800/50 p-8 md:p-10 transition-all duration-500 group-hover:border-gray-700/50">
          <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden mb-8 bg-gray-900">
            <div className="absolute inset-0 bg-gradient-to-br from-[#C80084]/20 via-transparent to-[#00D0CE]/20" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-7xl font-extrabold text-white/10 select-none">
                {member.nameHe.charAt(0)}
              </span>
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </div>
          <div className="relative mb-1">
            <span className="absolute text-[#C80084] text-2xl md:text-3xl font-extrabold" style={{ transform: "translate(-1px, 1px)" }} aria-hidden="true">{member.nameHe}</span>
            <span className="absolute text-[#00D0CE] text-2xl md:text-3xl font-extrabold" style={{ transform: "translate(1px, -1px)" }} aria-hidden="true">{member.nameHe}</span>
            <h3 className="relative text-2xl md:text-3xl font-extrabold text-white">{member.nameHe}</h3>
          </div>
          <p className="text-gray-500 text-sm font-bold mb-5 mt-2">{member.roleHe}</p>
          <p className="text-gray-400 leading-relaxed text-[15px]">{member.bio}</p>
        </div>
      </div>
    </motion.div>
  );
}

const values = [
  { number: "01", title: "חדשנות", description: "תמיד בחזית הטכנולוגיה והעיצוב, מביאים פתרונות מתקדמים לכל פרויקט" },
  { number: "02", title: "איכות", description: "ללא פשרות בכל פיקסל ושורת קוד, כי הפרטים הקטנים עושים את ההבדל" },
  { number: "03", title: "שקיפות", description: "תקשורת פתוחה ותהליך עבודה ברור מהיום הראשון ועד ההשקה" },
  { number: "04", title: "תוצאות", description: "מדידה, אופטימיזציה והשגת יעדים עסקיים אמיתיים ומוכחים" },
];

function ValuesStepper() {
  const outerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const scrollContainer = document.getElementById("smooth-content");
    if (!scrollContainer || !outerRef.current) return;

    const handleScroll = () => {
      if (!outerRef.current) return;
      const outerRect = outerRef.current.getBoundingClientRect();
      const scrollRect = scrollContainer.getBoundingClientRect();

      // How far the top of the outer container has scrolled past the viewport top
      const scrolledPast = scrollRect.top - outerRect.top;
      const totalScroll = outerRef.current.offsetHeight - scrollRect.height;

      if (totalScroll <= 0) return;
      const progress = Math.max(0, Math.min(1, scrolledPast / totalScroll));
      const newIndex = Math.min(values.length - 1, Math.floor(progress * values.length));
      setActiveIndex(newIndex);
    };

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    // Tall outer container — gives scroll runway for 4 steps
    <div ref={outerRef} style={{ minHeight: "250vh" }}>
    {/* Sticky inner — pins while scrolling through outer */}
    <div className="sticky top-0 h-screen flex flex-col items-center justify-center">
    <h3 className="chromatic-hover text-3xl md:text-4xl font-extrabold text-center mb-12" data-text="הערכים שלנו">
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
                backgroundColor: activeIndex === i ? "#fff" : "rgba(255,255,255,0.15)",
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
                    : "rgba(255,255,255,0.08)",
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
                opacity: isActive ? 1 : isPast ? 0.35 : 0.15,
                scale: isActive ? 1 : 0.95,
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
                <span className={`relative text-4xl sm:text-5xl md:text-6xl font-extrabold ${isActive ? "text-white" : "text-white/10"} transition-colors duration-500`}>
                  {value.number}
                </span>
              </div>

              <h4 className={`text-lg md:text-xl font-bold mt-3 mb-2 transition-colors duration-500 ${isActive ? "text-white" : "text-white/30"}`}>
                {value.title}
              </h4>
              <p className={`text-[14px] leading-relaxed transition-opacity duration-500 ${isActive ? "text-gray-400" : "text-gray-600"}`}>
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
    </div>
  );
}

export default function AboutUs() {
  return (
    <section id="about" className="relative bg-black py-24 md:py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <ScrollReveal>
          <h2 className="chromatic-hover text-4xl md:text-5xl lg:text-6xl font-extrabold text-center mb-20" data-text="מי אנחנו?">
            מי אנחנו?
          </h2>
        </ScrollReveal>

        {/* Team Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 mb-32">
          {TEAM_MEMBERS.map((member, i) => (
            <ChromaticCard key={member.email} member={member} index={i} />
          ))}
        </div>

        {/* Values Stepper — pinned section */}
        <ValuesStepper />
      </div>
    </section>
  );
}
