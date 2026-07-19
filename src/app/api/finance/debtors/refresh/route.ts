import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sweepTerminalFailures, getDismissedDebtors, debtorKey } from "@/lib/cardcom-debtors";

export const maxDuration = 60;

/**
 * On-demand run of the terminal-wide debt sweep — same code the 05:30 cron
 * runs, triggered from the debtors screen so the numbers are live when Elad
 * is actually looking at them. New-debtor/grown-debt notifications fire here
 * too; the snapshot diff keeps repeats silent either way.
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const summary = { debtors: 0, newDebtorAlerts: 0 };
    const snapshot = await sweepTerminalFailures(new Date(), summary);

    const dismissed = await getDismissedDebtors();
    const all = Object.values(snapshot).sort((a, b) => b.amount - a.amount);

    return NextResponse.json({
      ...summary,
      terminalDebtors: all.filter((d) => !dismissed[debtorKey(d)]),
      dismissedDebtors: all.filter((d) => dismissed[debtorKey(d)]),
      snapshotUpdatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error refreshing debtors:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
