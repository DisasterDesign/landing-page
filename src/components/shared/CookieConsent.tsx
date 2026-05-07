"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Button from "@/components/ui/Button";

export default function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      const timer = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookie-consent", JSON.stringify({ essential: true, analytics: true, marketing: true }));
    setShow(false);
  };

  const handleDecline = () => {
    localStorage.setItem("cookie-consent", JSON.stringify({ essential: true, analytics: false, marketing: false }));
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed bottom-0 left-0 right-0 z-[90] bg-white border-t border-gray-200 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] p-6"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-700 text-sm text-center md:text-right">
              אנחנו משתמשים בעוגיות כדי לשפר את חוויית הגלישה שלך. ניתן לבחור אילו עוגיות לאשר.
            </p>
            <div className="flex gap-3 shrink-0">
              <Button variant="ghost" size="sm" onClick={handleDecline}>
                דחה
              </Button>
              <Button variant="primary" size="sm" onClick={handleAccept}>
                אשר הכל
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
