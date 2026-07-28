import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import {
  PAGE_SEO,
  breadcrumbJsonLd,
  buildMetadata,
  featureBreadcrumbs,
  webPageJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = buildMetadata(PAGE_SEO.skillExecution);

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd({
            name: PAGE_SEO.skillExecution.title,
            description: PAGE_SEO.skillExecution.description,
            path: PAGE_SEO.skillExecution.path,
          }),
          breadcrumbJsonLd(
            featureBreadcrumbs("Skill Execution", PAGE_SEO.skillExecution.path),
          ),
        ]}
      />
      {children}
    </>
  );
}
