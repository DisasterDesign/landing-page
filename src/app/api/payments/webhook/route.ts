import { NextRequest, NextResponse, after } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { shouldCreateRecurringOrder } from "@/lib/agreements/one-time";
import {
  isWebhookSuccess,
  extractWebhookAmount,
  createRecurringOrderNTV,
  verifyLowProfilePayment,
  type CardcomWebhookPayload,
} from "@/lib/cardcom";
import { encrypt } from "@/lib/crypto";
import { withVat } from "@/lib/vat";
import { applyPaymentToProduct } from "@/lib/client-products";
import { notifyAllAdmins } from "@/lib/notifications";
import { sendPaymentReceivedEmail } from "@/lib/email";
import {
  applyPaymentFailure,
  applyPaymentSuccess,
  runLeadPostCommitEffects,
} from "@/lib/leads/agreement-lifecycle";
import { verifyRecurringWebhookSecret } from "@/lib/cardcom-webhook-auth";
import { recordVerifiedRecurringCharge } from "@/lib/cardcom-recurring-charge";

export const maxDuration = 60;

/**
 * Cardcom server-to-server callback. Must respond 200 quickly so Cardcom
 * doesn't retry. Heavy work is kept minimal (one DB transaction + one
 * notify fan-out).
 *
 * Cardcom does not sign first-charge callbacks. The callback identifies only
 * the stored LowProfile attempt; every payment fact is pulled back from
 * Cardcom's GetLpResult API before local state changes.
 *
 * Two flavors of webhook land here:
 *   1. First charge (LowProfile) — has ReturnValue=agreementId, no RecurringId.
 *   2. Recurring auto-charge (BillGold) — carries RecurringId.
 */
