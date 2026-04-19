export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendPushToUser } from "@/lib/push";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await sendPushToUser(session.user.id, {
      title: "התראת בדיקה ✓",
      body: "ההתראות פעילות. כל פעולה במערכת תקפיץ הודעה למסך.",
      url: "/admin",
      tag: "fw-test",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Push test error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
