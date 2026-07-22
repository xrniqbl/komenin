import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { buildMetadata } from "@/lib/seo";
import { requireSuperAdmin } from "@/server/admin";

export const metadata: Metadata = buildMetadata({
  title: "Admin",
  description: "Aether platform control plane.",
  path: "/admin",
  noIndex: true,
});

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();
  return <AdminShell>{children}</AdminShell>;
}
