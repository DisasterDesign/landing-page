export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { createRecurringOrder } from "@/lib/cardcom";

export const maxDuration = 120;

interface RetryResult {
  agreementId: string;
  customerName: string;
  ok: boolean;
  recurringId?: number;
  error?: string;
}

/**
 * POST /api/agreements/retry-recurring
 *
 * Re-attempts BillGold recurring-order setup for agreements that paid the
 * first charge but never got a recurring schedule (cardcomRecurringId is
 * null).
 *
 * Body:
 *   - { agreementId: string } → retry only that one
 *   - {} or empty → retry all eligible
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as Record<string, unknown>).role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let agreementId: string | undefined;
  try {
    const body = await req.json();
    if (body && typeof body.agreementId === "string") {
      agreementId = body.agreementId;
    }
  } catch {
    // empty body is fine — we'll retry all eligible
  }

  const candidates = await prisma.agreement.findMany({
    where: {
      paymentStatus: "COMPLETED",
      cardcomToken: { not: null },
      cardcomRecurringId: null,
      monthlyPrice: { gt: 0 },
      ...(agreementId ? { id: agreementId } : {}),
    },
    select: {
      id: true,
      customerName: true,
      email: true,
      phone: true,
      monthlyPrice: true,
      cardcomToken: true,
    },
  });

  if (candidates.length === 0) {
    return NextResponse.json({
      ok: true,
      total: 0,
      success: 0,
      failed: 0,
      results: [],
      message: agreementId
        ? "ההסכם לא עומד בתנאים (כבר יש הוראת קבע, לא שולם, או חסר טוקן)"
        : "אין הסכמים שדורשים retry",
    });
  }

  const results: RetryResult[] = [];

  for (const a of candidates) {
    if (!a.cardcomToken) {
      results.push({
        agreementId: a.id,
        customerName: a.customerName,
        ok: false,
        error: "missing cardcomToken",
      });
      continue;
    }
    try {
      const tokenPlain = decrypt(a.cardcomToken);
      const r = await createRecurringOrder({
        agreementId: a.id,
        cardcomToken: tokenPlain,
        monthlyAmount: a.monthlyPrice,
        customerName: a.customerName,
        customerEmail: a.email,
        customerPhone: a.phone ?? undefined,
        productDescription: `חבילה חודשית — ${a.customerName}`,
      });
      await prisma.agreement.update({
        where: { id: a.id },
        data: { cardcomRecurringId: r.recurringId },
      });
      results.push({
        agreementId: a.id,
        customerName: a.customerName,
        ok: true,
        recurringId: r.recurringId,
      });
      console.log(`retry-recurring: agreement ${a.id} → recurringId ${r.recurringId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        agreementId: a.id,
        customerName: a.customerName,
        ok: false,
        error: msg,
      });
      console.error(`retry-recurring: agreement ${a.id} failed:`, err);
    }
  }

  const success = results.filter((r) => r.ok).length;
  return NextResponse.json({
    ok: true,
    total: results.length,
    success,
    failed: results.length - success,
    results,
  });
}
