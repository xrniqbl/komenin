import { CtaBand } from "@/components/marketing/cta-band";
import { FaqSection } from "@/components/marketing/faq-section";
import { HeroSection } from "@/components/marketing/hero-section";
import { HowItWorksSection } from "@/components/marketing/how-it-works-section";
import { PillarsSection } from "@/components/marketing/pillars-section";
import { ProblemSection } from "@/components/marketing/problem-section";
import { PlatformCarousel } from "@/components/marketing/platform-carousel";
import { ProductShowcaseSection } from "@/components/marketing/product-showcase-section";
import { WhyItMatters } from "@/components/marketing/why-it-matters";
import { PricingTeaserSection } from "@/components/marketing/pricing-teaser-section";
import { SecuritySection } from "@/components/marketing/security-section";
import { JsonLd } from "@/components/seo/json-ld";
import { messages } from "@/lib/i18n/messages";
import { getRequestLocale } from "@/lib/i18n/request-locale";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  generatePageMetadata,
  pageSeoFor,
  webPageJsonLd,
} from "@/lib/seo";

export const generateMetadata = generatePageMetadata.bind(null, "home");

export default async function HomePage() {
  const locale = await getRequestLocale();
  const seo = pageSeoFor(locale, "home");
  const faqItems = messages[locale].faq.items;

  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd({
            name: seo.title,
            description: seo.description,
            path: seo.path,
          }),
          faqJsonLd(faqItems),
          breadcrumbJsonLd([{ name: "Home", path: "/" }]),
        ]}
      />
      <HeroSection />
      <PillarsSection />
      <ProblemSection />
      <HowItWorksSection />
      <PlatformCarousel />
      <ProductShowcaseSection />
      <WhyItMatters />
      <SecuritySection />
      <PricingTeaserSection />
      <FaqSection />
      <CtaBand />
    </>
  );
}
