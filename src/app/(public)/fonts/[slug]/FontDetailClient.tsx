"use client";

import { useState } from "react";
import Link from "next/link";
import FontPreview from "@/components/fonts/FontPreview";

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

type LicenseType = "PERSONAL" | "COMMERCIAL";

export default function FontDetailClient({ font }: { font: FontFamily }) {
  const [licenseType, setLicenseType] = useState<LicenseType>("PERSONAL");
  const [buying, setBuying] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [checkoutForm, setCheckoutForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
  });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const totalPrice = font.styles.reduce((sum, style) => {
    return (
      sum +
      (licenseType === "PERSONAL"
        ? style.pricePersonal
        : style.priceCommercial)
    );
  }, 0);

  const handleBuy = async () => {
    if (!checkoutForm.customerName || !checkoutForm.customerEmail) {
      setError("נא למלא שם ואימייל");
      return;
    }

    setBuying(true);
    setError("");

    try {
      const res = await fetch("/api/fonts/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...checkoutForm,
          fontFamilyId: font.id,
          licenseType,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Checkout failed");
      }

      const data = await res.json();
      setDownloadUrl(data.downloadUrl);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "שגיאה בתהליך הרכישה"
      );
    } finally {
      setBuying(false);
    }
  };

  const firstStyle = font.styles[0];

  return (
    <div className="min-h-screen bg-black" dir="rtl">
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-5xl mx-auto">
          {/* Font Name with chromatic effect */}
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-7xl font-extrabold mb-4 relative inline-block">
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

          {/* Font Preview */}
          {firstStyle && (
            <FontPreview
              fontName={font.name}
              fontFileUrl={firstStyle.fontFileUrl}
              className="mb-12"
            />
          )}

          {/* Styles Table */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">סגנונות</h2>

            {/* License Type Selector */}
            <div className="flex items-center gap-4 mb-6">
              <span className="text-gray-400 text-sm">סוג רישיון:</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="license"
                  checked={licenseType === "PERSONAL"}
                  onChange={() => setLicenseType("PERSONAL")}
                  className="accent-pink"
                />
                <span className="text-sm text-gray-300">
                  אישי (Personal)
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="license"
                  checked={licenseType === "COMMERCIAL"}
                  onChange={() => setLicenseType("COMMERCIAL")}
                  className="accent-pink"
                />
                <span className="text-sm text-gray-300">
                  מסחרי (Commercial)
                </span>
              </label>
            </div>

            {font.styles.length > 0 ? (
              <div className="space-y-2">
                {font.styles.map((style) => (
                  <div
                    key={style.id}
                    className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-white font-medium">
                        {style.name}
                      </span>
                      <span className="text-gray-500 text-xs">
                        משקל: {style.weight}
                      </span>
                    </div>
                    <span className="text-white font-semibold">
                      {licenseType === "PERSONAL"
                        ? style.pricePersonal
                        : style.priceCommercial}
                      ₪
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">אין סגנונות זמינים</p>
            )}

            {/* Total */}
            {font.styles.length > 0 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
                <span className="text-gray-300 font-medium">סה&quot;כ</span>
                <span className="text-2xl font-bold text-white">
                  {totalPrice}₪
                </span>
              </div>
            )}
          </div>

          {/* Download Success */}
          {downloadUrl ? (
            <div className="bg-green-900/20 border border-green-800 rounded-2xl p-6 text-center">
              <h3 className="text-xl font-bold text-green-300 mb-2">
                הרכישה הושלמה בהצלחה!
              </h3>
              <p className="text-gray-400 mb-4">
                הפונט שלך מוכן להורדה
              </p>
              <Link
                href={downloadUrl}
                className="inline-block bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-xl font-medium transition-colors"
              >
                עבור לדף ההורדה
              </Link>
            </div>
          ) : !showForm ? (
            /* Buy Button */
            <div className="text-center">
              <button
                onClick={() => setShowForm(true)}
                disabled={font.styles.length === 0}
                className="bg-pink hover:bg-pink/80 disabled:opacity-50 text-white px-10 py-3.5 rounded-xl text-lg font-bold transition-colors"
              >
                קנה עכשיו — {totalPrice}₪
              </button>
            </div>
          ) : (
            /* Checkout Form */
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md mx-auto">
              <h3 className="text-lg font-semibold text-white mb-4">
                פרטי הרכישה
              </h3>

              {error && (
                <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg px-4 py-3 text-sm mb-4">
                  {error}
                </div>
              )}

              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="שם מלא *"
                  value={checkoutForm.customerName}
                  onChange={(e) =>
                    setCheckoutForm({
                      ...checkoutForm,
                      customerName: e.target.value,
                    })
                  }
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-pink/50 transition-colors"
                />
                <input
                  type="email"
                  placeholder="אימייל *"
                  value={checkoutForm.customerEmail}
                  onChange={(e) =>
                    setCheckoutForm({
                      ...checkoutForm,
                      customerEmail: e.target.value,
                    })
                  }
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-pink/50 transition-colors"
                />
                <input
                  type="tel"
                  placeholder="טלפון (אופציונלי)"
                  value={checkoutForm.customerPhone}
                  onChange={(e) =>
                    setCheckoutForm({
                      ...checkoutForm,
                      customerPhone: e.target.value,
                    })
                  }
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-pink/50 transition-colors"
                />
              </div>

              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={handleBuy}
                  disabled={buying}
                  className="flex-1 bg-pink hover:bg-pink/80 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium transition-colors"
                >
                  {buying ? "מעבד..." : `שלם ${totalPrice}₪`}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2.5 rounded-lg text-sm transition-colors"
                >
                  ביטול
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
