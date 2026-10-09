import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { AppProviders } from "@/components/providers/app-providers";
import { getRequestLocale } from "@/lib/i18n/request-locale";
import {
  DEFAULT_OG_IMAGE,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  absoluteUrl,
  getSiteUrl,
} from "@/lib/seo";

import { Inter_Tight } from "next/font/google";

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: `${SITE_NAME} | Enterprise Social Operations Control Plane`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [...SITE_KEYWORDS],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "technology",
  // Do NOT set a site-wide canonical/OG url here — child routes must own their
  // canonical via buildMetadata(path). A root canonical of "/" would collapse
  // every public page into the homepage for crawlers.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/komenin-robot-256.png", sizes: "256x256", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["id_ID"],
    siteName: SITE_NAME,
    title: `${SITE_NAME} | Enterprise Social Operations Control Plane`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: absoluteUrl(DEFAULT_OG_IMAGE.path),
        width: DEFAULT_OG_IMAGE.width,
        height: DEFAULT_OG_IMAGE.height,
        alt: DEFAULT_OG_IMAGE.alt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | Enterprise Social Operations Control Plane`,
    description: SITE_DESCRIPTION,
    images: [absoluteUrl(DEFAULT_OG_IMAGE.path)],
  },
  robots: {
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
  // Search-console ownership tokens come from env so the repo never bakes a
  // real token into git. Set GOOGLE_SITE_VERIFICATION / BING_SITE_VERIFICATION
  // / TIKTOK_SITE_VERIFICATION when claiming the domain; empty = tag omitted.
  ...(process.env.GOOGLE_SITE_VERIFICATION ||
  process.env.BING_SITE_VERIFICATION ||
  process.env.TIKTOK_SITE_VERIFICATION
    ? {
        verification: {
          ...(process.env.GOOGLE_SITE_VERIFICATION
            ? { google: process.env.GOOGLE_SITE_VERIFICATION }
            : {}),
          ...(process.env.BING_SITE_VERIFICATION || process.env.TIKTOK_SITE_VERIFICATION
            ? {
                other: {
                  ...(process.env.BING_SITE_VERIFICATION
                    ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION }
                    : {}),
                  ...(process.env.TIKTOK_SITE_VERIFICATION
                    ? {
                        "tiktok-developers-site-verification":
                          process.env.TIKTOK_SITE_VERIFICATION,
                      }
                    : {}),
                },
              }
            : {}),
        },
      }
    : {}),
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();

  return (
    <html lang={locale} className={`${interTight.variable} dark`} data-scroll-behavior="smooth">
      <head>
        {process.env.TIKTOK_SITE_VERIFICATION && (
          <meta name="tiktok-developers-site-verification" content={process.env.TIKTOK_SITE_VERIFICATION} />
        )}
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <AppProviders initialLocale={locale}>{children}</AppProviders>
      </body>
    </html>
  );
}
