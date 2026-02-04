"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

export default function Contact() {
  const [formData, setFormData] = useState({ name: "", message: "" });
  const [rollProgress, setRollProgress] = useState(0); // 0 = off screen, 1 = in place
  const [animationComplete, setAnimationComplete] = useState(false);
  const [showShadow, setShowShadow] = useState(false);
  const [buttonHovered, setButtonHovered] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Scroll-based roll animation
  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;

      const rect = sectionRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // Start animation when section enters viewport from below
      const startTrigger = windowHeight; // Start when section top hits bottom of viewport
      const endTrigger = windowHeight * 0.4; // Complete when 40% down viewport

      if (rect.top <= startTrigger && rect.top >= endTrigger) {
        const progress = 1 - (rect.top - endTrigger) / (startTrigger - endTrigger);
        setRollProgress(Math.min(Math.max(progress, 0), 1));
        setAnimationComplete(false);
      } else if (rect.top < endTrigger) {
        setRollProgress(1);
        if (!animationComplete) {
          setTimeout(() => {
            setAnimationComplete(true);
            // Show shadow after animation complete with delay
            setTimeout(() => setShowShadow(true), 400);
          }, 100);
        }
      } else {
        // Section not yet in view - hide card
        setRollProgress(0);
        setAnimationComplete(false);
        setShowShadow(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [animationComplete]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const text = `שלום, פנייה חדשה מהאתר:
שם: ${formData.name}
הודעה: ${formData.message || "לא צוינה הודעה"}`;

    const whatsappUrl = `https://wa.me/972XXXXXXXXX?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, "_blank");
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  // Calculate roll animation values
  const rotateY = (1 - rollProgress) * 90; // 90deg to 0deg
  const translateX = (1 - rollProgress) * 100; // 100% to 0%
  const isRolling = rollProgress < 1;

  return (
    <section
      ref={sectionRef}
      id="contact"
      className="min-h-[70vh] relative overflow-hidden py-12 sm:py-16 md:py-20"
    >

      <div className="container mx-auto px-4 flex flex-col items-center justify-center min-h-[60vh] relative z-10">
        {/* SVG Title */}
        <div
          className={`mb-12 flex justify-center transition-all duration-700 ${
            animationComplete
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-8"
          }`}
        >
          <Image
            src="/צור קשר סקשן.svg"
            alt="צור קשר"
            width={231}
            height={50}
            className="h-auto"
            style={{ filter: "brightness(0) invert(1)" }}
          />
        </div>

        {/* Glass Card Container with roll animation */}
        <div
          className="w-full max-w-3xl p-4 sm:p-6 md:p-8 lg:p-12 relative"
          style={{
            backgroundColor: animationComplete ? "rgba(255, 255, 255, 0.03)" : "transparent",
            borderRadius: "24px",
            border: isRolling
              ? "2px solid rgba(255, 255, 255, 0.8)"
              : animationComplete
                ? "1px solid rgba(255, 255, 255, 0.15)"
                : "2px solid rgba(255, 255, 255, 0.8)",
            boxShadow: showShadow
              ? "0 0 60px rgba(255, 255, 255, 0.4), 0 0 120px rgba(255, 255, 255, 0.2), 0 8px 32px rgba(0, 0, 0, 0.15)"
              : "0 0 0 transparent",
            transform: `perspective(1000px) rotateY(${rotateY}deg) translateX(${translateX}%)`,
            transformOrigin: "right center",
            transition: animationComplete
              ? "border 0.5s ease-out 0.2s, box-shadow 0.8s ease-out 0.3s, background-color 0.3s ease-out"
              : "none",
            opacity: rollProgress > 0 ? 1 : 0,
          }}
        >
          {/* Contact Form */}
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="flex flex-col gap-6"
          >
            {/* Name Field */}
            <div
              className={`transition-all duration-500 ${
                animationComplete
                  ? "opacity-100 translate-y-0 rotate-0"
                  : "opacity-0 translate-y-4 rotate-[-2deg]"
              }`}
              style={{ transitionDelay: animationComplete ? "200ms" : "0ms" }}
            >
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-4 bg-transparent border-b-2 border-white/20 text-white text-right text-lg outline-none transition-all duration-300 focus:border-[#F37021] placeholder:text-white/40"
                placeholder="מה השם שלך?"
              />
            </div>

            {/* Message Field */}
            <div
              className={`transition-all duration-500 ${
                animationComplete
                  ? "opacity-100 translate-y-0 rotate-0"
                  : "opacity-0 translate-y-4 rotate-[2deg]"
              }`}
              style={{ transitionDelay: animationComplete ? "350ms" : "0ms" }}
            >
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                rows={5}
                className="w-full px-4 py-4 bg-transparent border-b-2 border-white/20 text-white text-right text-lg outline-none transition-all duration-300 focus:border-[#F37021] placeholder:text-white/40 resize-none"
                placeholder="ספר לנו הכל..."
              />
            </div>

            {/* Submit Button */}
            <div
              className={`transition-all duration-500 flex justify-center ${
                animationComplete
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: animationComplete ? "500ms" : "0ms" }}
            >
              <button
                type="submit"
                className="mt-4 px-8 py-3 rounded-full flex items-center justify-center transition-all duration-300"
                style={{
                  backgroundColor: buttonHovered ? "#ffffff" : "transparent",
                  border: "1px solid #ffffff",
                }}
                onMouseEnter={() => setButtonHovered(true)}
                onMouseLeave={() => setButtonHovered(false)}
              >
                <Image
                  src="/צור קשר.svg"
                  alt="צור קשר"
                  width={80}
                  height={16}
                  style={{
                    filter: buttonHovered ? "none" : "brightness(0) invert(1)",
                    transition: "filter 300ms",
                  }}
                />
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
