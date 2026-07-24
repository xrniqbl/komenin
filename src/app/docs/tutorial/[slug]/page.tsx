import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsArticle } from "@/components/docs/docs-article";
import { JsonLd } from "@/components/seo/json-ld";
import { getAllTutorialSlugs, getDocsPage } from "@/data/docs";
import { getRequestLocale } from "@/lib/i18n/locale";
import { breadcrumbJsonLd, buildMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return getAllTutorialSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getRequestLocale();
  const page = getDocsPage(slug, locale);
  if (!page) return {};
  return buildMetadata({
    title: page.title,
    description: page.description,
    path: `/docs/tutorial/${slug}`,
    type: "article",
  });
}

export default async function DocsTutorialPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = await getRequestLocale();
  const page = getDocsPage(slug, locale);
  if (!page) notFound();
  const href = `/docs/tutorial/${slug}`;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Docs", path: "/docs" },
          { name: page.title, path: href },
        ])}
      />
      <DocsArticle page={page} href={href} />
    </>
  );
}
