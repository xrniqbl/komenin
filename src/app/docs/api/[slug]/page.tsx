import { notFound } from "next/navigation";
import { DocsArticle } from "@/components/docs/docs-article";
import { getApiPage } from "@/data/docs";

export function generateStaticParams() {
  return [{ slug: "worker" }, { slug: "billing" }, { slug: "publish-webhook" }];
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
