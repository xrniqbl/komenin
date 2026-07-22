import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsArticle } from "@/components/docs/docs-article";
import { getAllTutorialSlugs, getDocsPage } from "@/data/docs";
import { buildMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return getAllTutorialSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getDocsPage(slug);
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
  const page = getDocsPage(slug);
  if (!page) notFound();
  return <DocsArticle page={page} href={`/docs/tutorial/${slug}`} />;
}
