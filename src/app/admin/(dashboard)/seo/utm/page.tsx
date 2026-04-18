"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

interface UtmRow {
  id: string;
  fullUrl: string;
  baseUrl: string;
  source: string;
  medium: string;
  campaign: string;
  term: string | null;
  content: string | null;
  label: string | null;
  clicks: number;
  createdAt: string;
}

export default function UtmPage() {
  const [links, setLinks] = useState<UtmRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);

  const [baseUrl, setBaseUrl] = useState("");
  const [source, setSource] = useState("");
  const [medium, setMedium] = useState("");
  const [campaign, setCampaign] = useState("");
  const [term, setTerm] = useState("");
  const [content, setContent] = useState("");
  const [label, setLabel] = useState("");

  const load = async () => {
    try {
      const res = await fetch("/api/seo/utm", { cache: "no-store" });
      if (!res.ok) throw new Error();
      setLinks((await res.json()).links ?? []);
    } catch {
      toast.error("שגיאה בטעינת הקישורים");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const reset = () => {
    setBaseUrl("");
    setSource("");
    setMedium("");
    setCampaign("");
    setTerm("");
    setContent("");
    setLabel("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setGenerated(null);
    try {
      const res = await fetch("/api/seo/utm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: baseUrl.trim(),
          source: source.trim(),
          medium: medium.trim(),
          campaign: campaign.trim(),
          term: term.trim() || undefined,
          content: content.trim() || undefined,
          label: label.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "שגיאה ביצירה");
        return;
      }
      toast.success("הקישור נוצר ונשמר");
      setGenerated(json.link.fullUrl);
      reset();
      load();
    } catch {
      toast.error("שגיאה ביצירה");
    } finally {
      setCreating(false);
    }
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("הועתק");
    } catch {
      toast.error("שגיאה בהעתקה");
    }
  };

  return (
    <div dir="rtl" className="space-y-6">
      <h2 className="text-2xl font-bold">יצירת קישורי UTM</h2>

      <form
        onSubmit={handleSubmit}
        className="bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-4"
      >
        <div>
          <label className="block text-sm text-gray-400 mb-1">כתובת יעד *</label>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            type="url"
            required
            placeholder="https://www.fuzionwebz.com/services/website"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">מקור *</label>
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              required
              placeholder="walla"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">מדיום *</label>
            <input
              value={medium}
              onChange={(e) => setMedium(e.target.value)}
              required
              placeholder="article"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">קמפיין *</label>
            <input
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
              required
              placeholder="launch-april-2026"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">מונח (אופציונלי)</label>
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">תוכן (אופציונלי)</label>
            <input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">תווית פנימית (אופציונלי)</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="מאמר אצל וואלה — UX לעסקים קטנים"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink"
          />
        </div>

        <button
          type="submit"
          disabled={creating}
          className="bg-pink hover:bg-pink-light disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl transition-colors"
        >
          {creating ? "יוצר…" : "צור קישור"}
        </button>

        {generated && (
          <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 flex items-center gap-3">
            <code className="flex-1 text-xs text-cyan break-all">{generated}</code>
            <button
              type="button"
              onClick={() => copy(generated)}
              className="shrink-0 text-xs bg-pink hover:bg-pink-light text-white font-bold px-3 py-1.5 rounded-lg"
            >
              העתק
            </button>
          </div>
        )}
      </form>

      <div>
        <h3 className="text-base font-bold text-white mb-3">הקישורים שלך</h3>
        {loading ? (
          <div className="h-32 bg-gray-900 border border-gray-700 rounded-2xl animate-pulse" />
        ) : links.length === 0 ? (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 text-center text-sm text-gray-500">
            עוד לא יצרת קישורים. השתמש בטופס למעלה.
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/50 border-b border-gray-700">
                <tr>
                  <th className="text-right text-gray-400 font-medium px-3 py-2.5">תווית</th>
                  <th className="text-right text-gray-400 font-medium px-3 py-2.5">מקור</th>
                  <th className="text-right text-gray-400 font-medium px-3 py-2.5">מדיום</th>
                  <th className="text-right text-gray-400 font-medium px-3 py-2.5">קמפיין</th>
                  <th className="text-right text-gray-400 font-medium px-3 py-2.5">קליקים</th>
                  <th className="text-right text-gray-400 font-medium px-3 py-2.5">תאריך</th>
                  <th className="px-3"></th>
                </tr>
              </thead>
              <tbody>
                {links.map((l) => (
                  <tr key={l.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/30">
                    <td className="px-3 py-2 text-white">{l.label || "—"}</td>
                    <td className="px-3 py-2 text-gray-300">{l.source}</td>
                    <td className="px-3 py-2 text-gray-300">{l.medium}</td>
                    <td className="px-3 py-2 text-gray-400 text-xs">{l.campaign}</td>
                    <td className="px-3 py-2 text-gray-300 font-mono">{l.clicks}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">
                      {new Date(l.createdAt).toLocaleDateString("he-IL")}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => copy(l.fullUrl)}
                        className="text-xs text-cyan hover:text-cyan/80 underline-offset-2 hover:underline"
                      >
                        העתק
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
