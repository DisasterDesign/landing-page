import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signAgreementSchema } from "@/lib/validations";
import { renderAgreement } from "@/lib/agreement-templates";
import { notifyAllAdmins } from "@/lib/notifications";

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

    const finalContent = renderAgreement(existing.tier, {
      customerName,
      businessName,
      idNumber,
      phone,
      email,
      date: signedAt.toLocaleDateString("he-IL"),
      signatureData,
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
        status: "SIGNED",
        content: finalContent,
      },
    });

    await notifyAllAdmins({
      type: "AGREEMENT_SIGNED",
      title: `הסכם נחתם — ${customerName}`,
      body: `מסלול ${existing.tier === "BASIC" ? "בסיס" : existing.tier === "ADVANCED" ? "מתקדם" : "פרימיום"}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error signing agreement:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
