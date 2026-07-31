export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwner, viewerErrorResponse } from "@/lib/auth/viewer";

const createSchema = z.object({
  baseUrl: z.string().url("כתובת לא תקינה"),
  source: z.string().min(1, "מקור נדרש"),
  medium: z.string().min(1, "מדיום נדרש"),
  campaign: z.string().min(1, "קמפיין נדרש"),
  term: z.string().optional(),
  content: z.string().optional(),
  label: z.string().optional(),
});

function buildUtmUrl(input: z.infer<typeof createSchema>): string {
  const url = new URL(input.baseUrl);
  url.searchParams.set("utm_source", input.source);
  url.searchParams.set("utm_medium", input.medium);
  url.searchParams.set("utm_campaign", input.campaign);
  if (input.term) url.searchParams.set("utm_term", input.term);
  if (input.content) url.searchParams.set("utm_content", input.content);
  return url.toString();
}

export async function GET() {
  try {
    const { userId } = await requireOwner();

    const links = await prisma.utmLink.findMany({
      where: { createdBy: userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ links });
  } catch (error) {
    const authResponse = viewerErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("UTM list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireOwner();

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const fullUrl = buildUtmUrl(parsed.data);

    const link = await prisma.utmLink.create({
      data: {
        fullUrl,
        baseUrl: parsed.data.baseUrl,
        source: parsed.data.source,
        medium: parsed.data.medium,
        campaign: parsed.data.campaign,
        term: parsed.data.term,
        content: parsed.data.content,
        label: parsed.data.label,
        createdBy: userId,
      },
    });

    return NextResponse.json({ link }, { status: 201 });
  } catch (error) {
    const authResponse = viewerErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("UTM create error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
