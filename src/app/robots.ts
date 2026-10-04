import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

// Private areas stay off-limits for every crawler, AI or classic.
const PRIVATE_PATHS = [
  "/app/",
  "/admin/",
  "/api/",
  "/onboarding",
  "/invite/",
  "/auth/",
  "/login",
  "/checkout",
];

// AI crawlers that power ChatGPT, Claude, Gemini, Perplexity, and TikTok's
// indexer. Each gets an explicit rule so they stay on public
// marketing/docs/pricing and out of app/admin/api/login.
const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "Google-Extended",
  "Anthropic-AI",
  "ClaudeBot",
  "Claude-Web",
  "PerplexityBot",
  "Bytespider",
  "Applebot-Extended",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/features/", "/docs/", "/pricing", "/signup"],
        disallow: PRIVATE_PATHS,
      },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: ["/", "/features/", "/docs/", "/pricing"],
        disallow: PRIVATE_PATHS,
      })),
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
