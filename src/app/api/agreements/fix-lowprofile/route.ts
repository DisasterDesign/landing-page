export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  PersistedRoleAuthorizationError,
  requirePersistedUserRole,
} from "@/lib/auth/persisted-role";
import { prisma } from "@/lib/prisma";
import { createRecurringOrderNTV } from "@/lib/cardcom";

export const maxDuration = 120;

/**
 * POST /api/agreements/fix-lowprofile
 *
 * One-time fix: patches cardcomLowProfileId for legacy agreements that are
 * missing it (the early webhook didn't capture LowProfileId), then creates
 * the recurring order via NTV API.
 *
 * IMPORTANT — VAT handling for legacy rows:
 * Customers in this batch were charged the bare monthlyPrice on their
 * first month (the pre-VAT-fix bug, e5aa5b9). Setting recurring at
 * withVat(monthlyPrice) would suddenly raise their next charge by 18%
 * without warning. So we send monthlyPrice AS-IS to Cardcom — keeps the
 * recurring charge identical to what they already paid. Trade-off: the
 * studio absorbs the lost VAT on these specific customers; cleaner
 * recovery is to discuss the increase with each customer separately.
 *
 * Body: { fixes: [{ agreementId: string, lowProfileId: string }] }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await requirePersistedUserRole(session.user.id, ["ADMIN"]);
  } catch (error) {
    if (error instanceof PersistedRoleAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw error;
  }

  const body = await req.json();
  const fixes: { agreementId: string; lowProfileId: string }[] = body.fixes;
  if (!Array.isArray(fixes) || fixes.length === 0) {
    return NextResponse.json({ error: "fixes array required" }, { status: 400 });
  }

  const results = [];

  for (const fix of fixes) {
    try {
      // 1. Update the LowProfileId in DB
      const agreement = await prisma.agreement.update({
        where: { id: fix.agreementId },
        data: { cardcomLowProfileId: fix.lowProfileId },
        select: {
          id: true,
          customerName: true,
          email: true,
          phone: true,
          monthlyPrice: true,
          cardcomRecurringId: true,
        },
      });

      if (agreement.cardcomRecurringId) {
        results.push({
          agreementId: fix.agreementId,
          name: agreement.customerName,
          ok: true,
          note: "already has recurringId, skipped NTV call",
        });
        continue;
      }

      // 2. Create recurring order via NTV.
      // No withVat() here — see header comment. Recurring charges should
      // match the customer's first-month amount, not the contract gross.
      const r = await createRecurringOrderNTV({
        lowProfileDealGuid: fix.lowProfileId,
        monthlyAmount: agreement.monthlyPrice,
        customerName: agreement.customerName,
        customerEmail: agreement.email,
        customerPhone: agreement.phone ?? undefined,
        productDescription: `חבילה חודשית — ${agreement.customerName}`,
        agreementId: agreement.id,
      });

      // 3. Save recurring ID
      await prisma.agreement.update({
        where: { id: agreement.id },
        data: {
          cardcomRecurringId: r.recurringId,
          cardcomAccountId: r.accountId,
        },
      });

      results.push({
        agreementId: fix.agreementId,
        name: agreement.customerName,
        ok: true,
        recurringId: r.recurringId,
        accountId: r.accountId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        agreementId: fix.agreementId,
        ok: false,
        error: msg,
      });
    }
  }

  return NextResponse.json({ ok: true, results });
}
