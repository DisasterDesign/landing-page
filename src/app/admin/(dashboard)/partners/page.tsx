"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

interface PartnerRow {
  id: string;
  name: string;
  isOwner: boolean;
  model: "OWNER" | "RECURRING_SHARE" | "FIRST_MONTH";
  sharePct: number | null;
  clientCount: number;
  monthlyGross: number;
  monthlyProfit: number;
  payoutThisMonth: number;
  recurringPayout: number;
  firstMonthPayout: number;
  firstMonthPending: number;
  dealsSignedThisMonth: number;
}

interface Deal {
  id: string;
  name: string;
  monthlyPrice: number;
  signedAt: string | null;
  partnerId: string | null;
}

interface CommissionRow {
  id: string;
  sellerId: string;
  clientName: string;
  amount: number;
  status: string;
  createdAt: string;
}

interface Overview {
  month: string;
  partners: PartnerRow[];
  owner: PartnerRow | null;
  totals: {
    businessGross: number;
    businessProfit: number;
    partnerPayouts: number;
    ownerKeeps: number;
    billingClients: number;
    unattributed: number;
  };
  deals: Deal[];
  commissions: CommissionRow[];
}

const shekel = (value: number) =>
  `₪${value.toLocaleString("he-IL", { maximumFractionDigits: 0 })}`;

const MODEL_LABEL: Record<PartnerRow["model"], string> = {
  OWNER: "בעלים",
  RECURRING_SHARE: "אחוז מתמשך",
  FIRST_MONTH: "חודש ראשון",
};

function monthOptions(): Array<{ value: string; label: string }> {
  const out: Array<{ value: string; label: string }> = [];
  const now = new Date();
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("he-IL", { month: "long", year: "numeric" }),
    });
  }
  return out;
}

