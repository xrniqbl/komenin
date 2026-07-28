import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsArticle } from "@/components/docs/docs-article";
import { JsonLd } from "@/components/seo/json-ld";
import { getApiPage } from "@/data/docs";
import { getRequestLocale } from "@/lib/i18n/request-locale";
import { breadcrumbJsonLd, buildMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return [{ slug: "worker" }, { slug: "billing" }, { slug: "publish-webhook" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getRequestLocale();
  const page = getApiPage(slug, locale);
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
  const locale = await getRequestLocale();
  const page = getApiPage(slug, locale);
  if (!page || slug === "index") notFound();
  const href = `/docs/api/${slug}`;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Docs", path: "/docs" },
          { name: "API", path: "/docs/api" },
          { name: page.title, path: href },
        ])}
      />
      <DocsArticle page={page} href={href} />
    </>
  );
}
