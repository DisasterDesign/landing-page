"use client";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";

type State =
  | "loading"
  | "unsupported"
  | "denied"
  | "not-subscribed"
  | "subscribed"
  | "subscribing"
  | "unsubscribing";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushNotificationToggle() {
  const [state, setState] = useState<State>("loading");
  const [activeCount, setActiveCount] = useState(0);
  const [publicKey, setPublicKey] = useState("");
  const [configured, setConfigured] = useState(false);

  const refresh = useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }

    try {
      const res = await fetch("/api/push/status", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setConfigured(!!json.configured);
      setPublicKey(json.publicKey || "");
      setActiveCount(json.activeSubscriptions || 0);

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "subscribed" : "not-subscribed");
    } catch {
      setState("not-subscribed");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const subscribe = async () => {
    if (!configured || !publicKey) {
      toast.error("הגדרות התראות לא מוגדרות בשרת");
      return;
    }
    setState("subscribing");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("ההרשאה נדחתה");
        setState(permission === "denied" ? "denied" : "not-subscribed");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
      });

      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      if (!res.ok) throw new Error();

      toast.success("התראות הופעלו במכשיר הזה");
      await refresh();
    } catch (err) {
      console.error(err);
      toast.error("הפעלת ההתראות נכשלה");
      setState("not-subscribed");
    }
  };

  const unsubscribe = async () => {
    setState("unsubscribing");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      toast.success("התראות בוטלו במכשיר הזה");
      await refresh();
    } catch {
      toast.error("הביטול נכשל");
      setState("subscribed");
    }
  };

  const sendTest = async () => {
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("התראת בדיקה נשלחה");
    } catch {
      toast.error("שליחת ההתראה נכשלה");
    }
  };

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">התראות במסך</h3>
        {activeCount > 0 && (
          <span className="text-xs text-gray-500">
            {activeCount} מכשיר{activeCount > 1 ? "ים" : ""} רשום{activeCount > 1 ? "ים" : ""}
          </span>
        )}
      </div>
      <p className="text-sm text-gray-400 leading-relaxed">
        קבל התראות על פניות חדשות, משימות ששויכו אליך, וחתימות הסכמים — ישירות
        למסך הנעילה. ב-iPhone זה עובד רק אחרי שהתקנת את האתר כאפליקציה (Add to
        Home Screen דרך Safari).
      </p>

      {state === "unsupported" && (
        <p className="text-sm text-yellow-400">הדפדפן הזה לא תומך בהתראות push.</p>
      )}

      {state === "denied" && (
        <p className="text-sm text-yellow-400">
          ההרשאה נחסמה. פתח את הגדרות הדפדפן/האפליקציה ואפשר התראות מ-fuzionwebz.com.
        </p>
      )}

      {!configured && state !== "unsupported" && state !== "loading" && (
        <p className="text-sm text-yellow-400">
          המנהל צריך להגדיר משתני VAPID בשרת. ההתראות לא פעילות עדיין.
        </p>
      )}

      {state === "loading" && (
        <div className="h-10 bg-gray-800 rounded-xl animate-pulse" />
      )}

      <div className="flex flex-wrap gap-2">
        {(state === "not-subscribed" || state === "subscribing") && configured && (
          <button
            onClick={subscribe}
            disabled={state === "subscribing"}
            className="bg-pink hover:bg-pink-light disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors"
          >
            {state === "subscribing" ? "מפעיל…" : "הפעל התראות במכשיר הזה"}
          </button>
        )}

        {(state === "subscribed" || state === "unsubscribing") && (
          <>
            <button
              onClick={sendTest}
              className="bg-pink hover:bg-pink-light text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors"
            >
              שלח התראת בדיקה
            </button>
            <button
              onClick={unsubscribe}
              disabled={state === "unsubscribing"}
              className="border border-gray-700 hover:border-gray-600 text-gray-300 px-4 py-2 rounded-xl text-sm"
            >
              {state === "unsubscribing" ? "מבטל…" : "בטל התראות"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
