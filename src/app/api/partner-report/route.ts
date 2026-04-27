export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VAT_RATE = 18;
const CARDCOM_FEE_RATE = 0.02;

interface PartnerRow {
  id: string;
  number: number;
  name: string;
  amount: number;
  vat: number;
  cardcomFee: number;
  expense: number;
  netProfit: number;
  partnerShare: number;
  paymentDate: string | null;
}

/**
 * GET /api/partner-report?month=YYYY-MM
 *
 * Returns the per-row monthly partner-share breakdown for clients with
 * status="בוצע" and partner="fuzion" whose paymentDate falls within
 * the requested month.
 *
 * Net per row: amount/(1+VAT) - cardcomFee - expense
 * Partner share per row: net / 2
 *
 * Defaults to the current month (server-local) if no `month` param.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const monthParam = url.searchParams.get("month"); // expected YYYY-MM
  let year: number;
  let month: number; // 1-12
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    year = y;
    month = m;
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

  const clients = await prisma.client.findMany({
    where: {
      status: "בוצע",
      partner: "fuzion",
      paymentDate: { gte: start, lt: end },
    },
    select: {
      id: true,
      number: true,
      name: true,
      amount: true,
      expense: true,
      paymentDate: true,
    },
    orderBy: { paymentDate: "asc" },
  });

  const rows: PartnerRow[] = clients.map((c) => {
    const amount = c.amount ?? 0;
    const vat = (amount * VAT_RATE) / (100 + VAT_RATE);
    const cardcomFee = amount * CARDCOM_FEE_RATE;
    const expense = c.expense ?? 0;
    const netProfit = amount - vat - cardcomFee - expense;
    const partnerShare = netProfit / 2;
    return {
      id: c.id,
      number: c.number,
      name: c.name,
      amount,
      vat,
      cardcomFee,
      expense,
      netProfit,
      partnerShare,
      paymentDate: c.paymentDate ? c.paymentDate.toISOString() : null,
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      amount: acc.amount + r.amount,
      vat: acc.vat + r.vat,
      cardcomFee: acc.cardcomFee + r.cardcomFee,
      expense: acc.expense + r.expense,
      netProfit: acc.netProfit + r.netProfit,
      partnerShare: acc.partnerShare + r.partnerShare,
    }),
    { amount: 0, vat: 0, cardcomFee: 0, expense: 0, netProfit: 0, partnerShare: 0 }
  );

  return NextResponse.json({
    month: `${year}-${String(month).padStart(2, "0")}`,
    rows,
    totals,
    count: rows.length,
  });
}
