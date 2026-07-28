import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import {
  PAGE_SEO,
  breadcrumbJsonLd,
  buildMetadata,
  webPageJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = buildMetadata(PAGE_SEO.status);

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd({
            name: PAGE_SEO.status.title,
            description: PAGE_SEO.status.description,
            path: PAGE_SEO.status.path,
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Status", path: "/status" },
          ]),
        ]}
      />
      {children}
    </>
  );
}
