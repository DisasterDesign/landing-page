import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { compare, hash } from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  currentPassword: z.string().min(1, "סיסמה נוכחית חובה"),
  newPassword: z
    .string()
    .min(8, "סיסמה חדשה חייבת להיות באורך 8 תווים לפחות")
    .max(100),
});

// POST - change the logged-in user's own password (sellers + admins).
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const msg =
        parsed.error.issues[0]?.message ?? "Validation failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, passwordHash: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ok = await compare(parsed.data.currentPassword, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "הסיסמה הנוכחית שגויה" }, { status: 400 });
    }

    if (parsed.data.newPassword === parsed.data.currentPassword) {
      return NextResponse.json(
        { error: "הסיסמה החדשה חייבת להיות שונה מהנוכחית" },
        { status: 400 }
      );
    }

    const passwordHash = await hash(parsed.data.newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error changing password:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
