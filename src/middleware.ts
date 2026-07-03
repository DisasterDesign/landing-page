import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  // Rate limit mutating requests
  if (["POST", "PATCH", "DELETE"].includes(req.method)) {
    // Attachment uploads are one POST per pasted screenshot — a bulk paste
    // would burn the shared 30/min budget, so give them their own wider bucket.
    const isAttachmentUpload =
      req.method === "POST" && /^\/api\/tasks\/[^/]+\/attachments$/.test(pathname);
    const { ok } = isAttachmentUpload
      ? rateLimit(`attach-up:${ip}`, 120)
      : rateLimit(ip);
    if (!ok) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }
  }

  // Bound anonymous reads of public attachment binaries (the only public GET
  // that does a per-request DB read of up to 4MB).
  if (req.method === "GET" && pathname.startsWith("/api/attachments/")) {
    const { ok } = rateLimit(`attach-get:${ip}`, 120);
    if (!ok) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  }

  // Allow public auth routes
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Allow public agreement signing endpoints
  if (pathname.startsWith("/api/agreements/sign/")) {
    return NextResponse.next();
  }

  // Allow public version endpoint (used by VersionTag refresh button)
  if (pathname === "/api/version") {
    return NextResponse.next();
  }

  // Allow public Meta webhook endpoint
  if (pathname.startsWith("/api/webhooks/facebook")) {
    return NextResponse.next();
  }

  // Allow public GET of task attachment binaries — URLs carry an unguessable
  // cuid (same model as agreement signTokens) so copied briefs render images
  // when pasted outside the admin. Upload/delete stay behind auth.
  if (pathname.startsWith("/api/attachments/") && req.method === "GET") {
    return NextResponse.next();
  }

  // Allow public Cardcom payment webhook (server-to-server, no auth header)
  if (pathname === "/api/payments/webhook") {
    return NextResponse.next();
  }

  // Allow Vercel cron endpoints — each route handler enforces its own
  // vercel-cron UA + CRON_SECRET check.
  if (pathname.startsWith("/api/cron/")) {
    return NextResponse.next();
  }

  // Allow public POST to /api/contacts
  if (pathname === "/api/contacts" && req.method === "POST") {
    return NextResponse.next();
  }

  // Allow public GET to /api/blog and /api/fonts
  if (
    (pathname.startsWith("/api/blog") || pathname.startsWith("/api/fonts")) &&
    req.method === "GET" &&
    !pathname.includes("/admin")
  ) {
    return NextResponse.next();
  }

  // Push subscription endpoints: sellers get new-lead notifications on
  // mobile, so they must be able to subscribe. SELLER and ADMIN only.
  if (pathname.startsWith("/api/push/")) {
    if (!isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userRole = (req.auth?.user as Record<string, unknown>)?.role;
    if (userRole !== "SELLER" && userRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.next();
  }

  // Seller-scoped API: open to SELLER and ADMIN only. Must come BEFORE the
  // ADMIN-only blanket gate below.
  if (pathname.startsWith("/api/seller/")) {
    if (!isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userRole = (req.auth?.user as Record<string, unknown>)?.role;
    if (userRole !== "SELLER" && userRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.next();
  }

  // Protect all other API routes
  if (pathname.startsWith("/api/")) {
    if (!isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Check admin role for API routes
    const userRole = (req.auth?.user as Record<string, unknown>)?.role;
    if (userRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.next();
  }

  // Protect /seller/* pages — SELLER and ADMIN only.
  if (pathname.startsWith("/seller")) {
    if (!isLoggedIn) {
      const loginUrl = new URL("/admin/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    const userRole = (req.auth?.user as Record<string, unknown>)?.role;
    if (userRole !== "SELLER" && userRole !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // Protect /admin/* (except /admin/login)
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (!isLoggedIn) {
      const loginUrl = new URL("/admin/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    // Check admin role for admin pages
    const userRole = (req.auth?.user as Record<string, unknown>)?.role;
    if (userRole !== "ADMIN") {
      // Sellers landing on /admin go to their own area instead of the public site.
      if (userRole === "SELLER") {
        return NextResponse.redirect(new URL("/seller", req.url));
      }
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/seller/:path*", "/api/:path*"],
};
