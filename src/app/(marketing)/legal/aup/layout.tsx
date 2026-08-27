import { generatePageMetadata } from "@/lib/seo";

export const generateMetadata = generatePageMetadata.bind(null, "aup");

export default async function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
