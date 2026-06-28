import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BUILD_SHA: (process.env.VERCEL_GIT_COMMIT_SHA ?? "dev").slice(0, 7),
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Serve the Ormat proposal at the root of its dedicated subdomain
  // (ormat.fuzionwebz.com) while the page itself lives at /ormat. Only the
  // bare host root is rewritten — /api, /_next, /payment/* resolve normally on
  // the subdomain, so the sign + Cardcom flow keeps working unchanged.
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/",
          has: [{ type: "host", value: "ormat.fuzionwebz.com" }],
          destination: "/ormat",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
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
              "media-src 'self' https://auxio.b-cdn.net",
              "object-src 'none'",
              "base-uri 'self'",
            ].join("; "),
          },
        ],
      },
      {
        // Private client pitch — keep the Ormat subdomain out of search
        // engines. Most-restrictive directive wins over the global index tag.
        source: "/:path*",
        has: [{ type: "host", value: "ormat.fuzionwebz.com" }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
