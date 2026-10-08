import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n/messages";
import { withLocalePath } from "@/lib/i18n/paths";

export const SITE_NAME = "Komenin";
export const SITE_TAGLINE = "Enterprise social operations control plane";
export const SITE_DESCRIPTION =
  "Run Instagram, Threads, and TikTok comments and auto posts with session routing, AI drafts, approval-first controls, and full audit trails.";
/** Primary contact for Organization schema (public support). */
export const SITE_SUPPORT_EMAIL = "halo@komenin.id";
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
  "social media management Indonesia",
  "otomatisasi komentar Instagram",
  "jadwal posting TikTok",
  "agency social ops",
  "Komenin",
  "komenin.id",
] as const;

/** Public marketing/docs routes included in sitemap. */
export const PUBLIC_ROUTES = [
  { path: "/", changeFrequency: "weekly" as const, priority: 1 },
  { path: "/features", changeFrequency: "weekly" as const, priority: 0.9 },
  { path: "/features/session-routing", changeFrequency: "monthly" as const, priority: 0.8 },
  { path: "/features/comment-engine", changeFrequency: "monthly" as const, priority: 0.8 },
  { path: "/features/agent-intelligence", changeFrequency: "monthly" as const, priority: 0.8 },
  { path: "/features/skill-execution", changeFrequency: "monthly" as const, priority: 0.8 },
  { path: "/use-cases", changeFrequency: "monthly" as const, priority: 0.75 },
  { path: "/platform/instagram", changeFrequency: "monthly" as const, priority: 0.75 },
  { path: "/platform/tiktok", changeFrequency: "monthly" as const, priority: 0.75 },
  { path: "/platform/threads", changeFrequency: "monthly" as const, priority: 0.75 },
  { path: "/integrations", changeFrequency: "monthly" as const, priority: 0.7 },
  { path: "/changelog", changeFrequency: "weekly" as const, priority: 0.6 },
  { path: "/pricing", changeFrequency: "weekly" as const, priority: 0.9 },
  { path: "/enterprise", changeFrequency: "monthly" as const, priority: 0.8 },
  { path: "/security", changeFrequency: "monthly" as const, priority: 0.8 },
  { path: "/about", changeFrequency: "monthly" as const, priority: 0.6 },
  { path: "/contact", changeFrequency: "monthly" as const, priority: 0.7 },
  { path: "/status", changeFrequency: "daily" as const, priority: 0.3 },
  { path: "/docs", changeFrequency: "weekly" as const, priority: 0.85 },
  { path: "/docs/api", changeFrequency: "weekly" as const, priority: 0.7 },
  { path: "/docs/tutorial/introduction", changeFrequency: "monthly" as const, priority: 0.7 },
  { path: "/legal/privacy", changeFrequency: "yearly" as const, priority: 0.3 },
  { path: "/legal/terms", changeFrequency: "yearly" as const, priority: 0.3 },
  { path: "/legal/aup", changeFrequency: "yearly" as const, priority: 0.3 },
  // Login is noindex via metadata; keep out of high-priority discovery.
  { path: "/signup", changeFrequency: "monthly" as const, priority: 0.75 },
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
  /**
   * Locale of this page variant. When set to "id", the canonical URL carries
   * the /id prefix and hreflang pairs the EN and ID URLs so search engines
   * index both variants separately.
   */
  locale?: Locale;
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
  locale = "en",
}: PageSeoInput): Metadata {
  const url = absoluteUrl(withLocalePath(locale, path));
  const imageUrl = image.startsWith("http") ? image : absoluteUrl(image);
  const fullTitle = title === SITE_NAME ? SITE_NAME : title;
  // Avoid double suffix when root layout uses `title.template = "%s | Komenin"`.
  const titleValue =
    path === "/" || fullTitle.includes(`| ${SITE_NAME}`) || fullTitle.startsWith(`${SITE_NAME} |`)
      ? { absolute: fullTitle }
      : fullTitle;

  // Path-based locale pairs: EN at the root path, ID under /id/<path>, each
  // pointing at the other via hreflang so both are indexed separately.
  const enUrl = absoluteUrl(withLocalePath("en", path));
  const idUrl = absoluteUrl(withLocalePath("id", path));

  return {
    title: titleValue,
    description,
    keywords: [...keywords],
    authors: [{ name: SITE_NAME }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    applicationName: SITE_NAME,
    category: "technology",
    alternates: {
      canonical: url,
      languages: {
        en: enUrl,
        id: idUrl,
        "x-default": enUrl,
      },
    },
    openGraph: {
      type,
      url,
      siteName: SITE_NAME,
      title: fullTitle,
      description,
      locale: locale === "id" ? "id_ID" : "en_US",
      alternateLocale: locale === "id" ? ["en_US"] : ["id_ID"],
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
          nocache: true,
          googleBot: { index: false, follow: false, noimageindex: true },
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
    legalName: SITE_NAME,
    url: getSiteUrl(),
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/brand/komenin-robot-512.png"),
      width: 512,
      height: 512,
    },
    image: absoluteUrl("/brand/komenin-robot-512.png"),
    description: SITE_DESCRIPTION,
    email: SITE_SUPPORT_EMAIL,
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "sales",
        email: SITE_SUPPORT_EMAIL,
        url: absoluteUrl("/contact"),
        availableLanguage: ["English", "Indonesian"],
      },
    ],
    areaServed: ["ID", "SG", "Worldwide"],
  };
}

