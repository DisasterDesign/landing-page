export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * Returns the list of Pages from the OAuth-set fb_pages cookie.
 * The page tokens are encrypted; the UI only needs id+name to render.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cookieStore = await cookies();
    const raw = cookieStore.get("fb_pages")?.value;
    if (!raw) return NextResponse.json({ pages: [] });

    try {
      const parsed = JSON.parse(raw) as {
        pages: Array<{ id: string; name: string; access_token: string }>;
      };
      // Don't leak the encrypted token to client; it'll be sent back on subscribe.
      return NextResponse.json({
        pages: parsed.pages.map((p) => ({ id: p.id, name: p.name })),
      });
    } catch {
      return NextResponse.json({ pages: [] });
    }
  } catch (error) {
    console.error("Pages list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
