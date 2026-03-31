"use client";

import { useEffect, useState } from "react";

interface FontOrder {
  id: string;
  customerName: string;
  customerEmail: string;
  licenseType: "PERSONAL" | "COMMERCIAL";
  totalPrice: number;
  currency: string;
  paymentStatus: "PENDING" | "COMPLETED" | "FAILED";
  downloadCount: number;
  fontFamily: { id: string; name: string; slug: string };
  createdAt: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: "ממתין", color: "bg-yellow-900/60 text-yellow-300" },
  COMPLETED: { label: "הושלם", color: "bg-green-900/60 text-green-300" },
  FAILED: { label: "נכשל", color: "bg-red-900/60 text-red-300" },
};

const licenseLabels: Record<string, string> = {
  PERSONAL: "אישי",
  COMMERCIAL: "מסחרי",
};

export default function AdminFontOrdersPage() {
  const [orders, setOrders] = useState<FontOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    const url = statusFilter
      ? `/api/fonts/admin/orders?status=${statusFilter}`
      : "/api/fonts/admin/orders";

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setOrders(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [statusFilter]);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">הזמנות פונטים</h1>
          <p className="text-gray-400 text-sm mt-1">
            כל ההזמנות מחנות הפונטים
          </p>
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setLoading(true);
          }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pink/50 transition-colors"
        >
          <option value="">כל הסטטוסים</option>
          <option value="PENDING">ממתין</option>
          <option value="COMPLETED">הושלם</option>
          <option value="FAILED">נכשל</option>
        </select>
      </div>

      {loading ? (
        <div className="text-gray-400 text-center py-12">טוען...</div>
      ) : orders.length === 0 ? (
        <div className="text-gray-400 text-center py-12">
          <p className="text-lg">אין הזמנות עדיין</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="text-right px-4 py-3 font-medium">לקוח</th>
                <th className="text-right px-4 py-3 font-medium">אימייל</th>
                <th className="text-right px-4 py-3 font-medium">פונט</th>
                <th className="text-center px-4 py-3 font-medium">רישיון</th>
                <th className="text-center px-4 py-3 font-medium">מחיר</th>
                <th className="text-center px-4 py-3 font-medium">סטטוס</th>
                <th className="text-center px-4 py-3 font-medium">תאריך</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-4 py-3 text-white">{order.customerName}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {order.customerEmail}
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {order.fontFamily.name}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-300">
                    {licenseLabels[order.licenseType]}
                  </td>
                  <td className="px-4 py-3 text-center text-white">
                    {order.totalPrice}₪
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                        statusConfig[order.paymentStatus]?.color || ""
                      }`}
                    >
                      {statusConfig[order.paymentStatus]?.label ||
                        order.paymentStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-400">
                    {new Date(order.createdAt).toLocaleDateString("he-IL")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
