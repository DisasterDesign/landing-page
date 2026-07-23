import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  PersistedRoleAuthorizationError,
  requirePersistedUserRole,
} from "@/lib/auth/persisted-role";
import { DEBTORS_DISMISSED_KEY, getDismissedDebtors } from "@/lib/cardcom-debtors";

/**
 * Mark a terminal debtor as irrelevant (or restore it). Dismissed debtors
 * stay in the snapshot — the debt is still real at Cardcom — but disappear
 * from the main list and never fire alerts.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await requirePersistedUserRole(session.user.id, ["ADMIN"]);

    const body = (await req.json()) as { key?: string; name?: string; dismissed?: boolean };
    const key = typeof body.key === "string" ? body.key.trim() : "";
    if (!key) {
      return NextResponse.json({ error: "key חובה" }, { status: 400 });
    }

    const dismissed = await getDismissedDebtors();
    if (body.dismissed === false) {
      delete dismissed[key];
    } else {
      dismissed[key] = { name: body.name || key, dismissedAt: new Date().toISOString() };
    }

    await prisma.keyValue.upsert({
      where: { key: DEBTORS_DISMISSED_KEY },
      create: { key: DEBTORS_DISMISSED_KEY, value: dismissed as object },
      update: { value: dismissed as object },
    });

    return NextResponse.json({ ok: true, dismissedCount: Object.keys(dismissed).length });
  } catch (error) {
    if (error instanceof PersistedRoleAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error dismissing debtor:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
