"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { confirmDanger } from "@/lib/confirm";

interface ConnectedIntegration {
  id: string;
  pageId: string;
  pageName: string;
  subscribedAt: string | null;
  createdAt: string;
}

interface StatusResponse {
  oauthConfigured: boolean;
  integrations: ConnectedIntegration[];
  recentLeadCount: number;
}

interface AvailablePage {
  id: string;
  name: string;
}

export default function FacebookIntegrationPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerPages, setPickerPages] = useState<AvailablePage[] | null>(null);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/facebook/status", { cache: "no-store" });
      if (!res.ok) throw new Error();
      setStatus(await res.json());
    } catch {
      toast.error("שגיאה בטעינת המצב");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPickerPages = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/facebook/pages", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setPickerPages(json.pages ?? []);
    } catch {
      toast.error("שגיאה בטעינת רשימת דפים");
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (params.get("step") === "pick-page") {
      loadPickerPages();
    }
    const err = params.get("error");
    if (err) {
      const msg =
        err === "scope_missing"
          ? "חסרות הרשאות. אשר את כל ה-checkboxes בקונסנט של Facebook."
          : `שגיאת חיבור: ${err}`;
      toast.error(msg, { duration: 8000 });
      router.replace("/admin/integrations/facebook");
    }
  }, [params, loadPickerPages, router]);

  const startConnect = () => {
    window.location.href = "/api/integrations/facebook/connect";
  };

  const subscribePage = async (pageId: string) => {
    setSubscribing(pageId);
    try {
      const res = await fetch("/api/integrations/facebook/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "subscribe failed");
      toast.success("ה-Page חובר וירשם ל-leadgen");
      setPickerPages(null);
      router.replace("/admin/integrations/facebook");
      await loadStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setSubscribing(null);
    }
  };

  const disconnect = async (pageId: string, pageName: string) => {
    const ok = await confirmDanger({
      title: `ניתוק ${pageName}`,
      message: "לידים שכבר התקבלו יישמרו במערכת, אבל לא יתקבלו לידים חדשים מה-Page הזה. ניתן יהיה לחבר מחדש בכל עת.",
      confirmLabel: "נתק",
      dangerous: true,
    });
    if (!ok) return;
    setDisconnecting(pageId);
    try {
      const res = await fetch("/api/integrations/facebook/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId }),
      });
      if (!res.ok) throw new Error();
      toast.success("נותק");
      await loadStatus();
    } catch {
      toast.error("שגיאה בניתוק");
    } finally {
      setDisconnecting(null);
    }
  };

  const syncHistoricalLeads = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/integrations/facebook/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "sync failed");
      toast.success(
        `סנכרון הושלם: ${json.created} חדשים, ${json.updated} עודכנו, ${json.skipped} דולגו (מתוך ${json.total})`,
        { duration: 8000 }
      );
      await loadStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בסנכרון");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 bg-gray-800 rounded animate-pulse" />
        <div className="h-48 bg-gray-900 border border-gray-700 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold mb-2">📘 Facebook Lead Ads</h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          לידים מקמפיינים בפייסבוק יזרמו אוטומטית למסך{" "}
          <a href="/admin/leads" className="text-cyan hover:underline">
            לידים
          </a>{" "}
          עם תיוג 📘 Facebook. בלי Zapier, בלי תשלום.
        </p>
      </div>

      {!status?.oauthConfigured && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-5">
          <h3 className="text-base font-bold text-yellow-300 mb-2">מחכה להגדרת מפתחות Meta</h3>
          <p className="text-sm text-gray-300 leading-relaxed">
            המנהל צריך להגדיר את משתני הסביבה{" "}
            <code className="bg-gray-800 px-1.5 py-0.5 rounded text-xs">META_APP_ID</code>,{" "}
            <code className="bg-gray-800 px-1.5 py-0.5 rounded text-xs">META_APP_SECRET</code>,{" "}
            <code className="bg-gray-800 px-1.5 py-0.5 rounded text-xs">META_REDIRECT_URI</code>{" "}
            ו-<code className="bg-gray-800 px-1.5 py-0.5 rounded text-xs">META_WEBHOOK_VERIFY_TOKEN</code>{" "}
            ב-Vercel. ראה{" "}
            <a href="/docs/FACEBOOK_LEADS_ARCHITECTURE.md" className="text-cyan hover:underline">
              docs/FACEBOOK_LEADS_ARCHITECTURE.md
            </a>{" "}
            להוראות מלאות.
          </p>
        </div>
      )}

      {/* Page picker after OAuth */}
      {pickerPages !== null && (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-3">
          <h3 className="text-lg font-bold">בחר Page לחיבור</h3>
          {pickerPages.length === 0 ? (
            <p className="text-sm text-gray-400">
              לא מצאנו Pages שאתה אדמין שלהם. ודא שאתה Admin של ה-Page בפייסבוק וחבר שוב.
            </p>
          ) : (
            <div className="space-y-2">
              {pickerPages.map((p) => (
                <button
                  key={p.id}
                  onClick={() => subscribePage(p.id)}
                  disabled={subscribing === p.id}
                  className="w-full flex items-center justify-between bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-xl p-4 text-right transition-colors"
                >
                  <span>
                    <span className="font-bold text-white block">{p.name}</span>
                    <span className="text-xs text-gray-500">ID: {p.id}</span>
                  </span>
                  <span className="text-xs text-pink font-bold">
                    {subscribing === p.id ? "מחבר…" : "חבר ←"}
                  </span>
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setPickerPages(null)}
            className="text-xs text-gray-500 hover:text-white"
          >
            ביטול
          </button>
        </div>
      )}

      {/* Connected pages */}
      {pickerPages === null && status && status.integrations.length > 0 && (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Pages מחוברים</h3>
            <span className="text-xs text-gray-500">
              {status.recentLeadCount} לידים ב-7 ימים אחרונים
            </span>
          </div>
          <div className="space-y-2">
            {status.integrations.map((integ) => (
              <div
                key={integ.id}
                className="flex items-center justify-between bg-gray-800/60 rounded-xl p-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-white">{integ.pageName}</p>
                    {integ.subscribedAt && (
                      <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold">
                        ✓ פעיל
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">ID: {integ.pageId}</p>
                </div>
                <button
                  onClick={() => disconnect(integ.pageId, integ.pageName)}
                  disabled={disconnecting === integ.pageId}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  {disconnecting === integ.pageId ? "מנתק…" : "ניתוק"}
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={startConnect}
              disabled={!status.oauthConfigured}
              className="text-xs text-cyan hover:underline disabled:opacity-50"
            >
              + חבר Page נוסף
            </button>
            <button
              onClick={syncHistoricalLeads}
              disabled={syncing}
              className="text-xs text-pink hover:underline disabled:opacity-50"
            >
              {syncing ? "מסנכרן…" : "🔄 סנכרן לידים ישנים"}
            </button>
          </div>
        </div>
      )}

      {/* Initial connect */}
      {pickerPages === null && status && status.integrations.length === 0 && (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-5">
          <div>
            <h3 className="text-lg font-bold text-white mb-2">חבר את ה-Page של פייסבוק</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              לחיצה תפתח את מסך ההסכמה של פייסבוק. תצטרך לאשר 5 הרשאות ולבחור איזה Page לחבר.
            </p>
          </div>
          <ul className="space-y-2 text-sm text-gray-300">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan" />
              לידים real-time — מופיעים תוך שניות
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan" />
              דדופ אוטומטי — Meta לא יכפיל לידים
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan" />
              שמירת form/campaign IDs לטרקינג ROI
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan" />
              נוטיפיקציה לכל ליד חדש
            </li>
          </ul>
          <button
            onClick={startConnect}
            disabled={!status.oauthConfigured}
            className="inline-flex items-center gap-2 px-5 py-3 bg-pink hover:bg-pink-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.91h-2.33V22c4.78-.76 8.43-4.92 8.43-9.94z" />
            </svg>
            חבר Facebook
          </button>
        </div>
      )}
    </div>
  );
}
