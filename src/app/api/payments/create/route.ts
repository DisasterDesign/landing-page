import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ensurePaymentUrlForAgreement } from "@/lib/payments";
import { CardcomError } from "@/lib/cardcom";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const agreementId = String(body?.agreementId ?? "").trim();
    if (!agreementId) {
      return NextResponse.json({ error: "agreementId required" }, { status: 400 });
    }

    const result = await ensurePaymentUrlForAgreement(agreementId);
    if (!result) {
      return NextResponse.json(
        { error: "Cardcom not configured or agreement not eligible (paid / no amount)" },
        { status: 409 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error creating payment page:", error);
    if (error instanceof CardcomError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
