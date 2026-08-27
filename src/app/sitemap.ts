import type { MetadataRoute } from "next";
import { getAllTutorialSlugs, getFlatDocsNav } from "@/data/docs";
import { PUBLIC_ROUTES, absoluteUrl } from "@/lib/seo";
import { withLocalePath } from "@/lib/i18n/paths";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = PUBLIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
    alternates: {
      languages: {
        en: absoluteUrl(route.path),
        id: absoluteUrl(withLocalePath("id", route.path)),
      },
    },
  }));

  const tutorialEntries: MetadataRoute.Sitemap = getAllTutorialSlugs().map((slug) => {
    const path = `/docs/tutorial/${slug}`;
    return {
      url: absoluteUrl(path),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: slug === "introduction" ? 0.72 : 0.65,
      alternates: {
        languages: {
          en: absoluteUrl(path),
          id: absoluteUrl(withLocalePath("id", path)),
        },
      },
    };
  });

  const docsNavEntries: MetadataRoute.Sitemap = getFlatDocsNav()
    .filter((item) => item.href.startsWith("/docs/"))
    .map((item) => ({
      url: absoluteUrl(item.href),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: item.href.startsWith("/docs/api") ? 0.62 : 0.68,
      alternates: {
        languages: {
          en: absoluteUrl(item.href),
          id: absoluteUrl(withLocalePath("id", item.href)),
        },
      },
    }));

  // Indonesian variants as first-class URLs so both languages get indexed.
  const idEntries: MetadataRoute.Sitemap = [
    ...staticEntries,
    ...tutorialEntries,
    ...docsNavEntries,
  ].map((entry) => ({
    ...entry,
    url: (entry.alternates?.languages as { id: string }).id,
    alternates: {
      languages: {
        en: (entry.alternates?.languages as { en: string }).en,
        id: (entry.alternates?.languages as { id: string }).id,
      },
    },
  }));

  // De-dupe by URL (static routes win on first insert for priority).
  const map = new Map<string, MetadataRoute.Sitemap[number]>();
  for (const entry of [...staticEntries, ...tutorialEntries, ...docsNavEntries, ...idEntries]) {
    if (!map.has(entry.url)) map.set(entry.url, entry);
  }
  return Array.from(map.values()).sort((a, b) => a.url.localeCompare(b.url));
}
