import { NextResponse } from "next/server";
import { loadDebtorsReport } from "@/lib/finance/debtors-report";
import { requireOwner, viewerErrorResponse } from "@/lib/auth/viewer";

/**
 * The debtors report: everything Cardcom says is not paying cleanly.
 * - problem charges: failed / in-debt-collection / lost, newest first
 * - inactive orders: recurrings Cardcom will not bill again, while the
 *   agreement's client is still on the books
 */
export async function GET() {
  try {
    const viewer = await requireOwner();

    return NextResponse.json(await loadDebtorsReport(viewer));
  } catch (error) {
    const authError = viewerErrorResponse(error);
    if (authError) return authError;
    console.error("Error fetching debtors:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
