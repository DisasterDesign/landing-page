"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

// Logo data with project info
const logos = [
  { name: "Adidas", project: "מיתוג דיגיטלי", desc: "עיצוב קמפיין שיווקי גלובלי" },
  { name: "Nike", project: "אתר מסחר", desc: "פלטפורמת e-commerce מתקדמת" },
  { name: "Apple", project: "אפליקציה", desc: "פיתוח אפליקציית iOS" },
  { name: "Google", project: "מערכת ניהול", desc: "דשבורד אנליטיקס" },
  { name: "Meta", project: "קמפיין סושיאל", desc: "אסטרטגיית תוכן" },
  { name: "Netflix", project: "לנדינג פייג'", desc: "עמוד נחיתה ממיר" },
  { name: "Spotify", project: "עיצוב UI", desc: "ממשק משתמש חדשני" },
  { name: "Amazon", project: "אוטומציה", desc: "מערכת שיווק אוטומטית" },
  { name: "Tesla", project: "3D קונפיגורטור", desc: "חוויה אינטראקטיבית" },
  { name: "Microsoft", project: "פורטל ארגוני", desc: "מערכת פנים-ארגונית" },
  { name: "Samsung", project: "אתר תדמית", desc: "עיצוב ופיתוח מותאם" },
  { name: "Sony", project: "חנות וירטואלית", desc: "חוויית קנייה מתקדמת" },
];

// Founders data
const founders = [
  {
    id: 1,
    name: "רועי יחזקאל",
    role: "אסטרטגיה ושיווק",
    image: "/roei-photo.jpeg",
    text: `רועי יחזקאל הוא מומחה אסטרטגיה ושיווק דיגיטלי עם ניסיון של למעלה מעשור בתעשייה. הוא מאמין שכל מותג מחזיק בתוכו סיפור ייחודי שמחכה להיות מסופר בצורה הנכונה.

במהלך הקריירה שלו, רועי הוביל קמפיינים פורצי דרך עבור מותגים מובילים בישראל ובעולם. הגישה שלו משלבת חשיבה אסטרטגית עם הבנה עמוקה של התנהגות צרכנים.

התמחותו העיקרית היא ביצירת אסטרטגיות שיווק מבוססות נתונים, תוך שמירה על קריאייטיביות ומקוריות.`,
  },
  {
    id: 2,
    name: "אלעד ניסים",
    role: "פיתוח וטכנולוגיה",
    image: "/elad-photo.jpg",
    text: `אלעד ניסים הוא מפתח Full-Stack וארכיטקט תוכנה עם רקע עשיר בפיתוח מערכות מורכבות. הוא שואף תמיד לדחוף את הגבולות של מה שאפשרי בטכנולוגיה.

עם התמחות בטכנולוגיות חזית מודרניות כמו React, Next.js ו-Three.js, אלעד יוצר חוויות דיגיטליות שמשלבות ביצועים יוצאי דופן עם עיצוב מרהיב.

הפילוסופיה שלו פשוטה: קוד נקי, ארכיטקטורה חכמה, וחוויית משתמש שעומדת במרכז.`,
  },
];

// Logo Box Component
function LogoBox({
  logo,
  onHover,
  isAnyHovered,
}: {
  logo: typeof logos[0];
  onHover: (logo: typeof logos[0] | null) => void;
  isAnyHovered: boolean;
}) {
  return (
    <div
      className="flex-shrink-0 w-40 h-20 mx-8 flex items-center justify-center bg-[#1E1E1E]/5 cursor-pointer transition-all duration-300"
      style={{
        opacity: isAnyHovered ? 0.1 : 0.3,
      }}
      onMouseEnter={() => onHover(logo)}
      onMouseLeave={() => onHover(null)}
    >
      <span className="text-[#1E1E1E]/60 font-medium text-sm">{logo.name}</span>
    </div>
  );
}

// Marquee Component
function Marquee({
  direction,
  isPaused,
  onLogoHover,
  isAnyHovered,
}: {
  direction: "left" | "right";
  isPaused: boolean;
  onLogoHover: (logo: typeof logos[0] | null) => void;
  isAnyHovered: boolean;
}) {
  const animationClass = direction === "left" ? "animate-marquee-left" : "animate-marquee-right";

  return (
    <div className="overflow-hidden flex items-center h-24">
      <div
        className={`flex ${animationClass}`}
        style={{
          animationPlayState: isPaused ? "paused" : "running",
          willChange: "transform",
        }}
      >
        {[...logos, ...logos].map((logo, i) => (
          <LogoBox
            key={`${logo.name}-${i}`}
            logo={logo}
            onHover={onLogoHover}
            isAnyHovered={isAnyHovered}
          />
        ))}
      </div>
    </div>
  );
}

