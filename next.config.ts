import type { NextConfig } from "next";
import { readFileSync } from "fs";
import { join } from "path";

// Read build-time injected env vars from JSON (created by prebuild script)
let injected: Record<string, string> = {};
try {
  injected = JSON.parse(readFileSync(join(process.cwd(), "env-injected.json"), "utf8"));
  console.log("next.config: loaded env-injected.json with", Object.keys(injected).filter(k => injected[k]).length, "vars");
} catch {
  // File doesn't exist in local dev (env vars come from .env)
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Inline env vars at build time — workaround for Vercel runtime injection bug
  env: {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || injected.GOOGLE_CLIENT_ID || "",
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || injected.GOOGLE_CLIENT_SECRET || "",
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || injected.GOOGLE_REDIRECT_URI || "",
    OAUTH_ENCRYPTION_KEY: process.env.OAUTH_ENCRYPTION_KEY || injected.OAUTH_ENCRYPTION_KEY || "",
    CRON_SECRET: process.env.CRON_SECRET || injected.CRON_SECRET || "",
    BLOG_API_KEY: process.env.BLOG_API_KEY || injected.BLOG_API_KEY || "",
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "X-Robots-Tag", value: "index, follow" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://vitals.vercel-insights.com https://va.vercel-scripts.com",
              "frame-src 'self'",
              "media-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
