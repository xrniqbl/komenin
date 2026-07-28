import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import {
  PAGE_SEO,
  breadcrumbJsonLd,
  buildMetadata,
  featureBreadcrumbs,
  webPageJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = buildMetadata(PAGE_SEO.commentEngine);

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd({
            name: PAGE_SEO.commentEngine.title,
            description: PAGE_SEO.commentEngine.description,
            path: PAGE_SEO.commentEngine.path,
          }),
          breadcrumbJsonLd(
            featureBreadcrumbs("Comment Engine", PAGE_SEO.commentEngine.path),
          ),
        ]}
      />
      {children}
    </>
  );
}
