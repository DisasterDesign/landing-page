"use client";

import type { LeadMetrics as LeadMetricsData } from "@/lib/leads/analytics";

const funnelRows: Array<{
  key: keyof Pick<
    LeadMetricsData,
    | "created"
    | "claimed"
    | "contacted"
    | "decisionMakerReached"
    | "qualified"
    | "agreementCreated"
    | "agreementSent"
    | "agreementSigned"
    | "paid"
  >;
  label: string;
}> = [
  { key: "created", label: "נוצרו" },
  { key: "claimed", label: "נלקחו" },
  { key: "contacted", label: "נוצר קשר" },
  { key: "decisionMakerReached", label: "מקבל/ת החלטה" },
  { key: "qualified", label: "מוסמכים" },
  { key: "agreementCreated", label: "הסכם נוצר" },
  { key: "agreementSent", label: "הסכם נשלח" },
  { key: "agreementSigned", label: "הסכם נחתם" },
  { key: "paid", label: "שולמו" },
];

function percent(value: number) {
  return new Intl.NumberFormat("he-IL", { style: "percent", maximumFractionDigits: 0 }).format(value);
}

function amount(value: number) {
  return `${new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 }).format(value)} ₪`;
}

function SummaryCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="rounded-2xl border border-gray-700 bg-gray-900 p-4">
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span className={`h-2 w-2 rounded-full ${accent}`} />
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

export default function LeadMetrics({ metrics }: { metrics: LeadMetricsData | null }) {
  if (!metrics) {
    return (
      <section className="animate-pulse rounded-2xl border border-gray-700 bg-gray-900 p-5">
        <div className="h-5 w-40 rounded bg-gray-800" />
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <div className="h-20 rounded-xl bg-gray-800" key={item} />)}
        </div>
      </section>
    );
  }

  return (
    <section dir="rtl" className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="סה״כ נכנסו (בטווח הנבחר)" value={metrics.created} accent="bg-pink-500" />
        <SummaryCard label="שיעור תשלום" value={percent(metrics.rates.paid)} accent="bg-green-500" />
        <SummaryCard label="הכנסה ראשונה" value={amount(metrics.revenue)} accent="bg-cyan" />
        <SummaryCard label="גודל עסקה ממוצע" value={amount(metrics.averageDealSize)} accent="bg-amber-500" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-gray-700 bg-gray-900">
        <div className="border-b border-gray-800 px-5 py-4">
          <h2 className="font-bold text-white">משפך המרות</h2>
          <p className="mt-1 text-xs text-gray-500">
            חציון לקיחת ליד: {metrics.timeToClaimMedianMinutes ?? "—"} דק׳ · חציון קשר: {metrics.timeToContactMedianMinutes ?? "—"} דק׳
          </p>
        </div>
        <div className="divide-y divide-gray-800">
          {funnelRows.map(({ key, label }) => (
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-2.5 text-sm" key={key}>
              <span className="text-gray-300">{label}</span>
              <span className="font-bold text-white">{metrics[key]}</span>
              <span className="w-12 text-left text-xs text-gray-500">
                {key === "created" ? "100%" : percent(metrics.rates[key])}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
