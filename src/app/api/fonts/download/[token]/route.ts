import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - Public: validate token and return font file URL
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const order = await prisma.fontOrder.findUnique({
      where: { downloadToken: token },
      include: {
        fontFamily: {
          include: {
            styles: {
              select: {
                id: true,
                name: true,
                fontFileUrl: true,
                weight: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Invalid download token" }, { status: 404 });
    }

    if (order.paymentStatus !== "COMPLETED") {
      return NextResponse.json({ error: "Payment not completed" }, { status: 403 });
    }

    // Check if download link has expired
    if (order.expiresAt && new Date() > order.expiresAt) {
      return NextResponse.json({ error: "Download link has expired" }, { status: 410 });
    }

    // Increment download count and set downloadedAt on first download
    await prisma.fontOrder.update({
      where: { id: order.id },
      data: {
        downloadCount: { increment: 1 },
        ...(order.downloadCount === 0 ? { downloadedAt: new Date() } : {}),
      },
    });

    return NextResponse.json({
      orderId: order.id,
      fontFamily: order.fontFamily.name,
      licenseType: order.licenseType,
      styles: order.fontFamily.styles,
      downloadCount: order.downloadCount + 1,
      createdAt: order.createdAt,
    });
  } catch (error) {
    console.error("Error processing download:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
