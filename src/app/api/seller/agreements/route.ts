import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAgreementSchema } from "@/lib/validations";
import { renderAgreement, AGREEMENT_DOCUMENT_VERSION } from "@/lib/agreement-templates";
import {
  createAgreementForLead,
} from "@/lib/leads/agreement-lifecycle";
import { updateLeadContactDetails } from "@/lib/leads/corrections";
import { leadDomainErrorResponse } from "@/lib/leads/http";

// GET - agreements currently credited to this seller. Legacy rows fall back to
// the creator only while no canonical credit has been frozen.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const agreements = await prisma.agreement.findMany({
      where: {
        OR: [
          { creditedSellerId: session.user.id },
          { creditedSellerId: null, createdBy: session.user.id },
        ],
      },
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
      select: {
        agreementId: true,
        agreementRefId: true,
        amount: true,
        status: true,
        briefTaskId: true,
      },
    });
    const byAgreement = new Map(
      commissions.map((commission) => [
        commission.agreementRefId ?? commission.agreementId,
        commission,
      ]),
    );

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
    const sellerId = session.user.id;

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
      leadId,
    } = parsed.data;

    if (!leadId) {
      return NextResponse.json(
        { error: "יצירת חוזה למוכר דורשת ליד מוכשר" },
        { status: 400 },
      );
    }

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

    await updateLeadContactDetails({
      leadId,
      details: {
        name: customerName,
        company: businessName || undefined,
        phone,
        email,
      },
      confirmation: "SELLER_CONFIRMED",
      actor: { userId: sellerId, role: "SELLER" },
    });

    const agreement = await createAgreementForLead({
      leadId,
      actor: { userId: sellerId, role: "SELLER" },
      agreement: {
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
        documentVersion: AGREEMENT_DOCUMENT_VERSION,
      },
    });

    return NextResponse.json(
      {
        id: agreement.id,
        signToken: agreement.signToken,
        customerName: agreement.customerName,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating seller agreement:", error);
    return leadDomainErrorResponse(error);
  }
}
