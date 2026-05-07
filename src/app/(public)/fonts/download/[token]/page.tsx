"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";

interface DownloadData {
  orderId: string;
  fontFamily: string;
  licenseType: "PERSONAL" | "COMMERCIAL";
  styles: { id: string; name: string; fontFileUrl: string; weight: number }[];
  downloadCount: number;
  createdAt: string;
}

export default function DownloadPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [data, setData] = useState<DownloadData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/fonts/download/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error("Invalid token");
        return res.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "קישור לא תקין");
        setLoading(false);
      });
  }, [token]);

  const licenseLabels: Record<string, string> = {
    PERSONAL: "אישי",
    COMMERCIAL: "מסחרי",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-700">טוען...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-black mb-2">קישור לא תקין</h1>
          <p className="text-gray-700 mb-6">
            הקישור פג תוקף או שאינו קיים
          </p>
          <Link
            href="/fonts"
            className="inline-block bg-pink hover:bg-pink/80 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
          >
            חזרה לחנות
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" dir="rtl">
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-lg mx-auto">
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">✓</div>
            <h1 className="text-2xl font-bold text-black mb-2">
              הפונט שלך מוכן!
            </h1>
            <p className="text-gray-700 mb-6">{data.fontFamily}</p>

            {/* Order Info */}
            <div className="bg-gray-100 rounded-xl p-4 mb-6 text-right space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-700">רישיון:</span>
                <span className="text-black">
                  {licenseLabels[data.licenseType] || data.licenseType}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">תאריך:</span>
                <span className="text-black">
                  {new Date(data.createdAt).toLocaleDateString("he-IL")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">הורדות:</span>
                <span className="text-black">{data.downloadCount}</span>
              </div>
            </div>

            {/* Download Buttons */}
            <div className="space-y-2">
              {data.styles.map((style) => (
                <a
                  key={style.id}
                  href={style.fontFileUrl}
                  download
                  className="block bg-pink hover:bg-pink/80 text-white px-6 py-3 rounded-xl font-medium transition-colors"
                >
                  הורד {style.name} (משקל {style.weight})
                </a>
              ))}
            </div>

            <Link
              href="/fonts"
              className="inline-block text-gray-600 hover:text-gray-700 text-sm mt-6 transition-colors"
            >
              ← חזרה לחנות הפונטים
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
