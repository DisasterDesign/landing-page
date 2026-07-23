"use client";

import Link from "next/link";
import toast from "react-hot-toast";

import LeadSourceBadge from "@/components/leads/LeadSourceBadge";
import type { LeadDetail } from "@/lib/leads/projection";

export default function LeadTable({ leads }: { leads: LeadDetail[] }) {
  function copyPhone(phone: string) {
    if (!navigator.clipboard?.writeText) {
      toast.error("העתקה אוטומטית אינה זמינה");
      return;
    }
    void navigator.clipboard
      .writeText(phone)
      .then(() => toast.success("הועתק"))
      .catch(() => toast.error("ההעתקה נכשלה"));
  }

  if (leads.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-700 bg-gray-900 p-12 text-center text-sm text-gray-500">
        אין לידים שמתאימים למסננים.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-700">
      <table className="w-full min-w-[1050px] text-sm">
        <thead className="bg-gray-800 text-xs text-gray-400">
          <tr>
            <th className="px-4 py-3 text-right font-medium">ליד ומקור</th>
            <th className="px-4 py-3 text-right font-medium">בעלות</th>
            <th className="px-4 py-3 text-right font-medium">שלב</th>
            <th className="px-4 py-3 text-right font-medium">פעולה הבאה</th>
            <th className="px-4 py-3 text-right font-medium">פרטי קשר</th>
            <th className="px-4 py-3 text-right font-medium">פעילות</th>
            <th className="px-4 py-3 text-right font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800 bg-gray-900">
          {leads.map((lead) => (
            <tr key={lead.id} className="hover:bg-gray-800/40">
              <td className="px-4 py-3">
                <div className="font-bold text-white">
                  {lead.company ?? lead.name ?? "ליד ללא שם"}
                </div>
                <div className="mt-2">
                  <LeadSourceBadge
                    intentLevel={lead.intentLevel}
                    sourceKey={lead.sourceKey}
                    sourceLabel={lead.sourceLabel}
                    sourceContext={lead.sourceContext}
                  />
                </div>
              </td>
              <td className="px-4 py-3 text-gray-300">
                {lead.owner?.name ??
                  (lead.eligibleSeller?.name
                    ? `ממתין ל־${lead.eligibleSeller.name}`
                    : "ללא בעלים")}
              </td>
              <td className="px-4 py-3">
                {lead.migrationReviewRequired ? (
                  <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs font-bold text-amber-200">
                    דורש סיווג
                  </span>
                ) : (
                  <span className="rounded-full bg-pink/15 px-2.5 py-1 text-xs font-bold text-pink">
                    {lead.stage}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-gray-300">
                {lead.nextAction.kind}
                {lead.nextFollowUpAt && (
                  <time className="mt-1 block text-xs text-gray-500">
                    {new Date(lead.nextFollowUpAt).toLocaleString("he-IL")}
                  </time>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {lead.phone && (
                    <>
                      <a
                        href={`tel:${lead.phone.replace(/[^+\d]/g, "")}`}
                        className="font-bold text-cyan"
                      >
                        <bdi dir="ltr">{lead.phone}</bdi>
                      </a>
                      <button
                        type="button"
                        onClick={() => copyPhone(lead.phone!)}
                        className="text-xs text-gray-400 hover:text-white"
                      >
                        העתק
                      </button>
                    </>
                  )}
                  {lead.website && (
                    <a
                      href={lead.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-cyan hover:underline"
                    >
                      אתר ↗
                    </a>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">
                {new Date(lead.lastActivityAt).toLocaleString("he-IL")}
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/admin/leads/${lead.id}`}
                  className="rounded-xl bg-cyan/20 px-3 py-2 text-xs font-bold text-cyan"
                >
                  פתח ליד
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
