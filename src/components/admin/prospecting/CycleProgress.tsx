import type { ProspectingCycleView } from "./types";

const statusLabels: Record<string, string> = {
  PROPOSING: "מכין הצעת אזור",
  AWAITING_APPROVAL: "ממתין לאישור",
  DISCOVERY_QUEUED: "ממתין לסריקה",
  DISCOVERING: "מאתר עסקים",
  AUDITING: "בודק אתרים",
  READY: "מוכן לפרסום",
  PUBLISHED: "פורסם למוכר",
  FAILED: "נכשל",
  CANCELLED: "בוטל",
};

export default function CycleProgress({ cycle }: { cycle: ProspectingCycleView }) {
  const counts = cycle.prospectCounts ?? {};
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const ready = (counts.READY ?? 0) + (counts.PUBLISHED ?? 0);

  return (
    <section className="rounded-2xl border border-gray-700 bg-gray-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-white">
            שבוע {new Date(cycle.weekStart).toLocaleDateString("he-IL")}
            {cycle.revision > 1 ? ` · גרסה ${cycle.revision}` : ""}
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            {cycle.supersededAt
              ? `הוחלף · ${cycle.supersededReason ?? "נוצרה רשימה חדשה"}`
              : (statusLabels[cycle.status] ?? cycle.status)}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            cycle.status === "FAILED"
              ? "bg-red-500/15 text-red-300"
              : cycle.status === "PUBLISHED"
                ? "bg-green-500/15 text-green-300"
                : "bg-cyan/10 text-cyan"
          }`}
        >
          {ready}/{cycle.targetCount} מוכנים
        </span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-800">
        <div
          className="h-full rounded-full bg-gradient-to-l from-pink to-cyan transition-all"
          style={{ width: `${Math.min(100, (ready / Math.max(cycle.targetCount, 1)) * 100)}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs md:grid-cols-5">
        <Metric label="עסקים שנמצאו" value={total} />
        <Metric label="חיפושי Places" value={cycle.placesSearchCalls} />
        <Metric label="בדיקות PageSpeed" value={cycle.pageSpeedCalls} />
        <Metric label="בדיקות AI" value={cycle.aiCalls} />
        <Metric label="עלות מוערכת" value={`$${cycle.estimatedCostUsd.toFixed(2)}`} />
      </div>
      {cycle.lastError && (
        <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
          {cycle.lastError}
        </p>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-gray-800/70 p-3">
      <div className="text-gray-500">{label}</div>
      <div className="mt-1 text-base font-bold text-white">{value}</div>
    </div>
  );
}
