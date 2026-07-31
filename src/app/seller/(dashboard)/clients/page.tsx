"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

interface SellerClientProduct {
  id: string;
  name: string;
  monthlyAmount: number | null;
  status: string;
}

interface SellerClient {
  id: string;
  name: string;
  businessName: string | null;
  status: string;
  monthlyAmount: number | null;
  startDate: string | null;
  createdAt: string;
  products: SellerClientProduct[];
}

interface SellerClientsPayload {
  clients: SellerClient[];
  summary: { count: number; monthlyTotal: number };
}

const currency = (value: number) =>
  `${value.toLocaleString("he-IL", { maximumFractionDigits: 0 })} ₪`;

export default function SellerClientsPage() {
  const [data, setData] = useState<SellerClientsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/seller/clients", {
          cache: "no-store",
        });
        if (!response.ok) throw new Error();
        setData((await response.json()) as SellerClientsPayload);
      } catch {
        toast.error("שגיאה בטעינת הלקוחות");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div dir="rtl" className="py-16 text-center text-gray-500">
        טוען לקוחות...
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-white">הלקוחות שלי</h1>
        <p className="mt-1 text-sm text-gray-400">
          לקוחות פעילים מעסקאות שסגרת.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-gray-700 bg-gray-900 p-4">
          <p className="text-xs text-gray-500">לקוחות פעילים</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {data?.summary.count ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-700 bg-gray-900 p-4">
          <p className="text-xs text-gray-500">מנויים חודשיים (ברוטו)</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {currency(data?.summary.monthlyTotal ?? 0)}
          </p>
        </div>
      </div>

      {data && data.clients.length === 0 ? (
        <div className="rounded-2xl border border-gray-700 bg-gray-900 py-16 text-center text-gray-500">
          עדיין אין לקוחות. עסקה שנסגרת דרכך תופיע כאן אוטומטית.
        </div>
      ) : (
        <div className="space-y-3">
          {data?.clients.map((client) => (
            <article
              key={client.id}
              className="rounded-2xl border border-gray-700 bg-gray-900 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-white">
                    {client.businessName || client.name}
                  </h2>
                  <p className="mt-0.5 text-xs text-gray-500">
                    הצטרף{" "}
                    {new Date(
                      client.startDate ?? client.createdAt,
                    ).toLocaleDateString("he-IL")}
                  </p>
                </div>
                <span className="rounded-xl bg-cyan/10 px-3 py-1.5 text-sm font-bold text-cyan">
                  {currency(client.monthlyAmount ?? 0)} / חודש
                </span>
              </div>
              {client.products.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {client.products.map((product) => (
                    <li
                      key={product.id}
                      className="rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1 text-xs text-gray-300"
                    >
                      {product.name}
                      {product.status === "בוצע" ? " · פעיל" : " · בהקמה"}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
