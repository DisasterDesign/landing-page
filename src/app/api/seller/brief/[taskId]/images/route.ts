import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { attachmentMetaSelect } from "@/lib/attachment-select";

// Mirrors /api/tasks/[id]/attachments but scoped to a seller's OWN brief task.
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB (Vercel body cap ~4.5MB)
const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { taskId } = await params;

    // The seller may only attach to a brief task they themselves created.
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, creatorId: true },
    });
    if (!task || task.creatorId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Only PNG, JPEG, WebP or GIF images are allowed" },
        { status: 400 }
      );
    }
    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Image must be between 1 byte and 4MB" },
        { status: 400 }
      );
    }

    const width = parseInt(String(formData.get("width") ?? ""), 10);
    const height = parseInt(String(formData.get("height") ?? ""), 10);
    const filename =
      (file.name || "image").replace(/[\r\n"\\]/g, "").slice(0, 200) || "image";
    const bytes = Buffer.from(await file.arrayBuffer());

    const attachment = await prisma.taskAttachment.create({
      data: {
        taskId,
        uploaderId: session.user.id,
        filename,
        mimeType: file.type,
        size: bytes.length,
        width: Number.isFinite(width) && width > 0 ? width : null,
        height: Number.isFinite(height) && height > 0 ? height : null,
        data: bytes,
      },
      select: attachmentMetaSelect,
    });

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    console.error("Error uploading brief image:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