export function websiteJsonLd() {
  // Docs ships an in-app autocomplete search (DocsSearch), not a ?q= URL query.
  // A SearchAction claiming /docs?q= would fail Search Console validation, so
  // the WebSite node carries identity only.
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: ["Komenin Social Ops", "Komenin Control Plane"],
    url: getSiteUrl(),
    description: SITE_DESCRIPTION,
    inLanguage: ["en", "id"],
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/brand/komenin-robot-512.png"),
      },
    },
  };
}

/**
 * TechArticle node for docs tutorial/API pages. Headline + description come
 * from the docs content entry; author/publisher keep the publisher graph.
 */
export function articleJsonLd(input: {
  headline: string;
  description: string;
  path: string;
  locale?: Locale;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: input.headline,
    description: input.description,
    url: absoluteUrl(withLocalePath(input.locale ?? "en", input.path)),
    inLanguage: input.locale === "id" ? "id" : "en",
    author: {
      "@type": "Organization",
      name: SITE_NAME,
      url: getSiteUrl(),
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/brand/komenin-robot-512.png"),
      },
    },
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: getSiteUrl(),
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": absoluteUrl(withLocalePath(input.locale ?? "en", input.path)),
    },
  };
}

export function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Social Media Management",
    operatingSystem: "Web",
    description: SITE_DESCRIPTION,
    url: getSiteUrl(),
    image: absoluteUrl(DEFAULT_OG_IMAGE.path),
    featureList: [
      "Session routing and proxy pools",
      "AI comment drafts with approval queues",
      "Content calendar and auto-publish",
      "Agent knowledge and skill execution",
      "Workspace RBAC and audit logs",
    ],
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "IDR",
      // Full commitment totals from DEFAULT_PLANS (starter → scale).
      lowPrice: "499000",
      highPrice: "3588000",
      offerCount: "3",
      url: absoluteUrl("/pricing"),
    },
  };
}

/** WebPage node for key landing URLs (pairs with breadcrumbs). */
export function webPageJsonLd(input: {
  name: string;
  description: string;
  path: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: getSiteUrl(),
    },
    about: {
      "@type": "SoftwareApplication",
      name: SITE_NAME,
    },
    inLanguage: ["en", "id"],
  };
}

