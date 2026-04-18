"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface IntegrationInfo {
  email: string | null;
  gscSiteUrl: string | null;
  ga4PropertyId: string | null;
  expiresAt: string;
  createdAt: string;
}

interface StatusResponse {
  oauthConfigured: boolean;
  connected: boolean;
  integration: IntegrationInfo | null;
}

export default function SeoPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/seo/status", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as StatusResponse;
      setStatus(data);
    } catch {
      toast.error("שגיאה בטעינת המצב");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (params.get("connected") === "1") {
      toast.success("חשבון Google חובר בהצלחה");
      router.replace("/admin/seo");
    }
    const err = params.get("error");
    if (err) {
      toast.error(`שגיאת חיבור: ${err}`);
      router.replace("/admin/seo");
    }
  }, [params, router]);

  const handleConnect = () => {
    window.location.href = "/api/seo/connect";
  };

  const handleDisconnect = async () => {
    if (!confirm("לנתק את חשבון Google? הנתונים הקיימים יישמרו אבל לא יתעדכנו.")) {
      return;
    }
    setDisconnecting(true);
    try {
      const res = await fetch("/api/seo/disconnect", { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("נותק");
      load();
    } catch {
      toast.error("שגיאה בניתוק");
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 bg-gray-800 rounded animate-pulse" />
        <div className="h-48 bg-gray-900 border border-gray-700 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold mb-2">SEO וניתוח גוגל</h2>
        <p className="text-sm text-gray-400">
          מערכת ניתוח מילים, דפים מובילים, וקישורים נכנסים — ישירות מ-Google
          Search Console ו-Google Analytics.
        </p>
      </div>

      {!status?.oauthConfigured && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-5">
          <h3 className="text-base font-bold text-yellow-300 mb-2">
            מחכה להגדרת מפתחות Google
          </h3>
          <p className="text-sm text-gray-300 leading-relaxed">
            המנהל צריך להגדיר את משתני הסביבה{" "}
            <code className="bg-gray-800 px-1.5 py-0.5 rounded text-xs">
              GOOGLE_CLIENT_ID
            </code>
            ,{" "}
            <code className="bg-gray-800 px-1.5 py-0.5 rounded text-xs">
              GOOGLE_CLIENT_SECRET
            </code>{" "}
            ו-
            <code className="bg-gray-800 px-1.5 py-0.5 rounded text-xs">
              GOOGLE_REDIRECT_URI
            </code>{" "}
            ב-Vercel. עד אז כפתור החיבור לא יעבוד.
          </p>
        </div>
      )}

      {status?.connected && status.integration ? (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/15 text-green-400 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-white">מחובר ל-Google</p>
              <p className="text-xs text-gray-400">
                {status.integration.email ?? "חשבון Google"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-800/60 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Search Console</p>
              <p className="text-gray-200">
                {status.integration.gscSiteUrl || "לא נבחר אתר עדיין"}
              </p>
            </div>
            <div className="bg-gray-800/60 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Analytics 4</p>
              <p className="text-gray-200">
                {status.integration.ga4PropertyId || "לא נבחר נכס עדיין"}
              </p>
            </div>
          </div>

          <p className="text-xs text-gray-500 leading-relaxed">
            הסנכרון הראשון של נתונים יבוצע בלילה. דפי המילים, הדפים והקישורים
            יתמלאו אוטומטית. כרגע אנחנו בשלב 1 של בניית המערכת — הצגת הנתונים
            תגיע בשלב הבא.
          </p>

          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
          >
            {disconnecting ? "מנתק..." : "נתק חשבון"}
          </button>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-5">
          <div>
            <h3 className="text-lg font-bold text-white mb-2">חבר חשבון Google</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              נחבר את החשבון שלך ל-Search Console ול-Analytics — בקריאה בלבד.
              לא נשנה כלום ולא נראה נתונים מחשבונות אחרים שלך.
            </p>
          </div>

          <ul className="space-y-2 text-sm text-gray-300">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan" />
              מילות החיפוש שמובילות אנשים לאתר שלך
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan" />
              דפים שמקבלים הכי הרבה תנועה אורגנית
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan" />
              קישורים נכנסים מאתרים חיצוניים
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan" />
              מאיפה אנשים מגיעים אליך מחוץ לגוגל
            </li>
          </ul>

          <button
            onClick={handleConnect}
            disabled={!status?.oauthConfigured}
            className="inline-flex items-center gap-2 px-5 py-3 bg-pink hover:bg-pink-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.35 11.1H12v3.2h5.35c-.5 2.4-2.6 4.1-5.35 4.1-3.25 0-5.9-2.65-5.9-5.9s2.65-5.9 5.9-5.9c1.5 0 2.85.55 3.9 1.5l2.4-2.3C16.6 4.45 14.45 3.5 12 3.5 7.05 3.5 3 7.55 3 12.5s4.05 9 9 9c5.2 0 8.65-3.65 8.65-8.8 0-.6-.05-1.1-.15-1.6z" />
            </svg>
            חבר חשבון Google
          </button>
        </div>
      )}
    </div>
  );
}
