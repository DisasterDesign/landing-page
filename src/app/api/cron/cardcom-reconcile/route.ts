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
  const dealId = row.TranzactionId != null ? String(row.TranzactionId) : null;
  const isSuccess = row.Status === "SUCCESSFUL";
  const isFailure = FAILURE_STATUSES.has(row.Status);

  const chargeDate = row.CreateDate ?? row.LastDate;
  const debtFields = {
    status: row.Status,
    responseCode: row.ResposeCode ?? null,
    billingAttempts: row.BillingAttempts ?? null,
    cardcomChargeDate: chargeDate ? new Date(chargeDate) : null,
    success: isSuccess,
  };

  // Match by deal id when Cardcom assigned one; otherwise by recurring id +
  // billing date (failed attempts may carry no TranzactionId).
  const existing = dealId
    ? await prisma.agreementCharge.findFirst({ where: { cardcomDealId: dealId } })
    : await prisma.agreementCharge.findFirst({
        where: {
          agreementId,
          cardcomRecurringId: row.RecurringId,
          cardcomChargeDate: debtFields.cardcomChargeDate,
        },
      });

  if (existing) {
    // Only touch rows the pull actually changes — keeps the daily run quiet.
    if (
      existing.status !== debtFields.status ||
      existing.responseCode !== debtFields.responseCode ||
      existing.billingAttempts !== debtFields.billingAttempts ||
      (existing.cardcomChargeDate == null && debtFields.cardcomChargeDate != null)
    ) {
      await prisma.agreementCharge.update({ where: { id: existing.id }, data: debtFields });
      summary.chargesUpdated++;
      // A charge we knew about that ROLLED INTO debt is news; re-notify.
      if (isFailure && existing.status !== debtFields.status) {
        summary.failuresNotified++;
        await notifyAllAdmins({
          type: "AGREEMENT_SIGNED",
          title: `🚨 חוב בקארדקום — ${customerName}`,
          body: `סטטוס חיוב: ${row.Status} · קוד דחייה ${row.ResposeCode ?? "?"} · ניסיון ${row.BillingAttempts ?? "?"} · ₪${row.SumToBill ?? "?"}`,
          url: "/admin/finance/debtors",
        });
      }
    }
    return;
  }

  await prisma.agreementCharge.create({
    data: {
      agreementId,
      amount: row.SumToBill ?? 0,
      cardcomDealId: dealId,
      invoiceNumber: row.DocumentNumber != null ? String(row.DocumentNumber) : null,
      cardcomRecurringId: row.RecurringId,
      ...debtFields,
      rawPayload: { source: "cardcom-reconcile", row: JSON.parse(JSON.stringify(row)) },
    },
  });
  summary.chargesCreated++;

  if (isFailure || !isSuccess) {
    summary.failuresNotified++;
    await notifyAllAdmins({
      type: "AGREEMENT_SIGNED",
      title: `🚨 חיוב שלא הצליח התגלה בקארדקום — ${customerName}`,
      body: `סטטוס: ${row.Status} · קוד דחייה ${row.ResposeCode ?? "?"} · ₪${row.SumToBill ?? "?"} (התגלה ב-reconciliation, לא הגיע webhook)`,
      url: "/admin/finance/debtors",
    });
  }
}
