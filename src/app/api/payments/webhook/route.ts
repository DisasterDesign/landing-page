import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isWebhookSuccess,
  extractWebhookAmount,
  type CardcomWebhookPayload,
} from "@/lib/cardcom";
import { notifyAllAdmins } from "@/lib/notifications";

/**
 * Cardcom server-to-server callback. Must respond 200 quickly so Cardcom
 * doesn't retry. Heavy work is kept minimal (one DB transaction + one
 * notify fan-out).
 *
 * Cardcom does NOT sign webhooks, so we trust the body's status code +
 * ReturnValue. The agreement.id we put in ReturnValue is a server-generated
 * cuid and not enumerable by an attacker, so this is reasonably safe.
 */
export async function POST(request: NextRequest) {
  let payload: CardcomWebhookPayload;
  try {
    payload = (await request.json()) as CardcomWebhookPayload;
  } catch {
    // Cardcom sometimes posts as form-encoded
    try {
      const form = await request.formData();
      const obj: Record<string, unknown> = {};
      for (const [k, v] of form.entries()) obj[k] = typeof v === "string" ? v : String(v);
      payload = obj as CardcomWebhookPayload;
    } catch {
      console.warn("Cardcom webhook: unparseable body");
      return NextResponse.json({ ok: true }, { status: 200 });
    }
  }

  console.log("Cardcom webhook received:", {
    ReturnValue: payload.ReturnValue,
    DealResponse: payload.DealResponse,
    ResponseCode: payload.ResponseCode,
    InternalDealNumber: payload.InternalDealNumber,
    LowProfileId: payload.LowProfileId,
  });

  const agreementId = typeof payload.ReturnValue === "string" ? payload.ReturnValue : null;
  if (!agreementId) {
    return NextResponse.json({ ok: true, ignored: "no ReturnValue" });
  }

  const agreement = await prisma.agreement.findUnique({
    where: { id: agreementId },
    select: { id: true, paymentStatus: true, customerName: true, monthlyPrice: true, clientId: true },
  });
  if (!agreement) {
    console.warn(`Cardcom webhook: agreement ${agreementId} not found`);
    return NextResponse.json({ ok: true, ignored: "agreement not found" });
  }

  // Idempotency: don't re-process a completed payment
  if (agreement.paymentStatus === "COMPLETED") {
    return NextResponse.json({ ok: true, ignored: "already completed" });
  }

  if (!isWebhookSuccess(payload)) {
    await prisma.agreement.update({
      where: { id: agreementId },
      data: { paymentStatus: "FAILED" },
    });
    return NextResponse.json({ ok: true, status: "failed" });
  }

  // Success path
  const paidAmount = extractWebhookAmount(payload);
  const cardcomDealId =
    payload.InternalDealNumber != null ? String(payload.InternalDealNumber) : null;
  const cardcomToken = typeof payload.Token === "string" ? payload.Token : null;
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
        ...(cardcomToken ? { cardcomToken } : {}),
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

  // Fire-and-forget admin notification (don't block webhook response)
  notifyAllAdmins({
    type: "AGREEMENT_SIGNED",
    title: `תשלום התקבל — ${agreement.customerName}`,
    body: `סכום: ${paidAmount ?? "?"} ₪${invoiceNumber ? ` · חשבונית #${invoiceNumber}` : ""}`,
  }).catch((e) => console.error("notify admins after payment failed:", e));

  return NextResponse.json({ ok: true, status: "completed" });
}

// Cardcom may also GET the URL during setup checks; respond OK
export async function GET() {
  return NextResponse.json({ ok: true });
}