// Founder Image Component
function FounderImage({
  founder,
  isSelected,
  onClick,
  isVisible,
  delay,
}: {
  founder: typeof founders[0];
  isSelected: boolean;
  onClick: () => void;
  isVisible: boolean;
  delay: number;
}) {
  return (
    <div
      className="cursor-pointer transition-all duration-500"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(50px)",
        transitionDelay: `${delay}ms`,
      }}
      onClick={onClick}
    >
      <div
        className={`w-[280px] h-[400px] lg:w-[400px] lg:h-[560px] overflow-hidden transition-all duration-300 ${
          isSelected ? "scale-105" : "scale-100 hover:scale-102"
        }`}
        style={{
          border: isSelected ? "3px solid #F37021" : "3px solid transparent",
        }}
      >
        <Image
          src={founder.image}
          alt={founder.name}
          width={400}
          height={560}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex justify-start mt-4">
        <Image
          src={founder.id === 1 ? "/roei-name.svg" : "/elad-name.svg"}
          alt={founder.name}
          width={120}
          height={30}
          className="h-auto w-auto max-w-[120px]"
          style={{
            filter: isSelected ? "none" : "grayscale(100%) opacity(0.5)",
            transition: "filter 300ms",
          }}
        />
      </div>
    </div>
  );
}

