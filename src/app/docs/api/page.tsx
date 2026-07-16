import { DocsArticle } from "@/components/docs/docs-article";
import { getApiPage } from "@/data/docs";

export default function DocsApiIndexPage() {
  const page = getApiPage("index");
  return <DocsArticle page={page!} href="/docs/api" />;
}
