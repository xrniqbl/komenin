import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsArticle } from "@/components/docs/docs-article";
import { getApiPage } from "@/data/docs";
import { buildMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return [{ slug: "worker" }, { slug: "billing" }, { slug: "publish-webhook" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getApiPage(slug);
  if (!page || slug === "index") return {};
  return buildMetadata({
    title: page.title,
    description: page.description,
    path: `/docs/api/${slug}`,
    type: "article",
  });
}

export default async function DocsApiSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getApiPage(slug);
  if (!page || slug === "index") notFound();
  return <DocsArticle page={page} href={`/docs/api/${slug}`} />;
}