/** ItemList for the features hub. */
export function featuresItemListJsonLd() {
  const features = [
    { name: "Session Routing", path: "/features/session-routing" },
    { name: "Comment Engine", path: "/features/comment-engine" },
    { name: "Agent Intelligence", path: "/features/agent-intelligence" },
    { name: "Skill Execution", path: "/features/skill-execution" },
    { name: "Agencies", path: "/use-cases" },
    { name: "Instagram", path: "/platform/instagram" },
    { name: "TikTok", path: "/platform/tiktok" },
    { name: "Threads", path: "/platform/threads" },
    { name: "Integrations", path: "/integrations" },
  ] as const;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${SITE_NAME} features`,
    itemListElement: features.map((feature, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: feature.name,
      url: absoluteUrl(feature.path),
    })),
  };
}

export function pricingProductJsonLd(
  plans: ReadonlyArray<{
    id: string;
    months: number;
    priceMonthly: number;
    priceTotal: number;
    currency?: "IDR" | "USD";
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
      sku: `komenin-${plan.id}`,
      price: String(plan.priceTotal),
      priceCurrency: plan.currency || "IDR",
      url: absoluteUrl("/signup"),
      availability: "https://schema.org/InStock",
      // Fixed far-future date: a build-time Date.now() goes stale and triggers
      // Search Console warnings once the build ages past it.
      priceValidUntil: "2099-12-31",
      description: `IDR ${plan.priceMonthly.toLocaleString("id-ID")}/month billed every ${plan.months} month${plan.months > 1 ? "s" : ""}`,
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
    title: "Komenin — Enterprise Social Comment & Content Automation",
    description: SITE_DESCRIPTION,
    path: "/",
  },
  features: {
    title: "Social Media Automation Features | Komenin",
    description:
      "Automate Instagram comments, Threads replies, and TikTok publishing with session routing, AI drafts, approval queues, and full audit trails.",
    path: "/features",
  },
  sessionRouting: {
    title: "Session Routing & Proxy Pools | Komenin",
    description:
      "Anti-detect sessions, residential proxy pools, and multi-tunnel account grids for safe Instagram, Threads, and TikTok automation.",
    path: "/features/session-routing",
  },
  commentEngine: {
    title: "Auto Comment Engine for Instagram & TikTok | Komenin",
    description:
      "Keyword listeners, AI comment drafts, human-like pacing, and approval queues for controlled social media engagement.",
    path: "/features/comment-engine",
  },
  agentIntelligence: {
    title: "AI Social Media Agent with Guardrails | Komenin",
    description:
      "AI personas, knowledge retrieval, memory, and guardrails for accurate auto replies on Instagram, Threads, and TikTok.",
    path: "/features/agent-intelligence",
  },
  skillExecution: {
    title: "Skill Automation & Webhook Triggers | Komenin",
    description:
      "Trigger skill automations from comment intent with webhook executors and transparent execution logs.",
    path: "/features/skill-execution",
  },
  pricing: {
    title: "Sosmed Automation Pricing — 1, 6, 12 Month Plans | Komenin",
    description:
      "Simple 1, 6, and 12 month plans for Instagram, Threads, and TikTok automation. Longer commitments unlock lower monthly rates.",
    path: "/pricing",
  },
  enterprise: {
    title: "Enterprise Social Media Management | Komenin",
    description:
      "RBAC, SSO foundations, audit logs, usage controls, and admin tooling for enterprise social ops teams.",
    path: "/enterprise",
  },
  security: {
    title: "Automation Security & Audit Trails | Komenin",
    description:
      "Encrypted session vaults, approval workflows, rate limits, and immutable audit trails by default.",
    path: "/security",
  },
  about: {
    title: "About Komenin — Social Ops Control Plane",
    description:
      "Komenin helps teams and agencies manage Instagram, Threads, and TikTok comments, content, and accounts from one governed workspace.",
    path: "/about",
  },
  contact: {
    title: "Contact Sales for Sosmed Automation Demo | Komenin",
    description: "Talk to the Komenin team about pilots, enterprise rollout, or product questions.",
    path: "/contact",
  },
  status: {
    title: "System Status | Komenin",
    description: "Live status for the Komenin web app, workers, session probes, and delivery services.",
    path: "/status",
  },
  docs: {
    title: "Documentation | Komenin",
    description:
      "Tutorials and API reference for Komenin session routing, campaigns, agents, workers, billing, and security.",
    path: "/docs",
  },
  docsApi: {
    title: "API Reference | Komenin Docs",
    description: "Worker, billing, and publish webhook APIs for integrating Komenin into your stack.",
    path: "/docs/api",
  },
  privacy: {
    title: "Privacy Policy | Komenin",
    description: "How Komenin collects, uses, and protects workspace and account data.",
    path: "/legal/privacy",
  },
  terms: {
    title: "Terms of Service | Komenin",
    description: "Terms governing use of the Komenin social operations platform.",
    path: "/legal/terms",
  },
  aup: {
    title: "Acceptable Use Policy | Komenin",
    description: "Acceptable use rules for automation, publishing, and platform access on Komenin.",
    path: "/legal/aup",
  },
  login: {
    title: "Log in | Komenin",
    description: "Sign in to your Komenin workspace.",
    path: "/login",
  },
  signup: {
    title: "Start free | Komenin",
    description: "Create a Komenin workspace and start approval-first social operations.",
    path: "/signup",
  },
  useCases: {
    title: "Komenin for Agencies — Multi-Brand Social Ops | Komenin",
    description:
      "Run every client brand from one governed workspace: per-client campaigns, leads pipelines, approval queues, and agency analytics.",
    path: "/use-cases",
  },
  platformInstagram: {
    title: "Instagram Comment & Auto Post Automation | Komenin",
    description:
      "Discover Instagram conversations, draft contextual comments with AI, approve in a mobile-friendly queue, and schedule auto posts.",
    path: "/platform/instagram",
  },
  platformTiktok: {
    title: "TikTok Publishing & Comment Automation | Komenin",
    description:
      "Schedule original TikTok posts from one topic and run approval-gated comment campaigns with strict pacing.",
    path: "/platform/tiktok",
  },
  platformThreads: {
    title: "Threads Reply Automation at Conversation Speed | Komenin",
    description:
      "Catch Threads mentions fast, generate contextual AI replies, and approve in seconds with enforced guardrails.",
    path: "/platform/threads",
  },
  integrations: {
    title: "Integrations — Publish Bridge, Webhooks & API | Komenin",
    description:
      "Connect Komenin to your stack: publish bridges, skill webhooks, outbound notifications, CSV exports, and the worker API.",
    path: "/integrations",
  },
  changelog: {
    title: "Changelog | Komenin",
    description:
      "What shipped lately in Komenin — automation depth, reporting, and governance updates.",
    path: "/changelog",
  },
  docsTutorial: {
    title: "Tutorials | Komenin Docs",
    description:
      "Step-by-step Komenin tutorials for workspaces, accounts, campaigns, approvals, and workers.",
    path: "/docs/tutorial/introduction",
  },
} as const;

/** Shape of one page's SEO entry (title/description/path). */
export type PageSeoEntry = {
  title: string;
  description: string;
  path: string;
};

/** Indonesian translations for public page SEO. Falls back to EN per-key. */
export const PAGE_SEO_ID: Record<keyof typeof PAGE_SEO, PageSeoEntry> = {
  home: {
    title: "Komenin — Platform Otomatisasi Komentar & Bot Sosmed",
    description:
      "Otomatisasi sosial media: auto komentar Instagram, bot sosmed Threads, campaign sosial media, dan jadwal posting TikTok dengan draf AI, kontrol persetujuan, dan jejak audit lengkap.",
    path: "/",
  },
  features: {
    title: "Fitur Otomatisasi Sosial Media | Komenin",
    description:
      "Otomatisasi komentar Instagram, auto posting TikTok, bot sosmed Threads, dan campaign sosial media dengan kontrol persetujuan dan audit trail.",
    path: "/features",
  },
  sessionRouting: {
    title: "Session Routing & Proxy Anti-Detect | Komenin",
    description:
      "Pool proxy, sesi anti-detect, dan grid akun multi-tunnel untuk bot sosmed Instagram, Threads, dan TikTok yang aman.",
    path: "/features/session-routing",
  },
  commentEngine: {
    title: "Bot Auto Komentar Instagram & TikTok | Komenin",
    description:
      "Listener kata kunci, draf AI, pacing seperti manusia, dan antrean persetujuan untuk campaign komentar otomatis yang terkontrol.",
    path: "/features/comment-engine",
  },
  agentIntelligence: {
    title: "AI Agent Balasan Otomatis Sosmed | Komenin",
    description:
      "Persona AI, guardrail, knowledge retrieval, dan memori untuk balasan otomatis Instagram, Threads, dan TikTok dalam skala besar.",
    path: "/features/agent-intelligence",
  },
  skillExecution: {
    title: "Skill Automation & Webhook Campaign | Komenin",
    description:
      "Pemicu otomatisasi campaign sosial media dari intent komentar dengan webhook executor dan log eksekusi transparan.",
    path: "/features/skill-execution",
  },
  pricing: {
    title: "Harga Bot Sosmed & Otomatisasi — Paket 1, 6, 12 Bulan",
    description:
      "Paket otomatisasi sosial media 1, 6, dan 12 bulan untuk Instagram, Threads, dan TikTok. Komitmen lebih lama, tarif bulanan lebih hemat.",
    path: "/pricing",
  },
  enterprise: {
    title: "Enterprise Social Media Management Indonesia",
    description:
      "RBAC, fondasi SSO, audit log, kontrol usage, dan tooling admin untuk tim enterprise dan agensi sosial media.",
    path: "/enterprise",
  },
  security: {
    title: "Keamanan Otomatisasi & Audit Trail | Komenin",
    description:
      "Vault sesi terenkripsi, alur persetujuan, rate limit, dan jejak audit permanen untuk bot sosmed yang aman.",
    path: "/security",
  },
  about: {
    title: "Tentang Komenin — Platform Bot Sosmed Indonesia",
    description:
      "Komenin membantu tim dan agensi mengelola komentar otomatis, campaign sosial media, dan akun Instagram, Threads, dan TikTok dari satu tempat.",
    path: "/about",
  },
  contact: {
    title: "Kontak & Demo Otomatisasi Sosmed | Komenin",
    description: "Hubungi tim Komenin untuk demo bot sosmed, pilot campaign, enterprise rollout, atau pertanyaan produk.",
    path: "/contact",
  },
  status: {
    title: "Status Sistem | Komenin",
    description: "Status live untuk web app Komenin, worker, probe sesi, dan layanan delivery.",
    path: "/status",
  },
  docs: {
    title: "Dokumentasi | Komenin",
    description:
      "Tutorial dan referensi API untuk session routing, campaign, agent, worker, billing, dan keamanan Komenin.",
    path: "/docs",
  },
  docsApi: {
    title: "Referensi API | Dokumentasi Komenin",
    description: "API worker, billing, dan publish webhook untuk mengintegrasikan Komenin ke stack Anda.",
    path: "/docs/api",
  },
  privacy: {
    title: "Kebijakan Privasi | Komenin",
    description: "Bagaimana Komenin mengumpulkan, menggunakan, dan melindungi data workspace dan akun.",
    path: "/legal/privacy",
  },
  terms: {
    title: "Syarat Layanan | Komenin",
    description: "Syarat penggunaan platform operasi sosial Komenin.",
    path: "/legal/terms",
  },
  aup: {
    title: "Kebijakan Penggunaan yang Wajar | Komenin",
    description: "Aturan penggunaan wajar untuk otomatisasi, publishing, dan akses platform di Komenin.",
    path: "/legal/aup",
  },
  login: {
    title: "Masuk | Komenin",
    description: "Masuk ke workspace Komenin Anda.",
    path: "/login",
  },
  signup: {
    title: "Mulai Gratis | Komenin",
    description: "Buat workspace Komenin dan mulai operasi sosial dengan persetujuan di setiap langkah.",
    path: "/signup",
  },
  useCases: {
    title: "Komenin untuk Agensi — Operasi Sosial Multi-Brand | Komenin",
    description:
      "Jalankan setiap brand klien dari satu workspace terkendali: campaign per klien, pipeline leads, antrean approval, dan analitik agensi.",
    path: "/use-cases",
  },
  platformInstagram: {
    title: "Otomatisasi Komentar & Auto Post Instagram | Komenin",
    description:
      "Temukan percakapan Instagram, buat komentar kontekstual dengan AI, setujui di antrean ramah-mobile, dan jadwalkan auto posting.",
    path: "/platform/instagram",
  },
  platformTiktok: {
    title: "Otomatisasi Publishing & Komentar TikTok | Komenin",
    description:
      "Jadwalkan postingan TikTok orisinal dari satu topik dan jalankan campaign komentar dengan gerbang persetujuan dan pacing ketat.",
    path: "/platform/tiktok",
  },
  platformThreads: {
    title: "Otomatisasi Balasan Threads Secepat Percakapan | Komenin",
    description:
      "Tangkap mention Threads dengan cepat, buat balasan AI kontekstual, dan setujui dalam hitungan detik dengan guardrail.",
    path: "/platform/threads",
  },
  integrations: {
    title: "Integrasi — Bridge Publish, Webhook & API | Komenin",
    description:
      "Hubungkan Komenin ke stack Anda: bridge publish, webhook skill, notifikasi outbound, export CSV, dan worker API.",
    path: "/integrations",
  },
  changelog: {
    title: "Changelog | Komenin",
    description:
      "Yang baru di Komenin — update kedalaman otomatisasi, pelaporan, dan governance.",
    path: "/changelog",
  },
  docsTutorial: {
    title: "Tutorial | Dokumentasi Komenin",
    description:
      "Tutorial Komenin langkah demi langkah untuk workspace, akun, campaign, persetujuan, dan worker.",
    path: "/docs/tutorial/introduction",
  },
};

/** Standard breadcrumb trails for marketing feature pages. */
export function featureBreadcrumbs(
  featureName: string,
  featurePath: string,
): Array<{ name: string; path: string }> {
  return [
    { name: "Home", path: "/" },
    { name: "Features", path: "/features" },
    { name: featureName, path: featurePath },
  ];
}

/** Pick the localized PAGE_SEO entry (ID translations fall back to EN per key). */
export function pageSeoFor(
  locale: Locale,
  key: keyof typeof PAGE_SEO,
): PageSeoEntry {
  const base = PAGE_SEO[key];
  if (locale !== "id") return base;
  const translated = PAGE_SEO_ID[key];
  return translated ?? base;
}

/**
 * Generate locale-aware page metadata. Resolves the locale from the request
 * (path prefix via middleware header, else the locale cookie) and returns the
 * localized title/description/OG/Twitter. Canonical and hreflang pair the EN
 * and /id URLs so both variants are indexed separately.
 */
export async function generatePageMetadata(
  key: keyof typeof PAGE_SEO,
): Promise<Metadata> {
  const { getRequestLocale } = await import("@/lib/i18n/request-locale");
  const locale = await getRequestLocale();
  const seo = pageSeoFor(locale, key);
  return buildMetadata({ ...seo, locale });
}