// Main Section Component
export default function FoundersSection() {
  const [selectedFounder, setSelectedFounder] = useState(founders[0]);
  const [hoveredLogo, setHoveredLogo] = useState<typeof logos[0] | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const isVisibleRef = useRef(false);
  const sectionRef = useRef<HTMLElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const isPaused = hoveredLogo !== null;

  // Mouse parallax for left panel
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!leftPanelRef.current) return;
      const rect = leftPanelRef.current.getBoundingClientRect();
      // Check if mouse is over the left panel
      if (e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top && e.clientY <= rect.bottom) {
        const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
        setMousePos({ x, y });
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Scroll-based visibility for entrance/exit animation
  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;

      const rect = sectionRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // Calculate how much of the section is in view
      const sectionTop = rect.top;
      const sectionBottom = rect.bottom;

      // Enter: when top of section reaches middle of screen
      // Exit: when section is mostly out of view (top below 80% of screen OR bottom above 20% of screen)
      const shouldBeVisible = sectionTop < windowHeight * 0.5 && sectionBottom > windowHeight * 0.2;

      if (shouldBeVisible && !isVisibleRef.current) {
        isVisibleRef.current = true;
        setIsVisible(true);
      } else if (!shouldBeVisible && isVisibleRef.current) {
        isVisibleRef.current = false;
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Check initial state

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section
      ref={sectionRef}
      id="founders"
      className="relative overflow-hidden"
      style={{ backgroundColor: "#FDF4EB", minHeight: "120vh" }}
    >
      {/* Left Side - Text Box spanning full section height (absolute positioned) */}
      <div
        ref={leftPanelRef}
        className="hidden lg:block absolute top-0 bottom-0 left-0 w-[22%] z-10"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 1.5s cubic-bezier(0.16, 1, 0.3, 1) 1s, opacity 1s ease-out 1s",
        }}
      >
        <div
          className="h-full flex flex-col p-8 lg:py-20 lg:pl-[max(2rem,calc(28vw-320px))] lg:pr-8 relative overflow-hidden"
          dir="rtl"
        >
          {/* Background Images with Parallax */}
          {/* Bottom layer - 2bar.png */}
          <Image
            src="/2bar.webp"
            alt=""
            fill
            className="object-cover transition-transform duration-200 ease-out"
            style={{
              transform: `translate(${mousePos.x * 10}px, ${mousePos.y * 10}px) scale(1.1)`,
            }}
          />
          {/* Middle layer - 1bar.png */}
          <Image
            src="/1bar.webp"
            alt=""
            fill
            className="object-cover transition-transform duration-200 ease-out"
            style={{
              transform: `translate(${mousePos.x * 20}px, ${mousePos.y * 20}px) scale(1.15)`,
            }}
          />
          {/* Top layer - 0bar.png with 45% opacity */}
          <Image
            src="/0bar.webp"
            alt=""
            fill
            className="object-cover transition-transform duration-200 ease-out"
            style={{
              transform: `translate(${mousePos.x * 30}px, ${mousePos.y * 30}px) scale(1.2)`,
              opacity: 0.85,
            }}
          />
          {/* Founder Info - animated on change */}
          <div
            key={selectedFounder.id}
            className="animate-fade-in max-w-[500px] ml-auto relative z-10 mt-40"
          >
            {/* Name SVG */}
            <div className="flex justify-end mb-8">
              <Image
                src={selectedFounder.id === 1 ? "/roei-name.svg" : "/elad-name.svg"}
                alt={selectedFounder.name}
                width={200}
                height={50}
                className="h-auto w-auto max-w-[200px]"
                style={{ filter: "brightness(0) invert(1)" }}
              />
            </div>

            <p className="text-white/80 leading-relaxed text-right whitespace-pre-line text-lg">
              {selectedFounder.text}
            </p>
          </div>

          {/* Indicator dots */}
          <div className="flex justify-end gap-3 mt-12 max-w-[500px] ml-auto relative z-10">
            {founders.map((founder) => (
              <button
                key={founder.id}
                onClick={() => setSelectedFounder(founder)}
                className={`w-3 h-3 transition-all duration-300 ${
                  selectedFounder.id === founder.id
                    ? "bg-white scale-125"
                    : "bg-white/40 hover:bg-white/60"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Main Content - pushed to the right on desktop */}
      <div className="lg:mr-0 lg:ml-[22%] bg-white" dir="rtl">
        {/* Section Title */}
        <div
          className="px-8 pt-20 mb-16 transition-all duration-700 flex justify-center"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(-30px)",
          }}
        >
          <Image
            src="/who-we-are-title.svg"
            alt="מי אנחנו? המקום להשוויץ"
            width={876}
            height={68}
            className="w-auto h-auto max-w-full"
            unoptimized
          />
        </div>

        {/* Founder Images */}
        <div className="flex justify-center items-center gap-6 lg:gap-8 px-8 py-16">
          {founders.map((founder, index) => (
            <FounderImage
              key={founder.id}
              founder={founder}
              isSelected={selectedFounder.id === founder.id}
              onClick={() => setSelectedFounder(founder)}
              isVisible={isVisible}
              delay={300 + index * 150}
            />
          ))}
        </div>
      </div>

      {/* Marquee Section - Full width with slightly darker background */}
      <div
        className="pb-20 transition-all duration-700"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "translateY(0)" : "translateY(30px)",
          transitionDelay: "600ms",
          backgroundColor: "#F5EDE4",
        }}
      >
        <p className="text-center text-[#1E1E1E]/40 mb-8 text-sm pt-8" dir="rtl">
          לקוחות שעבדנו איתם
        </p>
        <Marquee
          direction="left"
          isPaused={isPaused}
          onLogoHover={setHoveredLogo}
          isAnyHovered={isPaused}
        />
      </div>

      {/* Mobile Text Box - shown below images on mobile */}
      <div
        className="lg:hidden px-8 pb-20 transition-all duration-700"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "translateY(0)" : "translateY(30px)",
          transitionDelay: "400ms",
        }}
        dir="rtl"
      >
        <div className="bg-white p-8">
          <div key={selectedFounder.id} className="animate-fade-in">
            <h3 className="text-2xl font-bold text-[#1E1E1E] mb-2">
              {selectedFounder.name}
            </h3>
            <p className="text-lg text-[#F37021] mb-6">
              {selectedFounder.role}
            </p>
            <p className="text-[#1E1E1E]/70 leading-relaxed whitespace-pre-line">
              {selectedFounder.text}
            </p>
          </div>
          <div className="flex justify-center gap-3 mt-8">
            {founders.map((founder) => (
              <button
                key={founder.id}
                onClick={() => setSelectedFounder(founder)}
                className={`w-3 h-3 transition-all duration-300 ${
                  selectedFounder.id === founder.id
                    ? "bg-[#F37021] scale-125"
                    : "bg-[#1E1E1E]/20 hover:bg-[#1E1E1E]/40"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Expanded Logo Modal */}
      {hoveredLogo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          style={{
            backdropFilter: "blur(8px)",
            backgroundColor: "rgba(0, 0, 0, 0.3)",
          }}
        >
          <div
            className="w-[90vw] max-w-[500px] h-[400px] bg-white p-8 pointer-events-auto transform transition-all duration-300 scale-100"
            onMouseLeave={() => setHoveredLogo(null)}
          >
            <div className="w-full h-[200px] bg-gradient-to-br from-[#1E1E1E]/10 to-[#1E1E1E]/5 mb-6 flex items-center justify-center">
              <span className="text-4xl font-bold text-[#1E1E1E]/20">
                {hoveredLogo.name}
              </span>
            </div>

            <h4 className="text-2xl font-bold text-[#1E1E1E] mb-2 text-right">
              {hoveredLogo.project}
            </h4>
            <p className="text-[#1E1E1E]/60 text-right">{hoveredLogo.desc}</p>
            <p className="text-sm text-[#F37021] mt-4 text-right">
              לקוח: {hoveredLogo.name}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
