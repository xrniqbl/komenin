import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { getRequestLocale } from "@/lib/i18n/request-locale";
import {
  breadcrumbJsonLd,
  generatePageMetadata,
  pageSeoFor,
  featureBreadcrumbs,
  webPageJsonLd,
} from "@/lib/seo";

export const generateMetadata = generatePageMetadata.bind(null, "sessionRouting");

export default async function Layout({ children }: { children: React.ReactNode }) {
  const seo = pageSeoFor(await getRequestLocale(), "sessionRouting");
  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd({
            name: seo.title,
            description: seo.description,
            path: seo.path,
          }),
          breadcrumbJsonLd(
            featureBreadcrumbs("Session Routing", seo.path),
          ),
        ]}
      />
      {children}
    </>
  );
}
