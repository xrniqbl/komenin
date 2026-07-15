import { CtaBand } from "@/components/marketing/cta-band";
import { FaqSection } from "@/components/marketing/faq-section";
import { HeroSection } from "@/components/marketing/hero-section";
import { HowItWorksSection } from "@/components/marketing/how-it-works-section";
import { PillarsSection } from "@/components/marketing/pillars-section";
import { PricingTeaserSection } from "@/components/marketing/pricing-teaser-section";
import { SecuritySection } from "@/components/marketing/security-section";

export default function HomePage() {
  return (
    <>
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
