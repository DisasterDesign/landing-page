export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { createRecurringOrder, createRecurringOrderNTV } from "@/lib/cardcom";
import { withVat } from "@/lib/vat";

export const maxDuration = 120;

interface RetryResult {
  agreementId: string;
  customerName: string;
  ok: boolean;
  via?: "NTV" | "SOAP";
  recurringId?: number;
  error?: string;
}

/**
 * POST /api/agreements/retry-recurring
 *
 * Re-attempts recurring-order setup for agreements that paid the first
 * charge but never got a recurring schedule (cardcomRecurringId is null).
 *
 * Strategy:
 *   - Prefer Name-to-Value API (RecurringPayment.aspx) using the saved
 *     cardcomLowProfileId. This is what new payments use.
 *   - Fall back to legacy SOAP (BillGold) using the encrypted cardcomToken
 *     for older agreements that pre-date the LowProfileId capture.
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
      cardcomRecurringId: null,
      monthlyPrice: { gt: 0 },
      OR: [
        { cardcomLowProfileId: { not: null } },
        { cardcomToken: { not: null } },
      ],
      ...(agreementId ? { id: agreementId } : {}),
    },
    select: {
      id: true,
      customerName: true,
      email: true,
      phone: true,
      monthlyPrice: true,
      cardcomToken: true,
      cardcomLowProfileId: true,
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
        ? "ההסכם לא עומד בתנאים (כבר יש הוראת קבע, לא שולם, או חסר LowProfile / טוקן)"
        : "אין הסכמים שדורשים retry",
    });
  }

  const results: RetryResult[] = [];

  for (const a of candidates) {
    try {
      let r: { recurringId: number; accountId: number };
      let via: "NTV" | "SOAP";

      // monthlyPrice is NET in our DB; Cardcom is charged GROSS.
      const grossMonthly = withVat(a.monthlyPrice);
      if (a.cardcomLowProfileId) {
        via = "NTV";
        r = await createRecurringOrderNTV({
          lowProfileDealGuid: a.cardcomLowProfileId,
          monthlyAmount: grossMonthly,
          customerName: a.customerName,
          customerEmail: a.email,
          customerPhone: a.phone ?? undefined,
          productDescription: `חבילה חודשית — ${a.customerName}`,
          agreementId: a.id,
        });
      } else if (a.cardcomToken) {
        via = "SOAP";
        const tokenPlain = decrypt(a.cardcomToken);
        r = await createRecurringOrder({
          agreementId: a.id,
          cardcomToken: tokenPlain,
          monthlyAmount: grossMonthly,
          customerName: a.customerName,
          customerEmail: a.email,
          customerPhone: a.phone ?? undefined,
          productDescription: `חבילה חודשית — ${a.customerName}`,
        });
      } else {
        results.push({
          agreementId: a.id,
          customerName: a.customerName,
          ok: false,
          error: "missing both cardcomLowProfileId and cardcomToken",
        });
        continue;
      }

      await prisma.agreement.update({
        where: { id: a.id },
        data: {
          cardcomRecurringId: r.recurringId,
          cardcomAccountId: r.accountId,
        },
      });
      results.push({
        agreementId: a.id,
        customerName: a.customerName,
        ok: true,
        via,
        recurringId: r.recurringId,
      });
      console.log(
        `retry-recurring (${via}): agreement ${a.id} → recurringId ${r.recurringId}`
      );
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
