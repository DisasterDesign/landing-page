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
 * GET /api/partner-report
 *
 * Snapshot of every client currently active in the fuzion partnership:
 *   status = "בוצע"  AND  partner = "fuzion"
 *
 * No date filter. Each row's `amount` is treated as the monthly recurring
 * contribution; the report is a current-state snapshot the user saves at
 * end of month for the partner transfer.
 *
 * Per row:
 *   net = amount - VAT(18% inclusive) - cardcomFee(2%) - expense
 *   partnerShare = net / 2
 */
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clients = await prisma.client.findMany({
    where: {
      status: "בוצע",
      partner: "fuzion",
    },
    select: {
      id: true,
      number: true,
      name: true,
      amount: true,
      expense: true,
      paymentDate: true,
    },
    orderBy: { name: "asc" },
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
    snapshotAt: new Date().toISOString(),
    rows,
    totals,
    count: rows.length,
  });
}
