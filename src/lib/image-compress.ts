/**
 * Client-side image compression for task attachments.
 *
 * Screenshots pasted from clipboard are usually large PNGs (1-8MB). We
 * downscale to max 1920px and re-encode as WebP before upload so that:
 *  - uploads stay under the 4MB route limit (Vercel caps bodies at ~4.5MB)
 *  - rows in Postgres stay small (~100-300KB per screenshot)
 * If re-encoding fails or comes out larger, the original file is kept.
 */

const MAX_DIMENSION = 1920;
const WEBP_QUALITY = 0.85;
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // keep in sync with the API route

// Mime types the upload API accepts — anything else MUST be re-encoded.
const SERVER_ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export interface CompressedImage {
  blob: Blob;
  filename: string;
  width: number;
  height: number;
}

function replaceExtension(name: string, ext: string): string {
  const base = name.replace(/\.[a-zA-Z0-9]+$/, "");
  return `${base || "image"}.${ext}`;
}

async function decodeImage(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to <img> decoding (e.g. unsupported source)
    }
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to decode image"));
    };
    img.src = url;
  });
}

function dimensionsOf(source: ImageBitmap | HTMLImageElement): {
  width: number;
  height: number;
} {
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  return { width: source.width, height: source.height };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Compress an image file for upload. Animated GIFs are passed through
 * untouched (canvas re-encoding would drop the animation).
 */
export async function compressImage(file: File): Promise<CompressedImage> {
  if (file.type === "image/gif") {
    const source = await decodeImage(file);
    const { width, height } = dimensionsOf(source);
    if ("close" in source) source.close();
    return { blob: file, filename: file.name || "image.gif", width, height };
  }

  const source = await decodeImage(file);
  const { width, height } = dimensionsOf(source);

  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");

  let result: CompressedImage = {
    blob: file,
    filename: file.name || "image.png",
    width,
    height,
  };

  // Types the server rejects (avif, bmp, tiff...) must not pass through as-is.
  const mustReencode = !SERVER_ALLOWED_TYPES.has(file.type);

  if (ctx) {
    ctx.drawImage(source, 0, 0, targetW, targetH);

    // Safari has no WebP encoder — toBlob falls back to a PNG-typed blob (or
    // null), so verify the type and re-encode as PNG explicitly to keep the
    // downscale instead of discarding it.
    let candidate = await canvasToBlob(canvas, "image/webp", WEBP_QUALITY);
    if (!candidate || candidate.type !== "image/webp") {
      candidate = await canvasToBlob(canvas, "image/png", 1);
      if (candidate && candidate.type !== "image/png") candidate = null;
    }

    // Keep the re-encode when it helps (smaller / was scaled down) or when the
    // original type wouldn't be accepted by the server anyway.
    if (candidate && (mustReencode || candidate.size < file.size || scale < 1)) {
      result = {
        blob: candidate,
        filename: replaceExtension(
          file.name || "image",
          candidate.type === "image/webp" ? "webp" : "png"
        ),
        width: targetW,
        height: targetH,
      };
    }
  }

  if ("close" in source) source.close();

  if (mustReencode && result.blob === file) {
    throw new Error(`Unsupported image type: ${file.type}`);
  }

  return result;
}

/** Extract image files from a paste event's clipboard data (if any). */
export function imagesFromClipboard(e: ClipboardEvent): File[] {
  const items = e.clipboardData?.items;
  if (!items) return [];
  const files: File[] = [];
  for (const item of Array.from(items)) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  return files;
}

/** Extract image files from a drop event (if any). */
export function imagesFromDrop(e: React.DragEvent | DragEvent): File[] {
  const files = ("dataTransfer" in e && e.dataTransfer?.files) || null;
  if (!files) return [];
  return Array.from(files).filter((f) => f.type.startsWith("image/"));
}
