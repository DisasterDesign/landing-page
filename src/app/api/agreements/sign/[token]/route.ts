import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signAgreementSchema } from "@/lib/validations";
import { renderAgreement, AGREEMENT_DOCUMENT_VERSION } from "@/lib/agreement-templates";
import { notifyAllAdmins } from "@/lib/notifications";
import { ensurePaymentUrlForAgreement } from "@/lib/payments";

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

    const existing = await prisma.agreement.findUnique({
      where: { signToken: token },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (existing.status !== "DRAFT" && existing.status !== "SENT") {
      return NextResponse.json(
        { error: "Agreement is not signable", status: existing.status },
        { status: 410 }
      );
    }

    const { customerName, businessName, idNumber, phone, email, signatureData } = parsed.data;
    const signedAt = new Date();
    const signedIp = getClientIp(request);
    const signedUserAgent = request.headers.get("user-agent");

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
      date: signedAt.toLocaleDateString("he-IL"),
      signatureData,
      signedAt: signedAt.toISOString(),
      signedIp: signedIp ?? undefined,
      signedUserAgent: signedUserAgent ?? undefined,
    });

    const linkedClientId = await ensureClientForAgreement({
      currentClientId: existing.clientId,
      customerName,
      businessName,
      idNumber,
      phone,
      email,
    });

    await prisma.agreement.update({
      where: { signToken: token },
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
        status: "SIGNED",
        content: finalContent,
        ...(linkedClientId ? { clientId: linkedClientId } : {}),
      },
    });

    const tierLabel = existing.tier === "BASIC"
      ? "בסיס"
      : existing.tier === "ADVANCED"
      ? "מתקדם"
      : existing.tier === "PREMIUM"
      ? "פרימיום"
      : "מותאם אישית";

    await notifyAllAdmins({
      type: "AGREEMENT_SIGNED",
      title: `הסכם נחתם — ${customerName}`,
      body: `מסלול ${tierLabel} · ${existing.monthlyPrice.toLocaleString("he-IL")} ₪/חודש`,
    });

    // Best-effort: create a Cardcom payment page so the client can pay
    // immediately after signing. If this fails (Cardcom down, missing creds),
    // we still return success — the admin can resend the payment link later.
    let paymentUrl: string | null = null;
    try {
      const result = await ensurePaymentUrlForAgreement(existing.id);
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

async function ensureClientForAgreement(input: {
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

  const existing = await prisma.client.findFirst({
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
    await prisma.client.update({
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

  const created = await prisma.client.create({
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
