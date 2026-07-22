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
  if (prospects.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-700 bg-gray-900 p-10 text-center text-sm text-gray-500">
        עדיין לא נמצאו עסקים במחזור הזה
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-700">
      <table className="w-full min-w-[850px] text-sm">
        <thead className="bg-gray-800 text-xs text-gray-400">
          <tr>
            <th className="px-4 py-3 text-right font-medium">עסק</th>
            <th className="px-4 py-3 text-right font-medium">סטטוס אתר</th>
            <th className="px-4 py-3 text-right font-medium">דירוג</th>
            <th className="px-4 py-3 text-right font-medium">ביטחון</th>
            <th className="px-4 py-3 text-right font-medium">הזדמנות</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800 bg-gray-900">
          {prospects.map((prospect) => (
            <tr key={prospect.id} className="hover:bg-gray-800/40">
              <td className="px-4 py-3">
                <div className="font-medium text-white">{prospect.auditedDomain ?? "ללא דומיין"}</div>
                <div className="mt-1 font-mono text-[10px] text-gray-600">{prospect.placeId}</div>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
