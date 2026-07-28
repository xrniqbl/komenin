import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import {
  PAGE_SEO,
  breadcrumbJsonLd,
  buildMetadata,
  featuresItemListJsonLd,
  webPageJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = buildMetadata(PAGE_SEO.features);

export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd({
            name: PAGE_SEO.features.title,
            description: PAGE_SEO.features.description,
            path: PAGE_SEO.features.path,
          }),
          featuresItemListJsonLd(),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Features", path: "/features" },
          ]),
        ]}
      />
      {children}
    </>
  );
}
