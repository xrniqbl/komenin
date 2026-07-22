import type { Metadata } from "next";
import { PAGE_SEO, buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata(PAGE_SEO.features);

export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
