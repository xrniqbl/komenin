import type { Metadata } from "next";

export const SITE_NAME = "Aether";
export const SITE_TAGLINE = "Enterprise social operations control plane";
export const SITE_DESCRIPTION =
  "Run Instagram, Threads, and TikTok comments and auto posts with session routing, AI drafts, approval-first controls, and full audit trails.";
export const SITE_KEYWORDS = [
  "social media operations",
  "comment automation",
  "auto posting",
  "Instagram operations",
  "Threads automation",
  "TikTok publishing",
  "session routing",
  "AI social agent",
  "approval workflow",
  "enterprise social ops",
  "Aether",
] as const;

/** Public marketing/docs routes included in sitemap. */
export const PUBLIC_ROUTES = [
  { path: "/", changeFrequency: "weekly" as const, priority: 1 },
  { path: "/features", changeFrequency: "weekly" as const, priority: 0.9 },
  { path: "/features/session-routing", changeFrequency: "monthly" as const, priority: 0.8 },
  { path: "/features/comment-engine", changeFrequency: "monthly" as const, priority: 0.8 },
  { path: "/features/agent-intelligence", changeFrequency: "monthly" as const, priority: 0.8 },
  { path: "/features/skill-execution", changeFrequency: "monthly" as const, priority: 0.8 },
  { path: "/pricing", changeFrequency: "weekly" as const, priority: 0.9 },
  { path: "/enterprise", changeFrequency: "monthly" as const, priority: 0.8 },
  { path: "/security", changeFrequency: "monthly" as const, priority: 0.8 },
  { path: "/about", changeFrequency: "monthly" as const, priority: 0.6 },
  { path: "/contact", changeFrequency: "monthly" as const, priority: 0.7 },
  { path: "/status", changeFrequency: "daily" as const, priority: 0.5 },
  { path: "/docs", changeFrequency: "weekly" as const, priority: 0.85 },
  { path: "/docs/api", changeFrequency: "weekly" as const, priority: 0.7 },
  { path: "/legal/privacy", changeFrequency: "yearly" as const, priority: 0.3 },
  { path: "/legal/terms", changeFrequency: "yearly" as const, priority: 0.3 },
  { path: "/legal/aup", changeFrequency: "yearly" as const, priority: 0.3 },
  { path: "/login", changeFrequency: "yearly" as const, priority: 0.4 },
  { path: "/signup", changeFrequency: "monthly" as const, priority: 0.7 },
] as const;

export type PageSeoInput = {
  title: string;
  description: string;
  path?: string;
  keywords?: string[];
  /** Defaults to the generated 1200×630 Open Graph image route. */
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
  noIndex?: boolean;
  type?: "website" | "article";
};

export const DEFAULT_OG_IMAGE = {
  path: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: `${SITE_NAME} — ${SITE_TAGLINE}`,
} as const;

function normalizeBaseUrl(raw?: string | null): string {
  const fallback = "http://localhost:3000";
  const value = (raw || process.env.APP_URL || process.env.AUTH_URL || fallback).replace(/\/$/, "");
  try {
    const url = new URL(value);
    // Prefer https in production-like hosts.
    if (
      process.env.NODE_ENV === "production" &&
      url.protocol === "http:" &&
      url.hostname !== "localhost" &&
      url.hostname !== "127.0.0.1"
    ) {
      url.protocol = "https:";
    }
    return url.origin;
  } catch {
    return fallback;
  }
}

export function getSiteUrl(): string {
  return normalizeBaseUrl(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL);
}

