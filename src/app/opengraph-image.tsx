import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { OG_IMAGE_SIZE, OG_IMAGE_ALT, OG_MARKETING_IMAGE_PATH } from "@/lib/og-image";

export const alt = OG_IMAGE_ALT;
export const size = OG_IMAGE_SIZE;
export const contentType = "image/jpeg";

export default async function Image() {
  const image = await readFile(join(process.cwd(), "public", OG_MARKETING_IMAGE_PATH));
  return new Response(image, { headers: { "Content-Type": contentType } });
}