export async function POST(request: NextRequest) {
  // Cardcom posts JSON on some flows and form-encoded on others. The body is
  // a one-shot stream, so we must pick the right parser by Content-Type —
  // calling request.json() first and falling back to formData() on error
  // fails because the stream is already consumed by the failed attempt.
  const ct = request.headers.get("content-type") ?? "";
  let payload: CardcomWebhookPayload;
  try {
    if (ct.includes("application/json")) {
      payload = (await request.json()) as CardcomWebhookPayload;
    } else if (
      ct.includes("application/x-www-form-urlencoded") ||
      ct.includes("multipart/form-data")
    ) {
      const form = await request.formData();
      const obj: Record<string, unknown> = {};
      for (const [k, v] of form.entries()) obj[k] = typeof v === "string" ? v : String(v);
      payload = obj as CardcomWebhookPayload;
    } else {
      // Unknown/missing Content-Type — read as text and try JSON, then URL-encoded.
      const text = await request.text();
      try {
        payload = JSON.parse(text) as CardcomWebhookPayload;
      } catch {
        const params = new URLSearchParams(text);
        const obj: Record<string, unknown> = {};
        for (const [k, v] of params.entries()) obj[k] = v;
        payload = obj as CardcomWebhookPayload;
      }
    }
  } catch {
    console.warn("Cardcom webhook: unparseable body (content-type:", ct, ")");
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  console.log("Cardcom webhook received:", {
    DealResponse: payload.DealResponse,
    ResponseCode: payload.ResponseCode,
    InternalDealNumber: payload.InternalDealNumber,
    hasToken: typeof payload.Token === "string" && payload.Token.length > 0,
    LowProfileId: payload.LowProfileId,
    RecurringId: payload.RecurringId,
  });

  if (payload.RecurringId != null) {
    const authorization = verifyRecurringWebhookSecret({
      expectedSecret: process.env.CARDCOM_RECURRING_WEBHOOK_SECRET,
      receivedSecret:
        typeof payload.Secret === "string"
          ? payload.Secret
          : typeof payload.secret === "string"
            ? payload.secret
            : null,
    });
    if (!authorization.ok) {
      console.warn(
        `Cardcom recurring webhook rejected: ${authorization.reason}`,
      );
      return NextResponse.json(
        { ok: false, error: authorization.reason },
        { status: authorization.status },
      );
    }
    try {
      await handleRecurringCharge(payload);
      return NextResponse.json({ ok: true });
    } catch (error) {
      console.error("Cardcom recurring-charge processing failed:", error);
      return NextResponse.json(
        { ok: false, retry: true },
        { status: 503 },
      );
    }
  }

  try {
    await handleFirstCharge(payload);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Cardcom first-charge verification failed:", error);
    return NextResponse.json(
      { ok: false, retry: true },
      { status: 503 },
    );
  }
}

// Cardcom may also GET the URL during setup checks; respond OK
export async function GET() {
  return NextResponse.json({ ok: true });
}

async function handleFirstCharge(payload: CardcomWebhookPayload): Promise<void> {
  const lowProfileId =
    typeof payload.LowProfileId === "string"
      ? payload.LowProfileId.trim()
      : "";
  if (!lowProfileId) return;

  const matchingAgreements = await prisma.agreement.findMany({
    where: { paymentId: lowProfileId },
    take: 2,
    select: {
      id: true,
      tier: true,
      kind: true,
      paymentStatus: true,
      customerName: true,
      monthlyPrice: true,
      oneTimeFee: true,
      clientId: true,
      cardcomRecurringId: true,
      cardcomDealId: true,
      cardcomToken: true,
      cardcomLowProfileId: true,
      invoiceNumber: true,
      paymentId: true,
      email: true,
      phone: true,
      locale: true,
      vatExempt: true,
    },
  });
  if (matchingAgreements.length !== 1) {
    console.warn(
      `Cardcom webhook: expected one agreement for LowProfileId=${lowProfileId}, found ${matchingAgreements.length}`,
    );
    // A customer may have just PAID and nothing recorded it — a log line is
    // not enough. Alert the humans; the money side self-heals via the daily
    // reconcile, but the welcome flow (recurring order, emails) will not run
    // until someone connects this payment to an agreement.
    await notifyAllAdmins({
      type: "AGREEMENT_SIGNED",
      title: "🚨 תשלום קארדקום ללא הסכם תואם",
      body: `LowProfileId=${lowProfileId} — נמצאו ${matchingAgreements.length} הסכמים. ייתכן תשלום אמיתי שלא נקלט.`,
      url: "/admin/agreements",
    }).catch((e) => console.error("webhook orphan alert failed:", e));
    return;
  }
  const agreement = matchingAgreements[0];
  const agreementId = agreement.id;
  const firstChargeNet =
    agreement.monthlyPrice + (agreement.oneTimeFee ?? 0);
  const expectedAmount = agreement.vatExempt
    ? firstChargeNet
    : withVat(firstChargeNet);
  const verified = await verifyLowProfilePayment({
    lowProfileId,
    agreementId,
    expectedAmount,
  });

  if (!verified.success) {
    const failed = await prisma.$transaction((transaction) =>
      applyPaymentFailure(transaction, {
        agreementId,
        providerAttemptId: verified.lowProfileId,
        occurredAt: verified.occurredAt,
        actor: {
          type: "INTEGRATION",
          occurredAt: verified.occurredAt,
        },
      }),
    );
    await runLeadPostCommitEffects(failed.effects).catch((error) =>
      console.error("payment failure notification failed:", error),
    );
    return;
  }

  const paidAmount = verified.amount;
  const cardcomToken = verified.token;
  // Encrypt before persisting; raw token kept only for legacy SOAP fallback.
  const cardcomTokenEncrypted = cardcomToken ? encrypt(cardcomToken) : null;
  const invoiceNumber = verified.invoiceNumber;
  const paidAt = verified.occurredAt;
  const providerTransactionId = verified.transactionId;
  const verifiedAt = new Date();

  const lifecycle = await prisma.$transaction(async (tx) => {
    const result = await applyPaymentSuccess(tx, {
      agreementId,
      providerAttemptId: verified.lowProfileId,
      providerReturnValue: verified.agreementId,
      providerTransactionId,
      paidAt,
      paidAmount,
      verifiedAt,
      actor: { type: "INTEGRATION", occurredAt: paidAt },
    });

    // These are Cardcom/document details, not lifecycle state. They can be
    // repaired by a retry without repeating revenue or commission writes.
    await tx.agreement.update({
      where: { id: agreementId },
      data: {
        cardcomToken: cardcomTokenEncrypted ?? agreement.cardcomToken,
        cardcomLowProfileId: lowProfileId,
        invoiceNumber: invoiceNumber ?? agreement.invoiceNumber,
      },
    });

    // Mirror onto Client card if linked. The gross monthly is derived from
    // the agreement (not the charged amount) so it's known even when Cardcom
    // omits Sum/Amount; only the cumulative `amount` increment depends on a
    // known paidAmount. The monthly figure is written onto the PRODUCT this
    // agreement covers and the client rollup re-derived — writing it straight
    // onto the client would overwrite a multi-product client's total with one
    // product's price (מקורות ₪363 → ₪69 on Aquatis's next charge).
    if (result.paymentRecorded && agreement.clientId) {
      const grossMonthly = agreement.vatExempt
        ? agreement.monthlyPrice
        : withVat(agreement.monthlyPrice);
      await tx.client.update({
        where: { id: agreement.clientId },
        data: {
          paymentDate: paidAt,
          amount: { increment: paidAmount },
        },
      });
      await applyPaymentToProduct(tx, agreement.clientId, agreement.id, grossMonthly, paidAt);
    }
    return result;
  });

  await runLeadPostCommitEffects(lifecycle.effects).catch((error) =>
    console.error("lead payment notification failed:", error),
  );

  // Retries still repair canonical WON/event/commission truth above, but do
  // not repeat revenue, email, admin fan-out or recurring-order creation.
  if (!lifecycle.paymentRecorded) return;

  notifyAllAdmins({
    type: "AGREEMENT_SIGNED",
    title: `תשלום התקבל — ${agreement.customerName}`,
    body: `סכום: ${paidAmount} ₪${invoiceNumber ? ` · חשבונית #${invoiceNumber}` : ""}`,
  }).catch((e) => console.error("notify admins after payment failed:", e));

  sendPaymentReceivedEmail({
    customerName: agreement.customerName,
    amount: paidAmount,
    invoiceNumber: invoiceNumber ?? undefined,
    agreementTier: agreement.tier,
  }).catch((e) => console.error("email after payment failed:", e));

  // Register the monthly recurring schedule with Cardcom via the
  // Name-to-Value API (RecurringPayment.aspx) using the LowProfile GUID.
  // after() runs the call after the 200 response is sent back to Cardcom.
  // The three pre-existing conditions plus an explicit ONE_TIME check. A quote
  // already carries monthlyPrice = 0 and so was safe, but this is the one
  // failure that costs a customer real money — being billed every month for a
  // project they bought once — so it is stated rather than implied.
  if (
    shouldCreateRecurringOrder({
      kind: agreement.kind,
      monthlyPrice: agreement.monthlyPrice,
      cardcomRecurringId: agreement.cardcomRecurringId,
      lowProfileId: lowProfileId ?? null,
    })
  ) {
    after(async () => {
      try {
        console.log("Creating recurring order (NTV) for:", agreementId, {
          lowProfileId,
          monthlyPrice: agreement.monthlyPrice,
        });
        const r = await createRecurringOrderNTV({
          lowProfileDealGuid: lowProfileId,
          // VAT-exempt foreign clients are debited the NET amount; Israeli
          // clients the VAT-inclusive gross. agreement.monthlyPrice is NET.
          monthlyAmount: agreement.vatExempt
            ? agreement.monthlyPrice
            : withVat(agreement.monthlyPrice),
          customerName: agreement.customerName,
          customerEmail: agreement.email,
          customerPhone: agreement.phone ?? undefined,
          productDescription:
            agreement.locale === "en"
              ? `Monthly package — ${agreement.customerName}`
              : `חבילה חודשית — ${agreement.customerName}`,
          agreementId,
          documentLangEnglish: agreement.locale === "en",
          vatFree: agreement.vatExempt,
        });
        console.log("Recurring order created:", r);
        await prisma.agreement.update({
          where: { id: agreementId },
          data: {
            cardcomRecurringId: r.recurringId,
            cardcomAccountId: r.accountId,
          },
        });
        // Foreign recurring uses Cardcom NTV flags (Account.VatFree /
        // IsDocumentLangEnglish) that the NTV endpoint accepts silently — a
        // wrong flag would not error. Ask an admin to eyeball the first
        // recurring invoice (English + 0% VAT) once.
        if (agreement.vatExempt || agreement.locale === "en") {
          await notifyAllAdmins({
            type: "AGREEMENT_SIGNED",
            title: `🌍 הוראת קבע ללקוח חו״ל נוצרה — ${agreement.customerName}`,
            body: `יש לאמת בחשבונית הראשונה ב-Cardcom שהיא באנגלית וב-0% מע״מ.`,
          }).catch(() => {});
        }
      } catch (err) {
        console.error("Cardcom recurring setup failed:", err);
        await notifyAllAdmins({
          type: "AGREEMENT_SIGNED",
          title: `⚠️ הוראת קבע לא נוצרה — ${agreement.customerName}`,
          body: `החיוב הראשון הצליח. הקמת החיוב החודשי נכשלה — להקים ידנית מול Cardcom.`,
        }).catch(() => {});
      }
    });
  } else {
    console.warn("Skipping recurring order:", {
      agreementId,
      hasLowProfileId: !!lowProfileId,
      monthlyPrice: agreement.monthlyPrice,
      hasExistingRecurring: !!agreement.cardcomRecurringId,
    });
  }
}

async function handleRecurringCharge(p: CardcomWebhookPayload): Promise<void> {
  const recurringId = Number(p.RecurringId);
  if (!Number.isFinite(recurringId)) return;
  const dealId = p.InternalDealNumber != null ? String(p.InternalDealNumber) : null;
  if (!dealId) {
    console.warn(
      `Cardcom recurring webhook deferred: missing InternalDealNumber for RecurringId=${recurringId}`,
    );
    return;
  }
  const amount = extractWebhookAmount(p);
  if (amount === null) {
    throw new Error(
      `Cardcom recurring callback ${dealId} has no verified amount`,
    );
  }
  const success = isWebhookSuccess(p);
  const status =
    typeof p.Status === "string"
      ? p.Status.trim() || null
      : success
        ? "SUCCESSFUL"
        : null;
  const result = await recordVerifiedRecurringCharge({
    recurringId,
    providerDealId: dealId,
    amount,
    success,
    status,
    responseCode:
      finiteWebhookInteger(p.ResposeCode) ??
      finiteWebhookInteger(p.ResponseCode),
    billingAttempts: finiteWebhookInteger(p.BillingAttempts),
    invoiceNumber:
      p.DocumentNumber == null ? null : String(p.DocumentNumber),
    providerChargedAt: webhookDate(p.BillingDate),
    rawPayload: safeRecurringAuditPayload(p),
  });
  if (result.reviewRequired) {
    await notifyAllAdmins({
      type: "AGREEMENT_SIGNED",
      title: `⚠️ חיוב חודשי דורש בדיקת הכנסה — ${result.customerName}`,
      body: `עסקה ${dealId} נקלטה, אך לא ניתן היה להוכיח אם ההכנסה ההיסטורית כבר נרשמה.`,
      url: "/admin/finance/debtors",
    });
    return;
  }
  if (result.disposition === "unchanged") return;

  notifyAllAdmins({
    type: "AGREEMENT_SIGNED",
    title: success
      ? `💰 חיוב חודשי התקבל — ${result.customerName}`
      : `⚠️ חיוב חודשי נכשל — ${result.customerName}`,
    body: `₪${result.amount}${result.invoiceNumber ? ` · חשבונית #${result.invoiceNumber}` : ""}`,
  }).catch((e) => console.error("notify admins after recurring charge failed:", e));

  if (result.revenueApplied) {
    sendPaymentReceivedEmail({
      customerName: result.customerName,
      amount: result.amount,
      invoiceNumber: result.invoiceNumber ?? undefined,
      agreementTier: result.tier,
      isRecurring: true,
    }).catch((e) => console.error("email after recurring charge failed:", e));
  }
}

function finiteWebhookInteger(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function webhookDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function safeRecurringAuditPayload(
  payload: CardcomWebhookPayload,
): Prisma.InputJsonObject {
  const safe: Record<string, string | number | boolean> = {};
  for (const key of [
    "RecurringId",
    "InternalDealNumber",
    "DocumentNumber",
    "Sum",
    "Amount",
    "DealResponse",
    "ResponseCode",
    "Status",
    "ResposeCode",
    "BillingAttempts",
    "BillingDate",
  ] as const) {
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
