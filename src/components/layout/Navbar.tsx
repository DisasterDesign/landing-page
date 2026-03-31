"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MobileMenu from "./MobileMenu";

const SECTIONS = [
  { id: "hero", label: "ראשי", href: "#" },
  { id: "how-it-works", label: "תהליך", href: "#how-it-works" },
  { id: "about", label: "אודות", href: "#about" },
  { id: "services", label: "שירותים", href: "#services" },
  { id: "portfolio", label: "עבודות", href: "#portfolio" },
  { id: "pricing", label: "מחירים", href: "#pricing" },
  { id: "contact", label: "צור קשר", href: "#contact" },
];

export default function Navbar() {
  const [activeSection, setActiveSection] = useState("hero");
  const [loaded, setLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const scrollContainer = document.getElementById("smooth-content");
    if (!scrollContainer) return;

    const handleScroll = () => {
      const viewH = scrollContainer.clientHeight;
      let current = "hero";
      for (const section of SECTIONS) {
        const el = section.id === "hero"
          ? scrollContainer.querySelector("section")
          : document.getElementById(section.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          const containerRect = scrollContainer.getBoundingClientRect();
          const top = rect.top - containerRect.top;
          if (top < viewH * 0.5) current = section.id;
        }
      }
      setActiveSection(current);
    };

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, []);

  const handleClick = (href: string) => {
    setMenuOpen(false);
    const scrollContainer = document.getElementById("smooth-content");
    if (!scrollContainer) return;
    if (href === "#") {
      scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const target = document.querySelector(href);
    if (target) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const offset = targetRect.top - containerRect.top + scrollContainer.scrollTop;
      scrollContainer.scrollTo({ top: offset, behavior: "smooth" });
    }
  };

  return (
    <>
      {/* Desktop: vertical left sidebar */}
      <motion.nav
        className="hidden lg:flex flex-col items-end justify-center gap-7 absolute right-4 top-0 bottom-0 z-[20]"
        initial={{ x: 60, opacity: 0 }}
        animate={loaded ? { x: 0, opacity: 1 } : { x: 60, opacity: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {SECTIONS.map((section, i) => {
          const isActive = activeSection === section.id;
          return (
            <motion.button
              key={section.id}
              onClick={() => handleClick(section.href)}
              dir="ltr"
              className="group flex items-center w-full"
              initial={{ opacity: 0, x: 20 }}
              animate={loaded ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.8 + i * 0.07, duration: 0.4 }}
              data-cursor="pointer"
              aria-label={section.label}
            >
              {/* Label — left side (inner) */}
              <motion.span
                className="text-white whitespace-nowrap flex-1 text-right pr-3"
                animate={{ fontSize: isActive ? "22px" : "14px", opacity: isActive ? 1 : 0.25 }}
                whileHover={{ fontSize: "22px", opacity: 1 }}
                transition={{ duration: 0.25 }}
              >
                {section.label}
              </motion.span>
              {/* Dot — right side (outer, near edge), fixed position */}
              <div className="w-4 flex items-center justify-center shrink-0">
                <motion.span
                  className="block rounded-full bg-white"
                  animate={{ width: isActive ? 14 : 5, height: isActive ? 14 : 5 }}
                  whileHover={{ width: 14, height: 14 }}
                  transition={{ duration: 0.25 }}
                />
              </div>
            </motion.button>
          );
        })}
      </motion.nav>

      {/* Mobile hamburger — absolute in content container */}
      <button
        className="lg:hidden absolute top-5 left-16 z-[25] w-8 h-8 flex flex-col items-center justify-center gap-1.5"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label={menuOpen ? "סגור תפריט" : "פתח תפריט"}
        data-cursor="pointer"
      >
        <motion.span
          className="block w-6 h-[1px] bg-white"
          animate={menuOpen ? { rotate: 45, y: 3.5 } : { rotate: 0, y: 0 }}
        />
        <motion.span
          className="block w-4 h-[1px] bg-white ml-auto"
          animate={menuOpen ? { opacity: 0 } : { opacity: 1 }}
        />
        <motion.span
          className="block w-6 h-[1px] bg-white"
          animate={menuOpen ? { rotate: -45, y: -3.5 } : { rotate: 0, y: 0 }}
        />
      </button>

      {/* Mobile menu — covers entire content container */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="lg:hidden absolute inset-0 z-[25] bg-black flex flex-col items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <nav className="flex flex-col items-center gap-8">
              {SECTIONS.map((section, i) => (
                <motion.button
                  key={section.id}
                  onClick={() => handleClick(section.href)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  className="text-2xl font-anomalia text-white hover:opacity-60 transition-opacity"
                >
                  {section.label}
                </motion.button>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
