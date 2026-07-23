"use client";

import Link from "next/link";
import toast from "react-hot-toast";

import type { ProspectView } from "./types";

const websiteLabels: Record<string, string> = {
  NO_WEBSITE: "אין אתר",
  SOCIAL_ONLY: "רשת חברתית בלבד",
  PARKED: "דומיין חונה",
  UNREACHABLE: "לא נגיש",
  ACTIVE: "אתר פעיל",
  BLOCKED: "חסום לבדיקה",
  UNKNOWN: "לא ידוע",
};

export default function ProspectTable({ prospects }: { prospects: ProspectView[] }) {
  function copyPhone(phone: string) {
    if (!navigator.clipboard?.writeText) {
      toast.error("העתקה אוטומטית אינה זמינה");
      return;
    }
    void navigator.clipboard
      .writeText(phone)
      .then(() => toast.success("הטלפון הועתק"))
      .catch(() => toast.error("ההעתקה נכשלה"));
  }

  if (prospects.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-700 bg-gray-900 p-10 text-center text-sm text-gray-500">
        עדיין לא נמצאו עסקים במחזור הזה
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-700">
      <table className="w-full min-w-[1180px] text-sm">
        <thead className="bg-gray-800 text-xs text-gray-400">
          <tr>
            <th className="px-4 py-3 text-right font-medium">עסק</th>
            <th className="px-4 py-3 text-right font-medium">טלפון ציבורי</th>
            <th className="px-4 py-3 text-right font-medium">אתרים</th>
            <th className="px-4 py-3 text-right font-medium">סטטוס אתר</th>
            <th className="px-4 py-3 text-right font-medium">דירוג</th>
            <th className="px-4 py-3 text-right font-medium">ביטחון</th>
            <th className="px-4 py-3 text-right font-medium">הזדמנות</th>
            <th className="px-4 py-3 text-right font-medium">פעולות</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800 bg-gray-900">
          {prospects.map((prospect) => (
            <tr key={prospect.id} className="hover:bg-gray-800/40">
              <td className="px-4 py-3">
                <div className="font-medium text-white">
                  {prospect.business.displayName}
                </div>
                {prospect.business.address && (
                  <div className="mt-1 max-w-52 text-[10px] text-gray-500">
                    {prospect.business.address}
                  </div>
                )}
              </td>
              <td className="px-4 py-3">
                {prospect.liveStatus === "UNAVAILABLE" ? (
                  <span className="text-xs text-amber-300">
                    מידע חי לא זמין זמנית
                  </span>
                ) : prospect.liveStatus === "NO_PHONE" ? (
                  <span className="text-xs text-gray-500">אין טלפון ציבורי</span>
                ) : prospect.business.phone ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`tel:${prospect.business.phone.replace(/[^+\d]/g, "")}`}
                      className="font-bold text-cyan hover:underline"
                    >
                      <bdi dir="ltr">{prospect.business.phone}</bdi>
                    </a>
                    <button
                      type="button"
                      onClick={() => copyPhone(prospect.business.phone!)}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      העתק
                    </button>
                  </div>
                ) : null}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col items-start gap-1.5 text-xs">
                  {prospect.business.auditedWebsite ? (
                    <a
                      href={prospect.business.auditedWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-cyan hover:underline"
                    >
                      האתר שנבדק / הישן ↗
                    </a>
                  ) : (
                    <span className="text-gray-500">אין אתר מאובחן</span>
                  )}
                  {prospect.business.liveWebsite &&
                    prospect.business.liveWebsite !==
                      prospect.business.auditedWebsite && (
                      <a
                        href={prospect.business.liveWebsite}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-300 hover:text-white hover:underline"
                      >
                        האתר הציבורי ב־Google ↗
                      </a>
                    )}
                </div>
              </td>
              <td className="px-4 py-3 text-gray-300">
                {websiteLabels[prospect.websiteStatus] ?? prospect.websiteStatus}
              </td>
              <td className="px-4 py-3">
                {prospect.qualityScore === null ? (
                  <span className="text-gray-600">—</span>
                ) : (
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-pink/15 font-bold text-pink">
                    {prospect.qualityScore}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-gray-400">
                {prospect.auditConfidence === null
                  ? "—"
                  : `${Math.round(prospect.auditConfidence * 100)}%`}
              </td>
              <td className="max-w-md px-4 py-3 text-xs leading-5 text-gray-400">
                {prospect.opportunitySummary ?? prospect.status}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col items-start gap-2 text-xs">
                  <a
                    href={prospect.business.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-cyan hover:underline"
                  >
                    Google Maps ↗
                  </a>
                  {prospect.promotedLeadId ? (
                    <Link
                      href={`/admin/leads/${prospect.promotedLeadId}`}
                      className="rounded-xl bg-cyan/20 px-3 py-2 font-bold text-cyan"
                    >
                      פתח ליד
                    </Link>
                  ) : (
                    <span className="text-gray-500">טרם פורסם כליד</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
