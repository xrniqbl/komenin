import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/features/", "/docs/", "/pricing", "/signup"],
        disallow: [
          "/app/",
          "/admin/",
          "/api/",
          "/onboarding",
          "/invite/",
          "/auth/",
          "/login",
          "/checkout",
        ],
      },
      // Keep AI crawlers on public marketing/docs; still block app/admin/api.
      {
        userAgent: "GPTBot",
        allow: ["/", "/features/", "/docs/", "/pricing"],
        disallow: ["/app/", "/admin/", "/api/", "/onboarding", "/invite/", "/auth/", "/login"],
      },
      {
        userAgent: "Google-Extended",
        allow: ["/", "/features/", "/docs/", "/pricing"],
        disallow: ["/app/", "/admin/", "/api/", "/onboarding", "/invite/", "/auth/", "/login"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
