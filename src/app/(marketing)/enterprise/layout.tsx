import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import {
  PAGE_SEO,
  breadcrumbJsonLd,
  buildMetadata,
  webPageJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = buildMetadata(PAGE_SEO.enterprise);

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd({
            name: PAGE_SEO.enterprise.title,
            description: PAGE_SEO.enterprise.description,
            path: PAGE_SEO.enterprise.path,
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Enterprise", path: "/enterprise" },
          ]),
        ]}
      />
      {children}
    </>
  );
}
