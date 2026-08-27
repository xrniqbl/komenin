import { buildMetadata, generatePageMetadata, pageSeoFor } from "@/lib/seo";

// noindex page — metadata locale-aware, never indexed either way
export const generateMetadata = async () => {
  const { getRequestLocale } = await import("@/lib/i18n/request-locale");
  const seo = pageSeoFor(await getRequestLocale(), "login");
  return buildMetadata({ ...seo, noIndex: true });
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
