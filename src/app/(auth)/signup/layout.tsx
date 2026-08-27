import { generatePageMetadata, pageSeoFor } from "@/lib/seo";
import { getRequestLocale } from "@/lib/i18n/request-locale";

export const generateMetadata = generatePageMetadata.bind(null, "signup");

export default async function Layout({ children }: { children: React.ReactNode }) {
  const seo = pageSeoFor(await getRequestLocale(), "signup");
  return children;
}
