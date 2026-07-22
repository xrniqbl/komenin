import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { billingPlans } from "@/data/pricing";
import { PAGE_SEO, buildMetadata, pricingProductJsonLd } from "@/lib/seo";

export const metadata: Metadata = buildMetadata(PAGE_SEO.pricing);

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={pricingProductJsonLd(billingPlans)} />
      {children}
    </>
  );
}
