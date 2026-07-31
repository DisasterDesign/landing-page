import { NextResponse } from "next/server";
import { requireOwner, viewerErrorResponse } from "@/lib/auth/viewer";
import { sweepTerminalFailures, bucketDebtors } from "@/lib/cardcom-debtors";

export const maxDuration = 60;

/**
 * On-demand run of the terminal-wide debt sweep — same code the 05:30 cron
 * runs, triggered from the debtors screen so the numbers are live when Elad
 * is actually looking at them. New-debtor/grown-debt notifications fire here
 * too; the snapshot diff keeps repeats silent either way.
 */
export async function POST() {
  try {
    await requireOwner();

    const summary = { debtors: 0, newDebtorAlerts: 0, settled: 0 };
    const snapshot = await sweepTerminalFailures(new Date(), summary);
    const buckets = await bucketDebtors(snapshot);

    return NextResponse.json({
      ...summary,
      ...buckets,
      snapshotUpdatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const authError = viewerErrorResponse(error);
    if (authError) return authError;
    console.error("Error refreshing debtors:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
