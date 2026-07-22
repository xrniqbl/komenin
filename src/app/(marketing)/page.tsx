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
import { PAGE_SEO, buildMetadata, faqJsonLd } from "@/lib/seo";

export const metadata: Metadata = buildMetadata(PAGE_SEO.home);

export default function HomePage() {
  const faqItems = messages.en.faq.items;

  return (
    <>
      <JsonLd data={faqJsonLd(faqItems)} />
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
