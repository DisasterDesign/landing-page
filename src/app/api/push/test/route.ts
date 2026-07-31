export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireOwner, viewerErrorResponse } from "@/lib/auth/viewer";
import { sendPushToUser } from "@/lib/push";

export async function POST() {
  try {
    const viewer = await requireOwner();

    await sendPushToUser(viewer.userId, {
      title: "התראת בדיקה ✓",
      body: "ההתראות פעילות. כל פעולה במערכת תקפיץ הודעה למסך.",
      url: viewer.role === "SELLER" ? "/seller" : "/admin",
      tag: "fw-test",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const authResponse = viewerErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Push test error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
