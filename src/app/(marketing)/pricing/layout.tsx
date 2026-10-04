import { JsonLd } from "@/components/seo/json-ld";
import { billingPlans } from "@/data/pricing";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  generatePageMetadata,
  pageSeoFor,
  pricingProductJsonLd,
  webPageJsonLd,
} from "@/lib/seo";
import { getRequestLocale } from "@/lib/i18n/request-locale";
import { messages, type Locale } from "@/lib/i18n/messages";

export const generateMetadata = generatePageMetadata.bind(null, "pricing");

export default async function Layout({ children }: { children: React.ReactNode }) {
  const locale: Locale = await getRequestLocale();
  const seo = pageSeoFor(locale, "pricing");
  const aiFaq = messages[locale].pricingPage.ai.faq;
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
          faqJsonLd(aiFaq.map((item) => ({ q: item.q, a: item.a }))),
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
