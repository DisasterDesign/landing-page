"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

type Tier = "LANDING" | "BASIC" | "ADVANCED" | "PREMIUM";
type AgreementStatus = "DRAFT" | "SENT" | "SIGNED" | "CANCELLED";
type PaymentStatus =
  | "PENDING"
  | "SENT"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";
type LeadStage =
  | "NEW"
  | "PREPARING"
  | "CONTACTING"
  | "QUALIFIED"
  | "AGREEMENT_DRAFT"
  | "AGREEMENT_SENT"
  | "AGREEMENT_SIGNED"
  | "WON"
  | "LOST"
  | "SPAM";

interface ProductRow {
  id: string;
  name: string;
  monthlyAmount: number | null;
  lane: string | null;
  status: string;
}

interface ClientRow {
  id: string;
  number: number;
  name: string;
  businessName: string | null;
  status: string;
  monthlyAmount: number;
  monthlyGross: number;
  monthlyProfit: number;
  vatExempt: boolean;
  startDate: string | null;
  paymentDate: string | null;
  products: ProductRow[];
}

interface AgreementRow {
  id: string;
  customerName: string;
  businessName: string | null;
  tier: Tier | null;
  monthlyPrice: number;
  oneTimeFee: number | null;
  status: AgreementStatus;
  paymentStatus: PaymentStatus;
  signedAt: string | null;
  createdAt: string;
}

interface CommissionRow {
  id: string;
  clientName: string;
  amount: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
}

interface PartnerDetail {
  month: string;
  partner: {
    id: string;
    name: string;
    username: string | null;
    isOwner: boolean;
    model: "OWNER" | "RECURRING_SHARE" | "FIRST_MONTH";
    sharePct: number | null;
  };
  money: {
    monthlyGross: number;
    monthlyProfit: number;
    recurringPayout: number;
    firstMonthPayout: number;
    firstMonthPending: number;
    payout: number;
  };
  counts: {
    clients: number;
    billingClients: number;
    agreements: number;
    signedAgreements: number;
    signedThisMonth: number;
    leads: number;
  };
  clients: ClientRow[];
  agreements: AgreementRow[];
  leads: Array<{ stage: LeadStage; count: number }>;
  commissions: CommissionRow[];
}

const shekel = (value: number) =>
  `₪${value.toLocaleString("he-IL", { maximumFractionDigits: 0 })}`;

const MODEL_LABEL: Record<PartnerDetail["partner"]["model"], string> = {
  OWNER: "בעלים",
  RECURRING_SHARE: "אחוז מתמשך",
  FIRST_MONTH: "חודש ראשון",
};

const TIER_LABEL: Record<Tier, string> = {
  LANDING: "דף נחיתה",
  BASIC: "בסיס",
  ADVANCED: "מתקדם",
  PREMIUM: "פרימיום",
};

const STATUS_LABEL: Record<AgreementStatus, string> = {
  DRAFT: "טיוטה",
  SENT: "נשלח",
  SIGNED: "נחתם",
  CANCELLED: "בוטל",
};

const STATUS_CLASS: Record<AgreementStatus, string> = {
  DRAFT: "bg-gray-800 text-gray-400",
  SENT: "bg-cyan/10 text-cyan",
  SIGNED: "bg-green-500/10 text-green-400",
  CANCELLED: "bg-red-500/10 text-red-400",
};

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  PENDING: "טרם נשלח",
  SENT: "נשלח לתשלום",
  COMPLETED: "שולם",
  FAILED: "נכשל",
  CANCELLED: "בוטל",
};

const STAGE_LABEL: Record<LeadStage, string> = {
  NEW: "חדש",
  PREPARING: "בהכנה",
  CONTACTING: "בשיחה",
  QUALIFIED: "מוכשר",
  AGREEMENT_DRAFT: "טיוטת הסכם",
  AGREEMENT_SENT: "הסכם נשלח",
  AGREEMENT_SIGNED: "הסכם נחתם",
  WON: "נסגר",
  LOST: "אבוד",
  SPAM: "ספאם",
};

