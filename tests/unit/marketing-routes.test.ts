import { describe, expect, it, vi } from "vitest";
import { PUBLIC_ROUTES, PAGE_SEO, PAGE_SEO_ID } from "@/lib/seo";

describe("marketing sitemap coverage", () => {
  it("includes the new platform, use-case, integration, and changelog routes", () => {
    const paths = PUBLIC_ROUTES.map((r) => r.path);
    for (const path of [
      "/use-cases",
      "/platform/instagram",
      "/platform/tiktok",
      "/platform/threads",
      "/integrations",
      "/changelog",
    ]) {
      expect(paths).toContain(path);
    }
  });

  it("has EN + ID SEO entries for every new route key", () => {
    const keys = [
      "useCases",
      "platformInstagram",
      "platformTiktok",
      "platformThreads",
      "integrations",
      "changelog",
    ] as const;
    for (const key of keys) {
      expect(PAGE_SEO[key].path).toBeTruthy();
      expect(PAGE_SEO_ID[key].path).toBe(PAGE_SEO[key].path);
      expect(PAGE_SEO[key].title.length).toBeGreaterThan(10);
      expect(PAGE_SEO_ID[key].title.length).toBeGreaterThan(10);
    }
  });
});
