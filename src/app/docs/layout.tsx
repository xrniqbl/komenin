import type { Metadata } from "next";
import { DocsMobileNav } from "@/components/docs/docs-mobile-nav";
import { DocsSidebar } from "@/components/docs/docs-sidebar";
import { DocsTopNav } from "@/components/docs/docs-top-nav";
import { JsonLd } from "@/components/seo/json-ld";
import {
  PAGE_SEO,
  breadcrumbJsonLd,
  buildMetadata,
  webPageJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = buildMetadata(PAGE_SEO.docs);

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <JsonLd
        data={[
          webPageJsonLd({
            name: PAGE_SEO.docs.title,
            description: PAGE_SEO.docs.description,
            path: PAGE_SEO.docs.path,
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Documentation", path: "/docs" },
          ]),
        ]}
      />
      <DocsTopNav />
      <DocsMobileNav />
      <div className="mx-auto flex max-w-7xl">
        <aside className="hidden h-[calc(100vh-3.5rem)] w-72 shrink-0 border-r bg-background md:block">
          <DocsSidebar />
        </aside>
        {children}
      </div>
    </div>
  );
}
