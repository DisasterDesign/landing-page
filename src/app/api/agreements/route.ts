import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAgreementSchema } from "@/lib/validations";
import { renderAgreement, AGREEMENT_DOCUMENT_VERSION } from "@/lib/agreement-templates";
import { withVat } from "@/lib/vat";
import type { AgreementStatus, AgreementTier } from "@prisma/client";
import {
  createAgreementForLead,
  createStandaloneAgreement,
} from "@/lib/leads/agreement-lifecycle";
import { updateLeadContactDetails } from "@/lib/leads/corrections";
import { leadDomainErrorResponse } from "@/lib/leads/http";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get("status") as AgreementStatus | null;
    const tier = url.searchParams.get("tier") as AgreementTier | null;

    const agreements = await prisma.agreement.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(tier ? { tier } : {}),
      },
      include: { client: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: agreements });
  } catch (error) {
    console.error("Error fetching agreements:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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
      clientId,
      leadId,
      productId,
      newProductName,
      locale,
      vatExempt,
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
      date: new Date().toLocaleDateString(locale === "en" ? "en-GB" : "he-IL"),
      locale,
      vatExempt,
    });

    // Product coverage is meaningless without a client to hang it on.
    if ((productId || newProductName) && !clientId) {
      return NextResponse.json(
        { error: "שיוך למוצר דורש קישור ללקוח קיים" },
        { status: 400 }
      );
    }
    // Validate the picked product BEFORE creating the agreement, so a bad pick
    // doesn't leave an orphan agreement behind.
    if (clientId && productId) {
      const product = await prisma.clientProduct.findUnique({
        where: { id: productId },
        select: { clientId: true, archivedAt: true },
      });
      if (!product || product.clientId !== clientId || product.archivedAt) {
        return NextResponse.json(
          { error: "המוצר שנבחר אינו שייך ללקוח" },
          { status: 400 }
        );
      }
    }

    if (leadId) {
      await updateLeadContactDetails({
        leadId,
        details: {
          name: customerName,
          company: businessName || undefined,
          phone,
          email,
        },
        confirmation: "ADMIN_CONFIRMED",
        reason: "Agreement creation contact synchronization",
        actor: { userId: session.user.id, role: "ADMIN" },
      });
    }
    const agreementDraft = {
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
        locale,
        vatExempt,
        documentVersion: AGREEMENT_DOCUMENT_VERSION,
        clientId: clientId ?? null,
      } as const;
    const agreement = leadId
      ? await createAgreementForLead({
          leadId,
          actor: { userId: session.user.id, role: "ADMIN" },
          agreement: agreementDraft,
        })
      : await createStandaloneAgreement({
          actor: { userId: session.user.id, role: "ADMIN" },
          agreement: agreementDraft,
        });

    // Wire the agreement to the product it pays for. This is the link the
    // Cardcom webhook resolves by — with it in place, the first verified
    // payment flips the product to "בוצע", stamps its entry month and
    // re-rolls the client's MRR without anyone touching the admin.
    if (clientId && productId) {
      await prisma.clientProduct.update({
        where: { id: productId },
        data: { agreementId: agreement.id },
      });
    } else if (clientId && newProductName) {
      await prisma.clientProduct.create({
        data: {
          clientId,
          name: newProductName,
          // Reference figure only — status stays ריק (not counted in MRR)
          // until the first payment verifies, matching the strike-through
          // presentation in the clients table.
          monthlyAmount: vatExempt ? monthlyPrice : withVat(monthlyPrice),
          status: "",
          agreementId: agreement.id,
        },
      });
    }

    return NextResponse.json(agreement, { status: 201 });
  } catch (error) {
    console.error("Error creating agreement:", error);
    return leadDomainErrorResponse(error);
  }
}
