import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  PersistedRoleAuthorizationError,
  requirePersistedUserRole,
} from "@/lib/auth/persisted-role";
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
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await requirePersistedUserRole(session.user.id, ["ADMIN"]);

    const summary = { debtors: 0, newDebtorAlerts: 0, settled: 0 };
    const snapshot = await sweepTerminalFailures(new Date(), summary);
    const buckets = await bucketDebtors(snapshot);

    return NextResponse.json({
      ...summary,
      ...buckets,
      snapshotUpdatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof PersistedRoleAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error refreshing debtors:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
