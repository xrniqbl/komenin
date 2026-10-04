import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { getRequestLocale } from "@/lib/i18n/request-locale";
import {
  breadcrumbJsonLd,
  generatePageMetadata,
  pageSeoFor,
  webPageJsonLd,
} from "@/lib/seo";

export const generateMetadata = generatePageMetadata.bind(null, "platformThreads");

export default async function Layout({ children }: { children: React.ReactNode }) {
  const seo = pageSeoFor(await getRequestLocale(), "platformThreads");
  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd({
            name: seo.title,
            description: seo.description,
            path: seo.path,
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Threads", path: "/platform/threads" },
          ]),
        ]}
      />
      {children}
    </>
  );
}
