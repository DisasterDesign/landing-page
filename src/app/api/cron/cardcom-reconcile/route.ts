export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isCronAuthorized } from "@/lib/cron-auth";
import {
  getRecurringPaymentHistory,
  getRecurringPaymentState,
  type RecurringHistoryRow,
} from "@/lib/cardcom";
import { sweepTerminalFailures } from "@/lib/cardcom-debtors";
import {
  cardcomRecurringHistoryProviderDealId,
  recordVerifiedRecurringCharge,
} from "@/lib/cardcom-recurring-charge";
import { sendPaymentReceivedEmail } from "@/lib/email";
import { notifyAllAdmins } from "@/lib/notifications";

export const maxDuration = 60;

/**
 * Daily reconciliation against Cardcom — the pull half of the debtors report.
 *
 * The webhook is push-only: a delivery that never arrived is a charge (or a
 * failure) that simply doesn't exist in our DB. This job makes Cardcom the
 * source of truth once a day: for every agreement with a recurring account it
 * pulls the charge history (GetRecurringPaymentHistory) and the live order
 * state (GetRecurringPayment), upserts charges we missed, fills in the debt
 * fields on charges we already have, mirrors IsActive/NextDateToBill onto the
 * agreement, and notifies the admins about anything that needs a human:
 * new failed/debt charges, and active-in-our-books orders Cardcom has
 * deactivated.
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const agreements = await prisma.agreement.findMany({
    where: { cardcomAccountId: { not: null } },
    select: {
      id: true,
      customerName: true,
      cardcomAccountId: true,
      cardcomRecurringId: true,
      cardcomIsActive: true,
      client: { select: { id: true, name: true } },
    },
  });

  const now = new Date();
  // 90 days back: wide enough to catch late debt-status transitions
  // (DEBTAUTOBILLING → LOSTDEBT can take a full retry cycle), cheap enough to
  // run daily at this client count.
  const fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const summary = {
    agreements: agreements.length,
    chargesCreated: 0,
    chargesUpdated: 0,
    failuresNotified: 0,
    deactivations: 0,
    debtors: 0,
    newDebtorAlerts: 0,
    errors: [] as string[],
  };

  for (const a of agreements) {
    try {
      // ---- live order state --------------------------------------------
      const states = await getRecurringPaymentState(a.cardcomAccountId!);
      const state =
        states.find((s) => s.RecurringId === a.cardcomRecurringId) ??
        states.find((s) => s.ReturnValue === a.id) ??
        states[0];

      if (state) {
        const wasActive = a.cardcomIsActive;
        await prisma.agreement.update({
          where: { id: a.id },
          data: {
            cardcomIsActive: state.IsActive,
            cardcomNextBillDate: state.NextDateToBill ? new Date(state.NextDateToBill) : null,
            cardcomSyncedAt: now,
          },
        });
        // Notify once, on the transition — not every day the order stays off.
        if (state.IsActive === false && wasActive !== false) {
          summary.deactivations++;
          await notifyAllAdmins({
            type: "AGREEMENT_SIGNED",
            title: `⚠️ הוראת קבע לא פעילה — ${a.customerName}`,
            body: `קארדקום מדווחת שההוראה כבויה (חיובים שבוצעו: ${state.NumOfPaymentsAlreadyCharged ?? "?"}). הלקוח ${a.client?.name ?? ""} לא יחויב עד שתטופל.`,
            url: "/admin/finance/debtors",
          });
        }
      }

      // ---- charge history ----------------------------------------------
      const history = await getRecurringPaymentHistory({
        accountId: a.cardcomAccountId!,
        fromDate,
        toDate: now,
      });

      for (const row of history) {
        await syncHistoryRow(a.id, a.customerName, row, summary);
      }
    } catch (e) {
      summary.errors.push(`${a.customerName}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ---- terminal-wide failed-transactions sweep ------------------------
  // The per-account loop above only sees recurring orders the APP created.
  // Orders born in the Cardcom dashboard (no agreement stores their account)
  // are invisible to it — פיקס טיקטס carried three months of debt that way.
  // ListTransactions covers the whole terminal, so nothing can hide.
  try {
    await sweepTerminalFailures(now, summary);
  } catch (e) {
    summary.errors.push(`terminal sweep: ${e instanceof Error ? e.message : String(e)}`);
  }

  return NextResponse.json(summary);
}

const FAILURE_STATUSES = new Set(["DEBTAUTOBILLING", "LOSTDEBT", "ONHOLD"]);

async function syncHistoryRow(
  agreementId: string,
  customerName: string,
  row: RecurringHistoryRow,
  summary: { chargesCreated: number; chargesUpdated: number; failuresNotified: number }
) {
  const dealId = cardcomRecurringHistoryProviderDealId(row);
  if (!dealId) {
    throw new Error(
      `Recurring history row for ${customerName} has no stable provider identity`,
    );
  }
  const isSuccess = row.Status === "SUCCESSFUL";
  const isFailure = FAILURE_STATUSES.has(row.Status);
  const chargeDate = row.CreateDate ?? row.LastDate;
  const amount = row.SumToBill;
  if (amount == null || !Number.isFinite(amount) || amount <= 0) {
    throw new Error(
      `Recurring history row ${dealId} for ${customerName} has no positive amount`,
    );
  }
  const providerChargedAt = chargeDate ? new Date(chargeDate) : null;
  if (providerChargedAt && Number.isNaN(providerChargedAt.getTime())) {
    throw new Error(
      `Recurring history row ${dealId} for ${customerName} has an invalid date`,
    );
  }
  const result = await recordVerifiedRecurringCharge({
    recurringId: row.RecurringId,
    providerDealId: dealId,
    amount,
    success: isSuccess,
    status: row.Status,
    responseCode: row.ResposeCode ?? null,
    billingAttempts: row.BillingAttempts ?? null,
    invoiceNumber:
      row.DocumentNumber == null ? null : String(row.DocumentNumber),
    providerChargedAt,
    rawPayload: {
      source: "cardcom-reconcile",
      row: JSON.parse(JSON.stringify(row)),
    },
  });
  if (result.agreementId !== agreementId) {
    throw new Error(
      `Recurring history row ${dealId} resolved to a different agreement`,
    );
  }
  if (result.disposition === "created") summary.chargesCreated++;
  if (result.disposition === "updated") summary.chargesUpdated++;
  // Notifications below are best-effort. They run inside the caller's
  // per-agreement try, so an unguarded throw here would swallow the rest of
  // that agreement's history rows — silently degrading the very sweep this
  // job exists to guarantee.
  if (result.reviewRequired) {
    summary.failuresNotified++;
    await notifyAllAdmins({
      type: "AGREEMENT_SIGNED",
      title: `⚠️ חיוב חודשי דורש בדיקת הכנסה — ${result.customerName}`,
      body: `עסקה ${dealId} אומתה מול Cardcom, אך מקור רישום ההכנסה ההיסטורי אינו חד-משמעי.`,
      url: "/admin/finance/debtors",
    }).catch((e) => console.error("[cardcom-reconcile] review notify failed:", e));
    return;
  }
  if (
    (isFailure || !isSuccess) &&
    (result.disposition === "created" ||
      result.previousStatus !== row.Status)
  ) {
    summary.failuresNotified++;
    await notifyAllAdmins({
      type: "AGREEMENT_SIGNED",
      title: `🚨 חיוב שלא הצליח התגלה בקארדקום — ${customerName}`,
      body: `סטטוס: ${row.Status} · קוד דחייה ${row.ResposeCode ?? "?"} · ₪${result.amount} (התגלה ב-reconciliation, לא הגיע webhook)`,
      url: "/admin/finance/debtors",
    }).catch((e) => console.error("[cardcom-reconcile] failure notify failed:", e));
  } else if (result.revenueApplied) {
    await notifyAllAdmins({
      type: "AGREEMENT_SIGNED",
      title: `💰 חיוב חודשי התגלה בסנכרון — ${result.customerName}`,
      body: `₪${result.amount}${result.invoiceNumber ? ` · חשבונית #${result.invoiceNumber}` : ""}`,
      url: "/admin/finance",
    }).catch((e) => console.error("[cardcom-reconcile] success notify failed:", e));
    await sendPaymentReceivedEmail({
      customerName: result.customerName,
      amount: result.amount,
      invoiceNumber: result.invoiceNumber ?? undefined,
      agreementTier: result.tier,
      isRecurring: true,
    }).catch((e) => console.error("[cardcom-reconcile] success email failed:", e));
  }
}
