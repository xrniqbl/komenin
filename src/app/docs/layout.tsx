import type { Metadata } from "next";
import { DocsMobileNav } from "@/components/docs/docs-mobile-nav";
import { DocsSidebar } from "@/components/docs/docs-sidebar";
import { DocsTopNav } from "@/components/docs/docs-top-nav";
import { JsonLd } from "@/components/seo/json-ld";
import {
  PAGE_SEO,
  breadcrumbJsonLd,
  buildMetadata,
  organizationJsonLd,
  webPageJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = buildMetadata(PAGE_SEO.docs);

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-marketing relative min-h-screen text-foreground">
      <JsonLd
        data={[
          organizationJsonLd(),
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
      {/* Ambient blue glow to match marketing pages */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(46,124,246,0.12),transparent)]"
      />
      <div className="relative">
        <DocsTopNav />
        <DocsMobileNav />
        <div className="mx-auto flex max-w-7xl">
          <aside className="hidden h-[calc(100vh-3.5rem)] w-72 shrink-0 border-r border-white/10 bg-white/[0.02] backdrop-blur-xl md:sticky md:top-14 md:block">
            <DocsSidebar />
          </aside>
          {children}
        </div>
      </div>
    </div>
  );
}
