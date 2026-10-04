import { describe, expect, it } from "vitest";
import {
  DEFAULT_OG_IMAGE,
  PAGE_SEO,
  PUBLIC_ROUTES,
  absoluteUrl,
  articleJsonLd,
  breadcrumbJsonLd,
  buildMetadata,
  faqJsonLd,
  featuresItemListJsonLd,
  getSiteUrl,
  organizationJsonLd,
  pricingProductJsonLd,
  softwareApplicationJsonLd,
  webPageJsonLd,
  websiteJsonLd,
} from "@/lib/seo";

describe("seo helpers", () => {
  it("builds absolute urls from site origin", () => {
    const origin = getSiteUrl();
    expect(absoluteUrl("/")).toBe(origin);
    expect(absoluteUrl("/pricing")).toBe(`${origin}/pricing`);
  });

  it("includes canonical, hreflang, open graph, and twitter tags", () => {
    const meta = buildMetadata(PAGE_SEO.pricing);
    expect(meta.alternates?.canonical).toBe(absoluteUrl("/pricing"));
    // Path-based locale pairing: EN at the root path, ID under /id
    expect(meta.alternates?.languages).toMatchObject({
      en: absoluteUrl("/pricing"),
      id: absoluteUrl("/id/pricing"),
      "x-default": absoluteUrl("/pricing"),
    });
    expect(meta.openGraph?.url).toBe(absoluteUrl("/pricing"));
    expect(meta.openGraph?.title).toBe(PAGE_SEO.pricing.title);
    expect(meta.openGraph?.alternateLocale).toContain("id_ID");
    expect(meta.twitter && "card" in meta.twitter ? meta.twitter.card : null).toBe(
      "summary_large_image",
    );
  });

  it("localizes canonical and hreflang for the ID locale variant", () => {
    const meta = buildMetadata({ ...PAGE_SEO.pricing, locale: "id" });
    expect(meta.alternates?.canonical).toBe(absoluteUrl("/id/pricing"));
    expect(meta.alternates?.languages).toMatchObject({
      en: absoluteUrl("/pricing"),
      id: absoluteUrl("/id/pricing"),
      "x-default": absoluteUrl("/pricing"),
    });
    expect(meta.openGraph?.url).toBe(absoluteUrl("/id/pricing"));
    expect(meta.openGraph?.locale).toBe("id_ID");
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
    const data = faqJsonLd([{ q: "What is Komenin?", a: "A social ops control plane." }]);
    expect(data["@type"]).toBe("FAQPage");
    expect(data.mainEntity).toHaveLength(1);
  });

  it("defaults to 1200x630 open graph image route", () => {
    const meta = buildMetadata(PAGE_SEO.home);
    const image = meta.openGraph?.images;
    const first = Array.isArray(image) ? image[0] : image;
    expect(first).toMatchObject({
      url: absoluteUrl(DEFAULT_OG_IMAGE.path),
      width: 1200,
      height: 630,
    });
  });

  it("builds pricing product offers", () => {
    const data = pricingProductJsonLd([
      { id: "1m", months: 1, priceMonthly: 499000, priceTotal: 499000 },
      { id: "6m", months: 6, priceMonthly: 399000, priceTotal: 2394000 },
    ]);
    expect(data["@type"]).toBe("Product");
    expect(data.offers).toHaveLength(2);
  });

  it("exposes public marketing routes without login", () => {
    const paths = PUBLIC_ROUTES.map((r) => r.path);
    expect(paths).toContain("/");
    expect(paths).toContain("/pricing");
    expect(paths).toContain("/signup");
    expect(paths).not.toContain("/login");
    expect(paths).toContain("/docs/tutorial/introduction");
  });

  it("builds organization, website, and software graph nodes", () => {
    expect(organizationJsonLd()["@type"]).toBe("Organization");
    // WebSite carries identity only; /docs search is in-app autocomplete,
    // so no SearchAction with a ?q= URL is claimed.
    expect("potentialAction" in websiteJsonLd()).toBe(false);
    const app = softwareApplicationJsonLd();
    expect(app.offers.lowPrice).toBe("499000");
    expect(app.offers.highPrice).toBe("3588000");
  });

  it("builds tech article nodes for docs pages", () => {
    const data = articleJsonLd({
      headline: "Introduction",
      description: "Getting started with Komenin",
      path: "/docs/tutorial/introduction",
    });
    expect(data["@type"]).toBe("TechArticle");
    expect(data.mainEntityOfPage["@id"]).toContain("/docs/tutorial/introduction");
  });

  it("builds webpage, features list, and breadcrumb nodes", () => {
    expect(
      webPageJsonLd({
        name: "Pricing",
        description: "Plans",
        path: "/pricing",
      })["@type"],
    ).toBe("WebPage");
    const list = featuresItemListJsonLd();
    expect(list["@type"]).toBe("ItemList");
    expect(list.itemListElement.length).toBeGreaterThanOrEqual(4);
    expect(list.itemListElement.map((item) => item.name)).toContain("Session Routing");
    const crumbs = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Features", path: "/features" },
    ]);
    expect(crumbs.itemListElement).toHaveLength(2);
  });
});
