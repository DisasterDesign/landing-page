import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const schema = z.object({
  gscSiteUrl: z.string().min(1, "יש לבחור אתר"),
  ga4PropertyId: z.string().min(1, "יש לבחור נכס Analytics"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await prisma.googleIntegration.update({
      where: { userId: session.user.id },
      data: {
        gscSiteUrl: parsed.data.gscSiteUrl,
        ga4PropertyId: parsed.data.ga4PropertyId,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error configuring sites:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
