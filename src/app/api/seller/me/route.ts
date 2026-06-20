import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// GET - the logged-in seller's identity (for "assign to me" in the leads UI).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    id: session.user.id,
    name: session.user.name ?? "",
  });
}