export default function PartnersOverviewPage() {
  const months = useMemo(monthOptions, []);
  const [month, setMonth] = useState(months[0].value);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (selected: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/partners/overview?month=${selected}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error();
      setData((await response.json()) as Overview);
    } catch {
      toast.error("שגיאה בטעינת דוח השותפים");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(month);
  }, [load, month]);

  const partnerById = useMemo(() => {
    const map = new Map<string, string>();
    for (const partner of data?.partners ?? []) map.set(partner.id, partner.name);
    if (data?.owner) map.set(data.owner.id, data.owner.name);
    return map;
  }, [data]);

  if (loading && !data) {
    return (
      <div dir="rtl" className="rounded-2xl border border-gray-700 bg-gray-900 p-12 text-center text-sm text-gray-500">
        טוען דוח שותפים...
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">שותפים — תמונה מלאה</h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-gray-500">
            מי הביא מה וכמה יוצא לכל אחד. המסך הזה גלוי לך בלבד — כל שותף רואה
            במערכת שלו רק את החלק שלו ואינו יודע על קיום האחרים.
          </p>
        </div>
        <select
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          className="rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-pink"
        >
          {months.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </header>

      {/* Bottom line first — the number that decides transfers this month */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="מגלגל החודש (ברוטו)" value={shekel(data?.totals.businessGross ?? 0)} />
        <Stat label="רווח אחרי מע״מ ועמלה" value={shekel(data?.totals.businessProfit ?? 0)} />
        <Stat
          label="יוצא לשותפים"
          value={shekel(data?.totals.partnerPayouts ?? 0)}
          tone="warn"
        />
        <Stat
          label="נשאר אצלי"
          value={shekel(data?.totals.ownerKeeps ?? 0)}
          tone="good"
        />
      </div>

      {data && data.totals.unattributed > 0 && (
        <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          {data.totals.unattributed} לקוחות מחייבים ללא שיוך לשותף — הם נספרים
          ברווח אך לא אצל אף אחד. שווה לשייך אותם בדף הלקוחות.
        </p>
      )}

      {/* Per-partner board */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-gray-300">לפי שותף</h2>
        <div className="overflow-x-auto rounded-2xl border border-gray-700 bg-gray-900">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="bg-gray-800/60 text-[11px] uppercase tracking-wider text-gray-500">
                <th className="p-3 text-right font-medium">שותף</th>
                <th className="p-3 text-right font-medium">מודל</th>
                <th className="p-3 text-right font-medium">לקוחות</th>
                <th className="p-3 text-right font-medium">מגלגל חודשי</th>
                <th className="p-3 text-right font-medium">רווח מהם</th>
                <th className="p-3 text-right font-medium">עסקאות החודש</th>
                <th className="p-3 text-right font-medium">מגיע לו החודש</th>
              </tr>
            </thead>
            <tbody>
              {data?.partners.map((partner) => (
                <tr key={partner.id} className="border-t border-gray-800">
                  <td className="p-3 font-bold text-white">{partner.name}</td>
                  <td className="p-3">
                    <span
                      className={`rounded-lg px-2 py-1 text-[11px] font-bold ${
                        partner.model === "RECURRING_SHARE"
                          ? "bg-cyan/10 text-cyan"
                          : "bg-gray-800 text-gray-400"
                      }`}
                    >
                      {MODEL_LABEL[partner.model]}
                      {partner.sharePct != null ? ` · ${partner.sharePct}%` : ""}
                    </span>
                  </td>
                  <td className="p-3 font-mono tabular-nums text-gray-300">
                    {partner.clientCount}
                  </td>
                  <td className="p-3 font-mono tabular-nums text-gray-300">
                    {shekel(partner.monthlyGross)}
                  </td>
                  <td className="p-3 font-mono tabular-nums text-gray-300">
                    {shekel(partner.monthlyProfit)}
                  </td>
                  <td className="p-3 font-mono tabular-nums text-gray-300">
                    {partner.dealsSignedThisMonth}
                  </td>
                  <td className="p-3">
                    <span className="font-mono text-base font-bold tabular-nums text-pink">
                      {shekel(partner.payoutThisMonth)}
                    </span>
                    {partner.firstMonthPending > 0 && (
                      <span className="mt-0.5 block text-[11px] text-amber-300">
                        {shekel(partner.firstMonthPending)} טרם שולם
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {data?.owner && (
                <tr className="border-t-2 border-gray-700 bg-gray-800/40">
                  <td className="p-3 font-bold text-white">
                    {data.owner.name}
                    <span className="mr-2 rounded-lg bg-pink/15 px-2 py-0.5 text-[10px] font-bold text-pink">
                      בעלים
                    </span>
                  </td>
                  <td className="p-3 text-[11px] text-gray-500">ללא חלוקה</td>
                  <td className="p-3 font-mono tabular-nums text-gray-300">
                    {data.owner.clientCount}
                  </td>
                  <td className="p-3 font-mono tabular-nums text-gray-300">
                    {shekel(data.owner.monthlyGross)}
                  </td>
                  <td className="p-3 font-mono tabular-nums text-gray-300">
                    {shekel(data.owner.monthlyProfit)}
                  </td>
                  <td className="p-3 font-mono tabular-nums text-gray-300">
                    {data.owner.dealsSignedThisMonth}
                  </td>
                  <td className="p-3">
                    <span className="font-mono text-base font-bold tabular-nums text-green-400">
                      {shekel(data.totals.ownerKeeps)}
                    </span>
                    {/* The owner's number is a remainder, not a share of his
                        own clients — without this it reads as unexplained
                        next to his ₪0 columns. */}
                    <span className="mt-0.5 block text-[11px] text-gray-500">
                      יתרת הרווח אחרי תשלום לשותפים
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Deals closed in the selected month */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-gray-300">
          עסקאות שנחתמו החודש ({data?.deals.length ?? 0})
        </h2>
        {data && data.deals.length === 0 ? (
          <p className="rounded-2xl border border-gray-700 bg-gray-900 p-8 text-center text-sm text-gray-500">
            לא נחתמו עסקאות בחודש הזה.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-700 bg-gray-900">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="bg-gray-800/60 text-[11px] uppercase tracking-wider text-gray-500">
                  <th className="p-3 text-right font-medium">לקוח</th>
                  <th className="p-3 text-right font-medium">מי סגר</th>
                  <th className="p-3 text-right font-medium">חודשי</th>
                  <th className="p-3 text-right font-medium">נחתם</th>
                </tr>
              </thead>
              <tbody>
                {data?.deals.map((deal) => (
                  <tr key={deal.id} className="border-t border-gray-800">
                    <td className="p-3 font-bold text-white">{deal.name}</td>
                    <td className="p-3 text-gray-300">
                      {deal.partnerId
                        ? partnerById.get(deal.partnerId) ?? "—"
                        : "—"}
                    </td>
                    <td className="p-3 font-mono tabular-nums text-gray-300">
                      {shekel(deal.monthlyPrice)}
                    </td>
                    <td className="p-3 font-mono tabular-nums text-gray-500">
                      {deal.signedAt
                        ? new Date(deal.signedAt).toLocaleDateString("he-IL")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn";
}) {
  const valueClass =
    tone === "good"
      ? "text-green-400"
      : tone === "warn"
        ? "text-amber-300"
        : "text-white";
  return (
    <div className="rounded-2xl border border-gray-700 bg-gray-900 p-4">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-bold tabular-nums ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}
