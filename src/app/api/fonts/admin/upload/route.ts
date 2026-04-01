import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const ALLOWED_EXTENSIONS = [".otf", ".ttf", ".woff", ".woff2"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const fontSlug = formData.get("fontSlug") as string | null;

    if (!file || !fontSlug) {
      return NextResponse.json(
        { error: "file and fontSlug are required" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    // Validate extension
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}` },
        { status: 400 }
      );
    }

    // Sanitize slug
    const safeSlug = fontSlug.replace(/[^a-zA-Z0-9_-]/g, "");
    if (!safeSlug) {
      return NextResponse.json(
        { error: "Invalid fontSlug" },
        { status: 400 }
      );
    }

    // Create directory if needed
    const dir = path.join(process.cwd(), "public", "fonts", safeSlug);
    await mkdir(dir, { recursive: true });

    // Write file
    const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, "");
    const filePath = path.join(dir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const url = `/fonts/${safeSlug}/${filename}`;
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Font upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
