import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * The debtors report: everything Cardcom says is not paying cleanly.
 * - problem charges: failed / in-debt-collection / lost, newest first
 * - inactive orders: recurrings Cardcom will not bill again, while the
 *   agreement's client is still on the books
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [problemCharges, inactiveOrders] = await Promise.all([
      prisma.agreementCharge.findMany({
        where: {
          OR: [
            { success: false },
            { status: { in: ["DEBTAUTOBILLING", "LOSTDEBT", "ONHOLD"] } },
          ],
        },
        orderBy: { chargedAt: "desc" },
        take: 100,
        select: {
          id: true,
          amount: true,
          status: true,
          responseCode: true,
          billingAttempts: true,
          cardcomChargeDate: true,
          chargedAt: true,
          invoiceNumber: true,
          agreement: {
            select: {
              id: true,
              customerName: true,
              businessName: true,
              monthlyPrice: true,
              cardcomIsActive: true,
              cardcomNextBillDate: true,
              client: { select: { id: true, name: true, number: true } },
            },
          },
        },
      }),
      prisma.agreement.findMany({
        where: {
          cardcomIsActive: false,
          client: { archivedAt: null },
        },
        select: {
          id: true,
          customerName: true,
          businessName: true,
          monthlyPrice: true,
          cardcomNextBillDate: true,
          cardcomSyncedAt: true,
          client: { select: { id: true, name: true, number: true, monthlyAmount: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    return NextResponse.json({ problemCharges, inactiveOrders });
  } catch (error) {
    console.error("Error fetching debtors:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
