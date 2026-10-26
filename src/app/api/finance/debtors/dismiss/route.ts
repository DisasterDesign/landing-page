import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner, viewerErrorResponse } from "@/lib/auth/viewer";
import { DebtorDismissalError } from "@/lib/debtor-dismissal";
import { persistDebtorDismissal } from "@/lib/debtor-dismissal-store";

/** Change report visibility only. The debt and Cardcom orders stay untouched. */
export async function POST(req: NextRequest) {
  try {
    await requireOwner();
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
    }
    // The map is one JSON value: concurrent owners must not replace each
    // other's hides. Serializable conflicts reload the full map before retry.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await prisma.$transaction(
          (tx) => persistDebtorDismissal(body, tx.keyValue),
          { isolationLevel: "Serializable" },
        );
        return NextResponse.json({ ok: true, ...result });
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "P2034" && attempt < 2) continue;
        throw error;
      }
    }
    throw new Error("Dismissal transaction exhausted retries");
  } catch (error) {
    const authError = viewerErrorResponse(error);
    if (authError) return authError;
    if (error instanceof DebtorDismissalError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error dismissing debtor:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
