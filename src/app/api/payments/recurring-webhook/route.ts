export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyAllAdmins } from "@/lib/notifications";

/**
 * Cardcom's OFFICIAL recurring-payments webhook ("דיווח למערכת חיצונית",
 * enabled in the dashboard: הגדרות → הוראות קבע → למפתחים). Two payload kinds:
 *
 * - MasterRecurring: the ORDER changed — created, toggled active/inactive, or
 *   a billing attempt failed at the order level.
 * - DetailRecurring: a CHARGE ran or changed status — carries Status,
 *   ResposeCode (Cardcom's spelling), BillingAttempts, InternalDealNumber.
 *
 * This is the push half of the debtors report; the daily reconcile cron is
 * the pull half and the source of truth. Both write the same AgreementCharge
 * rows with the same dedup key (InternalDealNumber), so a delivery arriving
 * twice, or the cron re-reading what the webhook already wrote, is a no-op.
 *
 * Auth: Cardcom does not sign webhooks. The dashboard lets us attach a Secret
 * field to the payload — when CARDCOM_RECURRING_WEBHOOK_SECRET is set, a
 * mismatch is rejected. Until it's configured we accept (same trust level as
 * the existing payment webhook) but log a warning.
 */
export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const expectedSecret = process.env.CARDCOM_RECURRING_WEBHOOK_SECRET;
  const gotSecret = str(payload.Secret) ?? str(payload.secret);
  if (expectedSecret) {
    if (gotSecret !== expectedSecret) {
      console.warn("[recurring-webhook] secret mismatch — rejecting");
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    console.warn("[recurring-webhook] CARDCOM_RECURRING_WEBHOOK_SECRET not set — accepting unsigned payload");
  }

  const recurringId = num(payload.RecurringId) ?? num(payload.MasterRecurringId);
  const returnValue = str(payload.ReturnValue);

  // Locate the agreement: our own id echoed in ReturnValue wins; recurring id
  // is the fallback for orders created before ReturnValue was passed.
  const agreement =
    (returnValue
      ? await prisma.agreement.findUnique({
          where: { id: returnValue },
          select: { id: true, customerName: true, cardcomIsActive: true },
        })
      : null) ??
    (recurringId != null
      ? await prisma.agreement.findFirst({
          where: { cardcomRecurringId: recurringId },
          select: { id: true, customerName: true, cardcomIsActive: true },
        })
      : null);

  if (!agreement) {
    console.warn(`[recurring-webhook] no agreement for RecurringId=${recurringId} ReturnValue=${returnValue}`);
    // 200 so Cardcom doesn't retry forever on data we can't map anyway.
    return NextResponse.json({ ok: true, unmatched: true });
  }

  const status = str(payload.Status);
  const isDetail = payload.InternalDealNumber != null || status != null;

  if (isDetail) {
    const dealId = payload.InternalDealNumber != null ? String(payload.InternalDealNumber) : null;
    const isSuccess = status === "SUCCESSFUL";
    const data = {
      status,
      responseCode: num(payload.ResposeCode) ?? num(payload.ResponseCode),
      billingAttempts: num(payload.BillingAttempts),
      cardcomChargeDate: str(payload.BillingDate) ? new Date(str(payload.BillingDate)!) : null,
      success: isSuccess,
      amount: num(payload.Sum) ?? 0,
      cardcomRecurringId: recurringId,
      rawPayload: payload as object,
    };

    const existing = dealId
      ? await prisma.agreementCharge.findFirst({ where: { cardcomDealId: dealId } })
      : null;

    if (existing) {
      await prisma.agreementCharge.update({ where: { id: existing.id }, data });
    } else {
      await prisma.agreementCharge.create({
        data: { ...data, agreementId: agreement.id, cardcomDealId: dealId },
      });
    }

    if (!isSuccess) {
      await notifyAllAdmins({
        type: "AGREEMENT_SIGNED",
        title: `🚨 חיוב חודשי נכשל — ${agreement.customerName}`,
        body: `סטטוס: ${status ?? "?"} · קוד דחייה ${data.responseCode ?? "?"} · ניסיון ${data.billingAttempts ?? "?"} · ₪${data.amount}`,
        url: "/admin/finance/debtors",
      });
    }
  } else {
    // MasterRecurring — order-level change. Mirror the active flag; alert on
    // the active→inactive transition.
    const isActive = bool(payload.IsActive);
    if (isActive != null) {
      await prisma.agreement.update({
        where: { id: agreement.id },
        data: { cardcomIsActive: isActive, cardcomSyncedAt: new Date() },
      });
      if (isActive === false && agreement.cardcomIsActive !== false) {
        await notifyAllAdmins({
          type: "AGREEMENT_SIGNED",
          title: `⚠️ הוראת קבע כובתה — ${agreement.customerName}`,
          body: "קארדקום דיווחה שההוראה אינה פעילה. הלקוח לא יחויב עד שתטופל.",
          url: "/admin/finance/debtors",
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}
function bool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "True" || v === "1" || v === 1) return true;
  if (v === "false" || v === "False" || v === "0" || v === 0) return false;
  return null;
}
