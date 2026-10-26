export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, viewerErrorResponse } from "@/lib/auth/viewer";
import { ExpensePaymentError, recordExpensePayment } from "@/lib/finance/expense-payments";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const viewer = await requireAdmin();
    const { id } = await params;
    const result = await recordExpensePayment(viewer, id, await request.json().catch(() => null));
    const { payment } = result;
    return NextResponse.json({ payment: { id: payment.id, paymentKey: payment.paymentKey, amountIlsMinor: payment.amountIlsMinor, paidAt: payment.paidAt }, replay: result.replay }, { status: result.replay ? 200 : 201 });
  } catch (error) {
    const authError = viewerErrorResponse(error);
    if (authError) return authError;
    if (error instanceof ExpensePaymentError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
