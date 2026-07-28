import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import {
  PAGE_SEO,
  breadcrumbJsonLd,
  buildMetadata,
  featureBreadcrumbs,
  webPageJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = buildMetadata(PAGE_SEO.agentIntelligence);

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd({
            name: PAGE_SEO.agentIntelligence.title,
            description: PAGE_SEO.agentIntelligence.description,
            path: PAGE_SEO.agentIntelligence.path,
          }),
          breadcrumbJsonLd(
            featureBreadcrumbs("Agent Intelligence", PAGE_SEO.agentIntelligence.path),
          ),
        ]}
      />
      {children}
    </>
  );
}
