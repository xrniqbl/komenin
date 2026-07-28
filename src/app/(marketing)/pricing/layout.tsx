import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { billingPlans } from "@/data/pricing";
import {
  PAGE_SEO,
  breadcrumbJsonLd,
  buildMetadata,
  pricingProductJsonLd,
  webPageJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = buildMetadata(PAGE_SEO.pricing);

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd({
            name: PAGE_SEO.pricing.title,
            description: PAGE_SEO.pricing.description,
            path: PAGE_SEO.pricing.path,
          }),
          pricingProductJsonLd(billingPlans),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Pricing", path: "/pricing" },
          ]),
        ]}
      />
      {children}
    </>
  );
}
