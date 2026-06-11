import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET - Public (unguessable cuid URL, like agreement signTokens): serve the
// image binary. Must stay public so copied task briefs render images when
// pasted outside the admin (email, docs, Claude). Attachments are immutable,
// so cache hard.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // max-age covers browsers; s-maxage makes Vercel's edge cache absorb
    // repeat fetches (email proxies, doc renderers) instead of hitting the
    // function + Neon every time. Attachments are immutable after upload.
    const cacheControl = "public, max-age=31536000, s-maxage=31536000, immutable";

    // The id doubles as a strong ETag. Verify the row still exists (cheap,
    // no bytes) so deleted attachments return 404 rather than 304-forever.
    if (request.headers.get("if-none-match")?.includes(`"${id}"`)) {
      const exists = await prisma.taskAttachment.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!exists) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: `"${id}"`, "Cache-Control": cacheControl },
      });
    }

    const attachment = await prisma.taskAttachment.findUnique({
      where: { id },
      select: { data: true, mimeType: true, filename: true },
    });

    if (!attachment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const safeFilename = encodeURIComponent(attachment.filename);

    return new NextResponse(new Uint8Array(attachment.data), {
      status: 200,
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Length": String(attachment.data.length),
        "Content-Disposition": `inline; filename*=UTF-8''${safeFilename}`,
        "Cache-Control": cacheControl,
        ETag: `"${id}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Error serving attachment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Auth required: remove an attachment
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const attachment = await prisma.taskAttachment.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!attachment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.taskAttachment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting attachment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
