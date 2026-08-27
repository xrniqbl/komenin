import { JsonLd } from "@/components/seo/json-ld";
import { billingPlans } from "@/data/pricing";
import {
  breadcrumbJsonLd,
  generatePageMetadata,
  pageSeoFor,
  pricingProductJsonLd,
  webPageJsonLd,
} from "@/lib/seo";
import { getRequestLocale } from "@/lib/i18n/request-locale";

export const generateMetadata = generatePageMetadata.bind(null, "pricing");

export default async function Layout({ children }: { children: React.ReactNode }) {
  const seo = pageSeoFor(await getRequestLocale(), "pricing");
  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd({
            name: seo.title,
            description: seo.description,
            path: seo.path,
          }),
          pricingProductJsonLd(billingPlans),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Pricing", path: "/pricing" },
          ]),
        ]}
      />
      {children}
    </>
  );
}
