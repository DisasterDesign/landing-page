import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/fonts/download/"],
      },
    ],
    sitemap: "https://www.fuzionwebz.com/sitemap.xml",
  };
}
