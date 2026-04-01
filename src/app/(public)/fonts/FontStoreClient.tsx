"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface FontStyle {
  id: string;
  name: string;
  weight: number;
  pricePersonal: number;
  priceCommercial: number;
  fontFileUrl: string;
}

interface FontFamily {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  designer: string | null;
  previewUrl: string | null;
  category: string | null;
  tags: string[];
  featured: boolean;
  styles: FontStyle[];
}

const CATEGORIES = [
  { value: "", label: "הכל" },
  { value: "serif", label: "סריף" },
  { value: "sans", label: "סאנס" },
  { value: "display", label: "דיספליי" },
  { value: "script", label: "סקריפט" },
  { value: "mono", label: "מונו" },
];

const categoryLabels: Record<string, string> = {
  serif: "סריף",
  sans: "סאנס",
  display: "דיספליי",
  script: "סקריפט",
  mono: "מונו",
};

export default function FontStoreClient() {
  const [fonts, setFonts] = useState<FontFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("");

  useEffect(() => {
    let cancelled = false;
    const url = activeCategory
      ? `/api/fonts?category=${activeCategory}`
      : "/api/fonts";

    fetch(url)
      .then((res) => res.ok ? res.json() : [])
      .then((data) => {
        if (!cancelled) { setFonts(Array.isArray(data) ? data : []); setLoading(false); }
      })
      .catch(() => {
        if (!cancelled) { setFonts([]); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, [activeCategory]);

  const getMinPrice = (font: FontFamily) => {
    if (font.styles.length === 0) return 0;
    return Math.min(...font.styles.map((s) => s.pricePersonal));
  };

  return (
    <div className="min-h-screen bg-black" dir="rtl">
      {/* Hero */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="chromatic-hover chromatic-always text-[clamp(2rem,6vw,4.5rem)] font-extrabold text-center text-white w-full mb-6" data-text="חנות פונטים">
            חנות פונטים
          </h1>
          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto">
            פונטים מקוריים באיכות גבוהה לשימוש אישי ומסחרי
          </p>
        </div>
      </section>

      {/* Category Tabs */}
      <section className="px-6 pb-8">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-center gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={`px-4 py-2.5 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat.value
                  ? "bg-pink text-white"
                  : "bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-800"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </section>

      {/* Grid */}
      <section className="px-6 pb-24">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="text-gray-400 text-center py-16">טוען פונטים...</div>
          ) : fonts.length === 0 ? (
            <div className="text-gray-400 text-center py-16">
              <p className="text-lg">אין פונטים בקטגוריה זו</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {fonts.map((font) => (
                <Link
                  key={font.id}
                  href={`/fonts/${font.slug}`}
                  className="group relative block"
                >
                  {/* Chromatic offset layers */}
                  <div
                    className="absolute inset-0 rounded-[18px] bg-[#00D0CE]"
                    style={{ transform: "translate(3px, -3px)" }}
                  />
                  <div
                    className="absolute inset-0 rounded-[18px] bg-[#E503A2]"
                    style={{ transform: "translate(-3px, 3px)" }}
                  />

                  {/* Main card */}
                  <div className="relative bg-gray-950 border border-gray-800 rounded-[18px] p-6 transition-all duration-300 group-hover:-translate-y-1">
                    {/* Category badge */}
                    {font.category && (
                      <span className="inline-block text-xs bg-gray-800 text-gray-400 px-2.5 py-1 rounded-full mb-4">
                        {categoryLabels[font.category] || font.category}
                      </span>
                    )}

                    {/* Font Name */}
                    <h3 className="text-xl font-bold text-white mb-1">
                      {font.name}
                    </h3>

                    {/* Designer */}
                    {font.designer && (
                      <p className="text-gray-500 text-sm mb-4">
                        {font.designer}
                      </p>
                    )}

                    {/* Preview text area */}
                    <div className="bg-gray-900 rounded-xl p-4 mb-4 min-h-[60px] flex items-center justify-center">
                      <span className="text-gray-300 text-lg">
                        אבגדהוזחטיכלמנסעפצקרשת
                      </span>
                    </div>

                    {/* Price */}
                    <div className="flex items-center justify-between">
                      <span className="text-white font-semibold">
                        {getMinPrice(font) > 0
                          ? `מ-₪${getMinPrice(font)}`
                          : "חינם"}
                      </span>
                      <span className="text-gray-500 text-sm">
                        {font.styles.length} סגנונות
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
