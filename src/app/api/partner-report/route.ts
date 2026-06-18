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
  profit: number;
  partnerShare: number;
  paymentDate: string | null;
}

/**
 * GET /api/partner-report
 *
 * Snapshot of every client currently active in recurring payment
 * (status = "בוצע"). Each row's `amount` is treated as the monthly
 * recurring contribution; the report is a current-state snapshot the
 * user saves at end of month for the partner transfer.
 *
 * Per row:
 *   profit       = amount - VAT(18% inclusive) - cardcomFee(2%)
 *   partnerShare = profit / 2
 *
 * Both partners (Elad and Roy) get the same partnerShare value;
 * the UI renders it in two columns for clarity.
 */
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clients = await prisma.client.findMany({
    where: { status: "בוצע" },
    select: {
      id: true,
      number: true,
      name: true,
      amount: true,
      paymentDate: true,
      vatExempt: true,
    },
    orderBy: { name: "asc" },
  });

  const rows: PartnerRow[] = clients.map((c) => {
    const amount = c.amount ?? 0;
    // Foreign (zero-rated) clients: no VAT was collected, so none is backed out.
    const vat = c.vatExempt ? 0 : (amount * VAT_RATE) / (100 + VAT_RATE);
    const cardcomFee = amount * CARDCOM_FEE_RATE;
    const profit = amount - vat - cardcomFee;
    const partnerShare = profit / 2;
    return {
      id: c.id,
      number: c.number,
      name: c.name,
      amount,
      vat,
      cardcomFee,
      profit,
      partnerShare,
      paymentDate: c.paymentDate ? c.paymentDate.toISOString() : null,
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      amount: acc.amount + r.amount,
      vat: acc.vat + r.vat,
      cardcomFee: acc.cardcomFee + r.cardcomFee,
      profit: acc.profit + r.profit,
      partnerShare: acc.partnerShare + r.partnerShare,
    }),
    { amount: 0, vat: 0, cardcomFee: 0, profit: 0, partnerShare: 0 }
  );

  return NextResponse.json({
    snapshotAt: new Date().toISOString(),
    rows,
    totals,
    count: rows.length,
  });
}
