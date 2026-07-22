import type { MetadataRoute } from "next";
import { getAllTutorialSlugs, getFlatDocsNav } from "@/data/docs";
import { PUBLIC_ROUTES, absoluteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = PUBLIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const tutorialEntries: MetadataRoute.Sitemap = getAllTutorialSlugs().map((slug) => ({
    url: absoluteUrl(`/docs/tutorial/${slug}`),
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.65,
  }));

  const docsNavEntries: MetadataRoute.Sitemap = getFlatDocsNav()
    .filter((item) => item.href.startsWith("/docs/api/"))
    .map((item) => ({
      url: absoluteUrl(item.href),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));

  // De-dupe by URL
  const map = new Map<string, MetadataRoute.Sitemap[number]>();
  for (const entry of [...staticEntries, ...tutorialEntries, ...docsNavEntries]) {
    map.set(entry.url, entry);
  }
  return Array.from(map.values());
}
