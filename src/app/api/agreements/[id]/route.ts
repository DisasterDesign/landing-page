import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { updateAgreementSchema } from "@/lib/validations";
import { renderAgreement, AGREEMENT_DOCUMENT_VERSION } from "@/lib/agreement-templates";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const agreement = await prisma.agreement.findUnique({
      where: { id },
      include: { client: true },
    });

    if (!agreement) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(agreement);
  } catch (error) {
    console.error("Error fetching agreement:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateAgreementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.agreement.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // If any content-affecting field changed on an UNSIGNED agreement, re-render
    // the stored HTML so the customer's preview matches (language, VAT, price,
    // tier, services, party details). Signed agreements are frozen — their
    // content is the legally-binding signed document and must never change.
    const data = { ...parsed.data };
    const contentKeys: (keyof typeof parsed.data)[] = [
      "tier",
      "additionalServices",
      "monthlyPrice",
      "oneTimeFee",
      "customerName",
      "businessName",
      "idNumber",
      "phone",
      "email",
      "locale",
      "vatExempt",
    ];
    const contentChanged = contentKeys.some((k) => k in parsed.data);
    const isUnsigned = existing.status === "DRAFT" || existing.status === "SENT";

    let renderedContent: string | undefined;
    if (contentChanged && isUnsigned) {
      const merged = { ...existing, ...parsed.data };
      const locale = merged.locale === "en" ? "en" : "he";
      renderedContent = renderAgreement(merged.tier, {
        customerName: merged.customerName,
        businessName: merged.businessName ?? undefined,
        idNumber: merged.idNumber ?? undefined,
        phone: merged.phone,
        email: merged.email,
        monthlyPrice: merged.monthlyPrice,
        oneTimeFee: merged.oneTimeFee,
        tier: merged.tier,
        additionalServices: merged.additionalServices,
        date: new Date().toLocaleDateString(locale === "en" ? "en-GB" : "he-IL"),
        locale,
        vatExempt: merged.vatExempt,
      });
    }

    const agreement = await prisma.agreement.update({
      where: { id },
      data: {
        ...data,
        ...(renderedContent
          ? { content: renderedContent, documentVersion: AGREEMENT_DOCUMENT_VERSION }
          : {}),
      },
    });

    return NextResponse.json(agreement);
  } catch (error) {
    console.error("Error updating agreement:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.agreement.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.agreement.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting agreement:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