export function absoluteUrl(path = "/"): string {
  const base = getSiteUrl();
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildMetadata({
  title,
  description,
  path = "/",
  keywords = [...SITE_KEYWORDS],
  image = DEFAULT_OG_IMAGE.path,
  imageWidth = DEFAULT_OG_IMAGE.width,
  imageHeight = DEFAULT_OG_IMAGE.height,
  noIndex = false,
  type = "website",
}: PageSeoInput): Metadata {
  const url = absoluteUrl(path);
  const imageUrl = image.startsWith("http") ? image : absoluteUrl(image);
  const fullTitle = title === SITE_NAME ? SITE_NAME : title;
  // Avoid double suffix when root layout uses `title.template = "%s | Aether"`.
  const titleValue =
    path === "/" || fullTitle.includes(`| ${SITE_NAME}`) || fullTitle.startsWith(`${SITE_NAME} |`)
      ? { absolute: fullTitle }
      : fullTitle;

  return {
    title: titleValue,
    description,
    keywords: keywords.join(", "),
    authors: [{ name: SITE_NAME }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    applicationName: SITE_NAME,
    category: "technology",
    alternates: {
      canonical: url,
    },
    openGraph: {
      type,
      url,
      siteName: SITE_NAME,
      title: fullTitle,
      description,
      locale: "en_US",
      images: [
        {
          url: imageUrl,
          width: imageWidth,
          height: imageHeight,
          alt: DEFAULT_OG_IMAGE.alt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [imageUrl],
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
          googleBot: { index: false, follow: false },
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        },
  };
}

export function jsonLdScript(data: Record<string, unknown> | Array<Record<string, unknown>>) {
  return {
    __html: JSON.stringify(data).replace(/</g, "\\u003c"),
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: getSiteUrl(),
    logo: absoluteUrl("/brand/aether-logo-512.png"),
    description: SITE_DESCRIPTION,
    sameAs: [] as string[],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: getSiteUrl(),
    description: SITE_DESCRIPTION,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/brand/aether-logo-512.png"),
      },
    },
    potentialAction: {
      "@type": "SearchAction",
      target: `${absoluteUrl("/docs")}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: SITE_DESCRIPTION,
    url: getSiteUrl(),
    image: absoluteUrl(DEFAULT_OG_IMAGE.path),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: "29",
      highPrice: "49",
      offerCount: "3",
      url: absoluteUrl("/pricing"),
    },
  };
}

export function pricingProductJsonLd(
  plans: ReadonlyArray<{
    id: string;
    months: number;
    priceMonthly: number;
    priceTotal: number;
  }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${SITE_NAME} subscription`,
    description: PAGE_SEO.pricing.description,
    brand: {
      "@type": "Brand",
      name: SITE_NAME,
    },
    image: absoluteUrl(DEFAULT_OG_IMAGE.path),
    url: absoluteUrl("/pricing"),
    category: "BusinessApplication",
    offers: plans.map((plan) => ({
      "@type": "Offer",
      name: `${plan.months}-month plan`,
      sku: `aether-${plan.id}`,
      price: String(plan.priceTotal),
      priceCurrency: "USD",
      url: absoluteUrl("/signup"),
      availability: "https://schema.org/InStock",
      priceValidUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365)
        .toISOString()
        .slice(0, 10),
      description: `$${plan.priceMonthly}/month billed every ${plan.months} month${plan.months > 1 ? "s" : ""}`,
    })),
  };
}

export function faqJsonLd(items: ReadonlyArray<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export const PAGE_SEO = {
  home: {
    title: "Aether | Enterprise Social Operations Control Plane",
    description: SITE_DESCRIPTION,
    path: "/",
  },
  features: {
    title: "Features | Aether",
    description:
      "Session routing, comment engine, agent intelligence, and skill execution for governed social operations.",
    path: "/features",
  },
  sessionRouting: {
    title: "Session Routing | Aether Features",
    description:
      "Proxy pools, anti-detect sessions, and multi-tunnel account grids for Instagram, Threads, and TikTok.",
    path: "/features/session-routing",
  },
  commentEngine: {
    title: "Comment Engine | Aether Features",
    description:
      "Keyword listeners, AI drafts, human-like pacing, and approval queues for controlled engagement.",
    path: "/features/comment-engine",
  },
  agentIntelligence: {
    title: "Agent Intelligence | Aether Features",
    description:
      "Personas, guardrails, knowledge retrieval, and memory for accurate social replies at scale.",
    path: "/features/agent-intelligence",
  },
  skillExecution: {
    title: "Skill Execution | Aether Features",
    description:
      "Function calling with intent triggers and transparent chain-of-thought logs for operator trust.",
    path: "/features/skill-execution",
  },
  pricing: {
    title: "Pricing | Aether",
    description:
      "Simple 1, 6, and 12 month plans for enterprise social operations. Longer commitments unlock lower monthly rates.",
    path: "/pricing",
  },
  enterprise: {
    title: "Enterprise | Aether",
    description:
      "RBAC, SSO foundations, audit logs, usage controls, and admin tooling for enterprise social ops teams.",
    path: "/enterprise",
  },
  security: {
    title: "Security | Aether",
    description:
      "Encrypted session vaults, approval workflows, rate limits, and immutable audit trails by default.",
    path: "/security",
  },
  about: {
    title: "About | Aether",
    description: "Aether is the quiet control plane for enterprise social engagement operations.",
    path: "/about",
  },
  contact: {
    title: "Contact | Aether",
    description: "Talk to the Aether team about pilots, enterprise rollout, or product questions.",
    path: "/contact",
  },
  status: {
    title: "System Status | Aether",
    description: "Live status for the Aether web app, workers, session probes, and delivery services.",
    path: "/status",
  },
  docs: {
    title: "Documentation | Aether",
    description:
      "Tutorials and API reference for Aether session routing, campaigns, agents, workers, billing, and security.",
    path: "/docs",
  },
  docsApi: {
    title: "API Reference | Aether Docs",
    description: "Worker, billing, and publish webhook APIs for integrating Aether into your stack.",
    path: "/docs/api",
  },
  privacy: {
    title: "Privacy Policy | Aether",
    description: "How Aether collects, uses, and protects workspace and account data.",
    path: "/legal/privacy",
  },
  terms: {
    title: "Terms of Service | Aether",
    description: "Terms governing use of the Aether social operations platform.",
    path: "/legal/terms",
  },
  aup: {
    title: "Acceptable Use Policy | Aether",
    description: "Acceptable use rules for automation, publishing, and platform access on Aether.",
    path: "/legal/aup",
  },
  login: {
    title: "Log in | Aether",
    description: "Sign in to your Aether workspace.",
    path: "/login",
  },
  signup: {
    title: "Start free | Aether",
    description: "Create an Aether workspace and start approval-first social operations.",
    path: "/signup",
  },
} as const;
