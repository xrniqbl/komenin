import type { Metadata } from "next";
import { DocsHome } from "@/components/docs/docs-home";
import { PAGE_SEO, buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata(PAGE_SEO.docs);

export default function DocsHomePage() {
  return <DocsHome />;
}