const COMMISSION_LABEL: Record<string, string> = {
  PENDING: "ממתין",
  PAID: "שולם",
  CANCELLED: "בוטל",
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

const date = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("he-IL") : "—";

export default function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const months = useMemo(monthOptions, []);
  const [month, setMonth] = useState(months[0].value);
  const [data, setData] = useState<PartnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(
    async (selected: string) => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/partners/${id}?month=${selected}`,
          { cache: "no-store" },
        );
        if (response.status === 404) {
          setNotFound(true);
          setData(null);
          return;
        }
        if (!response.ok) throw new Error();
        setNotFound(false);
        setData((await response.json()) as PartnerDetail);
      } catch {
        toast.error("שגיאה בטעינת נתוני השותף");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    void load(month);
  }, [load, month]);

  if (notFound) {
    return (
      <div
        dir="rtl"
        className="rounded-2xl border border-gray-700 bg-gray-900 p-12 text-center"
      >
        <p className="text-sm text-gray-400">השותף לא נמצא.</p>
        <Link
          href="/admin/partners"
          className="mt-3 inline-block text-sm text-pink hover:underline"
        >
          חזרה ללוח השותפים
        </Link>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div
        dir="rtl"
        className="rounded-2xl border border-gray-700 bg-gray-900 p-12 text-center text-sm text-gray-500"
      >
        טוען נתוני שותף...
      </div>
    );
  }

  const partner = data?.partner;
  const isRecurring = partner?.model === "RECURRING_SHARE";

  return (
    <div dir="rtl" className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/admin/partners"
            className="text-xs text-gray-500 hover:text-pink"
          >
            ← לוח השותפים
          </Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-bold text-white">
            {partner?.name ?? "שותף"}
            {partner && (
              <span
                className={`rounded-lg px-2 py-1 text-[11px] font-bold ${
                  partner.model === "RECURRING_SHARE"
                    ? "bg-cyan/10 text-cyan"
                    : partner.model === "OWNER"
                      ? "bg-pink/15 text-pink"
                      : "bg-gray-800 text-gray-400"
                }`}
              >
                {MODEL_LABEL[partner.model]}
                {partner.sharePct != null ? ` · ${partner.sharePct}%` : ""}
              </span>
            )}
          </h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-gray-500">
            כל מה שהשותף הזה הביא — לקוחות, חוזים, לידים ועמלות. השיוך נקבע
            לפי השותף שרשום על העסקה, לא לפי מי הקליד אותה במערכת.
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="לקוחות"
          value={String(data?.counts.clients ?? 0)}
          hint={`${data?.counts.billingClients ?? 0} מחייבים`}
        />
        <Stat
          label="מגלגל חודשי (ברוטו)"
          value={shekel(data?.money.monthlyGross ?? 0)}
        />
        <Stat
          label="רווח אחרי מע״מ ועמלה"
          value={shekel(data?.money.monthlyProfit ?? 0)}
        />
        <Stat
          label="מגיע לו החודש"
          value={shekel(data?.money.payout ?? 0)}
          tone="pink"
          hint={
            partner?.model === "OWNER"
              ? "בעלים — ללא חלוקה"
              : isRecurring
                ? `${partner?.sharePct ?? 0}% מהרווח החודשי`
                : (data?.money.firstMonthPending ?? 0) > 0
                  ? `${shekel(data?.money.firstMonthPending ?? 0)} טרם שולם`
                  : "עמלות חודש ראשון"
          }
        />
      </div>

      {/* Leads pipeline — a thin strip, not a table; it is context for the
          numbers above, not a work surface. */}
      {data && data.leads.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-gray-300">
            לידים ({data.counts.leads})
          </h2>
          <div className="flex flex-wrap gap-2 rounded-2xl border border-gray-700 bg-gray-900 p-4">
            {data.leads.map((row) => (
              <span
                key={row.stage}
                className="rounded-xl border border-gray-700 bg-gray-800/60 px-3 py-1.5 text-xs text-gray-300"
              >
                {STAGE_LABEL[row.stage] ?? row.stage}
                <span className="mr-2 font-mono font-bold tabular-nums text-white">
                  {row.count}
                </span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Clients */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-gray-300">
          לקוחות ({data?.counts.clients ?? 0})
        </h2>
        {data && data.clients.length === 0 ? (
          <p className="rounded-2xl border border-gray-700 bg-gray-900 p-8 text-center text-sm text-gray-500">
            אין לקוחות משויכים לשותף הזה.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-700 bg-gray-900">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="bg-gray-800/60 text-[11px] uppercase tracking-wider text-gray-500">
                  <th className="p-3 text-right font-medium">לקוח</th>
                  <th className="p-3 text-right font-medium">סטטוס</th>
                  <th className="p-3 text-right font-medium">מוצרים</th>
                  <th className="p-3 text-right font-medium">חודשי</th>
                  <th className="p-3 text-right font-medium">רווח חודשי</th>
                  <th className="p-3 text-right font-medium">התחלה</th>
                </tr>
              </thead>
              <tbody>
                {data?.clients.map((client) => (
                  <tr key={client.id} className="border-t border-gray-800">
                    <td className="p-3">
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="font-bold text-white hover:text-pink"
                      >
                        {client.name}
                      </Link>
                      {client.businessName &&
                        client.businessName !== client.name && (
                          <span className="mt-0.5 block text-[11px] text-gray-500">
                            {client.businessName}
                          </span>
                        )}
                    </td>
                    <td className="p-3">
                      <span className="rounded-lg bg-gray-800 px-2 py-1 text-[11px] text-gray-300">
                        {client.status || "—"}
                      </span>
                      {client.vatExempt && (
                        <span className="mr-1 rounded-lg bg-amber-400/10 px-2 py-1 text-[11px] text-amber-300">
                          פטור מע״מ
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-[11px] text-gray-400">
                      {client.products.length === 0
                        ? "—"
                        : client.products
                            .map((product) => product.name)
                            .join(" · ")}
                    </td>
                    <td className="p-3 font-mono tabular-nums text-gray-300">
                      {shekel(client.monthlyAmount)}
                    </td>
                    <td className="p-3 font-mono tabular-nums text-gray-300">
                      {client.monthlyProfit > 0
                        ? shekel(client.monthlyProfit)
                        : "—"}
                    </td>
                    <td className="p-3 font-mono tabular-nums text-gray-500">
                      {date(client.startDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Agreements */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-gray-300">
          חוזים ({data?.counts.agreements ?? 0})
          {data && data.counts.signedThisMonth > 0 && (
            <span className="mr-2 text-[11px] font-medium text-gray-500">
              {data.counts.signedThisMonth} נחתמו בחודש הנבחר
            </span>
          )}
        </h2>
        {data && data.agreements.length === 0 ? (
          <p className="rounded-2xl border border-gray-700 bg-gray-900 p-8 text-center text-sm text-gray-500">
            אין חוזים משויכים לשותף הזה.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-700 bg-gray-900">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="bg-gray-800/60 text-[11px] uppercase tracking-wider text-gray-500">
                  <th className="p-3 text-right font-medium">לקוח</th>
                  <th className="p-3 text-right font-medium">חבילה</th>
                  <th className="p-3 text-right font-medium">חודשי</th>
                  <th className="p-3 text-right font-medium">סטטוס</th>
                  <th className="p-3 text-right font-medium">תשלום</th>
                  <th className="p-3 text-right font-medium">נחתם</th>
                  <th className="p-3 text-right font-medium">נוצר</th>
                </tr>
              </thead>
              <tbody>
                {data?.agreements.map((agreement) => (
                  <tr key={agreement.id} className="border-t border-gray-800">
                    <td className="p-3">
                      <span className="font-bold text-white">
                        {agreement.businessName || agreement.customerName}
                      </span>
                      {agreement.businessName &&
                        agreement.businessName !== agreement.customerName && (
                          <span className="mt-0.5 block text-[11px] text-gray-500">
                            {agreement.customerName}
                          </span>
                        )}
                    </td>
                    <td className="p-3 text-[11px] text-gray-400">
                      {agreement.tier ? TIER_LABEL[agreement.tier] : "מותאם"}
                    </td>
                    <td className="p-3 font-mono tabular-nums text-gray-300">
                      {shekel(agreement.monthlyPrice)}
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-lg px-2 py-1 text-[11px] font-bold ${STATUS_CLASS[agreement.status]}`}
                      >
                        {STATUS_LABEL[agreement.status]}
                      </span>
                    </td>
                    <td className="p-3 text-[11px] text-gray-400">
                      {PAYMENT_LABEL[agreement.paymentStatus]}
                    </td>
                    <td className="p-3 font-mono tabular-nums text-gray-500">
                      {date(agreement.signedAt)}
                    </td>
                    <td className="p-3 font-mono tabular-nums text-gray-500">
                      {date(agreement.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Commissions — only for the first-month model; an empty list here is
          normal for Roy and would read as a bug if rendered. */}
      {data && data.commissions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-gray-300">
            עמלות חודש ראשון ({data.commissions.length})
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-gray-700 bg-gray-900">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="bg-gray-800/60 text-[11px] uppercase tracking-wider text-gray-500">
                  <th className="p-3 text-right font-medium">לקוח</th>
                  <th className="p-3 text-right font-medium">סכום</th>
                  <th className="p-3 text-right font-medium">סטטוס</th>
                  <th className="p-3 text-right font-medium">נוצר</th>
                  <th className="p-3 text-right font-medium">שולם</th>
                </tr>
              </thead>
              <tbody>
                {data.commissions.map((commission) => (
                  <tr key={commission.id} className="border-t border-gray-800">
                    <td className="p-3 font-bold text-white">
                      {commission.clientName}
                    </td>
                    <td className="p-3 font-mono tabular-nums text-gray-300">
                      {shekel(commission.amount)}
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-lg px-2 py-1 text-[11px] font-bold ${
                          commission.status === "PAID"
                            ? "bg-green-500/10 text-green-400"
                            : commission.status === "CANCELLED"
                              ? "bg-red-500/10 text-red-400"
                              : "bg-amber-400/10 text-amber-300"
                        }`}
                      >
                        {COMMISSION_LABEL[commission.status] ??
                          commission.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono tabular-nums text-gray-500">
                      {date(commission.createdAt)}
                    </td>
                    <td className="p-3 font-mono tabular-nums text-gray-500">
                      {date(commission.paidAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "pink";
}) {
  return (
    <div className="rounded-2xl border border-gray-700 bg-gray-900 p-4">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p
        className={`mt-1 font-mono text-2xl font-bold tabular-nums ${
          tone === "pink" ? "text-pink" : "text-white"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-gray-500">{hint}</p>}
    </div>
  );
}
