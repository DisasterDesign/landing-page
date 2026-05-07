"use client";

import { useState, useEffect, useId, useCallback } from "react";
import { useRouter } from "next/navigation";
import FontWeightBadge from "@/components/fonts/FontWeightBadge";
import FontDownloadButton from "@/components/fonts/FontDownloadButton";
import Badge from "@/components/ui/Badge";
import ChromaticText from "@/components/animations/ChromaticText";
import ScrollReveal from "@/components/animations/ScrollReveal";

interface FontStyle {
  id: string;
  name: string;
  weight: number;
  fontFileUrl: string;
  pricePersonal: number;
  priceCommercial: number;
}

interface FontFamily {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  designer: string | null;
  category: string | null;
  tags: string[];
  styles: FontStyle[];
}

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const specimens = [
  { size: 74, text: "שלום עולם" },
  { size: 60, text: "Hello World" },
  { size: 48, text: "פוזיון פונטים" },
  {
    size: 36,
    text: "Typography is the craft of endowing human language with a durable visual form",
  },
  {
    size: 26,
    text: "הטיפוגרפיה היא אמנות הסידור של סימנים כתובים וסימני כתב",
  },
];

const CHAR_SETS: Record<string, { label: string; chars: string[] }> = {
  hebrew: {
    label: "עברית",
    chars: "אבגדהוזחטיכךלמםנןסעפףצץקרשת".split(""),
  },
  latin_upper: {
    label: "Latin Upper",
    chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
  },
  latin_lower: {
    label: "Latin Lower",
    chars: "abcdefghijklmnopqrstuvwxyz".split(""),
  },
  numbers: { label: "מספרים", chars: "0123456789".split("") },
  punctuation: {
    label: "פיסוק",
    chars: ".,;:!?-–—()[]{}\"'".split(""),
  },
  symbols: {
    label: "סמלים",
    chars: "@#$%^&*+=/₪€$£¥~".split(""),
  },
};

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function FontDetailClient({ font }: { font: FontFamily }) {
  const router = useRouter();
  const uniqueId = useId();

  /* ---- existing state ---- */
  const [previewText, setPreviewText] = useState("הדוגמא שלך כאן");
  const [fontSize, setFontSize] = useState(48);
  const [loadedFonts, setLoadedFonts] = useState<Record<string, string>>({});
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [error, setError] = useState("");

  /* ---- new state ---- */
  const [selectedWeight, setSelectedWeight] = useState(
    font.styles[0]?.id || ""
  );
  const [charCategory, setCharCategory] = useState<string>("hebrew");

  /* ---- font loading (unchanged) ---- */
  const makeFontName = useCallback(
    (styleId: string) =>
      `detail-${font.slug}-${styleId}-${uniqueId}`.replace(
        /[^a-zA-Z0-9_-]/g,
        "-"
      ),
    [font.slug, uniqueId]
  );

  useEffect(() => {
    const firstStyle = font.styles[0];
    if (!firstStyle?.fontFileUrl) return;

    const heroName = makeFontName("hero");
    const face = new FontFace(heroName, `url(${firstStyle.fontFileUrl})`);
    face
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
        setHeroLoaded(true);
      })
      .catch((err) => console.error("Hero font load failed:", err));
  }, [font.styles, makeFontName]);

  useEffect(() => {
    font.styles.forEach((style) => {
      if (!style.fontFileUrl) return;
      const name = makeFontName(style.id);
      const face = new FontFace(name, `url(${style.fontFileUrl})`, {
        weight: String(style.weight),
      });
      face
        .load()
        .then((loaded) => {
          document.fonts.add(loaded);
          setLoadedFonts((prev) => ({ ...prev, [style.id]: name }));
        })
        .catch((err) =>
          console.error(`Font load failed for ${style.name}:`, err)
        );
    });
  }, [font.styles, makeFontName]);

  /* ---- download handler (unchanged) ---- */
  const handleDownload = async (data: { name: string; email: string }) => {
    setError("");
    try {
      const res = await fetch("/api/fonts/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: data.name,
          customerEmail: data.email,
          fontFamilyId: font.id,
          licenseType: "PERSONAL",
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Checkout failed");
      }

      const d = await res.json();
      if (d.downloadUrl) {
        router.push(d.downloadUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בתהליך ההורדה");
    }
  };

  /* ---- derived ---- */
  const heroFontFamily = heroLoaded ? makeFontName("hero") : "inherit";

  /* ================================================================ */
  /*  JSX                                                             */
  /* ================================================================ */
  return (
    <div className="min-h-screen bg-white" dir="rtl">
      {/* ======================================================== */}
      {/*  1. HERO                                                  */}
      {/* ======================================================== */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <ScrollReveal>
            <h1
              className="text-7xl md:text-9xl font-extrabold mb-6 relative inline-block"
              style={{
                fontFamily: heroFontFamily,
                opacity: heroLoaded ? 1 : 0.5,
                transition: "opacity 0.3s ease",
              }}
            >
              <span className="relative">
                <span
                  className="absolute inset-0 text-[#00D0CE] select-none"
                  style={{ transform: "translate(3px, -3px)" }}
                  aria-hidden="true"
                >
                  {font.name}
                </span>
                <span
                  className="absolute inset-0 text-[#E503A2] select-none"
                  style={{ transform: "translate(-3px, 3px)" }}
                  aria-hidden="true"
                >
                  {font.name}
                </span>
                <span className="relative text-black">{font.name}</span>
              </span>
            </h1>

            <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
              {font.category && <Badge variant="cyan">{font.category}</Badge>}
              {font.styles.length > 0 && (
                <Badge variant="pink">{font.styles.length} משקלים</Badge>
              )}
            </div>

            {font.designer && (
              <p className="text-gray-700 text-lg mt-4">
                מעצב: {font.designer}
              </p>
            )}
          </ScrollReveal>
        </div>
      </section>

      {/* ======================================================== */}
      {/*  2. TYPE SPECIMEN                                         */}
      {/* ======================================================== */}
      <section className="py-16 md:py-24 border-t border-gray-200/50">
        <div className="max-w-6xl mx-auto px-6">
          <ScrollReveal>
            <ChromaticText
              text="דוגמאות טקסט"
              as="h2"
              alwaysActive
              className="text-3xl md:text-4xl font-bold mb-12"
            />
          </ScrollReveal>

          <div className="space-y-0">
            {specimens.map((spec, i) => (
              <ScrollReveal key={i} delay={i * 0.05}>
                <div className="py-6 border-b border-gray-200/50 last:border-b-0">
                  <div className="flex items-start gap-6">
                    <span className="text-xs text-gray-600 font-mono pt-2 shrink-0 w-12 text-left">
                      {spec.size}px
                    </span>
                    <p
                      className="text-black leading-tight flex-1"
                      style={{
                        fontFamily: heroFontFamily,
                        fontSize: `${spec.size}px`,
                        opacity: heroLoaded ? 1 : 0.4,
                        transition: "opacity 0.3s ease",
                      }}
                    >
                      {spec.text}
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/*  3. INTERACTIVE TESTER                                    */}
      {/* ======================================================== */}
      <section className="py-16 md:py-24 border-t border-gray-200/50">
        <div className="max-w-6xl mx-auto px-6">
          <ScrollReveal>
            <ChromaticText
              text="נסו את הפונט"
              as="h2"
              alwaysActive
              className="text-3xl md:text-4xl font-bold mb-8"
            />
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
              {/* Weight tabs */}
              {font.styles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {font.styles.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setSelectedWeight(style.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedWeight === style.id
                          ? "bg-pink text-white"
                          : "bg-gray-100 text-gray-700 hover:text-gray-200"
                      }`}
                    >
                      {style.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Controls */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
                <input
                  type="text"
                  value={previewText}
                  onChange={(e) => setPreviewText(e.target.value)}
                  placeholder="הקלד טקסט לתצוגה..."
                  className="flex-1 w-full bg-gray-100 border border-gray-300 rounded-lg px-4 py-2.5 text-black text-sm focus:outline-none focus:border-pink/50 transition-colors"
                />
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-gray-700 font-mono w-10 text-left">
                    {fontSize}px
                  </span>
                  <input
                    type="range"
                    min={16}
                    max={120}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-36 accent-pink"
                  />
                </div>
              </div>

              {/* Preview */}
              <div className="bg-gray-950 rounded-xl p-8 min-h-[120px] flex items-center">
                <p
                  className="text-black leading-relaxed transition-all duration-200 w-full"
                  style={{
                    fontFamily:
                      loadedFonts[selectedWeight] || heroFontFamily,
                    fontSize: `${fontSize}px`,
                    opacity:
                      loadedFonts[selectedWeight] || heroLoaded ? 1 : 0.4,
                  }}
                >
                  {previewText || "הדוגמא שלך כאן"}
                </p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ======================================================== */}
      {/*  4. ALL WEIGHTS DISPLAY                                   */}
      {/* ======================================================== */}
      {font.styles.length > 0 && (
        <section className="py-16 md:py-24 border-t border-gray-200/50">
          <div className="max-w-6xl mx-auto px-6">
            <ScrollReveal>
              <ChromaticText
                text="כל המשקלים"
                as="h2"
                alwaysActive
                className="text-3xl md:text-4xl font-bold mb-12"
              />
            </ScrollReveal>

            <div className="space-y-0">
              {font.styles.map((style, i) => (
                <ScrollReveal key={style.id} delay={i * 0.05}>
                  <div className="py-8 border-b border-gray-200/50 last:border-b-0">
                    <div className="flex items-center gap-3 mb-4">
                      <FontWeightBadge weight={style.weight} />
                      <span className="text-gray-700 font-medium">
                        {style.name}
                      </span>
                    </div>

                    {/* Hebrew alphabet */}
                    <p
                      className="text-black leading-relaxed mb-3"
                      style={{
                        fontFamily: loadedFonts[style.id] || "inherit",
                        fontSize: "32px",
                        opacity: loadedFonts[style.id] ? 1 : 0.4,
                        transition: "opacity 0.3s ease",
                      }}
                    >
                      אבגדהוזחטיכךלמםנןסעפףצץקרשת
                    </p>

                    {/* Numbers */}
                    <p
                      className="text-gray-700 leading-relaxed mb-3"
                      style={{
                        fontFamily: loadedFonts[style.id] || "inherit",
                        fontSize: "32px",
                        opacity: loadedFonts[style.id] ? 1 : 0.4,
                        transition: "opacity 0.3s ease",
                      }}
                    >
                      0123456789
                    </p>

                    {/* Symbols */}
                    <p
                      className="text-gray-700 leading-relaxed"
                      style={{
                        fontFamily: loadedFonts[style.id] || "inherit",
                        fontSize: "32px",
                        opacity: loadedFonts[style.id] ? 1 : 0.4,
                        transition: "opacity 0.3s ease",
                      }}
                    >
                      {"!@#$%^&*()"}
                    </p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/*  5. CHARACTER MAP                                         */}
      {/* ======================================================== */}
      <section className="py-16 md:py-24 border-t border-gray-200/50">
        <div className="max-w-6xl mx-auto px-6">
          <ScrollReveal>
            <ChromaticText
              text="מפת תווים"
              as="h2"
              alwaysActive
              className="text-3xl md:text-4xl font-bold mb-8"
            />
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            {/* Category tabs */}
            <div className="flex flex-wrap gap-2 mb-8">
              {Object.entries(CHAR_SETS).map(([key, { label }]) => (
                <button
                  key={key}
                  onClick={() => setCharCategory(key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    charCategory === key
                      ? "bg-pink text-white"
                      : "bg-gray-100 text-gray-700 hover:text-gray-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Character grid */}
            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
              {CHAR_SETS[charCategory]?.chars.map((char, i) => (
                <div
                  key={`${charCategory}-${i}`}
                  className="bg-gray-50 border border-gray-200 rounded-lg aspect-square flex items-center justify-center text-3xl hover:border-pink/50 transition-colors"
                  style={{
                    fontFamily: heroFontFamily,
                    opacity: heroLoaded ? 1 : 0.4,
                  }}
                >
                  <span className="text-black">{char}</span>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ======================================================== */}
      {/*  6. ABOUT                                                 */}
      {/* ======================================================== */}
      {(font.description || font.designer) && (
        <section className="py-16 md:py-24 border-t border-gray-200/50">
          <div className="max-w-6xl mx-auto px-6">
            <ScrollReveal>
              <ChromaticText
                text="אודות הפונט"
                as="h2"
                alwaysActive
                className="text-3xl md:text-4xl font-bold mb-8"
              />
            </ScrollReveal>

            <ScrollReveal delay={0.1}>
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8">
                {font.description && (
                  <p className="text-gray-700 text-lg leading-relaxed mb-6">
                    {font.description}
                  </p>
                )}

                {font.designer && (
                  <p className="text-gray-700 mb-6">
                    <span className="text-gray-600">מעצב:</span>{" "}
                    {font.designer}
                  </p>
                )}

                <div className="flex items-center gap-3 flex-wrap">
                  {font.category && (
                    <Badge variant="cyan">{font.category}</Badge>
                  )}
                  {font.styles.length > 0 && (
                    <Badge variant="pink">{font.styles.length} משקלים</Badge>
                  )}
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/*  7. DOWNLOAD / PURCHASE                                   */}
      {/* ======================================================== */}
      {font.styles.length > 0 && (
        <section className="py-16 md:py-24 border-t border-gray-200/50">
          <div className="max-w-6xl mx-auto px-6">
            <ScrollReveal>
              <ChromaticText
                text="הורדה"
                as="h2"
                alwaysActive
                className="text-3xl md:text-4xl font-bold mb-8"
              />
            </ScrollReveal>

            <ScrollReveal delay={0.1}>
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 mb-8">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-700 border-b border-gray-200">
                        <th className="text-right py-3 px-2 font-medium">
                          סגנון
                        </th>
                        <th className="text-right py-3 px-2 font-medium">
                          משקל
                        </th>
                        <th className="text-right py-3 px-2 font-medium">
                          אישי
                        </th>
                        <th className="text-right py-3 px-2 font-medium">
                          מסחרי
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {font.styles.map((style) => (
                        <tr
                          key={style.id}
                          className="border-b border-gray-200/50"
                        >
                          <td className="py-3 px-2 text-black font-medium">
                            {style.name}
                          </td>
                          <td className="py-3 px-2">
                            <FontWeightBadge weight={style.weight} />
                          </td>
                          <td className="py-3 px-2 text-black">
                            {style.pricePersonal === 0
                              ? "חינם"
                              : `${style.pricePersonal}₪`}
                          </td>
                          <td className="py-3 px-2 text-black">
                            {style.priceCommercial === 0
                              ? "חינם"
                              : `${style.priceCommercial}₪`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.15}>
              <div className="text-center">
                {error && (
                  <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg px-4 py-3 text-sm mb-4 max-w-md mx-auto">
                    {error}
                  </div>
                )}
                <FontDownloadButton onDownload={handleDownload} />
              </div>
            </ScrollReveal>
          </div>
        </section>
      )}
    </div>
  );
}
