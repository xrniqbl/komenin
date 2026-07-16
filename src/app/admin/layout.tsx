import { AdminShell } from "@/components/admin/admin-shell";
import { requireSuperAdmin } from "@/server/admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();
  return <AdminShell>{children}</AdminShell>;
}
