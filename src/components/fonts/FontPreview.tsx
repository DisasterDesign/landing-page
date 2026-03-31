"use client";

import { useState, useEffect, useId } from "react";
import { cn } from "@/lib/utils";

interface FontPreviewProps {
  fontName: string;
  fontFileUrl: string;
  className?: string;
}

export default function FontPreview({
  fontName,
  fontFileUrl,
  className,
}: FontPreviewProps) {
  const [text, setText] = useState("הדוגמא שלך כאן");
  const [fontSize, setFontSize] = useState(36);
  const [loaded, setLoaded] = useState(false);
  const uniqueId = useId();
  const safeFontName = `preview-${fontName.replace(/[^a-zA-Z0-9\u0590-\u05FF]/g, "-")}-${uniqueId}`;

  useEffect(() => {
    if (!fontFileUrl) return;

    const font = new FontFace(safeFontName, `url(${fontFileUrl})`);
    font
      .load()
      .then((loadedFont) => {
        document.fonts.add(loadedFont);
        setLoaded(true);
      })
      .catch((err) => {
        console.error("Failed to load font:", err);
      });
  }, [fontFileUrl, safeFontName]);

  return (
    <div
      className={cn(
        "bg-gray-900 border border-gray-800 rounded-2xl p-6",
        className
      )}
      dir="rtl"
    >
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="הקלד טקסט לתצוגה..."
          className="flex-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-pink/50 transition-colors"
        />
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-gray-400">{fontSize}px</span>
          <input
            type="range"
            min={16}
            max={72}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="w-28 accent-pink"
          />
        </div>
      </div>

      {/* Preview */}
      <div className="bg-gray-950 rounded-xl p-8 min-h-[120px] flex items-center justify-center">
        <p
          className="text-white text-center leading-relaxed transition-all duration-200"
          style={{
            fontFamily: loaded ? safeFontName : "inherit",
            fontSize: `${fontSize}px`,
            opacity: loaded ? 1 : 0.5,
          }}
        >
          {text || "הדוגמא שלך כאן"}
        </p>
      </div>

      {!loaded && fontFileUrl && (
        <p className="text-gray-500 text-xs mt-2 text-center">טוען פונט...</p>
      )}
    </div>
  );
}
