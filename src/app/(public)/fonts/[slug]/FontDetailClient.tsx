"use client";

import { useState, useEffect, useId, useCallback } from "react";
import { useRouter } from "next/navigation";
import FontWeightBadge from "@/components/fonts/FontWeightBadge";
import FontDownloadButton from "@/components/fonts/FontDownloadButton";

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

export default function FontDetailClient({ font }: { font: FontFamily }) {
  const router = useRouter();
  const uniqueId = useId();
  const [previewText, setPreviewText] = useState("הדוגמא שלך כאן");
  const [fontSize, setFontSize] = useState(48);
  const [loadedFonts, setLoadedFonts] = useState<Record<string, string>>({});
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [error, setError] = useState("");

  const makeFontName = useCallback(
    (styleId: string) =>
      `detail-${font.slug}-${styleId}-${uniqueId}`.replace(
        /[^a-zA-Z0-9_-]/g,
        "-"
      ),
    [font.slug, uniqueId]
  );

  // Load hero font (first available style)
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

  // Load each style font separately
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

  const heroFontFamily = heroLoaded ? makeFontName("hero") : "inherit";

  return (
    <div className="min-h-screen bg-black" dir="rtl">
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-5xl mx-auto">
          {/* Hero: Font name displayed in the font itself */}
          <div className="text-center mb-16">
            <h1
              className="text-5xl md:text-7xl lg:text-8xl font-extrabold mb-4 relative inline-block"
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
                <span className="relative text-white">{font.name}</span>
              </span>
            </h1>

            {font.designer && (
              <p className="text-gray-400 text-lg">מעצב: {font.designer}</p>
            )}
            {font.description && (
              <p className="text-gray-500 mt-4 max-w-2xl mx-auto">
                {font.description}
              </p>
            )}
          </div>

          {/* Interactive Preview */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-12">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
              <input
                type="text"
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                placeholder="הקלד טקסט לתצוגה..."
                className="flex-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-pink/50 transition-colors"
              />
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-gray-400">{fontSize}px</span>
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

            {/* Weight Rows */}
            <div className="space-y-3">
              {font.styles.map((style) => (
                <div
                  key={style.id}
                  className="bg-gray-950 rounded-xl p-5 flex flex-col gap-2"
                >
                  <div className="flex items-center gap-3">
                    <FontWeightBadge weight={style.weight} />
                    <span className="text-gray-400 text-sm">{style.name}</span>
                  </div>
                  <p
                    className="text-white leading-relaxed transition-all duration-200"
                    style={{
                      fontFamily: loadedFonts[style.id] || "inherit",
                      fontSize: `${fontSize}px`,
                      opacity: loadedFonts[style.id] ? 1 : 0.4,
                    }}
                  >
                    {previewText || "הדוגמא שלך כאן"}
                  </p>
                </div>
              ))}
              {font.styles.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-4">
                  אין סגנונות זמינים
                </p>
              )}
            </div>
          </div>

          {/* Price Table */}
          {font.styles.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
              <h2 className="text-lg font-semibold text-white mb-4">מחירון</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-800">
                      <th className="text-right py-3 px-2 font-medium">סגנון</th>
                      <th className="text-right py-3 px-2 font-medium">משקל</th>
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
                        className="border-b border-gray-800/50"
                      >
                        <td className="py-3 px-2 text-white font-medium">
                          {style.name}
                        </td>
                        <td className="py-3 px-2">
                          <FontWeightBadge weight={style.weight} />
                        </td>
                        <td className="py-3 px-2 text-white">
                          {style.pricePersonal === 0
                            ? "חינם"
                            : `${style.pricePersonal}₪`}
                        </td>
                        <td className="py-3 px-2 text-white">
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
          )}

          {/* Download Button */}
          <div className="text-center">
            {error && (
              <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg px-4 py-3 text-sm mb-4 max-w-md mx-auto">
                {error}
              </div>
            )}
            <FontDownloadButton onDownload={handleDownload} />
          </div>
        </div>
      </section>
    </div>
  );
}
