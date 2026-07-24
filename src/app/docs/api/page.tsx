import type { Metadata } from "next";
import { DocsArticle } from "@/components/docs/docs-article";
import { getApiPage } from "@/data/docs";
import { getRequestLocale } from "@/lib/i18n/locale";
import { PAGE_SEO, buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata(PAGE_SEO.docsApi);

export default async function DocsApiIndexPage() {
  const locale = await getRequestLocale();
  const page = getApiPage("index", locale);
  return <DocsArticle page={page!} href="/docs/api" />;
}
