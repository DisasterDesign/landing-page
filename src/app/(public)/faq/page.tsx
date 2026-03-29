"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ScrollReveal from "@/components/animations/ScrollReveal";
import { FAQ_ITEMS } from "@/lib/constants";

// Metadata must be in a separate file for client components, or we handle it via layout.
// We'll use a head-based approach via the parent layout's metadata template.

function FAQAccordionItem({
  question,
  answer,
  isOpen,
  onClick,
  index,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onClick: () => void;
  index: number;
}) {
  return (
    <ScrollReveal delay={index * 0.08}>
      <div className="border-b border-gray-800">
        <button
          onClick={onClick}
          className="w-full flex items-center justify-between py-6 text-right focus-visible:outline-2 focus-visible:outline-cyan focus-visible:outline-offset-2 rounded"
          aria-expanded={isOpen}
        >
          <span className="text-lg md:text-xl font-bold text-white pr-0 pl-4">
            {question}
          </span>
          <motion.span
            animate={{ rotate: isOpen ? 45 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-pink text-2xl font-bold flex-shrink-0"
          >
            +
          </motion.span>
        </button>

        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <p className="text-gray-400 pb-6 leading-relaxed">{answer}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ScrollReveal>
  );
}

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-black">
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold text-center mb-6">
              שאלות <span className="text-pink">נפוצות</span>
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-gray-400 text-lg md:text-xl text-center mb-16">
              ריכזנו עבורכם תשובות לשאלות הנפוצות ביותר
            </p>
          </ScrollReveal>

          <div>
            {FAQ_ITEMS.map((item, i) => (
              <FAQAccordionItem
                key={i}
                question={item.question}
                answer={item.answer}
                isOpen={openIndex === i}
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                index={i}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
