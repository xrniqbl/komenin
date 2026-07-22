import { describe, expect, it } from "vitest";
import {
  PAGE_SEO,
  absoluteUrl,
  buildMetadata,
  faqJsonLd,
  getSiteUrl,
} from "@/lib/seo";

describe("seo helpers", () => {
  it("builds absolute urls from site origin", () => {
    const origin = getSiteUrl();
    expect(absoluteUrl("/")).toBe(origin);
    expect(absoluteUrl("/pricing")).toBe(`${origin}/pricing`);
  });

  it("includes canonical, open graph, and twitter tags", () => {
    const meta = buildMetadata(PAGE_SEO.pricing);
    expect(meta.alternates?.canonical).toBe(absoluteUrl("/pricing"));
    expect(meta.openGraph?.url).toBe(absoluteUrl("/pricing"));
    expect(meta.openGraph?.title).toBe(PAGE_SEO.pricing.title);
    expect(meta.twitter && "card" in meta.twitter ? meta.twitter.card : null).toBe(
      "summary_large_image",
    );
  });

  it("uses absolute title on home to avoid template double suffix", () => {
    const meta = buildMetadata(PAGE_SEO.home);
    expect(meta.title).toEqual({ absolute: PAGE_SEO.home.title });
  });

  it("marks private pages as noindex", () => {
    const meta = buildMetadata({
      title: "Workspace",
      description: "Private",
      path: "/app",
      noIndex: true,
    });
    expect(meta.robots).toMatchObject({ index: false, follow: false });
  });

  it("builds FAQ structured data", () => {
    const data = faqJsonLd([{ q: "What is Aether?", a: "A social ops control plane." }]);
    expect(data["@type"]).toBe("FAQPage");
    expect(data.mainEntity).toHaveLength(1);
  });
});
