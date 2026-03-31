"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { NAV_ITEMS, SOCIAL_LINKS } from "@/lib/constants";

interface MobileMenuProps {
  onClose: () => void;
}

export default function MobileMenu({ onClose }: MobileMenuProps) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <motion.div
      className="absolute inset-0 z-[30] bg-black flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <nav className="flex flex-col items-center gap-8">
        {NAV_ITEMS.map((item, i) => (
          <motion.div
            key={item.href}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
          >
            <Link
              href={item.href}
              onClick={onClose}
              className="text-3xl font-bold text-white hover:text-pink transition-colors"
            >
              {item.label}
            </Link>
          </motion.div>
        ))}
      </nav>

      <motion.div
        className="flex gap-6 mt-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {Object.entries(SOCIAL_LINKS).map(([name, url]) => (
          <a
            key={name}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-pink transition-colors text-sm capitalize"
          >
            {name}
          </a>
        ))}
      </motion.div>
    </motion.div>
  );
}
