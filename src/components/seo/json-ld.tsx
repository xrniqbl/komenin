import { jsonLdScript } from "@/lib/seo";

export function JsonLd({
  data,
}: {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
}) {
  return (
    <script
      type="application/ld+json"
      // JSON-LD is static structured data generated server-side.
      dangerouslySetInnerHTML={jsonLdScript(data)}
    />
  );
}
