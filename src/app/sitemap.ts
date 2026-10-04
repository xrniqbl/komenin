import type { MetadataRoute } from "next";
import { getAllTutorialSlugs, getFlatDocsNav } from "@/data/docs";
import { PUBLIC_ROUTES, absoluteUrl } from "@/lib/seo";
import { withLocalePath } from "@/lib/i18n/paths";

export default function sitemap(): MetadataRoute.Sitemap {
  // Stable build date so `lastModified` doesn't shift on every build and waste
  // crawl budget. Override with BUILD_DATE (YYYY-MM-DD) when content changes.
  const buildDate = process.env.BUILD_DATE ? new Date(process.env.BUILD_DATE) : new Date();
  const lastModified = Number.isNaN(buildDate.getTime()) ? new Date() : buildDate;

  const alternatesFor = (path: string) => ({
    languages: {
      en: absoluteUrl(path),
      id: absoluteUrl(withLocalePath("id", path)),
      "x-default": absoluteUrl(path),
    },
  });

  // Yearly legal pages rarely change: omit lastModified so crawlers don't
  // treat every build as a content update.
  const staticEntries: MetadataRoute.Sitemap = PUBLIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    ...(route.changeFrequency === "yearly" ? {} : { lastModified }),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
    alternates: alternatesFor(route.path),
  }));

  const tutorialEntries: MetadataRoute.Sitemap = getAllTutorialSlugs().map((slug) => {
    const path = `/docs/tutorial/${slug}`;
    return {
      url: absoluteUrl(path),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: slug === "introduction" ? 0.72 : 0.65,
      alternates: alternatesFor(path),
    };
  });

  const docsNavEntries: MetadataRoute.Sitemap = getFlatDocsNav()
    .filter((item) => item.href.startsWith("/docs/"))
    .map((item) => ({
      url: absoluteUrl(item.href),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: item.href.startsWith("/docs/api") ? 0.62 : 0.68,
      alternates: alternatesFor(item.href),
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
        "x-default": (entry.alternates?.languages as { en: string }).en,
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
