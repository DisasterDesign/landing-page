import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAgreementSchema } from "@/lib/validations";
import { renderAgreement, AGREEMENT_DOCUMENT_VERSION } from "@/lib/agreement-templates";

// GET - the seller's OWN agreements (created by them), with commission status.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const agreements = await prisma.agreement.findMany({
      where: { createdBy: session.user.id },
      select: {
        id: true,
        tier: true,
        monthlyPrice: true,
        oneTimeFee: true,
        customerName: true,
        businessName: true,
        phone: true,
        status: true,
        paymentStatus: true,
        signToken: true,
        paidAmount: true,
        paidAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Attach the commission row (if any) per agreement so the UI can show
    // "deal closed → ₪X" + whether a brief was already sent.
    const commissions = await prisma.sellerCommission.findMany({
      where: { sellerId: session.user.id },
      select: { agreementId: true, amount: true, status: true, briefTaskId: true },
    });
    const byAgreement = new Map(commissions.map((c) => [c.agreementId, c]));

    const data = agreements.map((a) => ({
      ...a,
      commission: byAgreement.get(a.id) ?? null,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error listing seller agreements:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - seller issues a contract. Forced to the Israeli case (Hebrew, VAT) —
// the foreign-client toggle is admin-only.
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createAgreementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      tier,
      additionalServices,
      monthlyPrice,
      oneTimeFee,
      customerName,
      businessName,
      idNumber,
      phone,
      email,
    } = parsed.data;

    const cleanedExtras = (additionalServices ?? [])
      .map((s) => s.trim())
      .filter(Boolean);

    const content = renderAgreement(tier ?? null, {
      customerName,
      businessName,
      idNumber,
      phone,
      email,
      monthlyPrice,
      oneTimeFee: oneTimeFee ?? null,
      tier: tier ?? null,
      additionalServices: cleanedExtras,
      date: new Date().toLocaleDateString("he-IL"),
      locale: "he",
      vatExempt: false,
    });

    const agreement = await prisma.agreement.create({
      data: {
        tier: tier ?? null,
        additionalServices: cleanedExtras,
        monthlyPrice,
        oneTimeFee: oneTimeFee ?? null,
        customerName,
        businessName: businessName || null,
        idNumber: idNumber || null,
        phone,
        email,
        content,
        locale: "he",
        vatExempt: false,
        isSellerDeal: true,
        documentVersion: AGREEMENT_DOCUMENT_VERSION,
        createdBy: session.user.id,
      },
      select: { id: true, signToken: true, customerName: true },
    });

    return NextResponse.json(agreement, { status: 201 });
  } catch (error) {
    console.error("Error creating seller agreement:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
