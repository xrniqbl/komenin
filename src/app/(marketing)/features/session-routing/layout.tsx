import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import {
  PAGE_SEO,
  breadcrumbJsonLd,
  buildMetadata,
  featureBreadcrumbs,
  webPageJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = buildMetadata(PAGE_SEO.sessionRouting);

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd({
            name: PAGE_SEO.sessionRouting.title,
            description: PAGE_SEO.sessionRouting.description,
            path: PAGE_SEO.sessionRouting.path,
          }),
          breadcrumbJsonLd(
            featureBreadcrumbs("Session Routing", PAGE_SEO.sessionRouting.path),
          ),
        ]}
      />
      {children}
    </>
  );
}
