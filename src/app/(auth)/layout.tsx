import type { Metadata } from "next";
import { PAGE_SEO, buildMetadata } from "@/lib/seo";

// Auth area defaults; login/signup override more specific titles.
export const metadata: Metadata = buildMetadata({
  ...PAGE_SEO.login,
  noIndex: true,
});

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
