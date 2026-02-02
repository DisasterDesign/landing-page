"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

export default function Contact() {
  const [formData, setFormData] = useState({ name: "", message: "" });
  const [isVisible, setIsVisible] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const sectionRef = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Intersection Observer for entrance animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  // Get form dimensions for SVG border
  useEffect(() => {
    if (formRef.current) {
      const updateDimensions = () => {
        if (formRef.current) {
          setDimensions({
            width: formRef.current.offsetWidth,
            height: formRef.current.offsetHeight,
          });
        }
      };
      updateDimensions();
      window.addEventListener("resize", updateDimensions);
      return () => window.removeEventListener("resize", updateDimensions);
    }
  }, [isVisible]);

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

  const perimeter = 2 * (dimensions.width + dimensions.height);

  return (
    <section
      ref={sectionRef}
      id="contact"
      className="min-h-[70vh] relative overflow-hidden py-20"
    >
      <div className="container mx-auto px-8 flex flex-col items-start justify-center min-h-[60vh] relative z-10">
        {/* Form */}
        <div className="w-full max-w-[500px] ml-4 md:ml-12 lg:ml-24">
          {/* SVG Title */}
          <div
            className={`mb-12 flex justify-center transition-all duration-700 ${
              isVisible
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

          {/* Contact Form with animated border */}
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="relative p-8 flex flex-col gap-6"
          >
            {/* Animated SVG Border */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ overflow: "visible" }}
            >
              <rect
                x="0.5"
                y="0.5"
                width={dimensions.width ? dimensions.width - 1 : "100%"}
                height={dimensions.height ? dimensions.height - 1 : "100%"}
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="1"
                style={{
                  strokeDasharray: perimeter || 1000,
                  strokeDashoffset: isVisible ? 0 : perimeter || 1000,
                  transition: "stroke-dashoffset 1.2s ease-out",
                }}
              />
            </svg>

            {/* Name Field */}
            <div
              className={`transition-all duration-500 ${
                isVisible
                  ? "opacity-100 translate-y-0 rotate-0"
                  : "opacity-0 translate-y-4 rotate-[-2deg]"
              }`}
              style={{ transitionDelay: "200ms" }}
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
                isVisible
                  ? "opacity-100 translate-y-0 rotate-0"
                  : "opacity-0 translate-y-4 rotate-[2deg]"
              }`}
              style={{ transitionDelay: "350ms" }}
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
              className={`transition-all duration-500 ${
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: "500ms" }}
            >
              <button
                type="submit"
                className="w-full mt-4 px-8 py-4 bg-[#F37021] text-white text-lg font-medium transition-all duration-300 hover:bg-[#1E1E1E] hover:shadow-[0_0_30px_rgba(243,112,33,0.3)] relative overflow-hidden group"
              >
                <span className="relative z-10">בואו נדבר</span>
                {/* Sweep effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
