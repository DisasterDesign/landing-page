import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - the logged-in seller's identity (for "assign to me" in the leads UI)
// + whether they're still on the admin-issued starting password.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mustChangePassword: true },
  });
  return NextResponse.json({
    id: session.user.id,
    name: session.user.name ?? "",
    mustChangePassword: user?.mustChangePassword ?? false,
  });
}
