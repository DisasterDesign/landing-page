"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Client {
  id: string;
  name: string;
  amount: number | null;
  expense: number | null;
  startDate: string | null;
  createdAt: string;
}

interface MonthData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

const HEBREW_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

function formatCurrency(n: number) {
  return n.toLocaleString("he-IL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
      <p className="text-gray-400 text-xs mb-2">{label}</p>
      {payload.map((entry: TooltipPayloadItem, i: number) => (
        <p key={i} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)} ₪
        </p>
      ))}
    </div>
  );
}

export default function RevenueChart() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchClients() {
      try {
        const res = await fetch("/api/clients");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setClients(data.data);
      } catch (err) {
        console.error("Failed to fetch clients:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchClients();
  }, []);

  // Group by month and compute cumulative totals
  const chartData: MonthData[] = (() => {
    const monthMap: Record<string, { revenue: number; expenses: number }> = {};

    clients.forEach((client) => {
      const dateStr = client.startDate || client.createdAt;
      const date = new Date(dateStr);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      if (!monthMap[key]) {
        monthMap[key] = { revenue: 0, expenses: 0 };
      }
      monthMap[key].revenue += client.amount ?? 0;
      monthMap[key].expenses += client.expense ?? 0;
    });

    const sortedKeys = Object.keys(monthMap).sort();

    let cumRevenue = 0;
    let cumExpenses = 0;

    return sortedKeys.map((key) => {
      const [year, monthStr] = key.split("-");
      const monthIndex = parseInt(monthStr, 10) - 1;
      cumRevenue += monthMap[key].revenue;
      cumExpenses += monthMap[key].expenses;

      return {
        month: `${HEBREW_MONTHS[monthIndex]} ${year}`,
        revenue: cumRevenue,
        expenses: cumExpenses,
        profit: cumRevenue - cumExpenses,
      };
    });
  })();

  const totalRevenue = clients.reduce((sum, c) => sum + (c.amount ?? 0), 0);
  const totalExpenses = clients.reduce((sum, c) => sum + (c.expense ?? 0), 0);
  const netProfit = totalRevenue - totalExpenses;

  const summaryCards = [
    {
      label: 'סה"כ הכנסות',
      value: formatCurrency(totalRevenue),
      color: "text-green-400",
      borderColor: "border-green-400/30",
    },
    {
      label: 'סה"כ הוצאות',
      value: formatCurrency(totalExpenses),
      color: "text-red-400",
      borderColor: "border-red-400/30",
    },
    {
      label: "רווח נקי",
      value: formatCurrency(netProfit),
      color: netProfit >= 0 ? "text-green-400" : "text-red-400",
      borderColor: netProfit >= 0 ? "border-green-400/30" : "border-red-400/30",
    },
    {
      label: "לקוחות",
      value: String(clients.length),
      color: "text-white",
      borderColor: "border-gray-600",
    },
  ];

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-40" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-800 rounded-xl" />
            ))}
          </div>
          <div className="h-[350px] bg-gray-800 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="bg-gray-900 rounded-2xl border border-gray-700 p-6">
      <h3 className="text-lg font-bold mb-4 text-white">סקירת הכנסות</h3>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className={`bg-gray-800 rounded-xl p-4 border ${card.borderColor}`}
          >
            <p className="text-gray-400 text-xs mb-1">{card.label}</p>
            <p className={`text-xl font-bold ${card.color}`}>
              {card.value}
              {card.label !== "לקוחות" && " ₪"}
            </p>
          </div>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#E503A2" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#E503A2" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#01FFFF" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#01FFFF" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ffffff" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="month"
              tick={{ fill: "#9CA3AF", fontSize: 12 }}
              axisLine={{ stroke: "#374151" }}
              tickLine={{ stroke: "#374151" }}
            />
            <YAxis
              tick={{ fill: "#9CA3AF", fontSize: 12 }}
              axisLine={{ stroke: "#374151" }}
              tickLine={{ stroke: "#374151" }}
              tickFormatter={(v: number) => formatCurrency(v)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="revenue"
              name="הכנסות"
              stroke="#E503A2"
              fill="url(#colorRevenue)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              name="הוצאות"
              stroke="#01FFFF"
              fill="url(#colorExpenses)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="profit"
              name="רווח"
              stroke="#ffffff"
              fill="url(#colorProfit)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-[350px] text-gray-500">
          אין נתונים להצגה
        </div>
      )}
    </div>
  );
}
