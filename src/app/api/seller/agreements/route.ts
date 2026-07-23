import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAgreementSchema } from "@/lib/validations";
import { renderAgreement, AGREEMENT_DOCUMENT_VERSION } from "@/lib/agreement-templates";
import {
  createAgreementForLead,
} from "@/lib/leads/agreement-lifecycle";
import {
  canSellerManageAgreement,
  requirePersistedLeadReadRole,
  sellerAgreementScope,
  sellerAgreementOperationalFields,
} from "@/lib/leads/authorization";
import { updateLeadContactDetails } from "@/lib/leads/corrections";
import { leadDomainErrorResponse } from "@/lib/leads/http";

// GET - linked agreements are visible to the current operational owner and to
// the frozen-credit seller for financial history. Only a canonically ready
// current owner gets canManage; legacy/exception rows remain read-only.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const sellerId = session.user.id;
    await requirePersistedLeadReadRole(
      session.user.id,
      ["ADMIN", "SELLER"],
    );
    const agreements = await prisma.agreement.findMany({
      where: sellerAgreementScope(sellerId),
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
        lead: {
          select: {
            id: true,
            ownerId: true,
            migrationReviewRequired: true,
            intentLevel: true,
            sourceKey: true,
            stage: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Attach the commission row (if any) per agreement so the UI can show
    // "deal closed → ₪X" + whether a brief was already sent.
    const commissions = await prisma.sellerCommission.findMany({
      where: { sellerId },
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

    const data = agreements.map(
      ({ lead, phone, signToken, ...agreement }) => {
        const canManage = canSellerManageAgreement(sellerId, { lead });
        return {
          ...agreement,
          lead: lead
            ? {
                id: lead.id,
                intentLevel: lead.intentLevel,
                sourceKey: lead.sourceKey,
                stage: lead.stage,
              }
            : null,
          canManage,
          ...sellerAgreementOperationalFields(canManage, {
            phone,
            signToken,
          }),
          commission: byAgreement.get(agreement.id) ?? null,
        };
      },
    );

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error listing seller agreements:", error);
    return leadDomainErrorResponse(error);
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
