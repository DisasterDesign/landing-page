import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { attachmentMetaSelect } from "@/lib/attachment-select";

// Vercel serverless caps request bodies at ~4.5MB; stay safely under it.
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

// POST - Auth required: upload an image attachment to a task (multipart form)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const task = await prisma.task.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
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
        taskId: id,
        uploaderId: session.user.id!,
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
    console.error("Error uploading attachment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
