"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import MagneticButton from "@/components/animations/MagneticButton";
import MobileMenu from "./MobileMenu";

export default function Navbar() {
  const [scrollDirection, setScrollDirection] = useState<"up" | "down">("up");
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const prevScroll = useRef(0);

  useEffect(() => {
    const scrollContainer = document.getElementById("smooth-content");
    if (!scrollContainer) return;

    const handleScroll = () => {
      const currentScroll = scrollContainer.scrollTop;
      setScrolled(currentScroll > 50);
      if (currentScroll > prevScroll.current && currentScroll > 80) {
        setScrollDirection("down");
      } else if (currentScroll < prevScroll.current) {
        setScrollDirection("up");
      }
      prevScroll.current = currentScroll;
    };

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <motion.header
        className={cn(
          "sticky top-0 left-0 right-0 z-50 transition-colors duration-300",
          scrolled ? "bg-black/90 backdrop-blur-md border-b border-gray-800/50" : "bg-transparent"
        )}
        animate={{
          y: scrollDirection === "down" && scrolled ? -100 : 0,
        }}
        transition={{ duration: 0.3 }}
      >
        <nav className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="relative z-10" data-cursor="pointer">
            <Image
              src="/logo-white.svg"
              alt="Fuzion Webz"
              width={160}
              height={40}
              priority
              className="h-10 w-auto"
            />
          </Link>

          <ul className="hidden lg:flex items-center gap-8">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="relative text-sm text-gray-300 hover:text-white transition-colors duration-300 group"
                  data-cursor="pointer"
                >
                  {item.label}
                  <span className="absolute -bottom-1 right-0 w-0 h-[2px] bg-gradient-to-r from-pink to-cyan transition-all duration-300 group-hover:w-full" />
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden lg:block">
            <MagneticButton>
              <Link
                href="/#contact"
                className="chromatic-hover border-2 border-white text-white px-6 py-2.5 rounded-full text-sm font-bold hover:border-gray-400 transition-all duration-300"
                data-text="בואו נדבר"
              >
                בואו נדבר
              </Link>
            </MagneticButton>
          </div>

          <button
            className="lg:hidden relative z-10 w-8 h-8 flex flex-col items-center justify-center gap-1.5"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "סגור תפריט" : "פתח תפריט"}
            data-cursor="pointer"
          >
            <motion.span
              className="block w-6 h-0.5 bg-white"
              animate={menuOpen ? { rotate: 45, y: 4 } : { rotate: 0, y: 0 }}
            />
            <motion.span
              className="block w-6 h-0.5 bg-white"
              animate={menuOpen ? { opacity: 0 } : { opacity: 1 }}
            />
            <motion.span
              className="block w-6 h-0.5 bg-white"
              animate={menuOpen ? { rotate: -45, y: -4 } : { rotate: 0, y: 0 }}
            />
          </button>
        </nav>
      </motion.header>

      <AnimatePresence>
        {menuOpen && <MobileMenu onClose={() => setMenuOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
