import type { Metadata } from "next";
import { CtaBand } from "@/components/marketing/cta-band";
import { FaqSection } from "@/components/marketing/faq-section";
import { HeroSection } from "@/components/marketing/hero-section";
import { HowItWorksSection } from "@/components/marketing/how-it-works-section";
import { PillarsSection } from "@/components/marketing/pillars-section";
import { PricingTeaserSection } from "@/components/marketing/pricing-teaser-section";
import { SecuritySection } from "@/components/marketing/security-section";
import { JsonLd } from "@/components/seo/json-ld";
import { messages } from "@/lib/i18n/messages";
import {
  PAGE_SEO,
  breadcrumbJsonLd,
  buildMetadata,
  faqJsonLd,
  webPageJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = buildMetadata(PAGE_SEO.home);

export default function HomePage() {
  const faqItems = messages.en.faq.items;

  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd({
            name: PAGE_SEO.home.title,
            description: PAGE_SEO.home.description,
            path: PAGE_SEO.home.path,
          }),
          faqJsonLd(faqItems),
          breadcrumbJsonLd([{ name: "Home", path: "/" }]),
        ]}
      />
      <HeroSection />
      <PillarsSection />
      <HowItWorksSection />
      <SecuritySection />
      <PricingTeaserSection />
      <FaqSection />
      <CtaBand />
    </>
  );
}
