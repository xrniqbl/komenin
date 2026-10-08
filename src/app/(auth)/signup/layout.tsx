import { buildMetadata, generatePageMetadata, pageSeoFor } from "@/lib/seo";

// noindex page — same as login, never indexed either way
export const generateMetadata = async () => {
  const { getRequestLocale } = await import("@/lib/i18n/request-locale");
  const seo = pageSeoFor(await getRequestLocale(), "signup");
  return buildMetadata({ ...seo, noIndex: true });
};

export default async function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
