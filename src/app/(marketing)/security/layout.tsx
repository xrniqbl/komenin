import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import {
  PAGE_SEO,
  breadcrumbJsonLd,
  buildMetadata,
  webPageJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = buildMetadata(PAGE_SEO.security);

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd({
            name: PAGE_SEO.security.title,
            description: PAGE_SEO.security.description,
            path: PAGE_SEO.security.path,
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Security", path: "/security" },
          ]),
        ]}
      />
      {children}
    </>
  );
}
