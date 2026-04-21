import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // Rate limit mutating requests
  if (["POST", "PATCH", "DELETE"].includes(req.method)) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const { ok } = rateLimit(ip);
    if (!ok) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
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
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};
