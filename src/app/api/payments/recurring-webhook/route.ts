export const dynamic = "force-dynamic";
import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyAllAdmins } from "@/lib/notifications";
import { verifyRecurringWebhookSecret } from "@/lib/cardcom-webhook-auth";
import { recordVerifiedRecurringCharge } from "@/lib/cardcom-recurring-charge";

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
 * field to the payload. This endpoint fails closed until that shared secret is
 * configured and matches; the authenticated daily pull remains the fallback.
 */
export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const authorization = verifyRecurringWebhookSecret({
    expectedSecret: process.env.CARDCOM_RECURRING_WEBHOOK_SECRET,
    receivedSecret: str(payload.Secret) ?? str(payload.secret),
  });
  if (!authorization.ok) {
    console.warn(
      `[recurring-webhook] rejected: ${authorization.reason}`,
    );
    return NextResponse.json(
      { error: authorization.reason },
      { status: authorization.status },
    );
  }

  const recurringId = num(payload.RecurringId) ?? num(payload.MasterRecurringId);
  const returnValue = str(payload.ReturnValue);
  const status = str(payload.Status);
  const isDetail = payload.InternalDealNumber != null || status != null;

  if (isDetail) {
    const dealId =
      payload.InternalDealNumber == null
        ? null
        : String(payload.InternalDealNumber).trim() || null;
    if (!dealId) {
      console.warn(
        `[recurring-webhook] deferred detail without InternalDealNumber for RecurringId=${recurringId}`,
      );
      return NextResponse.json({ ok: true, deferred: true });
    }
    if (recurringId === null) {
      console.warn(
        `[recurring-webhook] deferred detail ${dealId} without RecurringId`,
      );
      return NextResponse.json({ ok: true, deferred: true });
    }
    const amount = num(payload.Sum) ?? num(payload.SumToBill);
    if (amount === null || amount <= 0) {
      console.warn(
        `[recurring-webhook] deferred detail ${dealId} without a positive amount`,
      );
      return NextResponse.json({ ok: true, deferred: true });
    }

    try {
      const result = await recordVerifiedRecurringCharge({
        recurringId,
        providerDealId: dealId,
        amount,
        success: status === "SUCCESSFUL",
        status,
        responseCode:
          num(payload.ResposeCode) ?? num(payload.ResponseCode),
        billingAttempts: num(payload.BillingAttempts),
        invoiceNumber:
          payload.DocumentNumber == null
            ? null
            : String(payload.DocumentNumber),
        providerChargedAt: date(payload.BillingDate),
        rawPayload: safeRecurringAuditPayload(payload),
      });

      // The charge is already recorded above. Everything below is
      // best-effort notification, so it must never throw into the catch —
      // that would answer Cardcom with 503 + retry for a charge that
      // actually succeeded. Same `.catch()` discipline as payments/webhook.
      if (result.reviewRequired) {
        await notifyAllAdmins({
          type: "AGREEMENT_SIGNED",
          title: `⚠️ חיוב חודשי דורש בדיקת הכנסה — ${result.customerName}`,
          body: `עסקה ${dealId} נקלטה, אך לא ניתן להוכיח אם ההכנסה ההיסטורית כבר נרשמה.`,
          url: "/admin/finance/debtors",
        }).catch((e) => console.error("[recurring-webhook] review notify failed:", e));
      } else if (
        !result.success &&
        (result.disposition === "created" ||
          result.previousStatus !== status)
      ) {
        await notifyAllAdmins({
          type: "AGREEMENT_SIGNED",
          title: `🚨 חיוב חודשי נכשל — ${result.customerName}`,
          body: `סטטוס: ${status ?? "?"} · קוד דחייה ${num(payload.ResposeCode) ?? num(payload.ResponseCode) ?? "?"} · ניסיון ${num(payload.BillingAttempts) ?? "?"} · ₪${result.amount}`,
          url: "/admin/finance/debtors",
        }).catch((e) => console.error("[recurring-webhook] failure notify failed:", e));
      }
      // A charge that simply worked is not news — see
      // src/lib/payments/recurring-notifications.ts. The money is recorded
      // above and visible in /admin/finance; only exceptions interrupt.
      return NextResponse.json({ ok: true });
    } catch (error) {
      console.error("[recurring-webhook] charge processing failed:", error);
      return NextResponse.json(
        { ok: false, retry: true },
        { status: 503 },
      );
    }
  }

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
function date(v: unknown): Date | null {
  const value = str(v);
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function bool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "True" || v === "1" || v === 1) return true;
  if (v === "false" || v === "False" || v === "0" || v === 0) return false;
  return null;
}

function safeRecurringAuditPayload(
  payload: Record<string, unknown>,
): Prisma.InputJsonObject {
  const safe: Record<string, string | number | boolean> = {};
  for (const key of [
    "RecurringId",
    "MasterRecurringId",
    "InternalDealNumber",
    "DocumentNumber",
    "Sum",
    "SumToBill",
    "Status",
    "ResposeCode",
    "ResponseCode",
    "BillingAttempts",
    "BillingDate",
  ]) {
    const value = payload[key];
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      safe[key] = value;
    }
  }
  return safe;
}
