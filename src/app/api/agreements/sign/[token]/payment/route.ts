import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensurePaymentUrlForAgreement } from "@/lib/payments";
import { CardcomError } from "@/lib/cardcom";

export const maxDuration = 30;

/**
 * POST /api/agreements/sign/[token]/payment
 *
 * Token-authenticated endpoint that builds (or returns the cached) Cardcom
 * LowProfile URL for the agreement linked to `token`. Detached from the
 * sign POST so customers always have a recovery path if Cardcom was slow
 * during signing.
 *
 * Auth model: possession of the sign-token IS the auth — the token is a
 * server-generated cuid and not enumerable. Same trust as the GET handler
 * in this folder.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const agreement = await prisma.agreement.findUnique({
      where: { signToken: token },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        paymentUrl: true,
      },
    });

    if (!agreement) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (agreement.status !== "SIGNED") {
      return NextResponse.json(
        { error: "Agreement is not signed yet", status: agreement.status },
        { status: 409 }
      );
    }
    if (agreement.paymentStatus === "COMPLETED") {
      return NextResponse.json(
        { error: "Already paid", paymentStatus: agreement.paymentStatus },
        { status: 409 }
      );
    }

    // If Cardcom already gave us a URL on a previous attempt and we're
    // still in SENT, hand it back without hitting Cardcom again.
    if (agreement.paymentUrl && agreement.paymentStatus === "SENT") {
      return NextResponse.json({ url: agreement.paymentUrl, cached: true });
    }

    const result = await ensurePaymentUrlForAgreement(agreement.id);
    if (!result) {
      return NextResponse.json(
        { error: "Cardcom not configured or agreement not eligible" },
        { status: 502 }
      );
    }
    return NextResponse.json({ url: result.url });
  } catch (error) {
    console.error("Sign payment endpoint error:", error);
    if (error instanceof CardcomError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
