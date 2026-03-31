import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createFontOrderSchema } from "@/lib/validations";
import crypto from "crypto";

// POST - Public: create a font order (mock checkout)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createFontOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { customerName, customerEmail, customerPhone, fontFamilyId, licenseType } = parsed.data;

    // Fetch font family with styles to calculate price
    const fontFamily = await prisma.fontFamily.findUnique({
      where: { id: fontFamilyId },
      include: { styles: true },
    });

    if (!fontFamily) {
      return NextResponse.json({ error: "Font family not found" }, { status: 404 });
    }

    if (fontFamily.styles.length === 0) {
      return NextResponse.json({ error: "No styles available" }, { status: 400 });
    }

    // Calculate total price (sum of all styles for the license type)
    const totalPrice = fontFamily.styles.reduce((sum, style) => {
      return sum + (licenseType === "PERSONAL" ? style.pricePersonal : style.priceCommercial);
    }, 0);

    const downloadToken = crypto.randomUUID();

    // Create order — mock: set to COMPLETED immediately
    const order = await prisma.fontOrder.create({
      data: {
        customerName,
        customerEmail,
        customerPhone,
        fontFamilyId,
        licenseType,
        totalPrice,
        currency: "ILS",
        paymentStatus: "COMPLETED",
        downloadToken,
      },
    });

    // Mock payment URL (CardCom integration will be added later)
    const downloadUrl = `/fonts/download/${downloadToken}`;
    const mockPaymentUrl = `/fonts/download/${downloadToken}`;

    return NextResponse.json(
      {
        orderId: order.id,
        downloadToken,
        downloadUrl,
        paymentUrl: mockPaymentUrl,
        totalPrice,
        currency: "ILS",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating font order:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
