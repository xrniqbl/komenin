import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import {
  PAGE_SEO,
  breadcrumbJsonLd,
  buildMetadata,
  webPageJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = buildMetadata(PAGE_SEO.contact);

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd({
            name: PAGE_SEO.contact.title,
            description: PAGE_SEO.contact.description,
            path: PAGE_SEO.contact.path,
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Contact", path: "/contact" },
          ]),
        ]}
      />
      {children}
    </>
  );
}
