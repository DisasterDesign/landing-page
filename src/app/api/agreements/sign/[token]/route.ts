import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { signAgreementSchema } from "@/lib/validations";
import { renderAgreement, AGREEMENT_DOCUMENT_VERSION } from "@/lib/agreement-templates";
import { notifyAllAdmins } from "@/lib/notifications";
import { ensurePaymentUrlForAgreement } from "@/lib/payments";
import { applyAgreementEventInTransaction } from "@/lib/leads/agreement-lifecycle";

export const maxDuration = 30;

function getClientIp(request: NextRequest): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const agreement = await prisma.agreement.findUnique({
      where: { signToken: token },
      select: {
        id: true,
        tier: true,
        monthlyPrice: true,
        oneTimeFee: true,
        customerName: true,
        businessName: true,
        idNumber: true,
        phone: true,
        email: true,
        status: true,
        content: true,
        signedAt: true,
        locale: true,
        vatExempt: true,
      },
    });

    if (!agreement) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (agreement.status === "SIGNED" || agreement.status === "CANCELLED") {
      return NextResponse.json(
        {
          error: "Already finalized",
          status: agreement.status,
          signedAt: agreement.signedAt,
        },
        { status: 410 }
      );
    }

    return NextResponse.json(agreement);
  } catch (error) {
    console.error("Error fetching sign agreement:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const parsed = signAgreementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { customerName, businessName, idNumber, phone, email, signatureData } = parsed.data;
    const signedAt = new Date();
    const signedIp = getClientIp(request);
    const signedUserAgent = request.headers.get("user-agent");

    const signed = await prisma.$transaction(async (transaction) => {
      const lockRows = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Agreement" WHERE "signToken" = ${token} FOR UPDATE
      `;
      if (lockRows.length === 0) return { outcome: "NOT_FOUND" as const };

      const existing = await transaction.agreement.findUnique({
        where: { signToken: token },
      });
      if (!existing) return { outcome: "NOT_FOUND" as const };
      if (existing.status === "CANCELLED") {
        return { outcome: "CANCELLED" as const };
      }
      if (existing.status === "SIGNED") {
        return {
          outcome: "SIGNED" as const,
          newlySigned: false,
          agreement: existing,
        };
      }

      const locale = existing.locale === "en" ? "en" : "he";
      const finalContent = renderAgreement(existing.tier, {
        customerName,
        businessName,
        idNumber,
        phone,
        email,
        monthlyPrice: existing.monthlyPrice,
        oneTimeFee: existing.oneTimeFee,
        tier: existing.tier,
        additionalServices: existing.additionalServices,
        date: signedAt.toLocaleDateString(locale === "en" ? "en-GB" : "he-IL"),
        signatureData,
        signedAt: signedAt.toISOString(),
        signedIp: signedIp ?? undefined,
        signedUserAgent: signedUserAgent ?? undefined,
        locale,
        vatExempt: existing.vatExempt,
        // One-off custom proposals (e.g. Ormat video) render their own legal body.
        customBodyHtml: existing.customBodyHtml ?? undefined,
      });

      const linkedClientId = await ensureClientForAgreement(transaction, {
        currentClientId: existing.clientId,
        customerName,
        businessName,
        idNumber,
        phone,
        email,
      });

      const updated = await transaction.agreement.update({
        where: { id: existing.id },
        data: {
          customerName,
          businessName: businessName || null,
          idNumber: idNumber || null,
          phone,
          email,
          signatureData,
          signedAt,
          signedIp: signedIp ?? null,
          signedUserAgent: signedUserAgent ?? null,
          documentVersion: AGREEMENT_DOCUMENT_VERSION,
          content: finalContent,
          clientId: linkedClientId ?? existing.clientId,
        },
      });

      await applyAgreementEventInTransaction(transaction, {
        agreementId: existing.id,
        type: "SIGNED",
        actor: {
          type: "INTEGRATION",
          occurredAt: signedAt,
        },
      });

      // Derive VAT status from all signed agreements inside the same commit as
      // the legal document and lifecycle event.
      if (linkedClientId) {
        await recomputeClientVatExempt(transaction, linkedClientId);
      }

      return {
        outcome: "SIGNED" as const,
        newlySigned: true,
        agreement: { ...updated, status: "SIGNED" as const },
      };
    });

    if (signed.outcome === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (signed.outcome === "CANCELLED") {
      return NextResponse.json(
        { error: "Agreement is not signable", status: "CANCELLED" },
        { status: 410 },
      );
    }

    const agreement = signed.agreement;
    const tierLabel = agreement.tier === "LANDING"
      ? "דף נחיתה"
      : agreement.tier === "BASIC"
      ? "בסיס"
      : agreement.tier === "ADVANCED"
      ? "מתקדם"
      : agreement.tier === "PREMIUM"
      ? "פרימיום"
      : "מותאם אישית";

    if (signed.newlySigned) {
      await notifyAllAdmins({
        type: "AGREEMENT_SIGNED",
        title: `הסכם נחתם — ${agreement.customerName}`,
        body: `מסלול ${tierLabel} · ${agreement.monthlyPrice.toLocaleString("he-IL")} ₪/חודש`,
      });
    }

    // Best-effort: create a Cardcom payment page so the client can pay
    // immediately after signing. If this fails (Cardcom down, missing creds),
    // we still return success — the admin can resend the payment link later.
    let paymentUrl: string | null = null;
    try {
      const result = await ensurePaymentUrlForAgreement(agreement.id);
      paymentUrl = result?.url ?? null;
    } catch (err) {
      console.error("Failed to create Cardcom payment page after sign:", err);
    }

    return NextResponse.json({ success: true, paymentUrl });
  } catch (error) {
    console.error("Error signing agreement:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function ensureClientForAgreement(transaction: Prisma.TransactionClient, input: {
  currentClientId: string | null;
  customerName: string;
  businessName?: string;
  idNumber?: string;
  phone: string;
  email: string;
}): Promise<string | null> {
  if (input.currentClientId) {
    return input.currentClientId;
  }

  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedPhone = input.phone.replace(/\D/g, "");

  const existing = await transaction.client.findFirst({
    where: {
      OR: [
        { email: { equals: normalizedEmail, mode: "insensitive" } },
        ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
      ],
      archivedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    await transaction.client.update({
      where: { id: existing.id },
      data: {
        name: existing.name || input.customerName,
        email: existing.email || normalizedEmail,
        phone: existing.phone || normalizedPhone || input.phone,
        businessName: existing.businessName || input.businessName || null,
        idNumber: existing.idNumber || input.idNumber || null,
      },
    });
    return existing.id;
  }

  const created = await transaction.client.create({
    data: {
      name: input.customerName,
      email: normalizedEmail,
      phone: normalizedPhone || input.phone,
      businessName: input.businessName || null,
      idNumber: input.idNumber || null,
      source: "agreement_signed",
      status: "פעיל",
    },
  });
  return created.id;
}

/**
 * A client's revenue is zero-rated only when ALL of its signed agreements are
 * VAT-exempt. Recomputed (in both directions) on every sign so the partner
 * report never zero-rates a client who also has a gross (VAT-bearing) Israeli
 * agreement.
 */
async function recomputeClientVatExempt(
  transaction: Prisma.TransactionClient,
  clientId: string,
): Promise<void> {
  const signed = await transaction.agreement.findMany({
    where: { clientId, status: "SIGNED" },
    select: { vatExempt: true },
  });
  const vatExempt = signed.length > 0 && signed.every((a) => a.vatExempt);
  await transaction.client.update({
    where: { id: clientId },
    data: { vatExempt },
  });
}
