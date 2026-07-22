import type { Metadata } from "next";
import { DocsArticle } from "@/components/docs/docs-article";
import { getApiPage } from "@/data/docs";
import { PAGE_SEO, buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata(PAGE_SEO.docsApi);

export default function DocsApiIndexPage() {
  const page = getApiPage("index");
  return <DocsArticle page={page!} href="/docs/api" />;
}
