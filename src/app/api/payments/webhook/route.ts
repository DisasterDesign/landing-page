import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isWebhookSuccess,
  extractWebhookAmount,
  createRecurringOrderNTV,
  type CardcomWebhookPayload,
} from "@/lib/cardcom";
import { encrypt } from "@/lib/crypto";
import { withVat } from "@/lib/vat";
import { notifyAllAdmins } from "@/lib/notifications";
import { sendPaymentReceivedEmail } from "@/lib/email";

export const maxDuration = 60;

/**
 * Cardcom server-to-server callback. Must respond 200 quickly so Cardcom
 * doesn't retry. Heavy work is kept minimal (one DB transaction + one
 * notify fan-out).
 *
 * Cardcom does NOT sign webhooks, so we trust the body's status code +
 * ReturnValue. The agreement.id we put in ReturnValue is a server-generated
 * cuid and not enumerable by an attacker, so this is reasonably safe.
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
    ReturnValue: payload.ReturnValue,
    DealResponse: payload.DealResponse,
    ResponseCode: payload.ResponseCode,
    InternalDealNumber: payload.InternalDealNumber,
    Token: payload.Token,
    LowProfileId: payload.LowProfileId,
    RecurringId: payload.RecurringId,
  });

  if (payload.RecurringId != null) {
    await handleRecurringCharge(payload);
    return NextResponse.json({ ok: true });
  }

  await handleFirstCharge(payload);
  return NextResponse.json({ ok: true });
}

// Cardcom may also GET the URL during setup checks; respond OK
export async function GET() {
  return NextResponse.json({ ok: true });
}

async function handleFirstCharge(payload: CardcomWebhookPayload): Promise<void> {
  const agreementId = typeof payload.ReturnValue === "string" ? payload.ReturnValue : null;
  if (!agreementId) return;

  const agreement = await prisma.agreement.findUnique({
    where: { id: agreementId },
    select: {
      id: true,
      tier: true,
      paymentStatus: true,
      customerName: true,
      monthlyPrice: true,
      clientId: true,
      cardcomRecurringId: true,
      email: true,
      phone: true,
    },
  });
  if (!agreement) {
    console.warn(`Cardcom webhook: agreement ${agreementId} not found`);
    return;
  }

  // Idempotency: don't re-process a completed payment
  if (agreement.paymentStatus === "COMPLETED") return;

  if (!isWebhookSuccess(payload)) {
    await prisma.agreement.update({
      where: { id: agreementId },
      data: { paymentStatus: "FAILED" },
    });
    return;
  }

  const paidAmount = extractWebhookAmount(payload);
  const cardcomDealId =
    payload.InternalDealNumber != null ? String(payload.InternalDealNumber) : null;
  const cardcomToken = typeof payload.Token === "string" ? payload.Token : null;
  // Encrypt before persisting; raw token kept only for legacy SOAP fallback.
  const cardcomTokenEncrypted = cardcomToken ? encrypt(cardcomToken) : null;
  const lowProfileId =
    typeof payload.LowProfileId === "string" ? payload.LowProfileId : null;
  const invoiceNumber =
    payload.DocumentNumber != null ? String(payload.DocumentNumber) : null;

  const paidAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.agreement.update({
      where: { id: agreementId },
      data: {
        paymentStatus: "COMPLETED",
        paidAt,
        paidAmount: paidAmount ?? agreement.monthlyPrice,
        ...(cardcomDealId ? { cardcomDealId } : {}),
        ...(cardcomTokenEncrypted ? { cardcomToken: cardcomTokenEncrypted } : {}),
        ...(lowProfileId ? { cardcomLowProfileId: lowProfileId } : {}),
        ...(invoiceNumber ? { invoiceNumber } : {}),
      },
    });

    // Mirror onto Client card if linked
    if (agreement.clientId && paidAmount != null) {
      await tx.client.update({
        where: { id: agreement.clientId },
        data: {
          paymentDate: paidAt,
          // amount = total received from this client; add this transaction
          amount: { increment: paidAmount },
        },
      });
    }
  });

  notifyAllAdmins({
    type: "AGREEMENT_SIGNED",
    title: `תשלום התקבל — ${agreement.customerName}`,
    body: `סכום: ${paidAmount ?? "?"} ₪${invoiceNumber ? ` · חשבונית #${invoiceNumber}` : ""}`,
  }).catch((e) => console.error("notify admins after payment failed:", e));

  sendPaymentReceivedEmail({
    customerName: agreement.customerName,
    amount: paidAmount ?? agreement.monthlyPrice,
    invoiceNumber: invoiceNumber ?? undefined,
    agreementTier: agreement.tier,
  }).catch((e) => console.error("email after payment failed:", e));

  // Register the monthly recurring schedule with Cardcom via the
  // Name-to-Value API (RecurringPayment.aspx) using the LowProfile GUID.
  // after() runs the call after the 200 response is sent back to Cardcom.
  if (
    lowProfileId &&
    agreement.monthlyPrice > 0 &&
    !agreement.cardcomRecurringId
  ) {
    after(async () => {
      try {
        console.log("Creating recurring order (NTV) for:", agreementId, {
          lowProfileId,
          monthlyPrice: agreement.monthlyPrice,
        });
        const r = await createRecurringOrderNTV({
          lowProfileDealGuid: lowProfileId,
          // Cardcom expects the gross amount; agreement.monthlyPrice is NET.
          monthlyAmount: withVat(agreement.monthlyPrice),
          customerName: agreement.customerName,
          customerEmail: agreement.email,
          customerPhone: agreement.phone ?? undefined,
          productDescription: `חבילה חודשית — ${agreement.customerName}`,
          agreementId,
        });
        console.log("Recurring order created:", r);
        await prisma.agreement.update({
          where: { id: agreementId },
          data: {
            cardcomRecurringId: r.recurringId,
            cardcomAccountId: r.accountId,
          },
        });
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

  const agreement = await prisma.agreement.findFirst({
    where: { cardcomRecurringId: recurringId },
    select: {
      id: true,
      tier: true,
      clientId: true,
      customerName: true,
      monthlyPrice: true,
    },
  });
  if (!agreement) {
    console.warn(`Cardcom recurring webhook: unknown RecurringId=${recurringId}`);
    return;
  }

  const amount = extractWebhookAmount(p) ?? agreement.monthlyPrice;
  const dealId = p.InternalDealNumber != null ? String(p.InternalDealNumber) : null;
  const invoice = p.DocumentNumber != null ? String(p.DocumentNumber) : null;
  const success = isWebhookSuccess(p);

  if (dealId) {
    const existing = await prisma.agreementCharge.findFirst({
      where: { cardcomDealId: dealId },
      select: { id: true },
    });
    if (existing) return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.agreementCharge.create({
      data: {
        agreementId: agreement.id,
        amount,
        cardcomDealId: dealId,
        invoiceNumber: invoice,
        cardcomRecurringId: recurringId,
        success,
        rawPayload: p as object,
      },
    });
    if (success && agreement.clientId) {
      await tx.client.update({
        where: { id: agreement.clientId },
        data: {
          amount: { increment: amount },
          paymentDate: new Date(),
        },
      });
    }
  });

  notifyAllAdmins({
    type: "AGREEMENT_SIGNED",
    title: success
      ? `💰 חיוב חודשי התקבל — ${agreement.customerName}`
      : `⚠️ חיוב חודשי נכשל — ${agreement.customerName}`,
    body: `₪${amount}${invoice ? ` · חשבונית #${invoice}` : ""}`,
  }).catch((e) => console.error("notify admins after recurring charge failed:", e));

  if (success) {
    sendPaymentReceivedEmail({
      customerName: agreement.customerName,
      amount,
      invoiceNumber: invoice ?? undefined,
      agreementTier: agreement.tier,
      isRecurring: true,
    }).catch((e) => console.error("email after recurring charge failed:", e));
  }
}
