"use client";

import { useEffect, useState, useCallback } from "react";
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

type SortMode = "newest" | "alpha";

function FontCard({ font }: { font: FontFamily }) {
  const [loadedFontName, setLoadedFontName] = useState<string | null>(null);

  useEffect(() => {
    // Find the regular (weight 400) style, or fallback to first style
    const regularStyle =
      font.styles.find((s) => s.weight === 400) || font.styles[0];
    if (!regularStyle?.fontFileUrl) return;

    const name = `card-${font.slug}-${regularStyle.id}`.replace(
      /[^a-zA-Z0-9_-]/g,
      "-"
    );
    const face = new FontFace(name, `url(${regularStyle.fontFileUrl})`);
    face
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
        setLoadedFontName(name);
      })
      .catch(() => {
        // Silently fail — preview just won't use the custom font
      });
  }, [font.slug, font.styles]);

  const getMinPrice = () => {
    if (font.styles.length === 0) return 0;
    return Math.min(...font.styles.map((s) => s.pricePersonal));
  };

  return (
    <Link href={`/fonts/${font.slug}`} className="group relative block">
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
      <div className="relative bg-gray-950 border border-gray-200 rounded-[18px] p-6 transition-all duration-300 group-hover:-translate-y-1">
        {/* Category badge */}
        {font.category && (
          <span className="inline-block text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full mb-4">
            {categoryLabels[font.category] || font.category}
          </span>
        )}

        {/* Font Name */}
        <h3 className="text-xl font-bold text-black mb-1">{font.name}</h3>

        {/* Designer */}
        {font.designer && (
          <p className="text-gray-600 text-sm mb-4">{font.designer}</p>
        )}

        {/* Preview text in the actual font */}
        <div className="bg-gray-50 rounded-xl p-4 mb-4 min-h-[60px] flex items-center justify-center overflow-hidden">
          <span
            className="text-gray-700 text-lg transition-all duration-300"
            style={{
              fontFamily: loadedFontName || "inherit",
              opacity: loadedFontName ? 1 : 0.5,
            }}
          >
            אבגדהוזחטיכלמנסעפצקרשת
          </span>
        </div>

        {/* Price + styles count */}
        <div className="flex items-center justify-between">
          <span className="text-black font-semibold">
            {getMinPrice() > 0 ? `מ-₪${getMinPrice()}` : "חינם"}
          </span>
          <span className="text-gray-600 text-sm">
            {font.styles.length} סגנונות
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function FontStoreClient() {
  const [fonts, setFonts] = useState<FontFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");

  useEffect(() => {
    let cancelled = false;
    const url = activeCategory
      ? `/api/fonts?category=${activeCategory}`
      : "/api/fonts";

    fetch(url)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) {
          setFonts(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFonts([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeCategory]);

  const sortedFonts = useCallback(() => {
    const sorted = [...fonts];
    if (sortMode === "alpha") {
      sorted.sort((a, b) => a.name.localeCompare(b.name, "he"));
    }
    // "newest" is the default API order (createdAt desc)
    return sorted;
  }, [fonts, sortMode]);

  return (
    <div className="min-h-screen bg-white" dir="rtl">
      {/* Hero */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <h1
            className="chromatic-hover chromatic-always text-[clamp(2rem,6vw,4.5rem)] font-extrabold text-center text-black w-full mb-6"
            data-text="חנות פונטים"
          >
            חנות פונטים
          </h1>
          <p className="text-gray-700 text-lg md:text-xl max-w-2xl mx-auto">
            פונטים מקוריים באיכות גבוהה לשימוש אישי ומסחרי
          </p>
        </div>
      </section>

      {/* Category Tabs + Sort */}
      <section className="px-6 pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap justify-center gap-2 mb-4">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={`px-4 py-2.5 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === cat.value
                    ? "bg-pink text-white"
                    : "bg-gray-50 text-gray-700 hover:text-black hover:bg-gray-100 border border-gray-200"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          {/* Sort buttons */}
          <div className="flex justify-center gap-2">
            <button
              onClick={() => setSortMode("newest")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                sortMode === "newest"
                  ? "bg-cyan/20 text-cyan border border-cyan/40"
                  : "bg-gray-50 text-gray-600 hover:text-gray-700 border border-gray-200"
              }`}
            >
              חדש
            </button>
            <button
              onClick={() => setSortMode("alpha")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                sortMode === "alpha"
                  ? "bg-cyan/20 text-cyan border border-cyan/40"
                  : "bg-gray-50 text-gray-600 hover:text-gray-700 border border-gray-200"
              }`}
            >
              א-ת
            </button>
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="px-6 pb-24">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="text-gray-700 text-center py-16">
              טוען פונטים...
            </div>
          ) : fonts.length === 0 ? (
            <div className="text-gray-700 text-center py-16">
              <p className="text-lg">אין פונטים בקטגוריה זו</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {sortedFonts().map((font) => (
                <FontCard key={font.id} font={font} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
