import { notFound } from "next/navigation";
import { DocsArticle } from "@/components/docs/docs-article";
import { getAllTutorialSlugs, getDocsPage } from "@/data/docs";

export function generateStaticParams() {
  return getAllTutorialSlugs().map((slug) => ({ slug }));
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
