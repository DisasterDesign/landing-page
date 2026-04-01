"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface FontFamily {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  published: boolean;
  featured: boolean;
  _count: { styles: number; orders: number };
  createdAt: string;
}

export default function AdminFontsPage() {
  const [fonts, setFonts] = useState<FontFamily[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/fonts/admin")
      .then((res) => res.json())
      .then((data) => {
        setFonts(Array.isArray(data) ? data : data.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const categoryLabels: Record<string, string> = {
    serif: "סריף",
    sans: "סאנס",
    display: "דיספליי",
    script: "סקריפט",
    mono: "מונו",
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">פונטים</h1>
          <p className="text-gray-400 text-sm mt-1">
            ניהול משפחות פונטים בחנות
          </p>
        </div>
        <Link
          href="/admin/fonts/new"
          className="bg-pink hover:bg-pink/80 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + הוסף פונט
        </Link>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-gray-400 text-center py-12">טוען...</div>
      ) : fonts.length === 0 ? (
        <div className="text-gray-400 text-center py-12">
          <p className="text-lg mb-2">אין פונטים עדיין</p>
          <Link
            href="/admin/fonts/new"
            className="text-pink hover:underline text-sm"
          >
            הוסף את הפונט הראשון
          </Link>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="text-right px-4 py-3 font-medium">שם</th>
                <th className="text-right px-4 py-3 font-medium">קטגוריה</th>
                <th className="text-center px-4 py-3 font-medium">סגנונות</th>
                <th className="text-center px-4 py-3 font-medium">הזמנות</th>
                <th className="text-center px-4 py-3 font-medium">סטטוס</th>
                <th className="text-center px-4 py-3 font-medium">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {fonts.map((font) => (
                <tr
                  key={font.id}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div>
                      <span className="text-white font-medium">
                        {font.name}
                      </span>
                      {font.featured && (
                        <span className="mr-2 text-xs bg-yellow-900/60 text-yellow-300 px-2 py-0.5 rounded-full">
                          מומלץ
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {font.category
                      ? categoryLabels[font.category] || font.category
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-300">
                    {font._count.styles}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-300">
                    {font._count.orders}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                        font.published
                          ? "bg-green-900/60 text-green-300"
                          : "bg-gray-700 text-gray-400"
                      }`}
                    >
                      {font.published ? "מפורסם" : "טיוטה"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link
                      href={`/admin/fonts/${font.id}/edit`}
                      className="text-cyan hover:text-cyan/80 text-sm transition-colors"
                    >
                      עריכה
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
